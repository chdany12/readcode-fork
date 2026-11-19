from decimal import Decimal

from payroll.pay import PayPolicy, PayStub, to_cents


class UnbalancedJournal(Exception):
    pass


def build_journal(stub: PayStub, policy: PayPolicy, run_id: str) -> dict:
    match = to_cents(stub.gross * policy.employer_match_rate)
    entries = [
        {"account": "expense:wages", "amount": stub.gross},
        {"account": "liability:tax_withholding", "amount": -stub.withholding},
        {"account": "cash:payroll", "amount": -stub.net},
    ]
    if match > 0:
        entries.append({"account": "expense:employer_match", "amount": match})
        entries.append({"account": "liability:retirement_match", "amount": -match})

    total = sum((e["amount"] for e in entries), Decimal("0"))
    if total != 0:
        raise UnbalancedJournal(f"{run_id}/{stub.employee_id}: off by {total}")
    return {"key": f"payroll:{run_id}:{stub.employee_id}", "entries": entries}


def post_run(ledger, stubs, policy: PayPolicy, run_id: str) -> int:
    posted = 0
    for stub in stubs:
        if stub.gross == 0:
            continue
        journal = build_journal(stub, policy, run_id)
        if ledger.post(journal):
            posted += 1
    return posted
