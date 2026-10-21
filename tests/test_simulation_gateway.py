"""Unit tests for multi-node event simulation, gateway deduplication, and aggregation."""

import time
import pytest

from tb_guard_ml.simulation.aggregation import EventAggregator
from tb_guard_ml.simulation.gateway import IngestionGateway
from tb_guard_ml.simulation.nodes import AcousticEvent, SimulatedAcousticNode


def test_acoustic_event_validation():
    """Verify event schema bounds and validation."""
    valid_event = AcousticEvent(
        event_id="EVT_01",
        node_id="NODE_01",
        site_id="SITE_A",
        timestamp="2026-10-21T12:00:00Z",
        event_type="cough_event",
        cough_event_score=0.85,
    )
    valid_event.validate()  # Should not raise

    # Invalid score > 1.0
    with pytest.raises(ValueError, match="cough_event_score"):
        bad_score = AcousticEvent(
            event_id="EVT_02",
            node_id="NODE_01",
            site_id="SITE_A",
            timestamp="2026-10-21T12:00:00Z",
            event_type="cough_event",
            cough_event_score=1.5,
        )
        bad_score.validate()

    # Invalid event_type
    with pytest.raises(ValueError, match="event_type"):
        bad_type = AcousticEvent(
            event_id="EVT_03",
            node_id="NODE_01",
            site_id="SITE_A",
            timestamp="2026-10-21T12:00:00Z",
            event_type="gunshot_sound",  # Unsupported
            cough_event_score=0.5,
        )
        bad_type.validate()


def test_gateway_duplicate_suppression_and_idempotency():
    """Verify gateway idempotency and rapid duplicate suppression."""
    gateway = IngestionGateway(duplicate_window_seconds=0.2)
    node = SimulatedAcousticNode(node_id="NODE_01", site_id="SITE_CLINIC_A")

    evt = node.generate_event(forced_type="cough_event")

    # First ingestion -> ACCEPTED
    res1 = gateway.ingest_event(evt)
    assert res1.accepted
    assert res1.status == "ACCEPTED"

    # Second ingestion of identical event_id -> DUPLICATE_SUPPRESSED
    res2 = gateway.ingest_event(evt)
    assert not res2.accepted
    assert res2.status == "DUPLICATE_SUPPRESSED"


def test_site_aggregation_and_human_review_flagging():
    """Verify time-window site aggregation and automated review triggers."""
    aggregator = EventAggregator(
        high_confidence_threshold=0.70,
        flag_cough_count_threshold=3,
        flag_degraded_ratio_threshold=0.25,
    )

    events = [
        AcousticEvent("E1", "N1", "SITE_A", "2026-10-21T10:00:00Z", "cough_event", 0.85, "good"),
        AcousticEvent("E2", "N1", "SITE_A", "2026-10-21T10:01:00Z", "cough_event", 0.90, "good"),
        AcousticEvent("E3", "N2", "SITE_A", "2026-10-21T10:02:00Z", "cough_event", 0.75, "good"),
        AcousticEvent("E4", "N2", "SITE_A", "2026-10-21T10:03:00Z", "speech", 0.15, "good"),
        AcousticEvent("E5", "N3", "SITE_B", "2026-10-21T10:00:00Z", "speech", 0.10, "good"),
    ]

    report_a = aggregator.aggregate_site_events("SITE_A", events)
    assert report_a.total_events == 4
    assert report_a.cough_event_count == 3
    assert report_a.high_confidence_coughs == 3
    assert report_a.active_nodes == ["N1", "N2"]
    # 3 coughs reaches threshold 3 -> flagged
    assert report_a.flagged_for_human_review is True
    assert any("cough frequency" in r.lower() for r in report_a.review_reasons)

    report_b = aggregator.aggregate_site_events("SITE_B", events)
    assert report_b.total_events == 1
    assert report_b.cough_event_count == 0
    assert report_b.flagged_for_human_review is False
