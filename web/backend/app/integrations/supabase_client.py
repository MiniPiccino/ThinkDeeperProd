from __future__ import annotations

import json
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence, Tuple, Union

import httpx


class SupabaseClient:
    """Minimal PostgREST client for Supabase REST endpoints."""

    def __init__(self, project_url: str, service_key: str, timeout: float = 10.0) -> None:
        base = project_url.rstrip("/")
        if not base.endswith("/rest/v1"):
            base = f"{base}/rest/v1"
        self._rest_url = base
        self._service_key = service_key
        self._client = httpx.Client(timeout=timeout)

    def insert(self, table: str, payload: Union[Mapping[str, Any], Sequence[Mapping[str, Any]]]) -> List[Dict[str, Any]]:
        body = self._normalize_body(payload)
        response = self._client.post(
            self._url_for(table),
            headers=self._headers(prefer="return=representation"),
            content=json.dumps(body),
        )
        self._raise_for_status(response)
        return self._safe_json(response)

    def upsert(
        self,
        table: str,
        payload: Union[Mapping[str, Any], Sequence[Mapping[str, Any]]],
        conflict_column: str,
    ) -> List[Dict[str, Any]]:
        body = self._normalize_body(payload)
        response = self._client.post(
            self._url_for(table),
            params={"on_conflict": conflict_column},
            headers=self._headers(prefer="resolution=merge-duplicates,return=representation"),
            content=json.dumps(body),
        )
        self._raise_for_status(response)
        return self._safe_json(response)

    def select(
        self,
        table: str,
        filters: Optional[Mapping[str, Union[Any, Tuple[str, Any]]]] = None,
        *,
        order: Optional[Tuple[str, str]] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        params: MutableMapping[str, str] = {"select": "*"}
        if filters:
            for column, raw in filters.items():
                op, value = raw if isinstance(raw, tuple) else ("eq", raw)
                params[column] = f"{op}.{value}"
        if order:
            column, direction = order
            params["order"] = f"{column}.{direction}"
        if limit is not None:
            params["limit"] = str(limit)
        response = self._client.get(
            self._url_for(table),
            headers=self._headers(),
            params=params,
        )
        self._raise_for_status(response)
        return self._safe_json(response)

    def _url_for(self, table: str) -> str:
        return f"{self._rest_url}/{table}"

    def _headers(self, *, prefer: Optional[str] = None) -> Dict[str, str]:
        headers = {
            "apikey": self._service_key,
            "Authorization": f"Bearer {self._service_key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        return headers

    @staticmethod
    def _normalize_body(payload: Union[Mapping[str, Any], Sequence[Mapping[str, Any]]]) -> List[Mapping[str, Any]]:
        if isinstance(payload, Mapping):
            return [payload]
        return list(payload)

    @staticmethod
    def _raise_for_status(response: httpx.Response) -> None:
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:  # pragma: no cover - simple pass-through
            detail = exc.response.text
            raise RuntimeError(f"Supabase request failed: {detail}") from exc

    @staticmethod
    def _safe_json(response: httpx.Response) -> List[Dict[str, Any]]:
        if not response.content:
            return []
        data = response.json()
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return [data]
        return []

