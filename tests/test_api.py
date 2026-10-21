"""Unit tests for FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient

from tb_guard_ml.api.app import app


@pytest.fixture
def client():
    return TestClient(app)


def test_api_health_endpoint(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HEALTHY"
    assert "disclaimer" in data


def test_api_model_info_endpoint(client: TestClient):
    response = client.get("/model/info")
    assert response.status_code == 200
    data = response.json()
    assert data["is_clinical_diagnostic_tool"] is False
    assert len(data["supported_tasks"]) >= 3


def test_api_event_ingestion_and_duplicate(client: TestClient):
    payload = {
        "event_id": "API_TEST_EVT_001",
        "node_id": "NODE_API_01",
        "site_id": "SITE_API_CLINIC",
        "timestamp": "2026-10-21T12:30:00Z",
        "event_type": "cough_event",
        "cough_event_score": 0.88,
        "quality_status": "good",
    }

    # 1. First submission -> 200 OK Accepted
    res1 = client.post("/events", json=payload)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["accepted"] is True
    assert data1["status"] == "ACCEPTED"

    # 2. Second submission -> 200 OK Suppressed
    res2 = client.post("/events", json=payload)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["accepted"] is False
    assert data2["status"] == "DUPLICATE_SUPPRESSED"


def test_api_event_ingestion_malformed(client: TestClient):
    # Missing required field 'event_type' and invalid score
    bad_payload = {
        "event_id": "API_TEST_BAD",
        "node_id": "NODE_API_01",
        "site_id": "SITE_API_CLINIC",
        "timestamp": "2026-10-21T12:30:00Z",
        "cough_event_score": 5.0,  # Invalid! Must be <= 1.0
    }
    response = client.post("/events", json=bad_payload)
    assert response.status_code == 422


def test_api_site_summary_and_nodes(client: TestClient):
    res_summary = client.get("/sites/SITE_API_CLINIC/summary")
    assert res_summary.status_code == 200
    data = res_summary.json()
    assert data["site_id"] == "SITE_API_CLINIC"
    assert "scientific_disclaimer" in data

    res_nodes = client.get("/nodes")
    assert res_nodes.status_code == 200
    assert isinstance(res_nodes.json(), list)


def test_api_ai_model_status_and_triage(client: TestClient):
    # Test model status
    status_res = client.get("/ai/model-status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["status"] == "TRAINED_READY"
    assert status_data["metrics"]["val_f1_tb"] > 0.8
    assert "scientific_disclaimer" in status_data

    # Test AI triage
    triage_payload = {
        "uuid": "mg_test_uuid_01",
        "result": "TB",
        "confidence": 0.88,
        "coughs": 3,
        "location": "RSKI Universitas Airlangga",
        "zone": "Poli Paru – Ruang Tunggu",
    }
    triage_res = client.post("/ai/triage", json=triage_payload)
    assert triage_res.status_code == 200
    triage_data = triage_res.json()
    assert triage_data["triage_level"] == "HIGH_PRIORITY"
    assert len(triage_data["who_recommended_actions"]) > 0
    assert "scientific_disclaimer" in triage_data

    # Test AI consult
    chat_payload = {
        "uuid": "mg_test_uuid_01",
        "prompt": "Bagaimana risiko penularan di ruang tunggu?",
        "context": {"location": "RSKI Poli Paru", "result": "TB", "confidence": 0.88},
    }
    chat_res = client.post("/ai/consult", json=chat_payload)
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert len(chat_data["reply"]) > 20
    assert len(chat_data["citations"]) > 0


def test_api_classify_audio_live(client: TestClient):
    import io
    import numpy as np
    import soundfile as sf

    # Generate synthetic 1.0 second 16 kHz cough waveform in WAV format
    sr = 16000
    t = np.linspace(0, 1.0, sr, endpoint=False)
    # Burst with higher energy in 2 kHz TB resonant region
    audio = (0.4 * np.sin(2 * np.pi * 2200 * t) + 0.1 * np.random.randn(sr)) * np.exp(-3 * t)
    audio = audio.astype(np.float32)

    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV")
    buf.seek(0)

    files = {"file": ("test_cough.wav", buf, "audio/wav")}
    data = {"patient_name": "Test Participant", "location": "Unit Uji Coba"}

    res = client.post("/ai/classify-audio", files=files, data=data)
    assert res.status_code == 200
    resp_json = res.json()
    assert "uuid" in resp_json
    assert resp_json["result"] in ["TB", "NEG"]
    assert 0.0 <= resp_json["confidence"] <= 1.0
    assert "acoustic_features" in resp_json
    assert "triage" in resp_json
    assert resp_json["triage"]["triage_level"] in ["HIGH_PRIORITY", "MODERATE_RISK", "NEGATIVE_MONITORING"]


