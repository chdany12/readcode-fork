export type AppEnv = "development" | "test" | "staging" | "production";

export interface EnvProfile {
  name: AppEnv;
  patientDataSource: "synthetic" | "prod-snapshot" | "live";
  smsProvider: "console" | "twilio";
  redirectSmsTo: string | null;
  reminderLeadHours: number;
}

export function resolveEnv(raw: string | undefined): AppEnv {
  switch (raw) {
    case "development":
    case "test":
    case "staging":
    case "production":
      return raw;
    case undefined:
    case "":
      return "development";
    default:
      throw new Error(`unknown APP_ENV "${raw}"`);
  }
}

export function buildProfile(env: NodeJS.ProcessEnv): EnvProfile {
  const name = resolveEnv(env.APP_ENV);
  const dataSource: EnvProfile["patientDataSource"] =
    name === "production" ? "live" : name === "staging" ? "prod-snapshot" : "synthetic";

  const smsProvider = name === "development" || name === "test" ? "console" : "twilio";

  let redirectSmsTo: string | null = null;
  if (name !== "production" && name !== "staging") {
    redirectSmsTo = env.QA_SMS_INBOX ?? "+15550000000";
  }

  return {
    name,
    patientDataSource: dataSource,
    smsProvider,
    redirectSmsTo,
    reminderLeadHours: name === "production" ? 24 : 1,
  };
}
