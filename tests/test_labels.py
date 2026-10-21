"""Unit tests for label mapping and feature matrix safeguards."""

import pytest

from tb_guard_ml.data.labels import LabelMapper, CLASS_TB_NEGATIVE, CLASS_TB_POSITIVE


def test_label_mapping_positive_and_negative():
    mapper = LabelMapper()

    # Valid positive variants
    for val in ["positive", "tb_positive", "culture_positive", "genexpert_positive", "1", "POS"]:
        target, reason = mapper.map_label(val)
        assert target == CLASS_TB_POSITIVE
        assert reason is None

    # Valid negative variants
    for val in ["negative", "tb_negative", "culture_negative", "genexpert_negative", "0", "NEG"]:
        target, reason = mapper.map_label(val)
        assert target == CLASS_TB_NEGATIVE
        assert reason is None


def test_missing_and_unknown_labels_never_default_to_negative():
    """Scientific safeguard: Missing or indeterminate labels must NEVER be silently imputed as 0/negative."""
    mapper = LabelMapper()

    # Missing / None
    target_none, reason_none = mapper.map_label(None)
    assert target_none is None
    assert "missing" in reason_none

    # Indeterminate
    for val in ["indeterminate", "unknown", "contaminated", "inconclusive", "nan", ""]:
        target, reason = mapper.map_label(val)
        assert target is None
        assert "indeterminate" in reason

    # Unsupported / random unrecognized label
    target_unsupp, reason_unsupp = mapper.map_label("random_ambiguous_text")
    assert target_unsupp is None
    assert "unsupported" in reason_unsupp


def test_prohibited_clinical_metadata_in_audio_features():
    """Scientific safeguard: Enforce that demographic/symptom metadata cannot contaminate audio feature matrix."""
    # Permitted audio feature columns
    safe_columns = [f"emb_{i}" for i in range(512)] + ["audio_rms", "audio_peak"]
    LabelMapper.validate_feature_matrix_columns(safe_columns)  # Should not raise

    # Prohibited columns
    violating_cases = [
        ["emb_0", "participant_age"],
        ["emb_0", "patient_sex"],
        ["emb_0", "symptoms_cough_duration"],
        ["emb_0", "hiv_status"],
    ]
    for cols in violating_cases:
        with pytest.raises(ValueError, match="Scientific Safeguard Violation"):
            LabelMapper.validate_feature_matrix_columns(cols)
