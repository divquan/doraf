-- AlterTable
ALTER TABLE "agent" ADD COLUMN "web_sales_id" VARCHAR(24) NOT NULL DEFAULT lower(encode(gen_random_bytes(12), 'hex'));

-- CreateIndex
CREATE UNIQUE INDEX "agent_web_sales_id_key" ON "agent"("web_sales_id");
