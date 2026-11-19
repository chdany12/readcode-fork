export interface SmsProviderConfig {
  baseUrl: string;
  accountSid: string;
  authToken: string;
  senderId: string;
  timeoutMs: number;
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const v = env[key];
  if (!v || v.trim() === "") {
    throw new Error(`missing required config ${key}`);
  }
  return v.trim();
}

export function loadSmsConfig(env: NodeJS.ProcessEnv): SmsProviderConfig {
  const timeoutMs = Number(env.SMS_TIMEOUT_MS ?? "5000");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("SMS_TIMEOUT_MS must be a positive number");
  }
  return {
    baseUrl: required(env, "SMS_BASE_URL"),
    accountSid: required(env, "SMS_ACCOUNT_SID"),
    authToken: required(env, "SMS_AUTH_TOKEN"),
    senderId: required(env, "SMS_SENDER_ID"),
    timeoutMs,
  };
}
