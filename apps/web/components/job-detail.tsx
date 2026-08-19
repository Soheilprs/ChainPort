"use client";

import { useEffect, useState } from "react";

import { AnalyzeButton } from "@/components/analysis-panel";
import { jobStatusLabel, jobStatusTone } from "@/components/job-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { fetchJob, type JobSummary, type ProjectSummary, type RepositorySummary } from "@/lib/api";

export function JobDetail({
  initialJob,
  initialProject,
  initialRepository,
}: {
  initialJob: JobSummary;
  initialProject: ProjectSummary;
  initialRepository: RepositorySummary;
}) {
  const [job, setJob] = useState(initialJob);
  const [repository, setRepository] = useState(initialRepository);
  const active = job.status === "QUEUED" || job.status === "INGESTING";

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = window.setInterval(() => {
      void fetchJob(job.id).then((result) => {
        if (result === null) {
          return;
        }
        setJob(result.job);
        setRepository(result.repository);
      });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [active, job.id]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="truncate text-2xl font-medium tracking-tight">{initialProject.name}</h1>
        <Badge tone={jobStatusTone(job.status)}>{jobStatusLabel(job.status)}</Badge>
      </div>
      <p className="text-sm text-muted">
        Ingest stores an immutable SHA. Analysis inspects that SHA as data only — it does not
        execute the repository or score target-chain compatibility.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Repository</CardTitle>
          <CardDescription className="break-all">{repository.normalizedUrl}</CardDescription>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Provider</dt>
              <dd>{repository.provider}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Clone status</dt>
              <dd>{repository.cloneStatus}</dd>
            </div>
            <div>
              <dt className="text-muted">Commit SHA</dt>
              <dd className="mt-1 truncate font-mono text-xs" title={job.repoSha ?? undefined}>
                {job.repoSha ?? "Not resolved yet"}
              </dd>
            </div>
          </dl>
        </Card>
        <Card>
          <CardTitle>Migration pair</CardTitle>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Source</dt>
              <dd>{job.sourceChainKey}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Target</dt>
              <dd>{job.targetChainKey}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Attempt</dt>
              <dd>{job.attempt}</dd>
            </div>
          </dl>
        </Card>
      </div>
      {job.status === "COMPLETED" ? (
        <AnalyzeButton projectId={initialProject.id} ingestComplete />
      ) : null}
      {job.status === "FAILED" ? (
        <Card className="border-blocker/30">
          <CardTitle>Ingest failed</CardTitle>
          <CardDescription>
            {job.errorCode ?? "CLONE_FAILED"}
            {job.errorMessage !== null ? ` — ${job.errorMessage}` : ""}
          </CardDescription>
        </Card>
      ) : null}
    </div>
  );
}
