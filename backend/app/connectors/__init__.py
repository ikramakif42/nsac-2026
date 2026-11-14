"""Connector registry."""
from app.connectors.base import BaseConnector
from app.connectors.qr3 import QR3Connector
from app.connectors.synthetic import SyntheticConnector
from app.connectors.wiseview import WiseViewConnector
from app.connectors.gaia import GaiaConnector

_registry: dict[str, BaseConnector] = {}


def _register(c: BaseConnector):
    _registry[c.id] = c


# Register all connectors at import time
_register(QR3Connector())
_register(SyntheticConnector())
_register(WiseViewConnector())
_register(GaiaConnector())


def get_connector(source_id: str) -> BaseConnector | None:
    return _registry.get(source_id)


def list_connectors() -> list[BaseConnector]:
    return list(_registry.values())

