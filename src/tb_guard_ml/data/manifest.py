"""Canonical manifest definition and validation for TB-Guard."""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import List, Optional

import pandas as pd

logger = logging.getLogger(__name__)

CANONICAL_COLUMNS = [
    "recording_id",
    "participant_id",
    "audio_path",
    "source_dataset",
    "original_sample_rate",
    "duration_seconds",
    "original_label",
    "target_label",
    "label_source",
    "split",
    "preprocessing_status",
    "exclusion_reason",
]


@dataclass
class ManifestRecord:
    recording_id: str
    participant_id: str
    audio_path: str
    source_dataset: str
    original_sample_rate: int
    duration_seconds: float
    original_label: str
    target_label: Optional[int]
    label_source: str
    split: str = "unassigned"  # "train", "val", "test", "unassigned", "excluded"
    preprocessing_status: str = "pending"  # "pending", "accepted", "rejected"
    exclusion_reason: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


class CanonicalManifest:
    """Manages the canonical dataset manifest."""

    def __init__(self, records: Optional[List[ManifestRecord]] = None, df: Optional[pd.DataFrame] = None):
        if df is not None:
            self._df = df.copy()
            self.validate_schema()
        elif records is not None:
            data = [r.to_dict() for r in records]
            self._df = pd.DataFrame(data)
            self.validate_schema()
        else:
            self._df = pd.DataFrame(columns=CANONICAL_COLUMNS)

    @property
    def df(self) -> pd.DataFrame:
        return self._df

    def validate_schema(self) -> None:
        """Ensure all required canonical columns exist and data types are coherent."""
        missing = [col for col in CANONICAL_COLUMNS if col not in self._df.columns]
        if missing:
            raise ValueError(f"Manifest missing required canonical columns: {missing}")

    def save(self, output_path: str | Path) -> None:
        """Save canonical manifest to CSV."""
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.validate_schema()
        self._df.to_csv(path, index=False)
        logger.info("Saved canonical manifest with %d records to %s", len(self._df), path)

    @classmethod
    def load(cls, manifest_path: str | Path) -> CanonicalManifest:
        """Load manifest from CSV."""
        path = Path(manifest_path)
        if not path.exists():
            raise FileNotFoundError(f"Manifest file does not exist: {path}")
        df = pd.read_csv(path)
        # Ensure target_label is Int64 (nullable int)
        if "target_label" in df.columns:
            df["target_label"] = pd.to_numeric(df["target_label"], errors="coerce").astype("Int64")
        return cls(df=df)

    def summary(self) -> dict:
        """Generate high-level summary of manifest contents."""
        total = len(self._df)
        if total == 0:
            return {"total_records": 0, "participants": 0}

        accepted = (self._df["preprocessing_status"] == "accepted").sum()
        rejected = (self._df["preprocessing_status"] == "rejected").sum()
        splits = self._df["split"].value_counts().to_dict()
        sources = self._df["source_dataset"].value_counts().to_dict()
        unique_participants = self._df["participant_id"].nunique()
        target_dist = self._df["target_label"].value_counts(dropna=False).to_dict()

        return {
            "total_records": int(total),
            "unique_participants": int(unique_participants),
            "accepted_records": int(accepted),
            "rejected_records": int(rejected),
            "splits": splits,
            "sources": sources,
            "target_distribution": {str(k): int(v) for k, v in target_dist.items()},
        }
