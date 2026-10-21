"""Participant-level data splitting with strict isolation and leakage verification."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Dict, List, Optional, Set, Tuple

if TYPE_CHECKING:
    from tb_guard_ml.config import SplitConfig

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class SplitReport:
    total_participants: int
    train_participants: int
    val_participants: int
    test_participants: int
    train_recordings: int
    val_recordings: int
    test_recordings: int
    train_positive_ratio: float
    val_positive_ratio: float
    test_positive_ratio: float
    leakage_detected: bool
    overlapping_participants: List[str]


def verify_split_leakage(df: pd.DataFrame) -> Tuple[bool, List[str]]:
    """Programmatically verify that no participant appears in more than one split.

    Args:
        df: DataFrame containing at least 'participant_id' and 'split' columns.

    Returns:
        (is_leak_free, overlapping_participant_ids)
    """
    valid_splits = ["train", "val", "test"]
    split_pids: Dict[str, Set[str]] = {}

    for s in valid_splits:
        split_pids[s] = set(df[df["split"] == s]["participant_id"].dropna().unique())

    train_val_overlap = split_pids["train"].intersection(split_pids["val"])
    train_test_overlap = split_pids["train"].intersection(split_pids["test"])
    val_test_overlap = split_pids["val"].intersection(split_pids["test"])

    all_overlaps = list(train_val_overlap | train_test_overlap | val_test_overlap)

    if all_overlaps:
        logger.error("DATA LEAKAGE DETECTED! Overlapping participants: %s", all_overlaps)
        return False, all_overlaps

    logger.info("Split verification passed: 0 participant overlap across train, val, and test.")
    return True, []


class ParticipantSplitter:
    """Partitions manifest records by participant_id, guaranteeing 0 participant overlap."""

    def __init__(
        self,
        seed: int = 42,
        train_ratio: float = 0.70,
        val_ratio: float = 0.15,
        test_ratio: float = 0.15,
        stratify: bool = True,
    ):
        r_sum = train_ratio + val_ratio + test_ratio
        if not np.isclose(r_sum, 1.0, atol=1e-3):
            raise ValueError(f"Split ratios must sum to 1.0, got {r_sum}")

        self.seed = seed
        self.train_ratio = train_ratio
        self.val_ratio = val_ratio
        self.test_ratio = test_ratio
        self.stratify = stratify

    def split_manifest(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, SplitReport]:
        """Assign 'split' column to df at participant level."""
        df = df.copy()

        # Only split records that have valid participant_ids and target_labels
        valid_mask = df["participant_id"].notna() & df["target_label"].notna() & (df["exclusion_reason"].isna())
        valid_df = df[valid_mask]

        if len(valid_df) == 0:
            df["split"] = "unassigned"
            report = SplitReport(
                total_participants=0,
                train_participants=0,
                val_participants=0,
                test_participants=0,
                train_recordings=0,
                val_recordings=0,
                test_recordings=0,
                train_positive_ratio=0.0,
                val_positive_ratio=0.0,
                test_positive_ratio=0.0,
                leakage_detected=False,
                overlapping_participants=[],
            )
            return df, report

        # Group by participant to find representative target label
        participant_summary = (
            valid_df.groupby("participant_id")["target_label"]
            .agg(lambda s: s.mode().iloc[0] if not s.empty else 0)
            .reset_index()
        )

        rng = np.random.RandomState(self.seed)

        if self.stratify and participant_summary["target_label"].nunique() > 1:
            # Stratified split at participant level
            train_pids: List[str] = []
            val_pids: List[str] = []
            test_pids: List[str] = []

            for label, group in participant_summary.groupby("target_label"):
                pids = np.array(group["participant_id"].tolist(), dtype=object)
                rng.shuffle(pids)

                n_total = len(pids)
                n_train = int(np.round(n_total * self.train_ratio))
                n_val = int(np.round(n_total * self.val_ratio))
                # Ensure test gets the remainder to cover all
                train_slice = list(pids[:n_train])
                val_slice = list(pids[n_train : n_train + n_val])
                test_slice = list(pids[n_train + n_val :])

                train_pids.extend(train_slice)
                val_pids.extend(val_slice)
                test_pids.extend(test_slice)
        else:
            # Random split at participant level without stratification
            pids = np.array(participant_summary["participant_id"].tolist(), dtype=object)
            rng.shuffle(pids)

            n_total = len(pids)
            n_train = int(np.round(n_total * self.train_ratio))
            n_val = int(np.round(n_total * self.val_ratio))

            train_pids = list(pids[:n_train])
            val_pids = list(pids[n_train : n_train + n_val])
            test_pids = list(pids[n_train + n_val :])

        # Map participant splits back to dataframe
        pid_to_split: Dict[str, str] = {}
        for p in train_pids:
            pid_to_split[p] = "train"
        for p in val_pids:
            pid_to_split[p] = "val"
        for p in test_pids:
            pid_to_split[p] = "test"

        df["split"] = df["participant_id"].map(pid_to_split).fillna("excluded")

        # Verify no leakage
        leak_free, overlaps = verify_split_leakage(df)
        if not leak_free:
            raise RuntimeError(f"Split algorithm produced participant leakage: {overlaps}")

        # Compute summary metrics for report
        train_df = df[df["split"] == "train"]
        val_df = df[df["split"] == "val"]
        test_df = df[df["split"] == "test"]

        train_pos = (train_df["target_label"] == 1).mean() if len(train_df) > 0 else 0.0
        val_pos = (val_df["target_label"] == 1).mean() if len(val_df) > 0 else 0.0
        test_pos = (test_df["target_label"] == 1).mean() if len(test_df) > 0 else 0.0

        report = SplitReport(
            total_participants=participant_summary["participant_id"].nunique(),
            train_participants=len(train_pids),
            val_participants=len(val_pids),
            test_participants=len(test_pids),
            train_recordings=len(train_df),
            val_recordings=len(val_df),
            test_recordings=len(test_df),
            train_positive_ratio=float(train_pos),
            val_positive_ratio=float(val_pos),
            test_positive_ratio=float(test_pos),
            leakage_detected=False,
            overlapping_participants=[],
        )

        return df, report
