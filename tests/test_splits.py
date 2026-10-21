"""Unit tests for participant-level data splitting and leakage verification."""

import pandas as pd
import pytest

from tb_guard_ml.data.splits import ParticipantSplitter, verify_split_leakage


def test_participant_level_split_isolation():
    """Verify that every recording from any participant is assigned to exactly one split."""
    # Create mock dataset with 12 participants having 3 recordings each
    records = []
    for p_idx in range(12):
        pid = f"PID_{p_idx:02d}"
        target = 1 if p_idx % 2 == 0 else 0
        for r_idx in range(3):
            records.append({
                "recording_id": f"{pid}_rec_{r_idx}",
                "participant_id": pid,
                "target_label": target,
                "exclusion_reason": None,
            })
    df = pd.DataFrame(records)

    splitter = ParticipantSplitter(seed=42, train_ratio=0.6, val_ratio=0.2, test_ratio=0.2)
    split_df, report = splitter.split_manifest(df)

    assert not report.leakage_detected
    assert len(report.overlapping_participants) == 0

    # Verify programmatic leakage check
    is_clean, overlaps = verify_split_leakage(split_df)
    assert is_clean
    assert len(overlaps) == 0

    # Ensure each participant appears in one and only one split
    for pid in df["participant_id"].unique():
        assigned_splits = split_df[split_df["participant_id"] == pid]["split"].unique()
        assert len(assigned_splits) == 1
        assert assigned_splits[0] in ["train", "val", "test"]


def test_leakage_detector_catches_intentional_leakage():
    """Verify verify_split_leakage catches cross-split participant contamination."""
    leaked_data = [
        {"participant_id": "P_01", "split": "train"},
        {"participant_id": "P_02", "split": "val"},
        {"participant_id": "P_01", "split": "test"},  # Contamination! P_01 is in train and test
    ]
    df = pd.DataFrame(leaked_data)
    is_clean, overlaps = verify_split_leakage(df)

    assert not is_clean
    assert "P_01" in overlaps
