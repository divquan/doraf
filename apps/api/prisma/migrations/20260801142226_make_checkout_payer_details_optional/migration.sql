-- AlterTable
ALTER TABLE "order" ALTER COLUMN "payer_phone_ciphertext" DROP NOT NULL,
ALTER COLUMN "payer_phone_fingerprint" DROP NOT NULL,
ALTER COLUMN "payer_phone_mask" DROP NOT NULL,
ALTER COLUMN "payer_network" DROP NOT NULL;
