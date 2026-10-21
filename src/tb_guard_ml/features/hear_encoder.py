"""HeAR (Health Acoustic Representations) feature extraction interface."""

from __future__ import annotations

import abc
import hashlib
import logging
import os
from pathlib import Path
from typing import List, Optional

import numpy as np
import torch
import torch.nn as nn

logger = logging.getLogger(__name__)

EXPECTED_WINDOW_SAMPLES = 32000  # 2.0s @ 16 kHz
EXPECTED_EMBEDDING_DIM = 512


class BaseAudioEncoder(abc.ABC):
    """Abstract interface for TB-Guard audio representation encoders."""

    @property
    @abc.abstractmethod
    def embedding_dim(self) -> int:
        pass

    @property
    @abc.abstractmethod
    def model_identifier(self) -> str:
        pass

    @property
    @abc.abstractmethod
    def is_synthetic_surrogate(self) -> bool:
        pass

    @abc.abstractmethod
    def encode_batch(self, audio_batch: np.ndarray) -> np.ndarray:
        """Encode a batch of 2.0s mono audio clips (Shape: (B, 32000)) into embeddings (Shape: (B, 512))."""
        pass


class OfficialHearEncoder(BaseAudioEncoder):
    """Official Google HeAR encoder loaded from Hugging Face or PyTorch hub.

    Requires access approval and HF_TOKEN from https://huggingface.co/google/hear.
    """

    def __init__(self, model_id: str = "google/hear", device: str = "cpu"):
        self._model_id = model_id
        self._device = torch.device(device if torch.cuda.is_available() and device.startswith("cuda") else "cpu")
        self._model = self._load_model()

    @property
    def embedding_dim(self) -> int:
        return EXPECTED_EMBEDDING_DIM

    @property
    def model_identifier(self) -> str:
        return f"{self._model_id}:{self._device.type}"

    @property
    def is_synthetic_surrogate(self) -> bool:
        return False

    def _load_model(self) -> nn.Module:
        """Load pretrained weights or raise a helpful diagnostic exception if access is blocked."""
        hf_token = os.environ.get("HF_TOKEN")
        try:
            from transformers import AutoModel
            logger.info("Loading official HeAR model from %s on %s...", self._model_id, self._device)
            model = AutoModel.from_pretrained(
                self._model_id,
                token=hf_token,
                trust_remote_code=True,
            )
            model.eval()
            model.to(self._device)
            # Freeze all parameters
            for param in model.parameters():
                param.requires_grad = False
            return model
        except Exception as e:
            raise PermissionError(
                f"Failed to load official HeAR model '{self._model_id}': {e}\n"
                "Official Google HeAR weights require gated access approval on Hugging Face:\n"
                "1. Apply for access at https://huggingface.co/google/hear\n"
                "2. Generate an access token at https://huggingface.co/settings/tokens\n"
                "3. Set HF_TOKEN in your environment or .env file.\n"
                "For pipeline testing without official weights, use the synthetic surrogate encoder:\n"
                "   encoder.name: hear_synthetic_surrogate"
            ) from e

    def encode_batch(self, audio_batch: np.ndarray) -> np.ndarray:
        """Extract 512-dim embeddings using official frozen HeAR model."""
        if audio_batch.ndim != 2 or audio_batch.shape[1] != EXPECTED_WINDOW_SAMPLES:
            raise ValueError(
                f"Expected audio batch shape (B, {EXPECTED_WINDOW_SAMPLES}), got {audio_batch.shape}"
            )

        tensor = torch.from_numpy(audio_batch).float().to(self._device)
        with torch.no_grad():
            outputs = self._model(tensor)
            if hasattr(outputs, "last_hidden_state"):
                # Average pool or take pooled representation
                emb = outputs.last_hidden_state.mean(dim=1)
            elif isinstance(outputs, torch.Tensor):
                emb = outputs
            elif isinstance(outputs, dict) and "embedding" in outputs:
                emb = outputs["embedding"]
            else:
                emb = outputs[0]

        np_emb = emb.detach().cpu().numpy()
        if np_emb.shape[1] != EXPECTED_EMBEDDING_DIM:
            raise ValueError(
                f"Encoder output dimension mismatch: expected {EXPECTED_EMBEDDING_DIM}, got {np_emb.shape[1]}"
            )
        return np_emb.astype(np.float32)


class HearSyntheticSurrogateEncoder(BaseAudioEncoder):
    """Deterministic, non-clinical acoustic feature surrogate for pipeline smoke testing.

    Computes deterministic spectrogram statistics and projects to 512 dimensions.
    Explicitly labeled as synthetic surrogate to prevent accidental clinical interpretation.
    """

    def __init__(self, device: str = "cpu"):
        self._device = device
        self._seed = 1337
        # Deterministic projection matrix
        rng = np.random.RandomState(self._seed)
        # Random orthogonal projection from 128 mel bins x 4 summary stats (512) -> 512
        q, _ = np.linalg.qr(rng.randn(512, 512))
        self._proj = q.astype(np.float32)

    @property
    def embedding_dim(self) -> int:
        return EXPECTED_EMBEDDING_DIM

    @property
    def model_identifier(self) -> str:
        return "hear_synthetic_surrogate:v1:non_clinical"

    @property
    def is_synthetic_surrogate(self) -> bool:
        return True

    def encode_batch(self, audio_batch: np.ndarray) -> np.ndarray:
        """Encode audio batch into deterministic 512-dim mock embeddings."""
        if audio_batch.ndim != 2 or audio_batch.shape[1] != EXPECTED_WINDOW_SAMPLES:
            raise ValueError(
                f"Expected audio batch shape (B, {EXPECTED_WINDOW_SAMPLES}), got {audio_batch.shape}"
            )

        batch_size = audio_batch.shape[0]
        embeddings = np.zeros((batch_size, EXPECTED_EMBEDDING_DIM), dtype=np.float32)

        for i in range(batch_size):
            signal = audio_batch[i]
            # Simple STFT simulation: 128 frequency bands via FFT on 4 non-overlapping segments
            chunks = np.array_split(signal, 4)
            features = []
            for chunk in chunks:
                fft_mag = np.abs(np.fft.rfft(chunk, n=256))[:128]
                features.append(fft_mag)
            
            feat_concat = np.concatenate(features).astype(np.float32)  # 512 dim
            # Normalize and project
            norm = np.linalg.norm(feat_concat) + 1e-8
            normalized = feat_concat / norm
            emb = np.dot(normalized, self._proj)
            # L2 normalize
            embeddings[i] = emb / (np.linalg.norm(emb) + 1e-8)

        return embeddings


def get_encoder(name: str, device: str = "cpu") -> BaseAudioEncoder:
    """Factory to get the appropriate encoder instance."""
    normalized_name = name.lower().strip()
    if "surrogate" in normalized_name or "synthetic" in normalized_name or "mock" in normalized_name:
        logger.info("Initializing HearSyntheticSurrogateEncoder (non-clinical smoke test mode)...")
        return HearSyntheticSurrogateEncoder(device=device)
    else:
        logger.info("Initializing OfficialHearEncoder (%s)...", name)
        return OfficialHearEncoder(model_id=name, device=device)
