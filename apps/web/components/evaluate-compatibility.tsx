export function EvaluateCompatibilityButton({
  projectId,
  analysisId,
  analysisComplete,
  returnTo,
  error,
}: {
  projectId: string;
  analysisId?: string | undefined;
  analysisComplete: boolean;
  returnTo: string;
  error?: string | null | undefined;
}) {
  if (!analysisComplete) {
    return (
      <p className="text-sm text-muted">
        Repository analysis must complete before target-chain compatibility can be evaluated.
      </p>
    );
  }

  const message =
    error === "evaluate-failed"
      ? "Unable to evaluate compatibility."
      : error === "api-unavailable"
        ? "API unavailable. Confirm the API is running."
        : error;

  return (
    <div className="space-y-2">
      <form method="post" action={`/app/projects/${projectId}/compatibility`}>
        <input type="hidden" name="returnTo" value={returnTo} />
        {analysisId !== undefined ? (
          <input type="hidden" name="analysisId" value={analysisId} />
        ) : null}
        <button
          type="submit"
          className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-3.5 text-sm font-semibold"
          style={{ backgroundColor: "#f4f4f5", color: "#09090b" }}
        >
          Evaluate target compatibility
        </button>
      </form>
      {message !== undefined && message !== null && message !== "" ? (
        <p className="text-sm text-blocker">{message}</p>
      ) : null}
      <p className="text-xs text-muted">
        Compares recorded requirements with the selected target chain. This does not modify the
        repository.
      </p>
    </div>
  );
}
