import {
  getOfficialDeploymentTestnet,
  requireChainByKey,
  snapshotForChainKey,
} from "@chainport/chain-registry";
import type { DatabaseClient } from "@chainport/db";
import {
  FUNNEL_STAGES,
  type AnalyticsAcquisitionFilter,
  type CompatibilityReadiness,
  type InfrastructureGapKind,
  type NetworkPartner,
  type RegressionStatus,
  type ValidationOutcome,
} from "@chainport/shared";
import { compareValidations } from "@chainport/validation";

import { conversionRate, cumulativeFunnel, highestStage, type StageFlags } from "./funnel.js";
import {
  classifyFinding,
  gapPriority,
  isInfrastructureGap,
  semanticCapabilityKey,
} from "./gaps.js";
import { projectCreatedAtFilter, type UtcRange } from "./range.js";

export interface AnalyticsQuery {
  range: UtcRange;
  includeInternal?: boolean;
  includeDemo?: boolean;
  includeDevnet?: boolean;
  acquisition?: AnalyticsAcquisitionFilter;
}

const PREPARED_OR_LATER: readonly string[] = [
  "PREPARED",
  "FUNDING",
  "BROADCASTING",
  "CONFIRMING",
  "VERIFYING",
  "COMPLETED",
  "RECONCILIATION_REQUIRED",
];

export class EcosystemAnalytics {
  public constructor(private readonly client: DatabaseClient) {}

  public async overview(partner: NetworkPartner, query: AnalyticsQuery) {
    const funnel = await this.funnel(partner, query);
    const compatibility = await this.compatibility(partner, query);
    const gaps = await this.infrastructureGaps(partner, query);
    const blockers = await this.blockers(partner, query);
    const validations = await this.validations(partner, query);
    const deployments = await this.deployments(partner, query);
    const insights = await this.insights(partner, query);
    const started = funnel.counts.PROJECT_STARTED;
    const attribution = await this.attribution(partner, query);
    return {
      partner,
      kpis: {
        projectsStarted: started,
        projectsAnalyzed: funnel.counts.REPOSITORY_ANALYZED,
        compatibilityReady: compatibility.ready,
        validated: funnel.counts.VALIDATION_PASSED,
        testnetDeployed: funnel.counts.TESTNET_DEPLOYED,
        overallConversion: conversionRate(funnel.counts.TESTNET_DEPLOYED, started),
      },
      attribution,
      funnel,
      compatibility,
      topBlockers: blockers.slice(0, 8),
      topGaps: gaps.slice(0, 8),
      validations,
      deployments,
      insights: insights.slice(0, 6),
    };
  }

  public async funnel(partner: NetworkPartner, query: AnalyticsQuery) {
    const projects = await this.attributedProjects(partner, query);
    const flags = await this.stageFlags(
      partner,
      projects.map((item) => item.id),
      query,
    );
    const highest = projects.map((project) => highestStage(flags.get(project.id) ?? emptyFlags()));
    const counts = cumulativeFunnel(highest);
    const started = counts.PROJECT_STARTED;
    return {
      unit: "unique Project",
      acquisition: query.acquisition ?? "all",
      stages: FUNNEL_STAGES.map((stage) => ({
        stage,
        count: counts[stage],
      })),
      counts,
      conversions: {
        startedToAnalyzed: conversionRate(counts.REPOSITORY_ANALYZED, started),
        analyzedToCompatibility: conversionRate(
          counts.COMPATIBILITY_EVALUATED,
          counts.REPOSITORY_ANALYZED,
        ),
        compatibilityToMigration: conversionRate(
          counts.MIGRATION_PLAN_CREATED,
          counts.COMPATIBILITY_EVALUATED,
        ),
        migrationToValidated: conversionRate(
          counts.VALIDATION_PASSED,
          counts.MIGRATION_PLAN_CREATED,
        ),
        validatedToDeployed: conversionRate(counts.TESTNET_DEPLOYED, counts.VALIDATION_PASSED),
        startedToDeployed: conversionRate(counts.TESTNET_DEPLOYED, started),
      },
    };
  }

