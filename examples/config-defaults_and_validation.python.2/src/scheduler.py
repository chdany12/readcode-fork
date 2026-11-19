from pipeline_config import load_pipeline


def execution_order(stages):
    by_name = {s["name"]: s for s in stages}
    done, order = set(), []
    remaining = list(by_name)
    while remaining:
        ready = [n for n in remaining if all(d in done for d in by_name[n]["needs"])]
        if not ready:
            raise RuntimeError(f"dependency cycle among {sorted(remaining)}")
        for name in ready:
            done.add(name)
            order.append(by_name[name])
        remaining = [n for n in remaining if n not in done]
    return order


def plan(doc):
    stages = execution_order(load_pipeline(doc))
    return [
        {
            "stage": s["name"],
            "timeout_s": s["timeout_minutes"] * 60,
            "attempts": s["retries"] + 1,
            "env": dict(s["env"]),
        }
        for s in stages
    ]
