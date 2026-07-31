import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHmac, randomBytes } from 'node:crypto';
import { PrismaClient } from '../src/generated/prisma/client';

async function main(): Promise<void> {
  const displayName = process.argv.slice(2).join(' ').trim();
  if (!displayName) {
    throw new Error(
      'Provide the first Administrator display name as the command argument',
    );
  }
  const databaseUrl = requiredEnvironment('DATABASE_URL');
  const fingerprintKey = Buffer.from(
    requiredEnvironment('INTERNAL_ENROLLMENT_FINGERPRINT_KEY_BASE64'),
    'base64',
  );
  if (fingerprintKey.length < 32) {
    throw new Error('Enrollment fingerprint key must be at least 32 bytes');
  }
  const ttlSeconds = Number(process.env.INTERNAL_ENROLLMENT_TTL_SECONDS ?? 900);
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1) {
    throw new Error('INTERNAL_ENROLLMENT_TTL_SECONDS must be positive');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const token = randomBytes(32).toString('base64url');
  const fingerprint = createHmac('sha256', fingerprintKey)
    .update('doraf:internal-enrollment:v1\0', 'utf8')
    .update(token, 'utf8')
    .digest();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1_000);

  try {
    const userId = await prisma.$transaction(async (transaction) => {
      if ((await transaction.internalUser.count()) !== 0) {
        throw new Error(
          'Bootstrap refused because an internal user already exists; use an authenticated Administrator invitation',
        );
      }
      const user = await transaction.internalUser.create({
        data: { displayName, role: 'ADMINISTRATOR' },
        select: { id: true },
      });
      await transaction.internalEnrollmentToken.create({
        data: {
          internalUserId: user.id,
          tokenFingerprint: fingerprint,
          expiresAt,
        },
      });
      return user.id;
    });
    console.log(
      JSON.stringify({
        userId,
        role: 'ADMINISTRATOR',
        enrollmentToken: token,
        enrollmentExpiresAt: expiresAt.toISOString(),
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Bootstrap failed');
  process.exitCode = 1;
});
