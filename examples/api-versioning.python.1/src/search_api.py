import base64
import json
from typing import Any, Dict, List, Mapping, Optional, Tuple

from versions import (
    DEPRECATED_VERSIONS,
    SUPPORTED_VERSIONS,
    UnsupportedVersion,
    parse_version,
)

PAGE_SIZE = 20


def _shape_v1(hits: List[dict], total: int, next_cursor: Optional[str]) -> dict:
    return {
        "total": total,
        "results": [
            {"id": h["id"], "title": h["title"], "score": round(h["score"], 3)}
            for h in hits
        ],
    }


def _shape_v2(hits: List[dict], total: int, next_cursor: Optional[str]) -> dict:
    return {
        "total": total,
        "results": [
            {
                "id": h["id"],
                "title": h["title"],
                "snippet": h.get("snippet", ""),
                "relevance": round(h["score"], 3),
            }
            for h in hits
        ],
    }


def _shape_v3(hits: List[dict], total: int, next_cursor: Optional[str]) -> dict:
    return {
        "items": [
            {
                "id": h["id"],
                "title": h["title"],
                "snippet": h.get("snippet", ""),
                "relevance": round(h["score"], 3),
            }
            for h in hits
        ],
        "next_cursor": next_cursor,
    }


SHAPERS = {1: _shape_v1, 2: _shape_v2, 3: _shape_v3}


def _encode_cursor(offset: int) -> str:
    return base64.urlsafe_b64encode(f"o:{offset}".encode()).decode()


def _decode_cursor(cursor: Optional[str]) -> int:
    if not cursor:
        return 0
    decoded = base64.urlsafe_b64decode(cursor.encode()).decode()
    prefix, _, value = decoded.partition(":")
    if prefix != "o":
        raise ValueError("bad cursor")
    return int(value)


def _page_start(version: int, params: Mapping[str, str]) -> int:
    if version >= 3:
        return _decode_cursor(params.get("cursor"))
    return max(int(params.get("offset", 0)), 0)


def _respond(status: int, body: Dict[str, Any], version: Optional[int]) -> Tuple[int, dict, str]:
    headers = {"Content-Type": "application/json", "Vary": "Accept-Version"}
    if version is not None:
        headers["API-Version"] = str(version)
        sunset = DEPRECATED_VERSIONS.get(version)
        if sunset:
            headers["Deprecation"] = "true"
            headers["Sunset"] = sunset
    return status, headers, json.dumps(body)


def handle_search(headers: Mapping[str, str], params: Mapping[str, str], index) -> Tuple[int, dict, str]:
    try:
        version = parse_version(headers.get("Accept-Version")) or max(SUPPORTED_VERSIONS)
    except UnsupportedVersion:
        return _respond(400, {"error": "unsupported_version", "supported": list(SUPPORTED_VERSIONS)}, None)

    query = (params.get("q") or "").strip()
    if not query:
        return _respond(400, {"error": "missing_query"}, version)

    try:
        start = _page_start(version, params)
    except ValueError:
        return _respond(400, {"error": "invalid_paging"}, version)

    hits, total = index.search(query, start, PAGE_SIZE)
    consumed = start + len(hits)
    next_cursor = _encode_cursor(consumed) if consumed < total else None
    body = SHAPERS[version](hits, total, next_cursor)
    return _respond(200, body, version)
