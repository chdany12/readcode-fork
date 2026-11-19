import { ConfigError, loadConfig } from "./config";

export function bootstrap(): void {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
  console.log(
    JSON.stringify({
      msg: "dispatch starting",
      port: config.port,
      radiusKm: config.courierSearchRadiusKm,
      surge: config.surge.enabled,
    }),
  );
}
