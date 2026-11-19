from flask import Blueprint, Response, current_app, jsonify, request, url_for

from feedapi.errors import ApiError

bp = Blueprint("feed", __name__, url_prefix="/v1")

MAX_TEXT = 500
MAX_PAGE = 50


def _services():
    return current_app.config["posts"], current_app.config["social"], current_app.config["limiter"]


def require_viewer():
    viewer = current_app.config["auth"].viewer_from(request.headers.get("Authorization"))
    if viewer is None:
        raise ApiError(401, "unauthenticated", "valid credentials required",
                       headers={"WWW-Authenticate": "Bearer"})
    return viewer


def _visible_post(posts, social, post_id, viewer):
    post = posts.get(post_id)
    if post is None:
        raise ApiError(404, "post_not_found", "post not found")
    if post.author_id != viewer.id:
        if social.is_blocked(post.author_id, viewer.id):
            raise ApiError(404, "post_not_found", "post not found")
        if post.visibility == "followers" and not social.follows(viewer.id, post.author_id):
            raise ApiError(404, "post_not_found", "post not found")
    if post.deleted:
        raise ApiError(410, "post_deleted", "post was deleted")
    return post


@bp.post("/posts")
def create_post():
    posts, _social, limiter = _services()
    viewer = require_viewer()
    if not request.is_json:
        raise ApiError(415, "unsupported_media_type", "Content-Type must be application/json")
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ApiError(400, "invalid_json", "body must be a JSON object")

    problems = {}
    text = body.get("text")
    if not isinstance(text, str) or not text.strip():
        problems["text"] = "required"
    elif len(text) > MAX_TEXT:
        problems["text"] = "must be at most %d characters" % MAX_TEXT
    visibility = body.get("visibility", "public")
    if visibility not in ("public", "followers"):
        problems["visibility"] = "must be public or followers"
    if problems:
        raise ApiError(422, "validation_failed", "request has invalid fields", details=problems)

    wait = limiter.check(viewer.id, "create_post")
    if wait:
        raise ApiError(429, "rate_limited", "too many posts", headers={"Retry-After": str(wait)})

    post = posts.create(viewer.id, text.strip(), visibility)
    resp = jsonify(post.to_dict())
    resp.status_code = 201
    resp.headers["Location"] = url_for("feed.get_post", post_id=post.id)
    return resp


@bp.get("/posts/<post_id>")
def get_post(post_id):
    posts, social, _limiter = _services()
    viewer = require_viewer()
    return jsonify(_visible_post(posts, social, post_id, viewer).to_dict())


@bp.delete("/posts/<post_id>")
def delete_post(post_id):
    posts, social, _limiter = _services()
    viewer = require_viewer()
    post = posts.get(post_id)
    if post is None:
        raise ApiError(404, "post_not_found", "post not found")
    if post.author_id != viewer.id:
        _visible_post(posts, social, post_id, viewer)
        raise ApiError(403, "forbidden", "only the author can delete a post")
    if not post.deleted:
        posts.soft_delete(post_id)
    return Response(status=204)


@bp.get("/feed")
def feed():
    posts, _social, _limiter = _services()
    viewer = require_viewer()
    try:
        limit = int(request.args.get("limit", "20"))
    except ValueError:
        raise ApiError(400, "invalid_parameter", "limit must be an integer")
    if not 1 <= limit <= MAX_PAGE:
        raise ApiError(400, "invalid_parameter", "limit must be between 1 and %d" % MAX_PAGE)

    items = posts.feed_for(viewer.id, limit)
    etag = '"%s"' % posts.feed_fingerprint(items)
    if request.if_none_match.contains(etag):
        resp = Response(status=304)
        resp.headers["ETag"] = etag
        return resp
    resp = jsonify({"items": [p.to_dict() for p in items]})
    resp.headers["ETag"] = etag
    return resp
