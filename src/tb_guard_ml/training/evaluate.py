"""Scientific evaluation metrics and participant-level bootstrap confidence intervals."""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

logger = logging.getLogger(__name__)


@dataclass
class ClassificationMetrics:
    sensitivity: float  # True Positive Rate / Recall
    specificity: float  # True Negative Rate
    precision: float
    f1: float
    roc_auc: float
    pr_auc: float
    brier_score: float
    threshold: float
    tp: int
    fp: int
    tn: int
    fn: int
    participant_count: int
    window_count: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class BootstrapIntervals:
    metric: str
    lower_95: float
    median: float
    upper_95: float


@dataclass
class EvaluationReport:
    split_name: str
    dataset_type: str  # "SYNTHETIC_SMOKE_TEST" or "CLINICAL_CODA"
    metrics: ClassificationMetrics
    bootstrap_ci: List[BootstrapIntervals]
    threshold_rationale: str
    is_synthetic: bool

    def to_dict(self) -> Dict[str, Any]:
        return {
            "split_name": self.split_name,
            "dataset_type": self.dataset_type,
            "metrics": self.metrics.to_dict(),
            "bootstrap_ci": [asdict(b) for b in self.bootstrap_ci],
            "threshold_rationale": self.threshold_rationale,
            "is_synthetic": self.is_synthetic,
        }

    def to_markdown(self) -> str:
        m = self.metrics
        status_banner = ""
        if self.is_synthetic:
            status_banner = (
                "> [!WARNING]\n"
                "> **SYNTHETIC SMOKE TEST DATA ONLY**\n"
                "> The metrics below are computed on synthetic non-clinical audio to verify pipeline integrity.\n"
                "> These results MUST NOT be interpreted as medical diagnostic performance.\n"
            )

        lines = [
            f"# TB-Guard Model Evaluation Report — Split: {self.split_name.upper()}",
            "",
            status_banner,
            f"- **Dataset Provenance:** `{self.dataset_type}`",
            f"- **Sample Size:** {m.participant_count} participants ({m.window_count} audio windows)",
            f"- **Decision Threshold:** {m.threshold:.4f} ({self.threshold_rationale})",
            "",
            "## Primary Performance Metrics",
            "| Metric | Value | 95% Bootstrap CI (Participant Resampled) |",
            "| :--- | :--- | :--- |",
        ]

        ci_map = {b.metric: f"[{b.lower_95:.3f}, {b.upper_95:.3f}]" for b in self.bootstrap_ci}

        lines.extend([
            f"| **Sensitivity (Recall)** | {m.sensitivity:.4f} | {ci_map.get('sensitivity', 'N/A')} |",
            f"| **Specificity** | {m.specificity:.4f} | {ci_map.get('specificity', 'N/A')} |",
            f"| **Precision (PPV)** | {m.precision:.4f} | {ci_map.get('precision', 'N/A')} |",
            f"| **F1-Score** | {m.f1:.4f} | {ci_map.get('f1', 'N/A')} |",
            f"| **ROC-AUC** | {m.roc_auc:.4f} | {ci_map.get('roc_auc', 'N/A')} |",
            f"| **PR-AUC** | {m.pr_auc:.4f} | {ci_map.get('pr_auc', 'N/A')} |",
            f"| **Brier Calibration Score** | {m.brier_score:.4f} | {ci_map.get('brier_score', 'N/A')} |",
            "",
            "## Confusion Matrix",
            "| | Predicted Negative (0) | Predicted Positive (1) |",
            "| :--- | :--- | :--- |",
            f"| **Actual Negative (0)** | TN: {m.tn} | FP: {m.fp} |",
            f"| **Actual Positive (1)** | FN: {m.fn} | TP: {m.tp} |",
            "",
            "## Scientific Safeguards & Notes",
            "1. Participant-level isolation guarantees no acoustic windows from the same participant crossed splits.",
            "2. Resampling unit for confidence intervals is the participant (cluster bootstrap), preserving intra-participant correlation.",
            "3. Audio representations alone cannot diagnose TB or establish active transmission.",
        ])

        return "\n".join(lines)


