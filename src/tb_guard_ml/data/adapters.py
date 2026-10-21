"""Dataset adapters for CODA TB Challenge and synthetic smoke test data generation."""

from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd
import soundfile as sf

from tb_guard_ml.data.labels import LabelMapper
from tb_guard_ml.data.manifest import CanonicalManifest, ManifestRecord

logger = logging.getLogger(__name__)


class SyntheticDatasetGenerator:
    """Generates synthetic, non-clinical audio files and metadata for pipeline verification.

    All generated records are explicitly tagged with source_dataset='SYNTHETIC_SMOKE_TEST'.
    """

    def __init__(
        self,
        output_dir: str | Path,
        num_participants: int = 24,
        recordings_per_participant: Tuple[int, int] = (1, 3),
        sample_rates: Tuple[int, ...] = (16000, 44100, 48000),
        random_seed: int = 42,
    ):
        self.output_dir = Path(output_dir)
        self.num_participants = num_participants
        self.recordings_per_participant = recordings_per_participant
        self.sample_rates = sample_rates
        self.rng = np.random.RandomState(random_seed)

    def generate(self) -> CanonicalManifest:
        """Create synthetic audio files and generate a canonical manifest."""
        audio_dir = self.output_dir / "audio"
        audio_dir.mkdir(parents=True, exist_ok=True)

        records: List[ManifestRecord] = []
        mapper = LabelMapper()

        for p_idx in range(self.num_participants):
            participant_id = f"SYNTH_PARTICIPANT_{p_idx + 1:03d}"
            
            # Assign synthetic status: 40% positive, 50% negative, 10% indeterminate/corrupt
            r_val = self.rng.rand()
            if r_val < 0.40:
                raw_label = "positive"
            elif r_val < 0.90:
                raw_label = "negative"
            else:
                raw_label = "indeterminate"

            target_label, exclusion_reason = mapper.map_label(raw_label)

            n_recs = self.rng.randint(self.recordings_per_participant[0], self.recordings_per_participant[1] + 1)
            for r_idx in range(n_recs):
                rec_id = f"{participant_id}_REC_{r_idx + 1:02d}"
                sr = int(self.rng.choice(self.sample_rates))
                
                # Duration between 1.5 and 5.0 seconds
                duration = float(self.rng.uniform(1.8, 4.5))
                num_samples = int(duration * sr)
                
                # Synthetic cough-like acoustic burst (decaying band-limited bursts + ambient noise)
                t = np.linspace(0, duration, num_samples, endpoint=False)
                # Base ambient noise
                audio = 0.01 * self.rng.randn(num_samples).astype(np.float32)
                
                # Add 1 to 3 cough-like energy bursts
                n_bursts = self.rng.randint(1, 4)
                for _ in range(n_bursts):
                    burst_center = self.rng.uniform(0.3, max(0.4, duration - 0.5))
                    burst_envelope = np.exp(-((t - burst_center) ** 2) / (2 * (0.08 ** 2)))
                    carrier = np.sin(2 * np.pi * self.rng.uniform(250, 600) * t)
                    audio += (burst_envelope * carrier * self.rng.uniform(0.2, 0.6)).astype(np.float32)

                # Peak limit to avoid hard clipping
                max_val = np.max(np.abs(audio))
                if max_val > 0.95:
                    audio = audio / max_val * 0.95

                # Optional stereo synthesis for testing multichannel handling
                channels = self.rng.choice([1, 2], p=[0.7, 0.3])
                if channels == 2:
                    audio_out = np.stack([audio, audio * 0.98 + 0.005 * self.rng.randn(num_samples).astype(np.float32)], axis=1)
                else:
                    audio_out = audio

                wav_path = audio_dir / f"{rec_id}.wav"
                sf.write(wav_path, audio_out, sr)

                record = ManifestRecord(
                    recording_id=rec_id,
                    participant_id=participant_id,
                    audio_path=str(wav_path.resolve()),
                    source_dataset="SYNTHETIC_SMOKE_TEST",
                    original_sample_rate=sr,
                    duration_seconds=round(duration, 3),
                    original_label=raw_label,
                    target_label=target_label,
                    label_source="synthetic_generator",
                    split="unassigned",
                    preprocessing_status="pending",
                    exclusion_reason=exclusion_reason,
                )
                records.append(record)

        manifest = CanonicalManifest(records=records)
        manifest_path = self.output_dir / "manifest.csv"
        manifest.save(manifest_path)
        logger.info("Generated %d synthetic records across %d participants at %s", len(records), self.num_participants, manifest_path)
        return manifest


