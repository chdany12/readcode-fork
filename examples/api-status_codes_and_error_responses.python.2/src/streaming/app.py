from typing import Iterator

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from streaming.catalog import Catalog
from streaming.ranges import RangeNotSatisfiable, parse_range

app = FastAPI()
catalog = Catalog()
CHUNK = 64 * 1024


def _chunks(path: str, start: int, end: int) -> Iterator[bytes]:
    remaining = end - start + 1
    with open(path, "rb") as fh:
        fh.seek(start)
        while remaining > 0:
            data = fh.read(min(CHUNK, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


@app.exception_handler(RangeNotSatisfiable)
async def range_not_satisfiable(_request: Request, exc: RangeNotSatisfiable):
    return JSONResponse(
        status_code=416,
        content={"error": "range_not_satisfiable"},
        headers={"Content-Range": f"bytes */{exc.size}"},
    )


@app.get("/videos/{video_id}/manifest")
def manifest(video_id: str, request: Request, authorization: str = Header(default=None)):
    if not authorization:
        raise HTTPException(
            status_code=401, detail="missing token", headers={"WWW-Authenticate": "Bearer"}
        )
    viewer = catalog.viewer_for_token(authorization)
    if viewer is None:
        raise HTTPException(
            status_code=401, detail="invalid token", headers={"WWW-Authenticate": "Bearer"}
        )

    video = catalog.find(video_id)
    if video is None:
        raise HTTPException(status_code=404, detail="video not found")
    if video.removed:
        raise HTTPException(status_code=410, detail="video was removed")
    if viewer.country in video.blocked_countries:
        raise HTTPException(status_code=451, detail="not available in your region")
    if video.premium and not viewer.subscribed:
        raise HTTPException(status_code=403, detail="subscription required")
    return {"video_id": video.id, "segments": video.segment_urls}


@app.get("/segments/{segment_id}")
def segment(segment_id: str, range: str = Header(default=None)):
    seg = catalog.find_segment(segment_id)
    if seg is None:
        raise HTTPException(status_code=404, detail="segment not found")

    byte_range = parse_range(range, seg.size)
    if byte_range is None:
        return StreamingResponse(
            _chunks(seg.path, 0, seg.size - 1),
            status_code=200,
            media_type="video/mp4",
            headers={"Content-Length": str(seg.size), "Accept-Ranges": "bytes"},
        )

    start, end = byte_range.start, byte_range.end
    status_code = 206 if end < seg.size - 1 else 200
    return StreamingResponse(
        _chunks(seg.path, start, end),
        status_code=status_code,
        media_type="video/mp4",
        headers={
            "Content-Range": f"bytes {start}-{end}/{seg.size}",
            "Content-Length": str(end - start + 1),
            "Accept-Ranges": "bytes",
        },
    )
