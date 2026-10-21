"""Dataset discovery and diagnostic inspection."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd

from tb_guard_ml.config import PipelineConfig
from tb_guard_ml.data.adapters import CodaDatasetAdapter, SyntheticDatasetGenerator
from tb_guard_ml.data.manifest import CanonicalManifest

logger = logging.getLogger(__name__)


@dataclass
class DatasetStatus:
    name: str
    available: bool
    path: str
    num_audio_files: int
    num_metadata_files: int
    notes: str


def inspect_available_datasets(config: PipelineConfig) -> Dict[str, DatasetStatus]:
    """Inspect configured directories and determine available datasets."""
    results: Dict[str, DatasetStatus] = {}

    # Check CODA TB DREAM dataset
    coda_adapter = CodaDatasetAdapter(config.dataset_root / "coda")
    coda_path = config.dataset_root / "coda"
    coda_available = coda_adapter.is_available()
    coda_wavs = len(list(coda_path.glob("**/*.wav"))) if coda_path.exists() else 0
    coda_meta = len(list(coda_path.glob("*.*sv"))) if coda_path.exists() else 0
    results["CODA_TB_DREAM"] = DatasetStatus(
        name="CODA TB DREAM Challenge (Synapse:syn31472953)",
        available=coda_available,
        path=str(coda_path),
        num_audio_files=coda_wavs,
        num_metadata_files=coda_meta,
        notes="Gated dataset. Requires Synapse credentials and challenge data agreement."
        if not coda_available
        else "Dataset detected and ready for ingestion.",
    )

    # Check synthetic smoke dataset
    synth_path = Path("data/synthetic_smoke/raw")
    synth_manifest = synth_path / "manifest.csv"
    synth_available = synth_manifest.exists()
    synth_wavs = len(list(synth_path.glob("**/*.wav"))) if synth_path.exists() else 0
    results["SYNTHETIC_SMOKE"] = DatasetStatus(
        name="Synthetic Smoke Test Dataset",
        available=synth_available,
        path=str(synth_path),
        num_audio_files=synth_wavs,
        num_metadata_files=1 if synth_available else 0,
        notes="Used for pipeline verification without clinical data."
        if synth_available
        else "Not yet generated. Run scripts/generate_synthetic_data.py to create.",
    )

    return results


def get_or_create_manifest(config: PipelineConfig, use_synthetic_fallback: bool = True) -> CanonicalManifest:
    """Load existing manifest, ingest real dataset, or create synthetic fallback."""
    if config.manifest_path.exists():
        logger.info("Loading existing manifest from %s", config.manifest_path)
        return CanonicalManifest.load(config.manifest_path)

    # Check real CODA dataset
    coda_path = config.dataset_root / "coda"
    coda_adapter = CodaDatasetAdapter(coda_path)
    if coda_adapter.is_available():
        logger.info("Ingesting real CODA dataset from %s", coda_path)
        manifest = coda_adapter.ingest()
        manifest.save(config.manifest_path)
        return manifest

    if use_synthetic_fallback:
        logger.warning(
            "Real clinical dataset not found at %s. Initializing synthetic smoke dataset as fallback.",
            config.dataset_root,
        )
        generator = SyntheticDatasetGenerator(output_dir=config.dataset_root)
        manifest = generator.generate()
        manifest.save(config.manifest_path)
        return manifest

    raise FileNotFoundError(
        f"No dataset found at {config.dataset_root} and synthetic fallback is disabled."
    )
