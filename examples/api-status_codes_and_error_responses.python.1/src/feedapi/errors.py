import logging

from flask import jsonify
from werkzeug.exceptions import HTTPException

log = logging.getLogger("feedapi")


class ApiError(Exception):
    def __init__(self, status, code, message, headers=None, details=None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.headers = headers or {}
        self.details = details


def _body(code, message, details=None):
    payload = {"error": {"code": code, "message": message}}
    if details:
        payload["error"]["details"] = details
    return payload


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(err):
        resp = jsonify(_body(err.code, err.message, err.details))
        resp.status_code = err.status
        for name, value in err.headers.items():
            resp.headers[name] = value
        return resp

    @app.errorhandler(HTTPException)
    def handle_http_error(err):
        resp = jsonify(_body(err.name.lower().replace(" ", "_"), err.description))
        resp.status_code = err.code
        return resp

    @app.errorhandler(Exception)
    def handle_unexpected(err):
        log.exception("unhandled error")
        resp = jsonify(_body("internal_error", "something went wrong"))
        resp.status_code = 500
        return resp