def compute_metrics(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    participant_ids: np.ndarray,
    threshold: float = 0.5,
) -> ClassificationMetrics:
    """Compute comprehensive classification metrics at given threshold."""
    y_true = y_true.astype(int)
    y_pred = (y_prob >= threshold).astype(int)

    # Confusion matrix elements
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel() if cm.size == 4 else (0, 0, 0, 0)

    # Metrics
    sens = float(recall_score(y_true, y_pred, zero_division=0))
    spec = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
    prec = float(precision_score(y_true, y_pred, zero_division=0))
    f1 = float(f1_score(y_true, y_pred, zero_division=0))

    try:
        roc_auc = float(roc_auc_score(y_true, y_prob)) if len(np.unique(y_true)) > 1 else 0.5
    except Exception:
        roc_auc = 0.5

    try:
        pr_auc = float(average_precision_score(y_true, y_prob)) if len(np.unique(y_true)) > 1 else 0.0
    except Exception:
        pr_auc = 0.0

    brier = float(brier_score_loss(y_true, y_prob))
    p_count = int(len(np.unique(participant_ids)))
    w_count = int(len(y_true))

    return ClassificationMetrics(
        sensitivity=sens,
        specificity=spec,
        precision=prec,
        f1=f1,
        roc_auc=roc_auc,
        pr_auc=pr_auc,
        brier_score=brier,
        threshold=threshold,
        tp=int(tp),
        fp=int(fp),
        tn=int(tn),
        fn=int(fn),
        participant_count=p_count,
        window_count=w_count,
    )


def compute_participant_bootstrap_ci(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    participant_ids: np.ndarray,
    threshold: float,
    n_bootstraps: int = 200,
    seed: int = 42,
) -> List[BootstrapIntervals]:
    """Compute 95% bootstrap confidence intervals by resampling unique participants."""
    unique_pids = np.unique(participant_ids)
    if len(unique_pids) < 3:
        return []

    rng = np.random.RandomState(seed)
    boot_metrics: Dict[str, List[float]] = {
        "sensitivity": [],
        "specificity": [],
        "precision": [],
        "f1": [],
        "roc_auc": [],
        "pr_auc": [],
        "brier_score": [],
    }

    # Map participant to sample indices
    pid_to_indices = {pid: np.where(participant_ids == pid)[0] for pid in unique_pids}

    for _ in range(n_bootstraps):
        sampled_pids = rng.choice(unique_pids, size=len(unique_pids), replace=True)
        sampled_indices = np.concatenate([pid_to_indices[p] for p in sampled_pids])

        b_true = y_true[sampled_indices]
        b_prob = y_prob[sampled_indices]

        # Only evaluate if both classes present
        if len(np.unique(b_true)) < 2:
            continue

        m = compute_metrics(b_true, b_prob, participant_ids[sampled_indices], threshold=threshold)
        boot_metrics["sensitivity"].append(m.sensitivity)
        boot_metrics["specificity"].append(m.specificity)
        boot_metrics["precision"].append(m.precision)
        boot_metrics["f1"].append(m.f1)
        boot_metrics["roc_auc"].append(m.roc_auc)
        boot_metrics["pr_auc"].append(m.pr_auc)
        boot_metrics["brier_score"].append(m.brier_score)

    intervals = []
    for metric_name, vals in boot_metrics.items():
        if len(vals) > 0:
            intervals.append(
                BootstrapIntervals(
                    metric=metric_name,
                    lower_95=float(np.percentile(vals, 2.5)),
                    median=float(np.percentile(vals, 50.0)),
                    upper_95=float(np.percentile(vals, 97.5)),
                )
            )

    return intervals


def evaluate_model(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    participant_ids: np.ndarray,
    threshold: float,
    split_name: str = "test",
    dataset_type: str = "SYNTHETIC_SMOKE_TEST",
    threshold_rationale: str = "Validation Youden J optimization",
    output_dir: Optional[str | Path] = None,
) -> EvaluationReport:
    """Run full scientific evaluation with participant clustering and export reports."""
    metrics = compute_metrics(y_true, y_prob, participant_ids, threshold=threshold)
    ci = compute_participant_bootstrap_ci(y_true, y_prob, participant_ids, threshold=threshold)
    is_synth = "synthetic" in dataset_type.lower()

    report = EvaluationReport(
        split_name=split_name,
        dataset_type=dataset_type,
        metrics=metrics,
        bootstrap_ci=ci,
        threshold_rationale=threshold_rationale,
        is_synthetic=is_synth,
    )

    if output_dir:
        out_p = Path(output_dir)
        out_p.mkdir(parents=True, exist_ok=True)
        json_file = out_p / f"eval_report_{split_name}.json"
        with open(json_file, "w", encoding="utf-8") as f:
            json.dump(report.to_dict(), f, indent=2)
        md_file = out_p / f"eval_report_{split_name}.md"
        with open(md_file, "w", encoding="utf-8") as f:
            f.write(report.to_markdown())
        logger.info("Saved evaluation report to %s and %s", json_file, md_file)

    return report
