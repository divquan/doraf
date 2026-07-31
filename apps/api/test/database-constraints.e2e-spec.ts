import { randomBytes, randomUUID } from 'node:crypto';
import { Pool, type DatabaseError } from 'pg';

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for database constraint tests',
  );
}

describe('foundation database constraints', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  let agentId: string;
  let productId: string;

  beforeAll(async () => {
    const tenantId = randomUUID();
    agentId = randomUUID();
    productId = randomUUID();

    await pool.query('INSERT INTO agent_tenant (id) VALUES ($1)', [tenantId]);
    await pool.query(
      `INSERT INTO agent (
        id, tenant_id, name, phone_ciphertext, phone_fingerprint, phone_mask,
        encryption_key_id, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        agentId,
        tenantId,
        'Database Test Agent',
        randomBytes(48),
        randomBytes(32),
        '024****567',
        'test-key-v1',
      ],
    );
    await pool.query(
      `INSERT INTO product (
        id, code, name, scope_disclosure, display_order, updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        productId,
        `TEST_${randomUUID().replaceAll('-', '').toUpperCase()}`,
        'Database Test Product',
        'Only used by the database constraint suite.',
        99,
      ],
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it('contains the three confirmed checker products as unavailable', async () => {
    const result = await pool.query<{ code: string; status: string }>(
      `SELECT code, status
       FROM product
       WHERE code = ANY($1::text[])
       ORDER BY display_order`,
      [['BECE', 'WASSCE', 'NOVDEC_PRIVATE']],
    );

    expect(result.rows).toEqual([
      { code: 'BECE', status: 'UNAVAILABLE' },
      { code: 'WASSCE', status: 'UNAVAILABLE' },
      { code: 'NOVDEC_PRIVATE', status: 'UNAVAILABLE' },
    ]);
  });

  it('rejects a duplicate protected phone fingerprint', async () => {
    const fingerprintResult = await pool.query<{ phone_fingerprint: Buffer }>(
      'SELECT phone_fingerprint FROM agent WHERE id = $1',
      [agentId],
    );
    const duplicateFingerprint = fingerprintResult.rows[0]?.phone_fingerprint;
    expect(duplicateFingerprint).toBeDefined();

    const secondTenantId = randomUUID();
    await pool.query('INSERT INTO agent_tenant (id) VALUES ($1)', [
      secondTenantId,
    ]);

    await expectDatabaseError(
      pool.query(
        `INSERT INTO agent (
          tenant_id, name, phone_ciphertext, phone_fingerprint, phone_mask,
          encryption_key_id, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          secondTenantId,
          'Duplicate Phone Agent',
          randomBytes(48),
          duplicateFingerprint,
          '024****567',
          'test-key-v1',
        ],
      ),
      '23505',
    );
  });

  it('rejects a maximum retail price below the base price', async () => {
    await expectDatabaseError(
      pool.query(
        `INSERT INTO product_pricing_policy (
          product_id, base_price_minor, maximum_retail_price_minor,
          effective_from, reason, updated_at
        ) VALUES ($1, $2, $3, NOW(), $4, NOW())`,
        [productId, 2_000, 1_999, 'Invalid range test'],
      ),
      '23514',
    );
  });

  it('rejects overlapping default pricing windows', async () => {
    await pool.query(
      `INSERT INTO product_pricing_policy (
        product_id, base_price_minor, maximum_retail_price_minor,
        effective_from, effective_to, reason, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        productId,
        2_000,
        3_000,
        '2026-01-01T00:00:00Z',
        '2026-02-01T00:00:00Z',
        'First window',
      ],
    );

    await expectDatabaseError(
      pool.query(
        `INSERT INTO product_pricing_policy (
          product_id, base_price_minor, maximum_retail_price_minor,
          effective_from, effective_to, reason, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          productId,
          2_100,
          3_100,
          '2026-01-15T00:00:00Z',
          '2026-02-15T00:00:00Z',
          'Overlapping window',
        ],
      ),
      '23P01',
    );
  });

  it('allows only one active retail price per agent and product', async () => {
    await pool.query(
      `INSERT INTO agent_product_price (
        agent_id, product_id, retail_price_minor, updated_at
      ) VALUES ($1, $2, $3, NOW())`,
      [agentId, productId, 2_500],
    );

    await expectDatabaseError(
      pool.query(
        `INSERT INTO agent_product_price (
          agent_id, product_id, retail_price_minor, updated_at
        ) VALUES ($1, $2, $3, NOW())`,
        [agentId, productId, 2_600],
      ),
      '23505',
    );
  });
});

async function expectDatabaseError(
  operation: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  try {
    await operation;
    throw new Error(`Expected PostgreSQL error ${expectedCode}`);
  } catch (error: unknown) {
    expect((error as DatabaseError).code).toBe(expectedCode);
  }
}
