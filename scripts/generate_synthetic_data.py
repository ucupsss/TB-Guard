"""CLI script to generate synthetic smoke-test audio data and canonical manifest."""

import argparse
import sys
from pathlib import Path

# Add src to sys.path so scripts can run directly without pip install -e .
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from tb_guard_ml.data.adapters import SyntheticDatasetGenerator


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic cough/noise audio for TB-Guard smoke testing.")
    parser.add_argument("--output-dir", type=str, default="data/synthetic_smoke/raw", help="Target output directory")
    parser.add_argument("--num-participants", type=int, default=24, help="Number of synthetic participants to generate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    print(f"Generating synthetic smoke-test data in {args.output_dir}...")
    generator = SyntheticDatasetGenerator(
        output_dir=args.output_dir,
        num_participants=args.num_participants,
        random_seed=args.seed,
    )
    manifest = generator.generate()
    summary = manifest.summary()
    print("\n--- Synthetic Generation Summary ---")
    for k, v in summary.items():
        print(f"  {k}: {v}")
    print("\nGeneration completed successfully.")


if __name__ == "__main__":
    main()
