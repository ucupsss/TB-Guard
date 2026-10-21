"""FastAPI application for TB-Guard edge ingestion and site aggregation."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

from tb_guard_ml import __version__
from tb_guard_ml.simulation.aggregation import EventAggregator, SiteSummaryReport
from tb_guard_ml.simulation.gateway import IngestionGateway
from tb_guard_ml.simulation.nodes import AcousticEvent

logger = logging.getLogger(__name__)

app = FastAPI(
    title="TB-Guard ML Pipeline & Simulation API",
    description="Research-stage acoustic event ingestion, multi-node gateway deduplication, and site aggregation.",
    version=__version__,
)

# Global gateway and aggregator state
gateway = IngestionGateway()
aggregator = EventAggregator()


class IngestEventRequest(BaseModel):
    event_id: str = Field(..., description="Unique event identifier")
    node_id: str = Field(..., description="ID of transmitting acoustic sensor node")
    site_id: str = Field(..., description="Monitored clinic site or zone ID")
    timestamp: str = Field(..., description="ISO-8601 UTC timestamp")
    event_type: str = Field(..., description="'cough_event', 'speech', or 'ambient_noise'")
    cough_event_score: float = Field(..., ge=0.0, le=1.0, description="Acoustic event confidence score (0.0 to 1.0)")
    quality_status: str = Field(default="good", description="'good', 'degraded', or 'clipped'")
    model_version: str = Field(default="hear_detector_v1", description="Detector model version")
    correlation_id: Optional[str] = Field(default=None, description="Optional request correlation ID")


class HealthResponse(BaseModel):
    status: str
    version: str
    active_nodes: int
    total_accepted_events: int
    disclaimer: str


class ModelInfoResponse(BaseModel):
    pipeline_version: str
    supported_tasks: List[str]
    scientific_notice: str
    is_clinical_diagnostic_tool: bool


@app.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """System health check and gateway metrics."""
    nodes = gateway.get_node_health()
    active_count = sum(1 for n in nodes if n.is_active)
    return HealthResponse(
        status="HEALTHY",
        version=__version__,
        active_nodes=active_count,
        total_accepted_events=len(gateway.accepted_events),
        disclaimer=(
            "TB-Guard is an investigational research prototype for public health screening studies. "
            "It is not a diagnostic device."
        ),
    )


@app.get("/model/info", response_model=ModelInfoResponse)
def get_model_info() -> ModelInfoResponse:
    """Return model architecture details, capabilities, and scientific boundaries."""
    return ModelInfoResponse(
        pipeline_version=__version__,
        supported_tasks=[
            "Acoustic event detection (cough screening)",
            "Exploratory TB-associated representation research",
            "Multi-node event aggregation and duplicate suppression",
        ],
        scientific_notice=(
            "Audio representations alone cannot establish active tuberculosis infection or clinical diagnosis. "
            "Predictions must never be presented as medical diagnoses."
        ),
        is_clinical_diagnostic_tool=False,
    )


@app.post("/events", status_code=status.HTTP_200_OK)
def ingest_event(req: IngestEventRequest) -> Dict[str, Any]:
    """Ingest acoustic event through gateway with idempotency and duplicate suppression."""
    res = gateway.ingest_event(req.model_dump())
    if not res.accepted and res.status == "VALIDATION_FAILED":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=res.message)
    return {
        "accepted": res.accepted,
        "event_id": res.event_id,
        "status": res.status,
        "correlation_id": res.correlation_id,
        "message": res.message,
    }


@app.get("/sites/{site_id}/summary")
def get_site_summary(site_id: str) -> Dict[str, Any]:
    """Return aggregated event counts, cough frequency, and review flags for a given site."""
    report = aggregator.aggregate_site_events(site_id=site_id, events=gateway.accepted_events)
    return report.to_dict()


@app.get("/nodes")
def list_nodes() -> List[Dict[str, Any]]:
    """List all registered edge nodes and their health status."""
    return [
        {
            "node_id": n.node_id,
            "site_id": n.site_id,
            "last_seen_iso": n.last_seen_iso,
            "total_events_received": n.total_events_received,
            "is_active": n.is_active,
        }
        for n in gateway.get_node_health()
    ]
