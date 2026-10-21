"""Training orchestration for TB-Guard baseline classifier."""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from tb_guard_ml.audio.loading import load_audio_file
from tb_guard_ml.audio.preprocessing import AudioPreprocessor
from tb_guard_ml.audio.segmentation import WindowSegmenter
from tb_guard_ml.config import PipelineConfig
from tb_guard_ml.data.manifest import CanonicalManifest
from tb_guard_ml.features.cache import EmbeddingCache
from tb_guard_ml.features.hear_encoder import BaseAudioEncoder, get_encoder
from tb_guard_ml.training.baseline import MajorityClassBaseline, TBGuardBaselineModel
from tb_guard_ml.training.evaluate import evaluate_model

logger = logging.getLogger(__name__)


def extract_features_for_manifest(
    manifest: CanonicalManifest,
    config: PipelineConfig,
    encoder: BaseAudioEncoder,
    cache: EmbeddingCache,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, List[str]]:
    """Extract or load cached embeddings for all accepted records in manifest.

    Returns:
        (X, y, splits, participant_ids)
    """
    df = manifest.df
    preprocessor = AudioPreprocessor(config.audio)
    segmenter = WindowSegmenter(sample_rate=config.audio.sample_rate)

    X_list: List[np.ndarray] = []
    y_list: List[int] = []
    splits_list: List[str] = []
    pids_list: List[str] = []

    for _, row in df.iterrows():
        # Only process records with valid target_label and no exclusion reason
        if pd.isna(row["target_label"]):
            continue
        ex_reason = row.get("exclusion_reason")
        if pd.notna(ex_reason) and str(ex_reason).strip().lower() not in ["", "none", "nan"]:
            continue

        audio_path = Path(row["audio_path"])
        load_res = load_audio_file(audio_path)
        if not load_res.is_valid or load_res.audio is None:
            continue

        prep_res = preprocessor.process(load_res.audio, load_res.sample_rate)
        if not prep_res.is_valid or prep_res.audio is None:
            continue

        rec_id = str(row["recording_id"])
        pid = str(row["participant_id"])
        target_label = int(row["target_label"])
        split = str(row["split"])

        windows = segmenter.segment(
            prep_res.audio,
            recording_id=rec_id,
            participant_id=pid,
            target_label=target_label,
            split=split,
        )

        # Batch encode windows or fetch from cache
        windows_to_encode = []
        indices_to_encode = []

        for idx, win in enumerate(windows):
            fp = EmbeddingCache.compute_fingerprint(win.audio_data.tobytes(), encoder.model_identifier)
            cached_emb = cache.get(win.window_id, fp)
            if cached_emb is not None:
                X_list.append(cached_emb)
                y_list.append(target_label)
                splits_list.append(split)
                pids_list.append(pid)
            else:
                windows_to_encode.append(win)
                indices_to_encode.append((win, fp))

        if windows_to_encode:
            batch_audio = np.stack([w.audio_data for w in windows_to_encode], axis=0)
            embeddings = encoder.encode_batch(batch_audio)

            for (win, fp), emb in zip(indices_to_encode, embeddings):
                cache.put(
                    window_id=win.window_id,
                    fingerprint=fp,
                    embedding=emb,
                    recording_id=win.recording_id,
                    participant_id=win.participant_id,
                    target_label=win.target_label,
                    split=win.split,
                    padding_samples=win.padding_samples,
                )
                X_list.append(emb)
                y_list.append(target_label)
                splits_list.append(split)
                pids_list.append(pid)

    if not X_list:
        raise ValueError("No valid audio windows were extracted or available from manifest.")

    return np.array(X_list), np.array(y_list), np.array(splits_list), pids_list


def find_optimal_threshold(y_val: np.ndarray, val_probs: np.ndarray) -> float:
    """Optimize decision threshold on validation set using Youden's J statistic (Sensitivity + Specificity - 1)."""
    thresholds = np.linspace(0.1, 0.9, 81)
    best_j = -1.0
    best_thresh = 0.5

    for t in thresholds:
        preds = (val_probs >= t).astype(int)
        tp = np.sum((preds == 1) & (y_val == 1))
        fn = np.sum((preds == 0) & (y_val == 1))
        tn = np.sum((preds == 0) & (y_val == 0))
        fp = np.sum((preds == 1) & (y_val == 0))

        sens = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
        j_stat = sens + spec - 1.0

        if j_stat > best_j:
            best_j = j_stat
            best_thresh = float(t)

    logger.info("Validation threshold tuned to %.3f (Youden J = %.3f)", best_thresh, best_j)
    return best_thresh