class CodaDatasetAdapter:
    """Adapter for CODA TB DREAM Challenge (Synapse syn31472953).

    Handles clinical reference standards, participant metadata, and audio files.
    """

    def __init__(self, dataset_root: str | Path, label_mapper: Optional[LabelMapper] = None):
        self.dataset_root = Path(dataset_root)
        self.label_mapper = label_mapper or LabelMapper()

    def is_available(self) -> bool:
        """Check if CODA raw dataset is present on disk."""
        if not self.dataset_root.exists():
            return False
        # Look for clinical metadata table and audio subdirectory
        metadata_candidates = list(self.dataset_root.glob("*clinical*.csv")) + list(self.dataset_root.glob("*metadata*.csv"))
        wav_files = list(self.dataset_root.glob("**/*.wav"))
        return len(metadata_candidates) > 0 and len(wav_files) > 0

    def ingest(self) -> CanonicalManifest:
        """Parse CODA directory into canonical manifest."""
        if not self.is_available():
            raise FileNotFoundError(
                f"CODA TB dataset not found at '{self.dataset_root}'.\n"
                "Please follow the setup instructions in docs/DATASET_ACCESS.md:\n"
                "1. Register at Synapse (https://www.synapse.org/Synapse:syn31472953).\n"
                "2. Accept DREAM Challenge terms of use.\n"
                "3. Download data into data/raw/coda/."
            )

        metadata_files = list(self.dataset_root.glob("*clinical*.csv")) + list(self.dataset_root.glob("*metadata*.csv"))
        meta_df = pd.read_csv(metadata_files[0])

        # Identify key columns in CODA
        # Expected CODA schema variations: participant_id, recording_id/filename, tb_status/culture_result
        pid_col = next((c for c in meta_df.columns if "participant" in c.lower() or "subject" in c.lower()), None)
        rec_col = next((c for c in meta_df.columns if "rec" in c.lower() or "file" in c.lower() or "audio" in c.lower()), None)
        status_col = next((c for c in meta_df.columns if "tb" in c.lower() or "status" in c.lower() or "culture" in c.lower() or "label" in c.lower()), None)

        if not pid_col or not status_col:
            raise ValueError(f"Could not resolve participant or label columns in CODA metadata: {meta_df.columns.tolist()}")

        records: List[ManifestRecord] = []
        for _, row in meta_df.iterrows():
            pid = str(row[pid_col])
            raw_label = row[status_col]
            target_label, exclusion_reason = self.label_mapper.map_label(raw_label)

            rec_id = str(row[rec_col]) if rec_col else f"{pid}_rec"
            
            # Find audio file
            audio_matches = list(self.dataset_root.glob(f"**/{rec_id}*.wav"))
            if not audio_matches:
                audio_path = "NOT_FOUND"
                exclusion_reason = "audio_file_missing"
                orig_sr = 0
                duration = 0.0
            else:
                audio_path = str(audio_matches[0].resolve())
                try:
                    info = sf.info(audio_path)
                    orig_sr = info.samplerate
                    duration = info.duration
                except Exception as e:
                    exclusion_reason = f"corrupt_audio: {e}"
                    orig_sr = 0
                    duration = 0.0

            records.append(
                ManifestRecord(
                    recording_id=rec_id,
                    participant_id=pid,
                    audio_path=audio_path,
                    source_dataset="CODA_TB_DREAM",
                    original_sample_rate=orig_sr,
                    duration_seconds=duration,
                    original_label=str(raw_label),
                    target_label=target_label,
                    label_source=f"coda_metadata:{status_col}",
                    split="unassigned",
                    preprocessing_status="pending" if exclusion_reason is None else "rejected",
                    exclusion_reason=exclusion_reason,
                )
            )

        return CanonicalManifest(records=records)
