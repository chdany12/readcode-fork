BUILTIN_STAGE_DEFAULTS = {
    "timeout_minutes": 30,
    "retries": 0,
    "allow_failure": False,
    "needs": [],
    "env": {},
}

ALLOWED_STAGE_KEYS = {"run", "image"} | set(BUILTIN_STAGE_DEFAULTS)
ALLOWED_DEFAULT_KEYS = set(BUILTIN_STAGE_DEFAULTS) - {"needs"}


class ConfigError(Exception):
    def __init__(self, problems):
        super().__init__("; ".join(problems))
        self.problems = problems


def resolve_stage(name, raw, pipeline_defaults):
    stage = dict(BUILTIN_STAGE_DEFAULTS)
    stage.update(pipeline_defaults)
    stage.update(raw)
    stage["name"] = name
    stage["env"].setdefault("STAGE_NAME", name)
    return stage


def _check_stage(name, stage, all_names):
    problems = []
    unknown = set(stage) - ALLOWED_STAGE_KEYS - {"name"}
    if unknown:
        problems.append(f"{name}: unknown keys {sorted(unknown)}")
    if not stage.get("run"):
        problems.append(f"{name}: 'run' is required")
    if not isinstance(stage["timeout_minutes"], int) or not 1 <= stage["timeout_minutes"] <= 240:
        problems.append(f"{name}: timeout_minutes must be an integer in 1..240")
    if not isinstance(stage["retries"], int) or not 0 <= stage["retries"] <= 5:
        problems.append(f"{name}: retries must be an integer in 0..5")
    for dep in stage["needs"]:
        if dep == name:
            problems.append(f"{name}: cannot depend on itself")
        elif dep not in all_names:
            problems.append(f"{name}: needs unknown stage {dep!r}")
    return problems


def load_pipeline(doc):
    raw_defaults = doc.get("defaults", {})
    bad_defaults = set(raw_defaults) - ALLOWED_DEFAULT_KEYS
    if bad_defaults:
        raise ConfigError([f"defaults: unknown keys {sorted(bad_defaults)}"])

    raw_stages = doc.get("stages")
    if not isinstance(raw_stages, dict) or not raw_stages:
        raise ConfigError(["stages: at least one stage is required"])

    names = set(raw_stages)
    stages, problems = [], []
    for name, raw in raw_stages.items():
        stage = resolve_stage(name, raw, raw_defaults)
        problems.extend(_check_stage(name, stage, names))
        stages.append(stage)

    if problems:
        raise ConfigError(problems)
    return stages