  public async projects(partner: NetworkPartner, query: AnalyticsQuery) {
    const attributed = await this.attributedProjects(partner, query);
    const flagsById = await this.stageFlags(
      partner,
      attributed.map((item) => item.id),
      query,
    );
    const latestCompat = await this.latestCompatibilityByProject(
      partner.networkKey,
      attributed.map((item) => item.id),
    );
    const latestValidation = await this.latestValidationByProject(
      attributed.map((item) => item.id),
    );
    const latestDeployment = await this.latestDeploymentByProject(
      partner,
      attributed.map((item) => item.id),
      query,
    );
    return attributed.map((project) => {
      const flags = flagsById.get(project.id) ?? emptyFlags();
      return {
        id: project.id,
        name: project.name,
        githubOwner: project.githubOwner,
        githubRepo: project.githubRepo,
        sourceChainKey: project.sourceChainKey,
        targetChainKey: partner.networkKey,
        stage: highestStage(flags),
        compatibilityReadiness: latestCompat.get(project.id)?.readiness ?? null,
        compatibilityScore: latestCompat.get(project.id)?.score ?? null,
        validationOutcome: latestValidation.get(project.id) ?? null,
        deploymentStatus: latestDeployment.get(project.id) ?? null,
        lastActivityAt: project.lastActivityAt.toISOString(),
        createdAt: project.createdAt.toISOString(),
        acquisitionSource: project.acquisitionSource,
        partnerReferred: project.partnerReferred,
      };
    });
  }

  public async attribution(partner: NetworkPartner, query: AnalyticsQuery) {
    const allQuery = { ...query, acquisition: "all" as const };
    const [all, referred] = await Promise.all([
      this.attributedProjects(partner, allQuery),
      this.attributedProjects(partner, { ...query, acquisition: "partner" }),
    ]);
    const partnerReferred = referred.length;
    const allTargetingNetwork = all.length;
    const genericTargetingNetwork = allTargetingNetwork - partnerReferred;
    return {
      version: "phase-10",
      definitions: {
        allTargetingNetwork:
          "Unique projects with a job whose targetChainKey equals the partner network",
        partnerReferred:
          "Unique projects created through this partner portal (networkPartnerId + PARTNER_PORTAL)",
        genericTargetingNetwork:
          "Unique projects targeting the network that did not arrive through this partner portal",
      },
      allTargetingNetwork,
      partnerReferred,
      genericTargetingNetwork,
      referralShare: conversionRate(partnerReferred, allTargetingNetwork),
    };
  }

  public async projectDetail(partner: NetworkPartner, projectId: string, query: AnalyticsQuery) {
    const list = await this.projects(partner, query);
    const summary = list.find((item) => item.id === projectId);
    if (summary === undefined) {
      return undefined;
    }
    const blockers = (await this.blockers(partner, query)).filter((item) =>
      item.exampleProjectIds.includes(projectId),
    );
    const timeline = await this.timeline(partner, projectId);
    return { project: summary, blockers: blockers.slice(0, 10), timeline };
  }

  public async timeline(partner: NetworkPartner, projectId: string) {
    const [job, analysis, compat, plan, changeSet, validation, deployment] = await Promise.all([
      this.client.migrationJob.findFirst({
        where: { projectId, targetChainKey: partner.networkKey },
        orderBy: { createdAt: "asc" },
      }),
      this.client.repositoryAnalysis.findFirst({
        where: { projectId, status: "COMPLETED" },
        orderBy: { completedAt: "asc" },
      }),
      this.client.compatibilityRun.findFirst({
        where: { projectId, targetChainKey: partner.networkKey, status: "COMPLETED" },
        orderBy: { completedAt: "asc" },
      }),
      this.client.plannedMigration.findFirst({
        where: { projectId, targetChainKey: partner.networkKey, status: "COMPLETED" },
        orderBy: { completedAt: "asc" },
      }),
      this.client.changeSet.findFirst({
        where: { projectId, status: "FINALIZED" },
        orderBy: { finalizedAt: "asc" },
      }),
      this.client.validationRun.findFirst({
        where: { projectId, outcome: "PASSED" },
        orderBy: { completedAt: "asc" },
      }),
      this.client.deploymentRun.findFirst({
        where: {
          projectId,
          status: "COMPLETED",
          targetTestnetKey: officialTestnetKey(partner.networkKey),
        },
        orderBy: { completedAt: "asc" },
      }),
    ]);
    const events: Array<{ type: string; at: string }> = [];
    if (job !== null) {
      events.push({ type: "Project created", at: job.createdAt.toISOString() });
      if (job.status === "COMPLETED" || job.repoSha !== null) {
        events.push({
          type: "Repository ingested",
          at: (job.finishedAt ?? job.updatedAt).toISOString(),
        });
      }
    }
    if (analysis?.completedAt !== null && analysis?.completedAt !== undefined) {
      events.push({ type: "Analysis complete", at: analysis.completedAt.toISOString() });
    }
    if (compat?.completedAt !== null && compat?.completedAt !== undefined) {
      events.push({ type: "Compatibility evaluated", at: compat.completedAt.toISOString() });
    }
    if (plan?.completedAt !== null && plan?.completedAt !== undefined) {
      events.push({ type: "Migration planned", at: plan.completedAt.toISOString() });
    }
    if (changeSet?.finalizedAt !== null && changeSet?.finalizedAt !== undefined) {
      events.push({ type: "ChangeSet finalized", at: changeSet.finalizedAt.toISOString() });
    }
    if (validation?.completedAt !== null && validation?.completedAt !== undefined) {
      events.push({ type: "Validation passed", at: validation.completedAt.toISOString() });
    }
    if (deployment?.completedAt !== null && deployment?.completedAt !== undefined) {
      events.push({
        type: "Testnet deployment succeeded",
        at: deployment.completedAt.toISOString(),
      });
    }
    return events;
  }

