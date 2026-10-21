"""Quality-control reporting and audio distribution diagnostics for TB-Guard."""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class QualityControlReport:
    total_audio_records: int
    accepted_files: int
    rejected_files: int
    acceptance_rate: float
    unique_participants: int
    exclusion_reasons: Dict[str, int]
    sample_rate_distribution: Dict[int, int]
    duration_stats: Dict[str, float]
    target_class_distribution: Dict[str, int]
    split_distribution: Dict[str, int]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_markdown(self) -> str:
        """Render readable markdown QC summary."""
        lines = [
            "# TB-Guard Audio Pipeline Quality Control Report",
            "",
            "## Summary",
            f"- **Total Audio Records Processed:** {self.total_audio_records}",
            f"- **Accepted Files:** {self.accepted_files} ({self.acceptance_rate * 100:.1f}%)",
            f"- **Rejected Files:** {self.rejected_files} ({(1.0 - self.acceptance_rate) * 100:.1f}%)",
            f"- **Unique Participants:** {self.unique_participants}",
            "",
            "## Exclusion Reasons Breakdown",
        ]
        if self.exclusion_reasons:
            for reason, count in sorted(self.exclusion_reasons.items(), key=lambda x: x[1], reverse=True):
                lines.append(f"- `{reason}`: {count}")
        else:
            lines.append("- *No files were excluded.*")

        lines.extend([
            "",
            "## Sample Rate Distribution",
        ])
        for sr, count in sorted(self.sample_rate_distribution.items()):
            lines.append(f"- **{sr} Hz:** {count} files")

        lines.extend([
            "",
            "## Duration Statistics (seconds)",
            f"- **Min:** {self.duration_stats.get('min', 0.0):.2f}s",
            f"- **Mean:** {self.duration_stats.get('mean', 0.0):.2f}s",
            f"- **Median:** {self.duration_stats.get('median', 0.0):.2f}s",
            f"- **Max:** {self.duration_stats.get('max', 0.0):.2f}s",
            "",
            "## Class & Split Distribution",
            "### Target Class",
        ])
        for cls_name, count in self.target_class_distribution.items():
            lines.append(f"- `Class {cls_name}`: {count}")

        lines.append("### Split")
        for split_name, count in self.split_distribution.items():
            lines.append(f"- `{split_name}`: {count}")

        return "\n".join(lines)


def generate_qc_report(df: pd.DataFrame, output_dir: Optional[str | Path] = None) -> QualityControlReport:
    """Generate QC report from manifest DataFrame and optionally save to disk."""
    total = len(df)
    if total == 0:
        rep = QualityControlReport(
            total_audio_records=0,
            accepted_files=0,
            rejected_files=0,
            acceptance_rate=0.0,
            unique_participants=0,
            exclusion_reasons={},
            sample_rate_distribution={},
            duration_stats={"min": 0.0, "mean": 0.0, "median": 0.0, "max": 0.0},
            target_class_distribution={},
            split_distribution={},
        )
    else:
        accepted = int((df["preprocessing_status"] == "accepted").sum())
        rejected = int(total - accepted)
        acc_rate = float(accepted / total)
        pids = int(df["participant_id"].nunique())

        # Exclusions
        ex_series = df["exclusion_reason"].dropna()
        exclusion_reasons = {str(k): int(v) for k, v in ex_series.value_counts().items()}

        # Sample rates
        sr_dist = {int(k): int(v) for k, v in df["original_sample_rate"].value_counts().items() if pd.notna(k)}

        # Durations
        dur = df["duration_seconds"].dropna()
        if len(dur) > 0:
            duration_stats = {
                "min": float(dur.min()),
                "mean": float(dur.mean()),
                "median": float(dur.median()),
                "max": float(dur.max()),
            }
        else:
            duration_stats = {"min": 0.0, "mean": 0.0, "median": 0.0, "max": 0.0}

        # Target class
        target_dist = {str(k): int(v) for k, v in df["target_label"].value_counts(dropna=False).items()}
        split_dist = {str(k): int(v) for k, v in df["split"].value_counts().items()}

        rep = QualityControlReport(
            total_audio_records=total,
            accepted_files=accepted,
            rejected_files=rejected,
            acceptance_rate=acc_rate,
            unique_participants=pids,
            exclusion_reasons=exclusion_reasons,
            sample_rate_distribution=sr_dist,
            duration_stats=duration_stats,
            target_class_distribution=target_dist,
            split_distribution=split_dist,
        )

    if output_dir:
        out_p = Path(output_dir)
        out_p.mkdir(parents=True, exist_ok=True)
        # Save JSON
        json_path = out_p / "qc_report.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(rep.to_dict(), f, indent=2)
        # Save Markdown
        md_path = out_p / "qc_report.md"
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(rep.to_markdown())
        logger.info("Saved QC reports to %s and %s", json_path, md_path)

    return rep
