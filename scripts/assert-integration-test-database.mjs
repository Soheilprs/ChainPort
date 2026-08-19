const purpose = process.env.CHAINPORT_DB_PURPOSE;
const databaseUrl = process.env.DATABASE_URL ?? "";

if (purpose !== "integration-test") {
  throw new Error(
    `Refusing to run integration tests: CHAINPORT_DB_PURPOSE must be "integration-test" (got ${JSON.stringify(purpose)}).`,
  );
}

let databaseName = "";
try {
  databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
} catch {
  throw new Error("Refusing to run integration tests: DATABASE_URL is not a valid URL.");
}

if (databaseName !== "chainport_integration") {
  throw new Error(
    `Refusing to run integration tests: DATABASE_URL must target chainport_integration (got ${JSON.stringify(databaseName)}).`,
  );
}
