"""Configuration module for TB-Guard ML Pipeline."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional

import yaml


@dataclass
class AudioConfig:
    sample_rate: int = 16000
    window_duration_seconds: float = 2.0
    channels: int = 1
    normalize_amplitude: bool = False  # Keep false by default to preserve dynamic range
    min_duration_seconds: float = 0.5
    max_duration_seconds: float = 60.0

    @property
    def window_samples(self) -> int:
        return int(self.sample_rate * self.window_duration_seconds)


@dataclass
class SplitConfig:
    seed: int = 42
    train_ratio: float = 0.70
    val_ratio: float = 0.15
    test_ratio: float = 0.15
    stratify_by_target: bool = True


@dataclass
class EncoderConfig:
    name: str = "google/hear"
    embedding_dim: int = 512
    batch_size: int = 16
    device: str = "cpu"
    use_cache: bool = True
    cache_dir: Path = field(default_factory=lambda: Path(".cache/hear_embeddings"))


@dataclass
class ClassifierConfig:
    model_type: str = "logistic_regression"  # "logistic_regression" or "class_weighted_linear"
    c_regularization: float = 1.0
    max_iter: int = 1000
    class_weight: str = "balanced"
    random_state: int = 42
    decision_threshold: Optional[float] = None  # Tuned on validation split if None


@dataclass
class PipelineConfig:
    experiment_name: str = "tb_guard_baseline"
    dataset_root: Path = field(default_factory=lambda: Path("data/raw"))
    interim_dir: Path = field(default_factory=lambda: Path("data/interim"))
    processed_dir: Path = field(default_factory=lambda: Path("data/processed"))
    splits_dir: Path = field(default_factory=lambda: Path("data/splits"))
    models_dir: Path = field(default_factory=lambda: Path("models"))
    reports_dir: Path = field(default_factory=lambda: Path("reports"))
    manifest_path: Path = field(default_factory=lambda: Path("data/manifest.csv"))
    
    audio: AudioConfig = field(default_factory=AudioConfig)
    split: SplitConfig = field(default_factory=SplitConfig)
    encoder: EncoderConfig = field(default_factory=EncoderConfig)
    classifier: ClassifierConfig = field(default_factory=ClassifierConfig)
    
    logging_level: str = "INFO"

    @classmethod
    def from_yaml(cls, path: str | Path) -> PipelineConfig:
        """Load configuration from a YAML file, resolving paths and environment variables."""
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Configuration file not found: {path}")

        with open(path, "r", encoding="utf-8") as f:
            data: Dict[str, Any] = yaml.safe_load(f) or {}

        audio_data = data.get("audio", {})
        split_data = data.get("split", {})
        encoder_data = data.get("encoder", {})
        classifier_data = data.get("classifier", {})

        return cls(
            experiment_name=data.get("experiment_name", "tb_guard_baseline"),
            dataset_root=Path(os.environ.get("TB_GUARD_DATA_DIR", data.get("dataset_root", "data/raw"))),
            interim_dir=Path(data.get("interim_dir", "data/interim")),
            processed_dir=Path(data.get("processed_dir", "data/processed")),
            splits_dir=Path(data.get("splits_dir", "data/splits")),
            models_dir=Path(os.environ.get("TB_GUARD_MODELS_DIR", data.get("models_dir", "models"))),
            reports_dir=Path(os.environ.get("TB_GUARD_REPORTS_DIR", data.get("reports_dir", "reports"))),
            manifest_path=Path(data.get("manifest_path", "data/manifest.csv")),
            audio=AudioConfig(
                sample_rate=int(audio_data.get("sample_rate", 16000)),
                window_duration_seconds=float(audio_data.get("window_duration_seconds", 2.0)),
                channels=int(audio_data.get("channels", 1)),
                normalize_amplitude=bool(audio_data.get("normalize_amplitude", False)),
                min_duration_seconds=float(audio_data.get("min_duration_seconds", 0.5)),
                max_duration_seconds=float(audio_data.get("max_duration_seconds", 60.0)),
            ),
            split=SplitConfig(
                seed=int(split_data.get("seed", 42)),
                train_ratio=float(split_data.get("train_ratio", 0.70)),
                val_ratio=float(split_data.get("val_ratio", 0.15)),
                test_ratio=float(split_data.get("test_ratio", 0.15)),
                stratify_by_target=bool(split_data.get("stratify_by_target", True)),
            ),
            encoder=EncoderConfig(
                name=str(encoder_data.get("name", "google/hear")),
                embedding_dim=int(encoder_data.get("embedding_dim", 512)),
                batch_size=int(encoder_data.get("batch_size", 16)),
                device=str(os.environ.get("TB_GUARD_DEVICE", encoder_data.get("device", "cpu"))),
                use_cache=bool(encoder_data.get("use_cache", True)),
                cache_dir=Path(os.environ.get("TB_GUARD_CACHE_DIR", encoder_data.get("cache_dir", ".cache/hear_embeddings"))),
            ),
            classifier=ClassifierConfig(
                model_type=str(classifier_data.get("model_type", "logistic_regression")),
                c_regularization=float(classifier_data.get("c_regularization", 1.0)),
                max_iter=int(classifier_data.get("max_iter", 1000)),
                class_weight=str(classifier_data.get("class_weight", "balanced")),
                random_state=int(classifier_data.get("random_state", 42)),
                decision_threshold=classifier_data.get("decision_threshold", None),
            ),
            logging_level=str(os.environ.get("TB_GUARD_LOG_LEVEL", data.get("logging_level", "INFO"))),
        )

    def ensure_directories(self) -> None:
        """Create configured directory tree if not present."""
        for p in [
            self.dataset_root,
            self.interim_dir,
            self.processed_dir,
            self.splits_dir,
            self.models_dir,
            self.reports_dir,
            self.encoder.cache_dir,
            self.manifest_path.parent,
        ]:
            p.mkdir(parents=True, exist_ok=True)