def train_baseline_pipeline(manifest: CanonicalManifest, config: PipelineConfig) -> Dict[str, Any]:
    """Train baseline pipeline, tune threshold on val, and evaluate on test set."""
    t_start = time.time()
    config.ensure_directories()

    encoder = get_encoder(config.encoder.name, device=config.encoder.device)
    cache = EmbeddingCache(config.encoder.cache_dir, encoder.model_identifier)

    # 1. Extract/Load embeddings
    X, y, splits, pids = extract_features_for_manifest(manifest, config, encoder, cache)
    pids_arr = np.array(pids)

    # 2. Slice splits
    train_mask = splits == "train"
    val_mask = splits == "val"
    test_mask = splits == "test"

    X_train, y_train, pids_train = X[train_mask], y[train_mask], pids_arr[train_mask]
    X_val, y_val, pids_val = X[val_mask], y[val_mask], pids_arr[val_mask]
    X_test, y_test, pids_test = X[test_mask], y[test_mask], pids_arr[test_mask]

    logger.info(
        "Extracted features: Train=%d, Val=%d, Test=%d (dim=%d)",
        len(y_train),
        len(y_val),
        len(y_test),
        X.shape[1],
    )

    # 3. Fit Majority Class Baseline for scientific comparison
    majority_model = MajorityClassBaseline()
    majority_model.fit(X_train, y_train)

    # 4. Fit TB-Guard Baseline Model (Scaler fitted ONLY on Train)
    model = TBGuardBaselineModel(config.classifier)
    model.fit(X_train, y_train)

    # 5. Tune threshold on validation split ONLY
    if len(y_val) > 0 and len(np.unique(y_val)) > 1:
        val_probs = model.predict_proba(X_val)[:, 1]
        best_threshold = find_optimal_threshold(y_val, val_probs)
    else:
        best_threshold = 0.5
        logger.warning("Validation split insufficient for threshold search; default 0.5 used.")

    model.decision_threshold = best_threshold

    # 6. Save trained model
    model_path = config.models_dir / f"{config.experiment_name}_model.joblib"
    model.save(str(model_path))

    # 7. Evaluate on Validation Set
    val_probs = model.predict_proba(X_val)[:, 1] if len(X_val) > 0 else np.array([])
    dataset_type = "SYNTHETIC_SMOKE_TEST" if encoder.is_synthetic_surrogate else "CLINICAL_CODA"

    val_report = None
    if len(y_val) > 0:
        val_report = evaluate_model(
            y_true=y_val,
            y_prob=val_probs,
            participant_ids=pids_val,
            threshold=best_threshold,
            split_name="validation",
            dataset_type=dataset_type,
            threshold_rationale="Validation Youden J optimization",
            output_dir=config.reports_dir,
        )

    # 8. Evaluate on Held-out Test Set (strictly untouched until now!)
    test_probs = model.predict_proba(X_test)[:, 1] if len(X_test) > 0 else np.array([])
    test_report = None
    if len(y_test) > 0:
        test_report = evaluate_model(
            y_true=y_test,
            y_prob=test_probs,
            participant_ids=pids_test,
            threshold=best_threshold,
            split_name="test",
            dataset_type=dataset_type,
            threshold_rationale=f"Frozen threshold {best_threshold:.3f} selected on validation split",
            output_dir=config.reports_dir,
        )

    duration = time.time() - t_start

    return {
        "status": "COMPLETED",
        "duration_seconds": duration,
        "model_path": str(model_path),
        "threshold": best_threshold,
        "is_synthetic": encoder.is_synthetic_surrogate,
        "val_report": val_report.to_dict() if val_report else None,
        "test_report": test_report.to_dict() if test_report else None,
    }
