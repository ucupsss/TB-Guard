"""Safe and robust audio loading for TB-Guard."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import soundfile as sf

logger = logging.getLogger(__name__)


@dataclass
class AudioLoadResult:
    audio: Optional[np.ndarray]
    sample_rate: int
    duration_seconds: float
    channels: int
    is_valid: bool
    error_message: Optional[str] = None


def load_audio_file(file_path: str | Path) -> AudioLoadResult:
    """Safely load an audio file from disk into a float32 NumPy array.

    Handles empty files, corrupt headers, non-existent files, and unsupported formats.
    """
    path = Path(file_path)
    if not path.exists():
        return AudioLoadResult(
            audio=None,
            sample_rate=0,
            duration_seconds=0.0,
            channels=0,
            is_valid=False,
            error_message=f"File not found: {path}",
        )

    if path.stat().st_size == 0:
        return AudioLoadResult(
            audio=None,
            sample_rate=0,
            duration_seconds=0.0,
            channels=0,
            is_valid=False,
            error_message="Audio file is empty (0 bytes)",
        )

    try:
        data, sr = sf.read(str(path), dtype="float32", always_2d=False)
        channels = 1 if data.ndim == 1 else data.shape[1]
        n_samples = len(data) if data.ndim == 1 else data.shape[0]
        duration = float(n_samples) / float(sr) if sr > 0 else 0.0

        # Basic validity check
        if n_samples == 0:
            return AudioLoadResult(
                audio=None,
                sample_rate=sr,
                duration_seconds=0.0,
                channels=channels,
                is_valid=False,
                error_message="Audio contains zero samples",
            )

        return AudioLoadResult(
            audio=data,
            sample_rate=sr,
            duration_seconds=duration,
            channels=channels,
            is_valid=True,
            error_message=None,
        )
    except Exception as e:
        logger.warning("Failed to load audio file %s: %s", path, e)
        return AudioLoadResult(
            audio=None,
            sample_rate=0,
            duration_seconds=0.0,
            channels=0,
            is_valid=False,
            error_message=f"Corrupt or unsupported audio: {e}",
        )
