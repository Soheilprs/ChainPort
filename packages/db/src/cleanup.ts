import { INTEGRATION_TEST_DATABASE_PURPOSE } from "@chainport/shared";

import type { DatabaseClient } from "./client.js";

export class DestructiveCleanupRefusedError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "DestructiveCleanupRefusedError";
  }
}

export function databaseNameFromUrl(databaseUrl: string): string {
  return new URL(databaseUrl).pathname.replace(/^\//, "");
}

export function assertIntegrationCleanupAllowed(
  purpose: string | undefined,
  databaseUrl: string,
): void {
  if (purpose !== INTEGRATION_TEST_DATABASE_PURPOSE) {
    throw new DestructiveCleanupRefusedError(
      "destructive cleanup is only allowed for the integration-test catalog",
    );
  }
  if (databaseNameFromUrl(databaseUrl) !== "chainport_integration") {
    throw new DestructiveCleanupRefusedError(
      "destructive cleanup must target chainport_integration",
    );
  }
}

export async function resetIntegrationDatabase(client: DatabaseClient): Promise<void> {
  assertIntegrationCleanupAllowed(process.env.CHAINPORT_DB_PURPOSE, process.env.DATABASE_URL ?? "");
  await client.$executeRawUnsafe(`
    TRUNCATE TABLE
      deployment_checks,
      deployment_contracts,
      deployment_transactions,
      deployment_preflights,
      deployment_status_events,
      deployment_runs,
      deployment_candidates,
      network_partners,
      validation_test_results,
      validation_steps,
      validation_status_events,
      validation_runs,
      change_set_changes,
      change_set_status_events,
      change_sets,
      repository_revisions,
      planned_migration_action_dependencies,
      planned_migration_action_evidence,
      planned_migration_actions,
      planned_migration_status_events,
      planned_migrations,
      compatibility_findings,
      compatibility_category_results,
      compatibility_status_events,
      compatibility_runs,
      compatibility_registry_snapshots,
      analysis_evidence,
      project_requirements,
      repository_components,
      repository_files,
      analysis_detector_runs,
      analysis_status_events,
      repository_analyses,
      deployments,
      sandbox_runs,
      migration_plans,
      findings,
      job_status_events,
      migration_jobs,
      projects,
      repositories,
      users,
      organizations
    RESTART IDENTITY CASCADE
  `);
}