  public async compatibility(partner: NetworkPartner, query: AnalyticsQuery) {
    const projects = await this.attributedProjects(partner, query);
    const latest = await this.latestCompatibilityByProject(
      partner.networkKey,
      projects.map((item) => item.id),
    );
    const dist: Record<CompatibilityReadiness, number> = {
      READY: 0,
      REVIEW_REQUIRED: 0,
      BLOCKED: 0,
      INSUFFICIENT_DATA: 0,
    };
    let scoreTotal = 0;
    let coverageTotal = 0;
    let scored = 0;
    let blocked = 0;
    let unknownHeavy = 0;
    for (const run of latest.values()) {
      dist[run.readiness] += 1;
      scoreTotal += run.score;
      coverageTotal += run.coverage;
      scored += 1;
      if (run.readiness === "BLOCKED") blocked += 1;
      if (run.unknownCount > 0) unknownHeavy += 1;
    }
    return {
      evaluated: scored,
      ready: dist.READY,
      reviewRequired: dist.REVIEW_REQUIRED,
      blocked: dist.BLOCKED,
      insufficientData: dist.INSUFFICIENT_DATA,
      averageScore: scored === 0 ? null : scoreTotal / scored,
      averageCoverage: scored === 0 ? null : coverageTotal / scored,
      blockerRate: conversionRate(blocked, scored),
      unknownDataRate: conversionRate(unknownHeavy, scored),
    };
  }

  public async blockers(partner: NetworkPartner, query: AnalyticsQuery) {
    const projects = await this.attributedProjects(partner, query);
    const ids = projects.map((item) => item.id);
    if (ids.length === 0) {
      return [];
    }
    const latest = await this.latestCompatibilityByProject(partner.networkKey, ids);
    const runIds = [...latest.values()].map((item) => item.id);
    if (runIds.length === 0) {
      return [];
    }
    const findings = await this.client.compatibilityFinding.findMany({
      where: {
        compatibilityRunId: { in: runIds },
        status: { in: ["BLOCKER", "WARNING", "UNKNOWN"] },
      },
      include: { run: { select: { projectId: true } } },
    });
    const groups = new Map<
      string,
      {
        key: string;
        ruleId: string;
        title: string;
        blockerProjects: Set<string>;
        warningProjects: Set<string>;
        unknownProjects: Set<string>;
      }
    >();
    for (const finding of findings) {
      const input = {
        ruleId: finding.ruleId,
        status: finding.status,
        category: finding.category,
        remediationType: finding.remediationType,
        sourceValue: finding.sourceValue,
        targetValue: finding.targetValue,
        title: finding.title,
      };
      const key = semanticCapabilityKey(input);
      const group = groups.get(key) ?? {
        key,
        ruleId: finding.ruleId,
        title: finding.title,
        blockerProjects: new Set<string>(),
        warningProjects: new Set<string>(),
        unknownProjects: new Set<string>(),
      };
      if (finding.status === "BLOCKER") group.blockerProjects.add(finding.run.projectId);
      if (finding.status === "WARNING") group.warningProjects.add(finding.run.projectId);
      if (finding.status === "UNKNOWN") group.unknownProjects.add(finding.run.projectId);
      groups.set(key, group);
    }
    return [...groups.values()]
      .map((group) => ({
        key: group.key,
        ruleId: group.ruleId,
        title: group.title,
        blockerProjects: group.blockerProjects.size,
        warningProjects: group.warningProjects.size,
        unknownProjects: group.unknownProjects.size,
        affectedProjects: new Set([
          ...group.blockerProjects,
          ...group.warningProjects,
          ...group.unknownProjects,
        ]).size,
        exampleProjectIds: [...group.blockerProjects, ...group.unknownProjects].slice(0, 5),
      }))
      .sort((left, right) => right.affectedProjects - left.affectedProjects);
  }

