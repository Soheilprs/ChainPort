CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
CREATE TYPE "RepositoryVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE "AuditAction" AS ENUM (
  'LOGIN',
  'LOGOUT',
  'PROJECT_CREATED',
  'PROJECT_ARCHIVED',
  'PRIVATE_REPO_CONNECTED',
  'ANALYSIS_STARTED',
  'CHANGESET_FINALIZED',
  'VALIDATION_STARTED',
  'DEPLOYMENT_PREPARED',
  'DEPLOYMENT_CONFIRMED',
  'DEPLOYMENT_COMPLETED',
  'PARTNER_SETTINGS_UPDATED',
  'MEMBER_ADDED',
  'ROLE_CHANGED',
  'ACCESS_DENIED'
);

ALTER TABLE "users"
  ADD COLUMN "issuer" TEXT,
  ADD COLUMN "subject" TEXT,
  ADD COLUMN "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "last_login_at" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "users_issuer_subject_key" ON "users"("issuer", "subject");

CREATE TABLE "organization_memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_memberships_user_id_organization_id_key" ON "organization_memberships"("user_id", "organization_id");
CREATE INDEX "organization_memberships_organization_id_role_idx" ON "organization_memberships"("organization_id", "role");

ALTER TABLE "organization_memberships"
  ADD CONSTRAINT "organization_memberships_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_memberships"
  ADD CONSTRAINT "organization_memberships_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "csrf_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "rotated_from_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "github_installations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "installation_id" TEXT NOT NULL,
    "account_login" TEXT NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "github_installations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "github_installations_user_id_installation_id_key" ON "github_installations"("user_id", "installation_id");
CREATE INDEX "github_installations_installation_id_idx" ON "github_installations"("installation_id");

ALTER TABLE "github_installations"
  ADD CONSTRAINT "github_installations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "repositories"
  ADD COLUMN "visibility" "RepositoryVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN "github_installation_db_id" UUID;

ALTER TABLE "repositories"
  ADD CONSTRAINT "repositories_github_installation_db_id_fkey"
  FOREIGN KEY ("github_installation_db_id") REFERENCES "github_installations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD COLUMN "owner_user_id" UUID,
  ADD COLUMN "owner_organization_id" UUID;

CREATE INDEX "projects_owner_user_id_idx" ON "projects"("owner_user_id");
CREATE INDEX "projects_owner_organization_id_idx" ON "projects"("owner_organization_id");

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_owner_organization_id_fkey"
  FOREIGN KEY ("owner_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "organization_id" UUID,
    "project_id" UUID,
    "action" "AuditAction" NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "request_id" TEXT,
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_events_actor_user_id_created_at_idx" ON "audit_events"("actor_user_id", "created_at");
CREATE INDEX "audit_events_organization_id_created_at_idx" ON "audit_events"("organization_id", "created_at");
CREATE INDEX "audit_events_project_id_created_at_idx" ON "audit_events"("project_id", "created_at");
CREATE INDEX "audit_events_action_created_at_idx" ON "audit_events"("action", "created_at");

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
