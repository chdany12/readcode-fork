import copy
import json
import os
from dataclasses import dataclass
from pathlib import Path

ENV_PREFIX = "DISPATCH_"
OVERRIDE_VAR = "DISPATCH_CONFIG_OVERRIDE"
BASE_PATH = Path("/etc/dispatch/config.json")

DEFAULTS = {
    "service": {"name": "dispatch-api", "port": 8080},
    "carrier": {
        "base_url": "https://api.sandbox.carrier.example/v2",
        "timeout_s": 10,
        "max_retries": 3,
    },
    "routing": {"max_stops_per_route": 25, "optimize": True},
}


@dataclass(frozen=True)
class CarrierSettings:
    base_url: str
    timeout_s: int
    max_retries: int


@dataclass(frozen=True)
class RoutingSettings:
    max_stops_per_route: int
    optimize: bool


@dataclass(frozen=True)
class Settings:
    name: str
    port: int
    carrier: CarrierSettings
    routing: RoutingSettings


def _read_json(path):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _deep_merge(base, layer):
    out = copy.deepcopy(base)
    for key, value in layer.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def _lookup(tree, path):
    node = tree
    for part in path:
        node = node.get(part) if isinstance(node, dict) else None
    return node


def _coerce(raw, default):
    if isinstance(default, bool):
        return raw.strip().lower() in ("1", "true", "yes", "on")
    if isinstance(default, int):
        return int(raw)
    return raw


def _apply_env(cfg, environ):
    for name, raw in environ.items():
        if not name.startswith(ENV_PREFIX) or name == OVERRIDE_VAR:
            continue
        path = name[len(ENV_PREFIX):].lower().split("__")
        node = cfg
        for part in path[:-1]:
            node = node.setdefault(part, {})
        node[path[-1]] = _coerce(raw, _lookup(DEFAULTS, path))
    return cfg


def _section(cfg, name):
    return {**DEFAULTS[name], **cfg.get(name, {})}


def load_config(environ=None):
    environ = os.environ if environ is None else environ

    merged = copy.deepcopy(DEFAULTS)
    if BASE_PATH.exists():
        merged = _deep_merge(merged, _read_json(BASE_PATH))

    override_path = environ.get(OVERRIDE_VAR)
    if override_path:
        merged.update(_read_json(override_path))

    merged = _apply_env(merged, environ)

    service = _section(merged, "service")
    carrier = _section(merged, "carrier")
    routing = _section(merged, "routing")
    return Settings(
        name=service["name"],
        port=service["port"],
        carrier=CarrierSettings(
            base_url=carrier["base_url"],
            timeout_s=carrier["timeout_s"],
            max_retries=carrier["max_retries"],
        ),
        routing=RoutingSettings(
            max_stops_per_route=routing["max_stops_per_route"],
            optimize=routing["optimize"],
        ),
    )