  public async infrastructureGaps(partner: NetworkPartner, query: AnalyticsQuery) {
    const projects = await this.attributedProjects(partner, query);
    const ids = projects.map((item) => item.id);
    if (ids.length === 0) {
      return [];
    }
    const latest = await this.latestCompatibilityByProject(partner.networkKey, ids);
    const runIds = [...latest.values()].map((item) => item.id);
    if (runIds.length === 0) {
      return [];
    }
    const findings = await this.client.compatibilityFinding.findMany({
      where: { compatibilityRunId: { in: runIds }, status: { not: "PASS" } },
      include: { run: { select: { projectId: true, repositoryId: true } } },
    });
    const groups = new Map<
      string,
      {
        key: string;
        kind: InfrastructureGapKind;
        title: string;
        projects: Set<string>;
        repositories: Set<string>;
        blockerProjects: Set<string>;
        unknownProjects: Set<string>;
      }
    >();
    for (const finding of findings) {
      const input = {
        ruleId: finding.ruleId,
        status: finding.status,
        category: finding.category,
        remediationType: finding.remediationType,
        sourceValue: finding.sourceValue,
        targetValue: finding.targetValue,
        title: finding.title,
      };
      const kind = classifyFinding(input);
      if (!isInfrastructureGap(kind) || kind === null) {
        continue;
      }
      const key = semanticCapabilityKey(input);
      const group = groups.get(key) ?? {
        key,
        kind,
        title: finding.title,
        projects: new Set<string>(),
        repositories: new Set<string>(),
        blockerProjects: new Set<string>(),
        unknownProjects: new Set<string>(),
      };
      group.projects.add(finding.run.projectId);
      group.repositories.add(finding.run.repositoryId);
      if (finding.status === "BLOCKER") group.blockerProjects.add(finding.run.projectId);
      if (finding.status === "UNKNOWN") group.unknownProjects.add(finding.run.projectId);
      groups.set(key, group);
    }
    return [...groups.values()]
      .map((group) => ({
        key: group.key,
        kind: group.kind,
        title: group.title,
        affectedProjects: group.projects.size,
        affectedRepositories: group.repositories.size,
        potentiallyUnblockableProjects: group.projects.size,
        explanation: `${group.projects.size} analyzed projects currently contain requirements affected by this capability.`,
        status: group.kind === "NETWORK_GAP" ? "UNAVAILABLE" : "UNKNOWN",
        priority: gapPriority(group.blockerProjects.size, group.unknownProjects.size),
        exampleProjectIds: [...group.projects].slice(0, 8),
      }))
      .sort(
        (left, right) =>
          right.priority - left.priority || right.affectedProjects - left.affectedProjects,
      );
  }

  public async migrations(partner: NetworkPartner, query: AnalyticsQuery) {
    const projects = await this.attributedProjects(partner, query);
    const ids = projects.map((item) => item.id);
    const plans = await this.client.plannedMigration.findMany({
      where: { projectId: { in: ids }, targetChainKey: partner.networkKey, status: "COMPLETED" },
      include: { actions: true, changeSets: true },
    });
    const latest = latestBy(
      plans,
      (item) => item.projectId,
      (item) => item.createdAt,
    );
    let safe = 0;
    let review = 0;
    let manual = 0;
    let blocked = 0;
    let unknown = 0;
    let allSafe = 0;
    let needsReview = 0;
    let blockedProjects = 0;
    let actions = 0;
    for (const plan of latest.values()) {
      safe += plan.safeActionCount;
      review += plan.reviewActionCount;
      manual += plan.manualActionCount;
      blocked += plan.blockedActionCount;
      unknown += plan.unknownActionCount;
      actions += plan.totalActions;
      if (plan.totalActions > 0 && plan.safeActionCount === plan.totalActions) allSafe += 1;
      if (plan.reviewActionCount > 0 || plan.manualActionCount > 0) needsReview += 1;
      if (plan.blockedActionCount > 0) blockedProjects += 1;
    }
    const changeSets = await this.client.changeSet.findMany({
      where: { projectId: { in: ids }, migrationPlan: { targetChainKey: partner.networkKey } },
    });
    const proposed = changeSets.reduce((sum, item) => sum + item.proposedCount, 0);
    const accepted = changeSets.reduce((sum, item) => sum + item.acceptedCount, 0);
    const rejected = changeSets.reduce((sum, item) => sum + item.rejectedCount, 0);
    const skipped = changeSets.reduce((sum, item) => sum + item.skippedCount, 0);
    const finalizedComplete = changeSets.filter(
      (item) => item.status === "FINALIZED" && item.completeness === "COMPLETE",
    ).length;
    const finalizedPartial = changeSets.filter(
      (item) => item.status === "FINALIZED" && item.completeness === "PARTIAL",
    ).length;
    return {
      plans: latest.size,
      actions,
      averageActions: latest.size === 0 ? null : actions / latest.size,
      safeAutomatic: safe,
      reviewRequired: review,
      manual,
      blocked,
      unknown,
      safeAutomaticShare: conversionRate(safe, actions),
      projectsAllSafe: allSafe,
      projectsNeedingReview: needsReview,
      projectsBlocked: blockedProjects,
      changeSets: changeSets.length,
      proposed,
      accepted,
      rejected,
      skipped,
      acceptanceRate: conversionRate(accepted, proposed),
      finalizedComplete,
      finalizedPartial,
    };
  }

