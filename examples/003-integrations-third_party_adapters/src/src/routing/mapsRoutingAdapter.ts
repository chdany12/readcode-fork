import { LatLng, RouteEstimate, RouteNotFoundError, RoutingUnavailableError } from "./types";

interface MapsApiResponse {
  status: "OK" | "ZERO_RESULTS" | "OVER_QUERY_LIMIT" | "INVALID_REQUEST";
  routes: Array<{
    legs: Array<{
      duration: { value: number };
      duration_in_traffic?: { value: number };
      distance: { value: number };
    }>;
  }>;
}

export interface MapsAdapterConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxAttempts: number;
}

const RETRYABLE_HTTP = new Set([429, 502, 503, 504]);

export class MapsRoutingAdapter {
  constructor(
    private readonly config: MapsAdapterConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ) {}

  async estimate(origin: LatLng, destination: LatLng): Promise<RouteEstimate> {
    const url = new URL("/directions/json", this.config.baseUrl);
    url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
    url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
    url.searchParams.set("departure_time", "now");

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const body = await this.callOnce(url);
        return this.toEstimate(body, origin, destination);
      } catch (err) {
        if (!(err instanceof RetryableError)) throw err;
        lastError = err;
        if (attempt < this.config.maxAttempts) {
          await this.sleep(200 * 2 ** (attempt - 1) + Math.random() * 100);
        }
      }
    }
    throw new RoutingUnavailableError("maps provider unavailable", lastError);
  }

  private async callOnce(url: URL): Promise<MapsApiResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        headers: { "X-Goog-Api-Key": this.config.apiKey },
        signal: controller.signal,
      });
    } catch (err) {
      throw new RetryableError("network error or timeout", err);
    } finally {
      clearTimeout(timer);
    }

    if (RETRYABLE_HTTP.has(res.status)) {
      throw new RetryableError(`maps http ${res.status}`);
    }
    if (!res.ok) {
      throw new RoutingUnavailableError(`maps http ${res.status}`);
    }

    const body = (await res.json()) as MapsApiResponse;
    if (body.status === "OVER_QUERY_LIMIT") {
      throw new RetryableError("maps quota exceeded");
    }
    return body;
  }

  private toEstimate(body: MapsApiResponse, origin: LatLng, destination: LatLng): RouteEstimate {
    if (body.status === "ZERO_RESULTS" || body.routes.length === 0) {
      throw new RouteNotFoundError(origin, destination);
    }
    if (body.status !== "OK") {
      throw new RoutingUnavailableError(`maps status ${body.status}`);
    }
    const legs = body.routes[0].legs;
    let duration = 0;
    let distance = 0;
    let trafficAware = true;
    for (const leg of legs) {
      if (leg.duration_in_traffic) {
        duration += leg.duration_in_traffic.value;
      } else {
        duration += leg.duration.value;
        trafficAware = false;
      }
      distance += leg.distance.value;
    }
    return { durationSeconds: duration, distanceMeters: distance, trafficAware };
  }
}

class RetryableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
  }
}
