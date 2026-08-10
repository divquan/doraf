-- CreateTable
CREATE TABLE "agent_onboarding" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" UUID NOT NULL,
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6),
    "prices_configured_at" TIMESTAMPTZ(6),
    "products_reviewed_at" TIMESTAMPTZ(6),
    "storefront_shared_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "last_dismissed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "agent_onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_onboarding_agent_id_key" ON "agent_onboarding"("agent_id");

-- AddForeignKey
ALTER TABLE "agent_onboarding" ADD CONSTRAINT "agent_onboarding_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
