import { execFileSync } from "node:child_process";

const databases = ["chainport_integration", "chainport_validation"];
const container = process.env.CHAINPORT_POSTGRES_CONTAINER ?? "chainport-postgres";
const user = process.env.CHAINPORT_POSTGRES_USER ?? "chainport";

for (const database of databases) {
  const exists = execFileSync(
    "docker",
    [
      "exec",
      container,
      "psql",
      "-U",
      user,
      "-d",
      "postgres",
      "-tAc",
      `SELECT 1 FROM pg_database WHERE datname = '${database}'`,
    ],
    { encoding: "utf8" },
  ).trim();

  if (exists === "1") {
    continue;
  }

  execFileSync(
    "docker",
    ["exec", container, "psql", "-U", user, "-d", "postgres", "-c", `CREATE DATABASE ${database}`],
    {
      stdio: "inherit",
    },
  );
}
