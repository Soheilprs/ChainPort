import { describe, expect, it } from "vitest";

import { canAccessProject, canManagePartner, canViewPartner } from "../src/index.js";
import type { Actor } from "../src/index.js";
import type { Project } from "@chainport/shared";

const now = new Date();

function project(ownerUserId: string | null): Project {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    organizationId: null,
    ownerUserId,
    ownerOrganizationId: null,
    repositoryId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "acme/wallet",
    githubUrl: "https://github.com/acme/wallet",
    githubOwner: "acme",
    githubRepo: "wallet",
    defaultBranch: "main",
    status: "ACTIVE",
    dataClassification: "PRODUCTION",
    networkPartnerId: null,
    acquisitionSource: "GENERIC_PORTAL",
    referralCode: null,
    campaign: null,
    activeRevisionId: null,
    createdAt: now,
    updatedAt: now,
  };
}

function actor(input: Partial<Actor> & { userId: string }): Actor {
  return {
    email: `${input.userId}@example.com`,
    name: input.userId,
    isPlatformAdmin: false,
    memberships: [],
    ...input,
  };
}

describe("authorization policy", () => {
  it("allows only the owning developer to access a project", () => {
    const alice = actor({ userId: "alice" });
    const bob = actor({ userId: "bob" });
    const owned = project("alice");
    expect(canAccessProject(alice, owned)).toBe(true);
    expect(canAccessProject(bob, owned)).toBe(false);
  });

  it("isolates foundation organizations", () => {
    const optimismAdmin = actor({
      userId: "op-admin",
      memberships: [{ organizationId: "org-op", role: "ADMIN", organizationKind: "NETWORK" }],
    });
    const baseAdmin = actor({
      userId: "base-admin",
      memberships: [{ organizationId: "org-base", role: "OWNER", organizationKind: "NETWORK" }],
    });
    expect(canViewPartner(optimismAdmin, "org-op")).toBe(true);
    expect(canManagePartner(optimismAdmin, "org-op")).toBe(true);
    expect(canViewPartner(optimismAdmin, "org-base")).toBe(false);
    expect(canViewPartner(baseAdmin, "org-op")).toBe(false);
  });

  it("does not treat foundation membership as project ownership", () => {
    const analyst = actor({
      userId: "analyst",
      memberships: [{ organizationId: "org-op", role: "MEMBER", organizationKind: "NETWORK" }],
    });
    expect(canAccessProject(analyst, project("alice"))).toBe(false);
    expect(canManagePartner(analyst, "org-op")).toBe(false);
    expect(canViewPartner(analyst, "org-op")).toBe(true);
  });
});
