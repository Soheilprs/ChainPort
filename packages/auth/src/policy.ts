import type { FoundationRole, MembershipRole, Project } from "@chainport/shared";

export interface ActorMembership {
  organizationId: string;
  role: MembershipRole;
  organizationKind: string;
}

export interface Actor {
  userId: string;
  email: string;
  name: string | null;
  isPlatformAdmin: boolean;
  memberships: readonly ActorMembership[];
}

export function foundationRoleFor(
  actor: Actor,
  organizationId: string,
): FoundationRole | undefined {
  const membership = actor.memberships.find((item) => item.organizationId === organizationId);
  if (membership === undefined) {
    return undefined;
  }
  if (membership.role === "OWNER" || membership.role === "ADMIN") {
    return "FOUNDATION_ADMIN";
  }
  return "FOUNDATION_ANALYST";
}

export function canAccessProject(actor: Actor, project: Project): boolean {
  if (actor.isPlatformAdmin) {
    return true;
  }
  if (project.ownerUserId === actor.userId) {
    return true;
  }
  if (
    project.ownerOrganizationId !== null &&
    actor.memberships.some((item) => item.organizationId === project.ownerOrganizationId)
  ) {
    return true;
  }
  return false;
}

export function canDeploy(actor: Actor, project: Project): boolean {
  return canAccessProject(actor, project);
}

export function canManagePartner(actor: Actor, partnerOrganizationId: string): boolean {
  if (actor.isPlatformAdmin) {
    return true;
  }
  return foundationRoleFor(actor, partnerOrganizationId) === "FOUNDATION_ADMIN";
}

export function canViewPartner(actor: Actor, partnerOrganizationId: string): boolean {
  if (actor.isPlatformAdmin) {
    return true;
  }
  return foundationRoleFor(actor, partnerOrganizationId) !== undefined;
}

export function canCreatePlatformPartner(actor: Actor): boolean {
  return actor.isPlatformAdmin;
}
