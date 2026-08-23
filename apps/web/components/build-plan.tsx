export function BuildMigrationPlanButton({
  compatibilityRunId,
  compatibilityComplete,
  returnTo,
  error,
}: {
  compatibilityRunId: string;
  compatibilityComplete: boolean;
  returnTo: string;
  error?: string | null | undefined;
}) {
  if (!compatibilityComplete) {
    return (
      <p className="text-sm text-muted">
        Compatibility evaluation must complete before a migration plan can be built.
      </p>
    );
  }

  const message =
    error === "plan-failed"
      ? "Unable to build migration plan."
      : error === "api-unavailable"
        ? "API unavailable. Confirm the API is running."
        : error;

  return (
    <div className="space-y-2">
      <form method="post" action={`/app/compatibility/${compatibilityRunId}/plan`}>
        <input type="hidden" name="returnTo" value={returnTo} />
        <button
          type="submit"
          className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-3.5 text-sm font-semibold"
          style={{ backgroundColor: "#f4f4f5", color: "#09090b" }}
        >
          Build migration plan
        </button>
      </form>
      {message !== undefined && message !== null && message !== "" ? (
        <p className="text-sm text-blocker">{message}</p>
      ) : null}
      <p className="text-xs text-muted">
        Plans required changes from compatibility findings. This does not modify the repository.
      </p>
    </div>
  );
}