  public async validations(partner: NetworkPartner, query: AnalyticsQuery) {
    const projects = await this.attributedProjects(partner, query);
    const ids = projects.map((item) => item.id);
    const runs = await this.client.validationRun.findMany({
      where: { projectId: { in: ids }, status: { in: ["COMPLETED", "FAILED", "TIMED_OUT"] } },
    });
    const outcomes: Record<ValidationOutcome, number> = {
      PASSED: 0,
      FAILED: 0,
      PARTIAL: 0,
      UNSUPPORTED: 0,
      INFRA_FAILURE: 0,
    };
    const failureReasons = new Map<string, number>();
    let repositoryFailures = 0;
    let infraFailures = 0;
    for (const run of runs) {
      if (run.outcome !== null) {
        outcomes[run.outcome] += 1;
      }
      if (run.outcome === "INFRA_FAILURE") {
        infraFailures += 1;
      } else if (
        run.outcome === "FAILED" ||
        run.outcome === "PARTIAL" ||
        run.outcome === "UNSUPPORTED"
      ) {
        repositoryFailures += 1;
      }
      if (run.errorCode !== null && run.outcome !== "PASSED") {
        failureReasons.set(run.errorCode, (failureReasons.get(run.errorCode) ?? 0) + 1);
      }
    }
    const generated = await this.client.repositoryRevision.findMany({
      where: { projectId: { in: ids }, type: "GENERATED" },
    });
    const regression: Record<RegressionStatus, number> = {
      NOT_COMPARED: 0,
      NO_REGRESSION: 0,
      REGRESSION_DETECTED: 0,
      BASELINE_ALREADY_FAILING: 0,
      INCONCLUSIVE: 0,
    };
    for (const revision of generated) {
      const originalId = revision.baseRevisionId;
      const original =
        originalId === null
          ? null
          : await this.client.validationRun.findFirst({
              where: {
                repositoryRevisionId: originalId,
                status: { in: ["COMPLETED", "TIMED_OUT"] },
              },
              orderBy: { completedAt: "desc" },
            });
      const generatedRun = await this.client.validationRun.findFirst({
        where: { repositoryRevisionId: revision.id, status: { in: ["COMPLETED", "TIMED_OUT"] } },
        orderBy: { completedAt: "desc" },
      });
      const compared = compareValidations(
        original === null ? null : mapValidation(original),
        generatedRun === null ? null : mapValidation(generatedRun),
      );
      regression[compared.regressionStatus] += 1;
    }
    const compared =
      regression.NO_REGRESSION +
      regression.REGRESSION_DETECTED +
      regression.BASELINE_ALREADY_FAILING;
    return {
      attempts: runs.length,
      outcomes,
      repositoryFailures,
      infraFailures,
      failureReasons: [...failureReasons.entries()]
        .map(([code, count]) => ({ code, count }))
        .sort((left, right) => right.count - left.count),
      regression,
      noRegressionRate: conversionRate(regression.NO_REGRESSION, compared),
    };
  }

