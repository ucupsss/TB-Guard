"""Time-window acoustic event aggregation, review flagging, and dashboard reporting."""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional

import numpy as np

from tb_guard_ml.simulation.nodes import AcousticEvent

logger = logging.getLogger(__name__)


@dataclass
class SiteSummaryReport:
    site_id: str
    window_start_iso: str
    window_end_iso: str
    total_events: int
    cough_event_count: int
    high_confidence_coughs: int
    average_cough_score: float
    degraded_quality_count: int
    active_nodes: List[str]
    flagged_for_human_review: bool
    review_reasons: List[str]
    scientific_disclaimer: str = (
        "TB-Guard Research Prototype: Acoustic event metrics reflect simulated ambient sensor counts. "
        "Acoustic events DO NOT identify individuals, establish disease diagnosis, or confirm TB transmission."
    )

    def to_dict(self) -> dict:
        return asdict(self)


class EventAggregator:
    """Aggregates acoustic events across time windows and sites, flagging anomalies for review."""

    def __init__(
        self,
        high_confidence_threshold: float = 0.70,
        flag_cough_count_threshold: int = 10,
        flag_degraded_ratio_threshold: float = 0.25,
    ):
        self.high_confidence_threshold = high_confidence_threshold
        self.flag_cough_count_threshold = flag_cough_count_threshold
        self.flag_degraded_ratio_threshold = flag_degraded_ratio_threshold

    def aggregate_site_events(
        self,
        site_id: str,
        events: List[AcousticEvent],
        window_start_iso: Optional[str] = None,
        window_end_iso: Optional[str] = None,
    ) -> SiteSummaryReport:
        """Compute aggregated metrics for a specific site over a given collection of events."""
        site_events = [e for e in events if e.site_id == site_id]
        now_iso = datetime.now(timezone.utc).isoformat()
        w_start = window_start_iso or (site_events[0].timestamp if site_events else now_iso)
        w_end = window_end_iso or (site_events[-1].timestamp if site_events else now_iso)

        if not site_events:
            return SiteSummaryReport(
                site_id=site_id,
                window_start_iso=w_start,
                window_end_iso=w_end,
                total_events=0,
                cough_event_count=0,
                high_confidence_coughs=0,
                average_cough_score=0.0,
                degraded_quality_count=0,
                active_nodes=[],
                flagged_for_human_review=False,
                review_reasons=[],
            )

        total = len(site_events)
        cough_events = [e for e in site_events if e.event_type == "cough_event"]
        c_count = len(cough_events)
        high_conf = [e for e in cough_events if e.cough_event_score >= self.high_confidence_threshold]
        high_conf_count = len(high_conf)

        avg_score = float(np.mean([e.cough_event_score for e in cough_events])) if cough_events else 0.0
        degraded = [e for e in site_events if e.quality_status in ["degraded", "clipped"]]
        degraded_count = len(degraded)

        active_nodes = sorted(list({e.node_id for e in site_events}))

        # Evaluate Flagging Criteria
        flagged = False
        reasons: List[str] = []

        if c_count >= self.flag_cough_count_threshold:
            flagged = True
            reasons.append(
                f"Elevated cough frequency: {c_count} events (threshold={self.flag_cough_count_threshold})"
            )

        degraded_ratio = degraded_count / float(total) if total > 0 else 0.0
        if degraded_ratio >= self.flag_degraded_ratio_threshold:
            flagged = True
            reasons.append(
                f"High acoustic degradation: {degraded_ratio * 100:.1f}% degraded audio (threshold={self.flag_degraded_ratio_threshold * 100:.1f}%)"
            )

        report = SiteSummaryReport(
            site_id=site_id,
            window_start_iso=w_start,
            window_end_iso=w_end,
            total_events=total,
            cough_event_count=c_count,
            high_confidence_coughs=high_conf_count,
            average_cough_score=round(avg_score, 4),
            degraded_quality_count=degraded_count,
            active_nodes=active_nodes,
            flagged_for_human_review=flagged,
            review_reasons=reasons,
        )

        return report
