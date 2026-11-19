from flask import Flask, jsonify, request

from ledger import InsufficientFunds, KeyReuse, Ledger, UnknownAccount

app = Flask(__name__)
ledger = Ledger({"acc_100": 50_000, "acc_200": 1_000})


def problem(status: int, code: str, detail: str):
    resp = jsonify({"error": {"code": code, "detail": detail}})
    resp.status_code = status
    return resp


def validate_transfer(body: object) -> str | None:
    if not isinstance(body, dict):
        return "body must be a JSON object"
    for field in ("source_id", "destination_id"):
        if not isinstance(body.get(field), str) or not body[field]:
            return f"{field} must be a non-empty string"
    if body["source_id"] == body["destination_id"]:
        return "source_id and destination_id must differ"
    amount = body.get("amount_cents")
    if isinstance(amount, bool) or not isinstance(amount, int) or amount <= 0:
        return "amount_cents must be a positive integer"
    return None


@app.post("/v1/transfers")
def create_transfer():
    key = request.headers.get("Idempotency-Key")
    if not key:
        return problem(400, "idempotency_key_required", "Idempotency-Key header is required")
    body = request.get_json(silent=True)
    error = validate_transfer(body)
    if error:
        return problem(400, "invalid_request", error)
    try:
        transfer, replayed = ledger.post_transfer(
            key, body["source_id"], body["destination_id"], body["amount_cents"]
        )
    except UnknownAccount:
        return problem(404, "unknown_account", "source or destination account does not exist")
    except InsufficientFunds:
        return problem(422, "insufficient_funds", "source account balance is too low")
    except KeyReuse:
        return problem(409, "idempotency_key_reused", "key was used with a different request")
    resp = jsonify(transfer)
    resp.status_code = 200 if replayed else 201
    resp.headers["Location"] = f"/v1/transfers/{transfer['source_id']}"
    return resp


@app.get("/v1/transfers/<int:transfer_id>")
def get_transfer(transfer_id: int):
    transfer = ledger.get_transfer(transfer_id)
    if transfer is None:
        return problem(404, "not_found", "transfer not found")
    return jsonify(transfer)
