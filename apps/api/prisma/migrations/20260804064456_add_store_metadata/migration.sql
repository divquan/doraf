/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `agent` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "agent" ADD COLUMN     "announcement" VARCHAR(200),
ADD COLUMN     "banner_url" VARCHAR(255),
ADD COLUMN     "logo_url" VARCHAR(255),
ADD COLUMN     "slug" VARCHAR(30),
ADD COLUMN     "store_name" VARCHAR(60),
ADD COLUMN     "tagline" VARCHAR(120),
ADD COLUMN     "theme_preset" VARCHAR(30) DEFAULT 'default',
ADD COLUMN     "whatsapp_number" VARCHAR(20);

-- CreateIndex
CREATE UNIQUE INDEX "agent_slug_key" ON "agent"("slug");
