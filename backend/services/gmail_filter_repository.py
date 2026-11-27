import json
import os
import threading
from typing import Dict, Any

from agent.utils.logger import get_logger

logger = get_logger(__name__)

_LOCK = threading.Lock()

DEFAULT_FILTERS = {
    "ignore_terms": ["noreply", "no-reply", "newsletter", "unsubscribe", "promotions", "notifications@", "spam", "social"],
    "important_terms": ["invoice", "urgent", "payment", "contract", "deadline", "meeting"],
    "only_important": False,
    "max_results": 10,
}


class GmailFilterRepository:
    """Stores per-session Gmail filtering preferences in a JSON file.

    Filters are a lightweight user preference (not a credential), so they are
    kept in a flat file next to the other file-backed stores in this project
    instead of adding a DB migration for them.
    """

    def __init__(self, storage_path: str = None):
        self.storage_path = storage_path or os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "data",
            "gmail_filters.json",
        )

    def _read_all(self) -> Dict[str, Any]:
        if not os.path.exists(self.storage_path):
            return {}
        try:
            with open(self.storage_path, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read Gmail filters file: {e}")
            return {}

    def _write_all(self, data: Dict[str, Any]) -> None:
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        with open(self.storage_path, "w") as f:
            json.dump(data, f, indent=2)

    def get(self, session_id: str) -> Dict[str, Any]:
        with _LOCK:
            data = self._read_all()
            return {**DEFAULT_FILTERS, **data.get(session_id, {})}

    def save(self, session_id: str, filters: Dict[str, Any]) -> Dict[str, Any]:
        with _LOCK:
            data = self._read_all()
            merged = {**DEFAULT_FILTERS, **data.get(session_id, {}), **filters}
            data[session_id] = merged
            self._write_all(data)
            logger.info(f"Saved Gmail filters for session {session_id}")
            return merged
