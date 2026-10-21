"""Unit tests for baseline training, threshold tuning, and evaluation metrics."""

from pathlib import Path
import numpy as np
import pytest

from tb_guard_ml.config import PipelineConfig
from tb_guard_ml.data.adapters import SyntheticDatasetGenerator
from tb_guard_ml.data.splits import ParticipantSplitter
from tb_guard_ml.training.baseline import MajorityClassBaseline, TBGuardBaselineModel
from tb_guard_ml.training.evaluate import compute_metrics, evaluate_model
from tb_guard_ml.training.train import train_baseline_pipeline


def test_majority_class_baseline():
    """Verify majority baseline predicts training class proportion."""
    X = np.random.randn(10, 512)
    y = np.array([0, 0, 0, 0, 0, 0, 0, 1, 1, 1])  # 70% negative

    majority = MajorityClassBaseline()
    majority.fit(X, y)

    assert majority.majority_class == 0
    preds = majority.predict(X)
    assert np.all(preds == 0)


def test_evaluation_metrics_computation():
    """Verify metrics calculation logic with known confusion matrix."""
    y_true = np.array([1, 1, 0, 0])
    y_prob = np.array([0.9, 0.4, 0.2, 0.8])
    pids = np.array(["P1", "P2", "P3", "P4"])

    # At threshold 0.5:
    # Preds: [1, 0, 0, 1]
    # TP = 1 (item 0), FN = 1 (item 1), TN = 1 (item 2), FP = 1 (item 3)
    m = compute_metrics(y_true, y_prob, pids, threshold=0.5)

    assert m.tp == 1
    assert m.fn == 1
    assert m.tn == 1
    assert m.fp == 1
    assert np.isclose(m.sensitivity, 0.5)
    assert np.isclose(m.specificity, 0.5)
    assert np.isclose(m.precision, 0.5)


def test_end_to_end_synthetic_training_pipeline(tmp_path: Path):
    """Smoke test: Run entire training pipeline end-to-end on synthetic data."""
    # 1. Generate small synthetic dataset
    synth_dir = tmp_path / "synthetic"
    gen = SyntheticDatasetGenerator(synth_dir, num_participants=10, recordings_per_participant=(1, 2), random_seed=42)
    manifest = gen.generate()

    # 2. Split dataset at participant level
    splitter = ParticipantSplitter(seed=42, train_ratio=0.6, val_ratio=0.2, test_ratio=0.2)
    split_df, report = splitter.split_manifest(manifest.df)
    manifest._df = split_df
    manifest.save(synth_dir / "manifest.csv")

    # 3. Configure pipeline for synthetic surrogate encoder
    config = PipelineConfig(
        experiment_name="test_smoke_run",
        dataset_root=synth_dir,
        manifest_path=synth_dir / "manifest.csv",
        models_dir=tmp_path / "models",
        reports_dir=tmp_path / "reports",
    )
    config.encoder.name = "hear_synthetic_surrogate"
    config.encoder.cache_dir = tmp_path / "cache"

    # 4. Train pipeline
    results = train_baseline_pipeline(manifest, config)

    assert results["status"] == "COMPLETED"
    assert Path(results["model_path"]).exists()
    assert 0.0 < results["threshold"] < 1.0
    assert results["is_synthetic"] is True

    # Check that evaluation reports were written
    assert (tmp_path / "reports" / "eval_report_test.json").exists()
    assert (tmp_path / "reports" / "eval_report_test.md").exists()
