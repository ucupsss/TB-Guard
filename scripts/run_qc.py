"""CLI script to run quality-control diagnostics on dataset manifest."""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from tb_guard_ml.audio.loading import load_audio_file
from tb_guard_ml.audio.preprocessing import AudioPreprocessor
from tb_guard_ml.audio.quality import generate_qc_report
from tb_guard_ml.data.manifest import CanonicalManifest


def main():
    parser = argparse.ArgumentParser(description="Run audio quality control checks on manifest.")
    parser.add_argument("--manifest", type=str, default="data/synthetic_smoke/raw/manifest.csv", help="Manifest path")
    parser.add_argument("--output-dir", type=str, default="reports/synthetic_smoke", help="QC report output dir")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        print(f"Error: Manifest not found at {manifest_path}")
        sys.exit(1)

    print(f"Loading manifest from {manifest_path}...")
    manifest = CanonicalManifest.load(manifest_path)
    df = manifest.df.copy()

    # Preprocess and validate each file
    preprocessor = AudioPreprocessor()
    print(f"Validating {len(df)} audio records...")

    statuses = []
    reasons = []

    for _, row in df.iterrows():
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

    # Update manifest on disk
    manifest = CanonicalManifest(df=df)
    manifest.save(manifest_path)

    # Generate QC report
    qc = generate_qc_report(df, output_dir=args.output_dir)
    print("\n" + qc.to_markdown())


if __name__ == "__main__":
    main()
