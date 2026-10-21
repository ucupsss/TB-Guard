"""Audio preprocessing pipeline: mono conversion, anti-aliased resampling, and quality checks."""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Optional, Tuple

import numpy as np
from scipy import signal

from tb_guard_ml.config import AudioConfig

logger = logging.getLogger(__name__)


@dataclass
class PreprocessResult:
    audio: Optional[np.ndarray]
    sample_rate: int
    duration_seconds: float
    peak_amplitude: float
    rms_amplitude: float
    is_clipped: bool
    is_silent: bool
    is_valid: bool
    exclusion_reason: Optional[str] = None


class AudioPreprocessor:
    """Deterministic audio preprocessor for converting raw audio into 16 kHz mono representations."""

    def __init__(self, config: Optional[AudioConfig] = None):
        self.config = config or AudioConfig()

    def to_mono(self, audio: np.ndarray) -> np.ndarray:
        """Convert multichannel audio to mono by taking the unweighted mean across channels."""
        if audio.ndim == 1:
            return audio
        elif audio.ndim == 2:
            return np.mean(audio, axis=1)
        else:
            raise ValueError(f"Unsupported audio tensor dimension: {audio.ndim}")

    def resample_16k(self, audio: np.ndarray, orig_sr: int) -> np.ndarray:
        """Resample audio to target sample rate (default 16 kHz) using polyphase anti-aliasing filtering."""
        target_sr = self.config.sample_rate
        if orig_sr == target_sr:
            return audio.astype(np.float32)

        # Compute irreducible fraction for resample_poly
        gcd = math.gcd(orig_sr, target_sr)
        up = target_sr // gcd
        down = orig_sr // gcd

        resampled = signal.resample_poly(audio, up, down).astype(np.float32)
        return resampled

    def process(self, audio: np.ndarray, orig_sr: int) -> PreprocessResult:
        """Preprocess audio array: check validity, convert to mono, resample, and compute metrics."""
        # 1. Check for non-finite values (NaN, inf)
        if not np.all(np.isfinite(audio)):
            return PreprocessResult(
                audio=None,
                sample_rate=orig_sr,
                duration_seconds=0.0,
                peak_amplitude=0.0,
                rms_amplitude=0.0,
                is_clipped=False,
                is_silent=False,
                is_valid=False,
                exclusion_reason="non_finite_audio_samples",
            )

        # 2. Convert to mono
        mono = self.to_mono(audio)

        # 3. Check duration before resampling
        orig_duration = len(mono) / float(orig_sr) if orig_sr > 0 else 0.0
        if orig_duration < self.config.min_duration_seconds:
            return PreprocessResult(
                audio=None,
                sample_rate=orig_sr,
                duration_seconds=orig_duration,
                peak_amplitude=float(np.max(np.abs(mono))) if len(mono) > 0 else 0.0,
                rms_amplitude=0.0,
                is_clipped=False,
                is_silent=False,
                is_valid=False,
                exclusion_reason=f"duration_below_minimum_{orig_duration:.2f}s",
            )

        if orig_duration > self.config.max_duration_seconds:
            return PreprocessResult(
                audio=None,
                sample_rate=orig_sr,
                duration_seconds=orig_duration,
                peak_amplitude=float(np.max(np.abs(mono))),
                rms_amplitude=0.0,
                is_clipped=False,
                is_silent=False,
                is_valid=False,
                exclusion_reason=f"duration_exceeds_maximum_{orig_duration:.2f}s",
            )

        # 4. Anti-aliased Resampling to 16 kHz
        resampled = self.resample_16k(mono, orig_sr)
        duration = len(resampled) / float(self.config.sample_rate)

        # 5. Compute amplitude metrics
        peak = float(np.max(np.abs(resampled)))
        rms = float(np.sqrt(np.mean(resampled ** 2)))
        is_clipped = bool(peak >= 0.999)
        is_silent = bool(rms < 1e-4)

        if is_silent:
            return PreprocessResult(
                audio=None,
                sample_rate=self.config.sample_rate,
                duration_seconds=duration,
                peak_amplitude=peak,
                rms_amplitude=rms,
                is_clipped=is_clipped,
                is_silent=True,
                is_valid=False,
                exclusion_reason="silent_audio_below_rms_threshold",
            )

        # 6. Optional amplitude normalization (off by default)
        processed_audio = resampled
        if self.config.normalize_amplitude and peak > 0:
            processed_audio = resampled / peak

        return PreprocessResult(
            audio=processed_audio,
            sample_rate=self.config.sample_rate,
            duration_seconds=duration,
            peak_amplitude=peak,
            rms_amplitude=rms,
            is_clipped=is_clipped,
            is_silent=False,
            is_valid=True,
            exclusion_reason=None,
        )
