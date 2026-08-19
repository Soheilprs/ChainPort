const FORBIDDEN_ENV = [
  "PRIVATE_KEY",
  "MNEMONIC",
  "RPC_API_KEY",
  "GITHUB_TOKEN",
  "DATABASE_URL",
  "REDIS_URL",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
];

export const SANDBOX_PATH =
  "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/chainport/.foundry/bin";

export function sandboxEnvironment(
  extra: Readonly<Record<string, string>> = {},
): Record<string, string> {
  const env: Record<string, string> = {
    CI: "true",
    HOME: "/tmp/home",
    SVM_HOME: "/usr/local/svm",
    PATH: SANDBOX_PATH,
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    TERM: "dumb",
    FOUNDRY_DISABLE_NIGHTLY_WARNING: "1",
    FOUNDRY_OFFLINE: "true",
    SVM_SKIP_DOWNLOAD: "true",
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_NOSYSTEM: "1",
    npm_config_ignore_scripts: "true",
    npm_config_audit: "false",
    npm_config_fund: "false",
    ...extra,
  };
  for (const key of Object.keys(env)) {
    if (FORBIDDEN_ENV.includes(key) || key.startsWith("AWS_") || key.startsWith("CHAINPORT_")) {
      delete env[key];
    }
  }
  return env;
}

export function assertNoHostSecrets(envText: string): void {
  for (const key of FORBIDDEN_ENV) {
    if (new RegExp(`^${key}=`, "m").test(envText)) {
      throw new Error(`sandbox environment leaked ${key}`);
    }
  }
}
