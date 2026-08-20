CREATE TYPE "AcquisitionSource" AS ENUM ('GENERIC_PORTAL', 'PARTNER_PORTAL', 'INTERNAL', 'API');

ALTER TABLE "network_partners"
    ADD COLUMN "slug" TEXT,
    ADD COLUMN "logo_url" TEXT,
    ADD COLUMN "primary_accent" TEXT,
    ADD COLUMN "short_description" TEXT,
    ADD COLUMN "developer_portal_enabled" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "docs_url" TEXT,
    ADD COLUMN "faucet_url" TEXT,
    ADD COLUMN "explorer_url" TEXT,
    ADD COLUMN "support_url" TEXT,
    ADD COLUMN "discord_url" TEXT,
    ADD COLUMN "developer_docs_url" TEXT;

WITH ranked AS (
    SELECT
        id,
        network_key,
        ROW_NUMBER() OVER (PARTITION BY network_key ORDER BY created_at, id) AS rn
    FROM "network_partners"
)
UPDATE "network_partners" AS partner
SET "slug" = CASE
    WHEN ranked.rn = 1 THEN ranked.network_key
    ELSE ranked.network_key || '-' || substr(replace(partner.id::text, '-', ''), 1, 8)
END
FROM ranked
WHERE partner.id = ranked.id;

ALTER TABLE "network_partners" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "network_partners_slug_key" ON "network_partners"("slug");

ALTER TABLE "projects"
    ADD COLUMN "network_partner_id" UUID,
    ADD COLUMN "acquisition_source" "AcquisitionSource" NOT NULL DEFAULT 'GENERIC_PORTAL',
    ADD COLUMN "referral_code" TEXT,
    ADD COLUMN "campaign" TEXT;

CREATE INDEX "projects_network_partner_id_idx" ON "projects"("network_partner_id");
CREATE INDEX "projects_acquisition_source_idx" ON "projects"("acquisition_source");

ALTER TABLE "projects"
    ADD CONSTRAINT "projects_network_partner_id_fkey"
    FOREIGN KEY ("network_partner_id") REFERENCES "network_partners"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