  public async deployments(partner: NetworkPartner, query: AnalyticsQuery) {
    const projects = await this.attributedProjects(partner, query);
    const ids = projects.map((item) => item.id);
    const testnetKey = officialTestnetKey(partner.networkKey);
    const runs = await this.client.deploymentRun.findMany({
      where: { projectId: { in: ids } },
    });
    const partnerRuns = runs.filter((run) => {
      if (run.targetTestnetKey === "anvil") {
        return query.includeDevnet === true;
      }
      return run.targetTestnetKey === testnetKey;
    });
    const prepared = unique(
      partnerRuns
        .filter((run) => PREPARED_OR_LATER.includes(run.status))
        .map((run) => run.projectId),
    );
    const confirmed = unique(
      partnerRuns
        .filter((run) => run.broadcastStartedAt !== null || run.status === "COMPLETED")
        .map((run) => run.projectId),
    );
    const success = unique(
      partnerRuns.filter((run) => run.status === "COMPLETED").map((run) => run.projectId),
    );
    const failed = unique(
      partnerRuns.filter((run) => run.status === "FAILED").map((run) => run.projectId),
    );
    const recon = unique(
      partnerRuns
        .filter((run) => run.status === "RECONCILIATION_REQUIRED")
        .map((run) => run.projectId),
    );
    const anvilSuccess = unique(
      runs
        .filter((run) => run.targetTestnetKey === "anvil" && run.status === "COMPLETED")
        .map((run) => run.projectId),
    );
    return {
      prepared: prepared.length,
      confirmed: confirmed.length,
      success: success.length,
      failed: failed.length,
      reconciliationRequired: recon.length,
      anvilSuccessExcluded: query.includeDevnet === true ? 0 : anvilSuccess.length,
    };
  }

  public registry(partner: NetworkPartner) {
    const chain = requireChainByKey(partner.networkKey);
    const snapshot = snapshotForChainKey(partner.networkKey);
    const testnet = getOfficialDeploymentTestnet(partner.networkKey);
    const tokens = snapshot.snapshot.tokens;
    const protocols = snapshot.snapshot.protocols;
    const feeds = snapshot.snapshot.feeds;
    const rpc = snapshot.snapshot.rpcMethods;
    return {
      chain: {
        key: chain.key,
        name: chain.name,
        chainId: chain.chainId,
        networkKind: chain.networkKind,
      },
      deploymentTestnet: testnet
        ? { key: testnet.key, name: testnet.name, chainId: testnet.chainId }
        : null,
      tokens: summarizeAvailability(tokens.map((item) => item.availability)),
      protocols: summarizeAvailability(protocols.map((item) => item.availability)),
      feeds: summarizeAvailability(feeds.map((item) => item.availability)),
      rpcMethods: summarizeAvailability(rpc.map((item) => item.availability)),
      items: {
        tokens: tokens.map((item) => ({
          id: item.symbol,
          availability: item.availability,
          provenance: item.provenance,
        })),
        protocols: protocols.map((item) => ({
          id: item.id,
          availability: item.availability,
          provenance: item.provenance,
        })),
        feeds: feeds.map((item) => ({
          id: item.id,
          availability: item.availability,
          provenance: item.provenance,
        })),
        rpcMethods: rpc.map((item) => ({
          id: item.method,
          availability: item.availability,
          provenance: item.provenance,
        })),
      },
    };
  }

  public async insights(partner: NetworkPartner, query: AnalyticsQuery) {
    const [funnel, gaps, migrations, compatibility] = await Promise.all([
      this.funnel(partner, query),
      this.infrastructureGaps(partner, query),
      this.migrations(partner, query),
      this.compatibility(partner, query),
    ]);
    const items: string[] = [];
    items.push(
      `${funnel.counts.REPOSITORY_ANALYZED} unique projects have completed analysis for ${partner.displayName}.`,
    );
    if (compatibility.evaluated > 0) {
      items.push(
        `${compatibility.ready} of ${compatibility.evaluated} evaluated projects are currently READY.`,
      );
    }
    const usdc = gaps.find((item) => item.key.includes("USDC"));
    if (usdc !== undefined) {
      items.push(
        `${usdc.affectedProjects} analyzed projects currently contain requirements affected by USDC availability.`,
      );
    }
    const layerzero = gaps.find((item) => item.key.includes("LAYERZERO"));
    if (layerzero !== undefined) {
      items.push(
        `${layerzero.affectedProjects} projects have UNKNOWN or unavailable LayerZero target availability.`,
      );
    }
    const rpcGap = gaps.find((item) => item.key.startsWith("rpc:"));
    if (rpcGap !== undefined) {
      items.push(
        `${rpcGap.affectedProjects} projects are affected by an unavailable or unknown RPC capability (${rpcGap.key}).`,
      );
    }
    if (migrations.safeAutomaticShare !== null) {
      items.push(
        `${(migrations.safeAutomaticShare * 100).toFixed(0)}% of planned migration actions are currently safe-automatic.`,
      );
    }
    items.push(
      `${funnel.counts.VALIDATION_PASSED} projects have a PASSED validation; ${funnel.counts.TESTNET_DEPLOYED} reached a successful partner testnet deployment.`,
    );
    return items;
  }

