"""Inference service for TB-Guard acoustic representation scoring."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np

from tb_guard_ml.audio.preprocessing import AudioPreprocessor
from tb_guard_ml.audio.segmentation import WindowSegmenter
from tb_guard_ml.features.hear_encoder import BaseAudioEncoder, get_encoder
from tb_guard_ml.training.baseline import TBGuardBaselineModel

logger = logging.getLogger(__name__)


@dataclass
class WindowInferenceResult:
    window_id: str
    probability_positive: float
    predicted_class: int
    is_screen_positive: bool


@dataclass
class AudioInferenceResult:
    recording_id: str
    num_windows: int
    mean_probability: float
    max_probability: float
    screen_positive: bool
    window_predictions: List[WindowInferenceResult]
    scientific_disclaimer: str = (
        "TB-Guard Research Prototype: Acoustic scores represent exploratory research representations. "
        "They DO NOT constitute medical diagnosis. Clinical evaluation is always required."
    )


class TBGuardPredictor:
    """End-to-end inference predictor loading trained model and encoder."""

    def __init__(
        self,
        model_path: str | Path,
        encoder_name: str = "hear_synthetic_surrogate",
        device: str = "cpu",
    ):
        self.model_path = Path(model_path)
        self.model = TBGuardBaselineModel.load(str(self.model_path))
        self.encoder: BaseAudioEncoder = get_encoder(encoder_name, device=device)
        self.preprocessor = AudioPreprocessor()
        self.segmenter = WindowSegmenter()

    def predict_audio(self, audio: np.ndarray, orig_sr: int, recording_id: str = "query") -> AudioInferenceResult:
        """Run preprocessing, window segmentation, embedding extraction, and model classification."""
        prep_res = self.preprocessor.process(audio, orig_sr)
        if not prep_res.is_valid or prep_res.audio is None:
            raise ValueError(f"Audio preprocessing failed: {prep_res.exclusion_reason}")

        windows = self.segmenter.segment(prep_res.audio, recording_id=recording_id, participant_id="inference_query")
        if not windows:
            raise ValueError("No valid windows generated from audio")

        batch_audio = np.stack([w.audio_data for w in windows], axis=0)
        embeddings = self.encoder.encode_batch(batch_audio)

        probs = self.model.predict_proba(embeddings)[:, 1]
        preds = (probs >= self.model.decision_threshold).astype(int)

        win_results: List[WindowInferenceResult] = []
        for i, win in enumerate(windows):
            win_results.append(
                WindowInferenceResult(
                    window_id=win.window_id,
                    probability_positive=float(probs[i]),
                    predicted_class=int(preds[i]),
                    is_screen_positive=bool(preds[i] == 1),
                )
            )

        mean_p = float(np.mean(probs))
        max_p = float(np.max(probs))
        overall_screen = bool(max_p >= self.model.decision_threshold)

        return AudioInferenceResult(
            recording_id=recording_id,
            num_windows=len(windows),
            mean_probability=round(mean_p, 4),
            max_probability=round(max_p, 4),
            screen_positive=overall_screen,
            window_predictions=win_results,
        )
