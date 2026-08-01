-- AlterTable
ALTER TABLE "agent" ALTER COLUMN "web_sales_id" SET DEFAULT lower(encode(gen_random_bytes(12), 'hex'));

-- AlterTable
ALTER TABLE "idempotency_record" ALTER COLUMN "scope" SET DATA TYPE VARCHAR(200);