  public async unknownBacklog(partner: NetworkPartner, query: AnalyticsQuery) {
    const gaps = await this.infrastructureGaps(partner, query);
    return gaps
      .filter((item) => item.kind === "UNKNOWN_NETWORK_DATA")
      .sort((left, right) => right.affectedProjects - left.affectedProjects);
  }

  private async attributedProjects(partner: NetworkPartner, query: AnalyticsQuery) {
    const createdAt = projectCreatedAtFilter(query.range);
    const referred = {
      networkPartnerId: partner.id,
      acquisitionSource: "PARTNER_PORTAL" as const,
    };
    const rows = await this.client.project.findMany({
      where: {
        ...(query.includeInternal === true ? {} : { dataClassification: "PRODUCTION" }),
        ...(createdAt === undefined ? {} : { createdAt }),
        jobs: { some: { targetChainKey: partner.networkKey } },
        ...(query.acquisition === "partner" ? referred : {}),
        ...(query.acquisition === "generic" ? { NOT: referred } : {}),
      },
      include: {
        jobs: {
          where: { targetChainKey: partner.networkKey },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
        repository: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      githubOwner: row.githubOwner,
      githubRepo: row.githubRepo,
      createdAt: row.createdAt,
      lastActivityAt: row.updatedAt,
      sourceChainKey: row.jobs[0]?.sourceChainKey ?? "",
      cloneStatus: row.repository.cloneStatus,
      acquisitionSource: row.acquisitionSource,
      partnerReferred:
        row.networkPartnerId === partner.id && row.acquisitionSource === "PARTNER_PORTAL",
    }));
  }

  private async stageFlags(
    partner: NetworkPartner,
    projectIds: string[],
    query: AnalyticsQuery,
  ): Promise<Map<string, StageFlags>> {
    const map = new Map<string, StageFlags>();
    for (const id of projectIds) {
      map.set(id, emptyFlags());
    }
    if (projectIds.length === 0) {
      return map;
    }
    const testnetKey = officialTestnetKey(partner.networkKey);
    const [repos, analyses, compats, plans, changeSets, validations, deployments] =
      await Promise.all([
        this.client.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, repository: { select: { cloneStatus: true } } },
        }),
        this.client.repositoryAnalysis.findMany({
          where: { projectId: { in: projectIds }, status: "COMPLETED" },
          select: { projectId: true },
        }),
        this.client.compatibilityRun.findMany({
          where: {
            projectId: { in: projectIds },
            targetChainKey: partner.networkKey,
            status: "COMPLETED",
          },
          select: { projectId: true },
        }),
        this.client.plannedMigration.findMany({
          where: {
            projectId: { in: projectIds },
            targetChainKey: partner.networkKey,
            status: "COMPLETED",
          },
          select: { projectId: true },
        }),
        this.client.changeSet.findMany({
          where: {
            projectId: { in: projectIds },
            migrationPlan: { targetChainKey: partner.networkKey },
          },
          select: { projectId: true, status: true },
        }),
        this.client.validationRun.findMany({
          where: { projectId: { in: projectIds }, outcome: "PASSED" },
          select: { projectId: true },
        }),
        this.client.deploymentRun.findMany({
          where: { projectId: { in: projectIds } },
          select: { projectId: true, status: true, targetTestnetKey: true },
        }),
      ]);
    for (const row of repos) {
      const flags = map.get(row.id);
      if (flags !== undefined && row.repository.cloneStatus === "READY") {
        flags.ingested = true;
      }
    }
    for (const row of analyses) setFlag(map, row.projectId, "analyzed");
    for (const row of compats) setFlag(map, row.projectId, "compatibilityEvaluated");
    for (const row of plans) setFlag(map, row.projectId, "migrationPlanned");
    for (const row of changeSets) {
      setFlag(map, row.projectId, "safeFixesGenerated");
      if (row.status === "FINALIZED") setFlag(map, row.projectId, "revisionFinalized");
    }
    for (const row of validations) setFlag(map, row.projectId, "validationPassed");
    for (const row of deployments) {
      const isPartnerTestnet = row.targetTestnetKey === testnetKey;
      const isAnvil = row.targetTestnetKey === "anvil";
      if (isAnvil && query.includeDevnet !== true) {
        continue;
      }
      if (!isPartnerTestnet && !isAnvil) {
        continue;
      }
      if (PREPARED_OR_LATER.includes(row.status)) {
        setFlag(map, row.projectId, "deploymentPrepared");
      }
      if (row.status === "COMPLETED") {
        setFlag(map, row.projectId, "testnetDeployed");
      }
    }
    return map;
  }

  private async latestCompatibilityByProject(networkKey: string, projectIds: string[]) {
    if (projectIds.length === 0) {
      return new Map<
        string,
        {
          id: string;
          projectId: string;
          readiness: CompatibilityReadiness;
          score: number;
          coverage: number;
          unknownCount: number;
        }
      >();
    }
    const runs = await this.client.compatibilityRun.findMany({
      where: { projectId: { in: projectIds }, targetChainKey: networkKey, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
    });
    return latestBy(
      runs,
      (item) => item.projectId,
      (item) => item.createdAt,
    );
  }

  private async latestValidationByProject(projectIds: string[]) {
    const runs = await this.client.validationRun.findMany({
      where: { projectId: { in: projectIds }, outcome: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    const map = new Map<string, ValidationOutcome>();
    for (const run of runs) {
      if (!map.has(run.projectId) && run.outcome !== null) {
        map.set(run.projectId, run.outcome);
      }
    }
    return map;
  }

  private async latestDeploymentByProject(
    partner: NetworkPartner,
    projectIds: string[],
    query: AnalyticsQuery,
  ) {
    const testnetKey = officialTestnetKey(partner.networkKey);
    const runs = await this.client.deploymentRun.findMany({
      where: {
        projectId: { in: projectIds },
        ...(query.includeDevnet === true ? {} : { targetTestnetKey: { not: "anvil" } }),
      },
      orderBy: { createdAt: "desc" },
    });
    const map = new Map<string, string>();
    for (const run of runs) {
      if (run.targetTestnetKey !== testnetKey && query.includeDevnet !== true) {
        continue;
      }
      if (!map.has(run.projectId)) {
        map.set(run.projectId, run.status);
      }
    }
    return map;
  }
}

function emptyFlags(): StageFlags {
  return {
    ingested: false,
    analyzed: false,
    compatibilityEvaluated: false,
    migrationPlanned: false,
    safeFixesGenerated: false,
    revisionFinalized: false,
    validationPassed: false,
    deploymentPrepared: false,
    testnetDeployed: false,
  };
}

function setFlag(map: Map<string, StageFlags>, projectId: string, key: keyof StageFlags): void {
  const flags = map.get(projectId);
  if (flags !== undefined) {
    flags[key] = true;
  }
}

function officialTestnetKey(networkKey: string): string {
  return getOfficialDeploymentTestnet(networkKey)?.key ?? `${networkKey}-sepolia`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function latestBy<T>(
  items: T[],
  keyOf: (item: T) => string,
  timeOf: (item: T) => Date,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = keyOf(item);
    const existing = map.get(key);
    if (existing === undefined || timeOf(item) > timeOf(existing)) {
      map.set(key, item);
    }
  }
  return map;
}

function summarizeAvailability(values: readonly string[]): {
  available: number;
  unavailable: number;
  unknown: number;
} {
  return {
    available: values.filter((item) => item === "AVAILABLE").length,
    unavailable: values.filter((item) => item === "UNAVAILABLE").length,
    unknown: values.filter((item) => item === "UNKNOWN").length,
  };
}

function mapValidation(row: {
  id: string;
  outcome: ValidationOutcome | null;
  status: string;
}): Parameters<typeof compareValidations>[0] {
  return {
    id: row.id,
    projectId: "",
    repositoryRevisionId: "",
    revisionType: "ORIGINAL",
    baseCommitSha: "",
    revisionContentHash: "",
    engineVersion: "1",
    profile: "STANDARD_LOCAL",
    framework: null,
    status: row.status as never,
    outcome: row.outcome,
    sandboxImage: null,
    sandboxImageDigest: null,
    runtimeVersion: null,
    buildStatus: null,
    testStatus: null,
    countsAvailable: false,
    testTotal: null,
    testPassed: null,
    testFailed: null,
    testSkipped: null,
    durationMs: null,
    errorCode: null,
    errorMessage: null,
    idempotencyKey: "",
    limitsJson: {},
    networkPolicy: "",
    leaseOwner: null,
    leaseExpiresAt: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
