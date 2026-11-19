import os
import sys

from ingest import TelemetryIngest
from runtime import ConfigError, load_profile


def build_sink(broker):
    if not broker:
        return lambda batch: print(f"[local sink] {len(batch)} readings")
    from mqtt_client import publish_batch
    return lambda batch: publish_batch(broker, "telemetry/v1", batch)


def main():
    try:
        profile, broker = load_profile(os.environ)
    except ConfigError as exc:
        print(f"startup aborted: {exc}", file=sys.stderr)
        raise SystemExit(78)
    return TelemetryIngest(profile, build_sink(broker))
