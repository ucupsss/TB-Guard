"""Multi-node acoustic event simulation, gateway deduplication, and aggregation."""

from tb_guard_ml.simulation.nodes import SimulatedAcousticNode, AcousticEvent, NodeFleet
from tb_guard_ml.simulation.gateway import IngestionGateway, GatewayIngestResult
from tb_guard_ml.simulation.aggregation import EventAggregator, SiteSummaryReport

__all__ = [
    "SimulatedAcousticNode",
    "AcousticEvent",
    "NodeFleet",
    "IngestionGateway",
    "GatewayIngestResult",
    "EventAggregator",
    "SiteSummaryReport",
]
