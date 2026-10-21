"""Edge-to-cloud ingestion gateway with deduplication and structured telemetry."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple

from tb_guard_ml.simulation.nodes import AcousticEvent

logger = logging.getLogger(__name__)


@dataclass
class GatewayIngestResult:
    accepted: bool
    event_id: str
    status: str  # "ACCEPTED", "DUPLICATE_SUPPRESSED", "VALIDATION_FAILED"
    correlation_id: str
    message: str


@dataclass
class NodeHealthInfo:
    node_id: str
    site_id: str
    last_seen_iso: str
    total_events_received: int
    is_active: bool  # active if seen within heartbeat timeout


class IngestionGateway:
    """Ingestion gateway providing validation, idempotency, duplicate suppression, and health tracking."""

    def __init__(
        self,
        duplicate_window_seconds: float = 0.5,
        node_heartbeat_timeout_seconds: float = 60.0,
    ):
        self.duplicate_window_seconds = duplicate_window_seconds
        self.node_heartbeat_timeout_seconds = node_heartbeat_timeout_seconds

        self._seen_event_ids: Set[str] = set()
        self._accepted_events: List[AcousticEvent] = []
        self._node_registry: Dict[str, NodeHealthInfo] = {}
        # Keep track of last event timestamp per node to suppress echo duplicates
        self._node_last_event_time: Dict[str, float] = {}

    @property
    def accepted_events(self) -> List[AcousticEvent]:
        return self._accepted_events

    def ingest_event(self, event_dict_or_obj: dict | AcousticEvent) -> GatewayIngestResult:
        """Validate, deduplicate, and ingest an incoming acoustic event."""
        # Parse & Validate
        if isinstance(event_dict_or_obj, dict):
            try:
                event = AcousticEvent(**event_dict_or_obj)
            except Exception as e:
                corr_id = event_dict_or_obj.get("correlation_id", "UNKNOWN")
                logger.warning("[corr_id=%s] Schema validation failed: %s", corr_id, e)
                return GatewayIngestResult(
                    accepted=False,
                    event_id=event_dict_or_obj.get("event_id", "INVALID"),
                    status="VALIDATION_FAILED",
                    correlation_id=corr_id,
                    message=f"Schema validation error: {e}",
                )
        else:
            event = event_dict_or_obj

        try:
            event.validate()
        except ValueError as e:
            logger.warning("[corr_id=%s] Event validation failed: %s", event.correlation_id, e)
            return GatewayIngestResult(
                accepted=False,
                event_id=event.event_id,
                status="VALIDATION_FAILED",
                correlation_id=event.correlation_id,
                message=str(e),
            )

        # 1. Idempotency Check: Exact Event ID duplicate
        if event.event_id in self._seen_event_ids:
            logger.info(
                "[corr_id=%s] Suppressed exact duplicate event_id=%s from node=%s",
                event.correlation_id,
                event.event_id,
                event.node_id,
            )
            return GatewayIngestResult(
                accepted=False,
                event_id=event.event_id,
                status="DUPLICATE_SUPPRESSED",
                correlation_id=event.correlation_id,
                message="Exact event_id already received (idempotent rejection)",
            )

        # 2. Windowed Echo Suppression: Rapid identical triggers from the same node
        current_mono_time = time.monotonic()
        last_time = self._node_last_event_time.get(event.node_id, 0.0)
        time_diff = current_mono_time - last_time

        if time_diff < self.duplicate_window_seconds and event.event_type == "cough_event":
            logger.info(
                "[corr_id=%s] Rapid successive trigger (%.3fs < %.3fs) on node=%s; suppressed as echo duplicate",
                event.correlation_id,
                time_diff,
                self.duplicate_window_seconds,
                event.node_id,
            )
            return GatewayIngestResult(
                accepted=False,
                event_id=event.event_id,
                status="DUPLICATE_SUPPRESSED",
                correlation_id=event.correlation_id,
                message=f"Suppressed rapid echo duplicate ({time_diff:.3f}s delta)",
            )

        # Accept event
        self._seen_event_ids.add(event.event_id)
        self._node_last_event_time[event.node_id] = current_mono_time
        event.processing_status = "processed"
        self._accepted_events.append(event)

        # Update Node Health Registry
        now_iso = datetime.now(timezone.utc).isoformat()
        if event.node_id not in self._node_registry:
            self._node_registry[event.node_id] = NodeHealthInfo(
                node_id=event.node_id,
                site_id=event.site_id,
                last_seen_iso=now_iso,
                total_events_received=1,
                is_active=True,
            )
        else:
            info = self._node_registry[event.node_id]
            info.last_seen_iso = now_iso
            info.total_events_received += 1
            info.is_active = True

        logger.info(
            "[corr_id=%s] Ingested event_id=%s type=%s score=%.3f from node=%s site=%s",
            event.correlation_id,
            event.event_id,
            event.event_type,
            event.cough_event_score,
            event.node_id,
            event.site_id,
        )

        return GatewayIngestResult(
            accepted=True,
            event_id=event.event_id,
            status="ACCEPTED",
            correlation_id=event.correlation_id,
            message="Event ingested successfully",
        )

    def get_node_health(self) -> List[NodeHealthInfo]:
        """Return status for all known nodes."""
        return list(self._node_registry.values())
