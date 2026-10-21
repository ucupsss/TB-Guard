"""Simulated acoustic sensor nodes generating streaming events."""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class AcousticEvent:
    event_id: str
    node_id: str
    site_id: str
    timestamp: str  # ISO-8601 UTC
    event_type: str  # "cough_event", "speech", "ambient_noise"
    cough_event_score: float  # 0.0 - 1.0 confidence score
    quality_status: str = "good"  # "good", "degraded", "clipped"
    model_version: str = "hear_detector_v1"
    processing_status: str = "raw"  # "raw", "processed", "flagged"
    correlation_id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def to_dict(self) -> dict:
        return asdict(self)

    def validate(self) -> None:
        """Validate event schema and bounds."""
        if not self.event_id or not self.node_id or not self.site_id:
            raise ValueError("event_id, node_id, and site_id must be non-empty strings")
        if not (0.0 <= self.cough_event_score <= 1.0):
            raise ValueError(f"cough_event_score must be between 0.0 and 1.0, got {self.cough_event_score}")
        if self.event_type not in ["cough_event", "speech", "ambient_noise"]:
            raise ValueError(f"Unsupported event_type: {self.event_type}")
        if self.quality_status not in ["good", "degraded", "clipped"]:
            raise ValueError(f"Unsupported quality_status: {self.quality_status}")


class SimulatedAcousticNode:
    """Represents an edge acoustic sensor deployed at a specific clinic site/zone."""

    def __init__(
        self,
        node_id: str,
        site_id: str,
        cough_rate_per_minute: float = 2.0,
        random_seed: Optional[int] = None,
    ):
        self.node_id = node_id
        self.site_id = site_id
        self.cough_rate_per_minute = cough_rate_per_minute
        self.rng = np.random.RandomState(random_seed)
        self.last_heartbeat = time.time()
        self.events_emitted = 0

    def generate_event(
        self,
        forced_type: Optional[str] = None,
        forced_timestamp: Optional[str] = None,
    ) -> AcousticEvent:
        """Synthesize a single acoustic event."""
        now_iso = forced_timestamp or datetime.now(timezone.utc).isoformat()
        self.last_heartbeat = time.time()
        self.events_emitted += 1

        if forced_type:
            event_type = forced_type
        else:
            # 60% cough_event, 25% speech, 15% ambient_noise
            event_type = str(self.rng.choice(["cough_event", "speech", "ambient_noise"], p=[0.60, 0.25, 0.15]))

        # Generate realistic model confidence scores based on event type
        if event_type == "cough_event":
            score = float(self.rng.beta(8, 2))  # Biased high (e.g. 0.70 - 0.98)
        elif event_type == "speech":
            score = float(self.rng.beta(2, 6))  # Low (e.g. 0.10 - 0.35)
        else:
            score = float(self.rng.beta(1, 9))  # Very low (e.g. 0.02 - 0.15)

        # Quality status
        q_rand = self.rng.rand()
        if q_rand < 0.88:
            quality = "good"
        elif q_rand < 0.96:
            quality = "degraded"
        else:
            quality = "clipped"

        event = AcousticEvent(
            event_id=f"EVT_{self.node_id}_{int(time.time() * 1000)}_{self.events_emitted:04d}",
            node_id=self.node_id,
            site_id=self.site_id,
            timestamp=now_iso,
            event_type=event_type,
            cough_event_score=round(score, 4),
            quality_status=quality,
            model_version="hear_detector_v1",
            processing_status="raw",
        )
        event.validate()
        return event


class NodeFleet:
    """Manages a fleet of simulated acoustic sensor nodes across public health monitoring sites."""

    def __init__(self):
        self.nodes: Dict[str, SimulatedAcousticNode] = {}

    def add_node(self, node: SimulatedAcousticNode) -> None:
        self.nodes[node.node_id] = node

    def create_standard_fleet(self) -> None:
        """Create standard test fleet across multiple simulated clinic zones."""
        configs = [
            ("NODE_CLINIC_A_WAITING", "SITE_CLINIC_A", 4.0, 101),
            ("NODE_CLINIC_A_TRIAGE", "SITE_CLINIC_A", 1.5, 102),
            ("NODE_CLINIC_B_CONSULT", "SITE_CLINIC_B", 2.0, 103),
            ("NODE_COMMUNITY_HUB_01", "SITE_COMMUNITY_01", 3.2, 104),
        ]
        for node_id, site_id, rate, seed in configs:
            self.add_node(SimulatedAcousticNode(node_id, site_id, rate, seed))

    def emit_fleet_burst(self, n_events_per_node: int = 3) -> List[AcousticEvent]:
        """Trigger an event burst across all active nodes in the fleet."""
        events = []
        for node in self.nodes.values():
            for _ in range(n_events_per_node):
                events.append(node.generate_event())
        return events
