"""Deterministic audio window segmentation for 2-second (32,000 samples) HeAR inputs."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

import numpy as np

logger = logging.getLogger(__name__)

DEFAULT_WINDOW_SAMPLES = 32000  # 2.0s @ 16 kHz


@dataclass
class AudioWindow:
    window_id: str
    recording_id: str
    participant_id: str
    start_sample: int
    end_sample: int
    start_time_seconds: float
    end_time_seconds: float
    padding_samples: int
    audio_data: np.ndarray  # Shape: (32000,) float32
    target_label: Optional[int] = None
    split: str = "unassigned"


class WindowSegmenter:
    """Segments 16 kHz mono audio into deterministic 2.0s (32,000 samples) windows."""

    def __init__(
        self,
        sample_rate: int = 16000,
        window_duration_seconds: float = 2.0,
        hop_duration_seconds: Optional[float] = None,  # If None, non-overlapping (2.0s)
    ):
        self.sample_rate = sample_rate
        self.window_duration_seconds = window_duration_seconds
        self.window_samples = int(sample_rate * window_duration_seconds)
        self.hop_samples = int(sample_rate * (hop_duration_seconds or window_duration_seconds))

    def segment(
        self,
        audio: np.ndarray,
        recording_id: str,
        participant_id: str,
        target_label: Optional[int] = None,
        split: str = "unassigned",
    ) -> List[AudioWindow]:
        """Divide audio array into 32,000-sample windows with explicit provenance and padding tracking."""
        total_samples = len(audio)
        windows: List[AudioWindow] = []

        if total_samples == 0:
            return windows

        # Case 1: Audio is shorter than 1 window duration -> deterministic zero padding at the tail
        if total_samples < self.window_samples:
            padding_needed = self.window_samples - total_samples
            padded_audio = np.pad(audio, (0, padding_needed), mode="constant", constant_values=0.0)
            
            win = AudioWindow(
                window_id=f"{recording_id}_win_00",
                recording_id=recording_id,
                participant_id=participant_id,
                start_sample=0,
                end_sample=total_samples,
                start_time_seconds=0.0,
                end_time_seconds=total_samples / float(self.sample_rate),
                padding_samples=padding_needed,
                audio_data=padded_audio.astype(np.float32),
                target_label=target_label,
                split=split,
            )
            windows.append(win)
            return windows

        # Case 2: Audio is longer than or equal to 1 window
        start = 0
        win_idx = 0
        while start < total_samples:
            end = start + self.window_samples
            if end <= total_samples:
                chunk = audio[start:end]
                pad_len = 0
            else:
                # Tail segment that is shorter than a full window
                chunk_raw = audio[start:]
                pad_len = self.window_samples - len(chunk_raw)
                chunk = np.pad(chunk_raw, (0, pad_len), mode="constant", constant_values=0.0)

            win = AudioWindow(
                window_id=f"{recording_id}_win_{win_idx:02d}",
                recording_id=recording_id,
                participant_id=participant_id,
                start_sample=start,
                end_sample=min(end, total_samples),
                start_time_seconds=start / float(self.sample_rate),
                end_time_seconds=min(end, total_samples) / float(self.sample_rate),
                padding_samples=pad_len,
                audio_data=chunk.astype(np.float32),
                target_label=target_label,
                split=split,
            )
            windows.append(win)
            win_idx += 1
            start += self.hop_samples

            # If tail segment was padded to window size, stop to avoid redundant empty segments
            if pad_len > 0:
                break

        return windows
