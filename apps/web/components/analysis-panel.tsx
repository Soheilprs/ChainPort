"use client";

export function AnalyzeButton({
  projectId,
  ingestComplete,
  returnTo,
  error,
}: {
  projectId: string;
  ingestComplete: boolean;
  returnTo: string;
  error?: string | null | undefined;
}) {
  if (!ingestComplete) {
    return <p className="text-sm text-muted">Ingest must complete before analysis can start.</p>;
  }

  const message =
    error === "analyze-failed"
      ? "Unable to start analysis."
      : error === "api-unavailable"
        ? "API unavailable. Confirm the API and worker are running."
        : error === "AUTHENTICATION_REQUIRED"
          ? "Sign in is required."
          : error;

  return (
    <div className="space-y-2">
      <form method="post" action={`/app/projects/${projectId}/analyze`}>
        <input type="hidden" name="returnTo" value={returnTo} />
        <button
          type="submit"
          className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-3.5 text-sm font-semibold"
          style={{ backgroundColor: "#f4f4f5", color: "#09090b" }}
        >
          Analyze repository
        </button>
      </form>
      {message !== undefined && message !== null && message !== "" ? (
        <p className="text-sm text-blocker">{message}</p>
      ) : null}
      <p className="text-xs text-muted">
        Analysis inspects the stored commit SHA only. It does not compare the target chain.
      </p>
    </div>
  );
}
