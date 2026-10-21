"""Main CLI pipeline runner for TB-Guard: discovery, splitting, caching, and baseline training."""

import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from tb_guard_ml.audio.loading import load_audio_file
from tb_guard_ml.audio.preprocessing import AudioPreprocessor
from tb_guard_ml.audio.quality import generate_qc_report
from tb_guard_ml.config import PipelineConfig
from tb_guard_ml.data.discovery import get_or_create_manifest, inspect_available_datasets
from tb_guard_ml.data.manifest import CanonicalManifest
from tb_guard_ml.data.splits import ParticipantSplitter, verify_split_leakage
from tb_guard_ml.training.train import train_baseline_pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("tb_guard_ml.pipeline")


def main():
    parser = argparse.ArgumentParser(description="Run TB-Guard ML Pipeline stages.")
    parser.add_argument("--config", type=str, default="configs/synthetic_smoke.yaml", help="Path to config YAML")
    parser.add_argument("--allow-synthetic", action="store_true", default=True, help="Allow synthetic fallback if real data is missing")
    args = parser.parse_args()

    config = PipelineConfig.from_yaml(args.config)
    config.ensure_directories()

    print("=================================================================")
    print(f"  TB-GUARD ML PIPELINE — Experiment: {config.experiment_name}")
    print("=================================================================")

    # 1. Dataset Discovery & Provenance Check
    print("\n[Stage 1] Inspecting dataset provenance and availability...")
    dataset_statuses = inspect_available_datasets(config)
    for name, st in dataset_statuses.items():
        status_symbol = "[AVAILABLE]" if st.available else "[NOT DETECTED]"
        print(f"  * {st.name} {status_symbol}")
        print(f"    Path: {st.path}")
        print(f"    Audio files: {st.num_audio_files}, Metadata: {st.num_metadata_files}")
        print(f"    Notes: {st.notes}")

    coda_status = dataset_statuses.get("CODA_TB_DREAM")
    is_real_data_run = coda_status and coda_status.available

    if not is_real_data_run:
        print("\n> [NOTICE] Clinical CODA dataset is not present or access credentials not configured.")
        print("> Falling back to SYNTHETIC SMOKE TEST mode to verify pipeline execution and integrity.")
        print("> Experiment B (Clinical TB Classification): BLOCKED (pending Synapse access approval).")
        print("> Experiment A (Synthetic Pipeline Smoke Test): RUNNING.")

    # 2. Ingest or Load Manifest
    print("\n[Stage 2] Loading / Ingesting Canonical Manifest...")
    manifest = get_or_create_manifest(config, use_synthetic_fallback=args.allow_synthetic)
    df = manifest.df.copy()
    print(f"  Manifest contains {len(df)} records across {df['participant_id'].nunique()} unique participants.")

    # 3. Audio Preprocessing Validation & Quality Control
    print("\n[Stage 3] Running audio preprocessing and signal quality checks...")
    preprocessor = AudioPreprocessor(config.audio)
    statuses = []
    reasons = []

    for _, row in df.iterrows():
        # Keep existing exclusions if already set
        if row.get("exclusion_reason") is not None and str(row.get("exclusion_reason")) != "nan":
            statuses.append("rejected")
            reasons.append(str(row["exclusion_reason"]))
            continue

        audio_path = Path(row["audio_path"])
        load_res = load_audio_file(audio_path)
        if not load_res.is_valid or load_res.audio is None:
            statuses.append("rejected")
            reasons.append(load_res.error_message or "audio_load_failure")
            continue

        prep_res = preprocessor.process(load_res.audio, load_res.sample_rate)
        if not prep_res.is_valid or prep_res.audio is None:
            statuses.append("rejected")
            reasons.append(prep_res.exclusion_reason or "preprocessing_failure")
        else:
            statuses.append("accepted")
            reasons.append(None)

    df["preprocessing_status"] = statuses
    df["exclusion_reason"] = reasons

    qc_report = generate_qc_report(df, output_dir=config.reports_dir)
    print(f"  Accepted: {qc_report.accepted_files}/{qc_report.total_audio_records} files ({qc_report.acceptance_rate * 100:.1f}%)")

    # 4. Participant-Level Splitting & Leakage Verification
    print("\n[Stage 4] Generating participant-level data splits (train/val/test)...")
    splitter = ParticipantSplitter(
        seed=config.split.seed,
        train_ratio=config.split.train_ratio,
        val_ratio=config.split.val_ratio,
        test_ratio=config.split.test_ratio,
        stratify=config.split.stratify_by_target,
    )
    df, split_report = splitter.split_manifest(df)

    # Re-save manifest with updated split and QC columns
    manifest = CanonicalManifest(df=df)
    manifest.save(config.manifest_path)

    # Programmatic leakage assertion
    leak_free, overlaps = verify_split_leakage(df)
    if not leak_free:
        print(f"CRITICAL ERROR: Data leakage detected across splits: {overlaps}")
        sys.exit(1)

    print("  Split isolation verified: 0 participant overlap across train, val, and test.")
    print(f"  Train: {split_report.train_participants} participants ({split_report.train_recordings} recordings)")
    print(f"  Val:   {split_report.val_participants} participants ({split_report.val_recordings} recordings)")
    print(f"  Test:  {split_report.test_participants} participants ({split_report.test_recordings} recordings)")

    # 5. Feature Extraction, Embedding Caching & Baseline Training
    print("\n[Stage 5 & 6] Feature extraction, embedding caching, and baseline model training...")
    results = train_baseline_pipeline(manifest, config)

    print("\n=================================================================")
    print("  PIPELINE EXECUTION SUMMARY")
    print("=================================================================")
    print(f"  Status:             {results['status']}")
    print(f"  Elapsed Time:       {results['duration_seconds']:.2f} seconds")
    print(f"  Trained Model:      {results['model_path']}")
    print(f"  Selected Threshold: {results['threshold']:.3f} (Validation-tuned)")
    print(f"  Synthetic Mode:     {results['is_synthetic']}")

    if results.get("test_report"):
        test_m = results["test_report"]["metrics"]
        print("\n  Held-out Test Performance:")
        print(f"    Sensitivity (Recall): {test_m['sensitivity']:.4f}")
        print(f"    Specificity:          {test_m['specificity']:.4f}")
        print(f"    Precision (PPV):      {test_m['precision']:.4f}")
        print(f"    F1-Score:             {test_m['f1']:.4f}")
        print(f"    ROC-AUC:              {test_m['roc_auc']:.4f}")
        print(f"    PR-AUC:               {test_m['pr_auc']:.4f}")
        print(f"    Brier Score:          {test_m['brier_score']:.4f}")

    print("\nPipeline stage completed. Artifacts saved in reports/ and models/.")


if __name__ == "__main__":
    main()
