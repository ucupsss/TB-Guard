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
