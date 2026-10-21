"""CLI demonstration of multi-node acoustic sensor simulation and gateway aggregation."""

import json
import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from tb_guard_ml.simulation.aggregation import EventAggregator
from tb_guard_ml.simulation.gateway import IngestionGateway
from tb_guard_ml.simulation.nodes import NodeFleet

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


def main():
    print("=================================================================")
    print("  TB-GUARD MULTI-NODE ACOUSTIC SIMULATOR DEMO")
    print("=================================================================")

    # Initialize fleet across clinic sites
    fleet = NodeFleet()
    fleet.create_standard_fleet()
    gateway = IngestionGateway(duplicate_window_seconds=0.3)
    aggregator = EventAggregator(high_confidence_threshold=0.70, flag_cough_count_threshold=5)

    print(f"\nDeployed standard fleet with {len(fleet.nodes)} simulated edge nodes:")
    for n_id, node in fleet.nodes.items():
        print(f"  - Node: {n_id:<26} Site: {node.site_id:<18} Baseline Rate: {node.cough_rate_per_minute}/min")

    # 1. Normal Burst
    print("\n[Step 1] Emitting standard acoustic event burst across fleet...")
    burst_events = fleet.emit_fleet_burst(n_events_per_node=3)
    for evt in burst_events:
        res = gateway.ingest_event(evt)
        print(f"  Ingest: {res.event_id:<36} status={res.status:<20} type={evt.event_type:<14} score={evt.cough_event_score:.3f}")

    # 2. Test Duplicate Suppression & Idempotency
    print("\n[Step 2] Testing duplicate event suppression and idempotency...")
    dup_event = burst_events[0]
    dup_res = gateway.ingest_event(dup_event)
    print(f"  Exact Duplicate Submission: event_id={dup_res.event_id} status={dup_res.status} message='{dup_res.message}'")

    # 3. Test High Frequency Surge at Clinic A
    print("\n[Step 3] Simulating acute cough cluster surge at SITE_CLINIC_A...")
    node_a = fleet.nodes["NODE_CLINIC_A_WAITING"]
    for i in range(8):
        # Introduce tiny time pause to avoid immediate echo window suppression
        time.sleep(0.01)
        cough_evt = node_a.generate_event(forced_type="cough_event")
        cough_evt.cough_event_score = 0.92
        gateway.ingest_event(cough_evt)

    # 4. Generate Aggregated Site Summaries
    print("\n[Step 4] Computing site-level aggregated summaries for public-health dashboard...")
    sites = ["SITE_CLINIC_A", "SITE_CLINIC_B", "SITE_COMMUNITY_01"]
    for site_id in sites:
        rep = aggregator.aggregate_site_events(site_id, gateway.accepted_events)
        print(f"\n--- Site: {rep.site_id} ---")
        print(f"  Total Events:          {rep.total_events}")
        print(f"  Cough Events:          {rep.cough_event_count}")
        print(f"  High-Confidence (>=0.7):{rep.high_confidence_coughs}")
        print(f"  Average Cough Score:   {rep.average_cough_score:.4f}")
        print(f"  Degraded Audio Count:  {rep.degraded_quality_count}")
        print(f"  Active Nodes:          {rep.active_nodes}")
        print(f"  Flagged for Review:    {rep.flagged_for_human_review}")
        if rep.review_reasons:
            print(f"  Review Reasons:        {rep.review_reasons}")
        print(f"  Disclaimer:            {rep.scientific_disclaimer[:70]}...")

    print("\nSimulation demo completed successfully.")


if __name__ == "__main__":
    main()
