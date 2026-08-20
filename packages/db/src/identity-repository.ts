import {
  createId,
  type AuditAction,
  type GitHubInstallationRecord,
  type JsonObject,
  type MembershipRole,
  type Organization,
  type OrganizationKind,
  type OrganizationMembership,
  type SessionRecord,
  type User,
} from "@chainport/shared";

import type { DatabaseClient } from "./client.js";
import { rethrowPersistenceError } from "./client.js";

export class IdentityRepository {
  public constructor(private readonly client: DatabaseClient) {}

  public async getUserById(id: string): Promise<User | undefined> {
    const row = await this.client.user.findUnique({ where: { id } });
    return row === null ? undefined : mapUser(row);
  }

  public async getUserByEmail(email: string): Promise<User | undefined> {
    const row = await this.client.user.findUnique({ where: { email } });
    return row === null ? undefined : mapUser(row);
  }

  public async upsertOidcUser(input: {
    email: string;
    name: string | null;
    issuer: string;
    subject: string;
  }): Promise<User> {
    try {
      const existing = await this.client.user.findFirst({
        where: { issuer: input.issuer, subject: input.subject },
      });
      if (existing !== null) {
        const updated = await this.client.user.update({
          where: { id: existing.id },
          data: { email: input.email, name: input.name, lastLoginAt: new Date() },
        });
        return mapUser(updated);
      }
      const byEmail = await this.client.user.findUnique({ where: { email: input.email } });
      if (byEmail !== null) {
        const updated = await this.client.user.update({
          where: { id: byEmail.id },
          data: {
            issuer: input.issuer,
            subject: input.subject,
            name: input.name,
            lastLoginAt: new Date(),
          },
        });
        return mapUser(updated);
      }
      const created = await this.client.user.create({
        data: {
          id: createId(),
          email: input.email,
          name: input.name,
          issuer: input.issuer,
          subject: input.subject,
          lastLoginAt: new Date(),
        },
      });
      return mapUser(created);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async setPlatformAdmin(userId: string, isPlatformAdmin: boolean): Promise<User> {
    const row = await this.client.user.update({
      where: { id: userId },
      data: { isPlatformAdmin },
    });
    return mapUser(row);
  }

  public async listMemberships(
    userId: string,
  ): Promise<Array<OrganizationMembership & { organizationKind: OrganizationKind }>> {
    const rows = await this.client.organizationMembership.findMany({
      where: { userId },
      include: { organization: true },
    });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      organizationId: row.organizationId,
      role: row.role as MembershipRole,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      organizationKind: row.organization.kind as OrganizationKind,
    }));
  }

  public async addMembership(input: {
    userId: string;
    organizationId: string;
    role: MembershipRole;
  }): Promise<OrganizationMembership> {
    try {
      const row = await this.client.organizationMembership.upsert({
        where: {
          userId_organizationId: { userId: input.userId, organizationId: input.organizationId },
        },
        update: { role: input.role },
        create: {
          id: createId(),
          userId: input.userId,
          organizationId: input.organizationId,
          role: input.role,
        },
      });
      return mapMembership(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async createOrganization(input: {
    name: string;
    slug: string;
    kind: OrganizationKind;
  }): Promise<Organization> {
    const row = await this.client.organization.create({
      data: { id: createId(), name: input.name, slug: input.slug, kind: input.kind },
    });
    return row;
  }

  public async createSession(input: {
    userId: string;
    tokenHash: string;
    csrfHash: string;
    expiresAt: Date;
    ip?: string;
    userAgent?: string;
    rotatedFromId?: string;
  }): Promise<SessionRecord> {
    const row = await this.client.session.create({
      data: {
        id: createId(),
        userId: input.userId,
        tokenHash: input.tokenHash,
        csrfHash: input.csrfHash,
        expiresAt: input.expiresAt,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        rotatedFromId: input.rotatedFromId ?? null,
      },
    });
    return mapSession(row);
  }

  public async getSessionByTokenHash(tokenHash: string): Promise<SessionRecord | undefined> {
    const row = await this.client.session.findUnique({ where: { tokenHash } });
    return row === null ? undefined : mapSession(row);
  }

  public async touchSession(id: string): Promise<void> {
    await this.client.session.update({ where: { id }, data: { lastSeenAt: new Date() } });
  }

  public async revokeSession(id: string): Promise<void> {
    await this.client.session.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  public async revokeUserSessions(userId: string): Promise<void> {
    await this.client.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  public async recordAudit(input: {
    actorUserId?: string | null;
    organizationId?: string | null;
    projectId?: string | null;
    action: AuditAction;
    targetType: string;
    targetId?: string | null;
    requestId?: string | null;
    metadata?: JsonObject;
  }): Promise<void> {
    await this.client.auditEvent.create({
      data: {
        id: createId(),
        actorUserId: input.actorUserId ?? null,
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        requestId: input.requestId ?? null,
        metadata: input.metadata ?? {},
      },
    });
  }

  public async listAudit(input: { organizationId?: string; projectId?: string; limit?: number }) {
    return this.client.auditEvent.findMany({
      where: {
        ...(input.organizationId === undefined ? {} : { organizationId: input.organizationId }),
        ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 100,
    });
  }

  public async upsertInstallation(input: {
    userId: string;
    installationId: string;
    accountLogin: string;
  }): Promise<GitHubInstallationRecord> {
    const existing = await this.client.gitHubInstallation.findUnique({
      where: {
        userId_installationId: { userId: input.userId, installationId: input.installationId },
      },
    });
    if (existing !== null) {
      const updated = await this.client.gitHubInstallation.update({
        where: { id: existing.id },
        data: { accountLogin: input.accountLogin, revokedAt: null },
      });
      return mapInstallation(updated);
    }
    const created = await this.client.gitHubInstallation.create({
      data: {
        id: createId(),
        userId: input.userId,
        installationId: input.installationId,
        accountLogin: input.accountLogin,
      },
    });
    return mapInstallation(created);
  }

  public async getInstallationById(id: string): Promise<GitHubInstallationRecord | undefined> {
    const row = await this.client.gitHubInstallation.findUnique({ where: { id } });
    return row === null ? undefined : mapInstallation(row);
  }

  public async listInstallations(userId: string): Promise<GitHubInstallationRecord[]> {
    const rows = await this.client.gitHubInstallation.findMany({
      where: { userId, revokedAt: null },
    });
    return rows.map(mapInstallation);
  }

  public async revokeInstallation(id: string): Promise<void> {
    await this.client.gitHubInstallation.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  public async countActiveJobs(input: {
    ownerUserId: string;
    statuses: readonly string[];
    kind: "ingest" | "analysis" | "validation" | "deployment";
  }): Promise<number> {
    if (input.kind === "ingest") {
      return this.client.migrationJob.count({
        where: {
          project: { ownerUserId: input.ownerUserId },
          status: { in: [...input.statuses] as never },
        },
      });
    }
    if (input.kind === "analysis") {
      return this.client.repositoryAnalysis.count({
        where: {
          project: { ownerUserId: input.ownerUserId },
          status: { in: [...input.statuses] as never },
        },
      });
    }
    if (input.kind === "validation") {
      return this.client.validationRun.count({
        where: {
          project: { ownerUserId: input.ownerUserId },
          status: { in: [...input.statuses] as never },
        },
      });
    }
    return this.client.deploymentRun.count({
      where: {
        project: { ownerUserId: input.ownerUserId },
        status: { in: [...input.statuses] as never },
      },
    });
  }
}

function mapUser(row: {
  id: string;
  email: string;
  name: string | null;
  organizationId: string | null;
  issuer: string | null;
  subject: string | null;
  isPlatformAdmin: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return row;
}

function mapMembership(row: {
  id: string;
  userId: string;
  organizationId: string;
  role: MembershipRole;
  createdAt: Date;
  updatedAt: Date;
}): OrganizationMembership {
  return row;
}

function mapSession(row: SessionRecord): SessionRecord {
  return row;
}

function mapInstallation(row: GitHubInstallationRecord): GitHubInstallationRecord {
  return row;
}
