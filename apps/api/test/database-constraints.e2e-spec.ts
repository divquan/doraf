import { randomBytes, randomUUID } from 'node:crypto';
import { Pool, type DatabaseError, type PoolClient } from 'pg';

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
  let inventoryBatchId: string;
  let internalUserId: string;
  let voucherId: string;
  let serialFingerprint: Buffer;

  beforeAll(async () => {
    const tenantId = randomUUID();
    agentId = randomUUID();
    internalUserId = randomUUID();
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
      `INSERT INTO internal_user (
        id, display_name, role, status, updated_at
      ) VALUES ($1, $2, 'ADMINISTRATOR', 'ACTIVE', NOW())`,
      [internalUserId, 'Database Test Administrator'],
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

    inventoryBatchId = randomUUID();
    voucherId = randomUUID();
    serialFingerprint = randomBytes(32);
    await pool.query(
      `INSERT INTO inventory_batch (
        id, product_id, vendor_name, vendor_reference, acquisition_date,
        unit_acquisition_cost_minor, source_row_count, accepted_row_count,
        encrypted_data_key, kms_key_version, uploaded_by_actor_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10)`,
      [
        inventoryBatchId,
        productId,
        'Database Test Vendor',
        'DB-TEST-INV-1',
        '2026-07-30',
        1_500,
        1,
        randomBytes(48),
        'projects/test/locations/global/keyRings/test/cryptoKeys/voucher/cryptoKeyVersions/1',
        randomUUID(),
      ],
    );
    await insertVoucher(pool, {
      id: voucherId,
      batchId: inventoryBatchId,
      productId,
      serialFingerprint,
      pinFingerprint: randomBytes(32),
    });
    await pool.query(
      `INSERT INTO inventory_event (
        voucher_id, event_type, previous_availability,
        resulting_availability, source_type, source_id
      ) VALUES ($1, 'IMPORTED', NULL, 'AVAILABLE', 'INVENTORY_BATCH', $2)`,
      [voucherId, inventoryBatchId],
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

  it('assigns a permanent opaque and unique web sales identifier', async () => {
    const first = await pool.query<{ web_sales_id: string }>(
      'SELECT web_sales_id FROM agent WHERE id = $1',
      [agentId],
    );
    const webSalesId = first.rows[0]?.web_sales_id;
    expect(webSalesId).toMatch(/^[a-f0-9]{24}$/);

    const tenantId = randomUUID();
    await pool.query('INSERT INTO agent_tenant (id) VALUES ($1)', [tenantId]);
    await expectDatabaseError(
      pool.query(
        `INSERT INTO agent (
          tenant_id, name, phone_ciphertext, phone_fingerprint, phone_mask,
          web_sales_id, encryption_key_id, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          tenantId,
          'Duplicate Web Channel Agent',
          randomBytes(48),
          randomBytes(32),
          '020****456',
          webSalesId,
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

  it('rejects duplicate voucher serial fingerprints', async () => {
    await expectDatabaseError(
      insertVoucher(pool, {
        id: randomUUID(),
        batchId: inventoryBatchId,
        productId,
        serialFingerprint,
        pinFingerprint: randomBytes(32),
      }),
      '23505',
    );
  });

  it('rejects a voucher whose product differs from its batch', async () => {
    const otherProduct = await pool.query<{ id: string }>(
      'SELECT id FROM product WHERE code = $1',
      ['BECE'],
    );
    const otherProductId = otherProduct.rows[0]?.id;
    expect(otherProductId).toBeDefined();

    await expectDatabaseError(
      insertVoucher(pool, {
        id: randomUUID(),
        batchId: inventoryBatchId,
        productId: otherProductId,
        serialFingerprint: randomBytes(32),
        pinFingerprint: randomBytes(32),
      }),
      '23503',
    );
  });

  it('prevents terminal sold inventory from returning to available', async () => {
    await pool.query(
      `UPDATE voucher
       SET availability = 'SOLD', version = version + 1, updated_at = NOW()
       WHERE id = $1`,
      [voucherId],
    );

    await expectDatabaseError(
      pool.query(
        `UPDATE voucher
         SET availability = 'AVAILABLE', version = version + 1, updated_at = NOW()
         WHERE id = $1`,
        [voucherId],
      ),
      '23514',
    );
  });

  it('keeps inventory events append-only', async () => {
    await expectDatabaseError(
      pool.query(
        `UPDATE inventory_event
         SET event_type = 'ALTERED'
         WHERE voucher_id = $1`,
        [voucherId],
      ),
      '42501',
    );
  });

  it('rejects a session assigned to both an agent and an internal user', async () => {
    await expectDatabaseError(
      pool.query(
        `INSERT INTO session (
          agent_id, internal_user_id, token_fingerprint,
          authentication_strength, authenticated_at, expires_at
        ) VALUES ($1, $2, $3, 'MFA', NOW(), NOW() + INTERVAL '1 hour')`,
        [agentId, internalUserId, randomBytes(32)],
      ),
      '23514',
    );
  });

  it('allows an OTP-authenticated session for an agent', async () => {
    await pool.query(
      `INSERT INTO session (
        agent_id, token_fingerprint, authentication_strength,
        authenticated_at, expires_at
      ) VALUES ($1, $2, 'OTP', NOW(), NOW() + INTERVAL '1 hour')`,
      [agentId, randomBytes(32)],
    );
  });

  it('rejects a duplicate idempotency key within its scope', async () => {
    const key = randomUUID();
    await pool.query(
      `INSERT INTO idempotency_record (
        scope, key, operation, request_fingerprint, expires_at
      ) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 hour')`,
      ['agent:command', key, 'AGENT_PRICE_SET', randomBytes(32)],
    );
    await expectDatabaseError(
      pool.query(
        `INSERT INTO idempotency_record (
          scope, key, operation, request_fingerprint, expires_at
        ) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 hour')`,
        ['agent:command', key, 'AGENT_PRICE_SET', randomBytes(32)],
      ),
      '23505',
    );
  });

  it('rejects duplicate outbox events for one aggregate version', async () => {
    const aggregateId = randomUUID();
    await insertOutboxEvent(pool, aggregateId, 1, 'PRICE_CHANGED');
    await expectDatabaseError(
      insertOutboxEvent(pool, aggregateId, 1, 'PRICE_CHANGED'),
      '23505',
    );
  });

  it('does not retain outbox work when its domain transaction rolls back', async () => {
    const aggregateId = randomUUID();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO outbox_event (
          event_type, aggregate_type, aggregate_id, aggregate_version
        ) VALUES ('DELIVERY_REQUESTED', 'AGENT', $1, 1)`,
        [aggregateId],
      );
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    const result = await pool.query(
      'SELECT id FROM outbox_event WHERE aggregate_id = $1',
      [aggregateId],
    );
    expect(result.rowCount).toBe(0);
  });

  it('lets competing workers claim different outbox events', async () => {
    await insertOutboxEvent(pool, randomUUID(), 1, 'DELIVERY_REQUESTED');
    await insertOutboxEvent(pool, randomUUID(), 1, 'DELIVERY_REQUESTED');
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      await Promise.all([first.query('BEGIN'), second.query('BEGIN')]);
      const [left, right] = await Promise.all([
        claimOne(first, randomUUID()),
        claimOne(second, randomUUID()),
      ]);
      expect(left).toBeDefined();
      expect(right).toBeDefined();
      expect(left).not.toBe(right);
      await Promise.all([first.query('COMMIT'), second.query('COMMIT')]);
    } finally {
      first.release();
      second.release();
    }
  });

  it('allows only one unconsumed enrollment token per internal user', async () => {
    await pool.query(
      `INSERT INTO internal_enrollment_token (
        internal_user_id, token_fingerprint, expires_at
      ) VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
      [internalUserId, randomBytes(32)],
    );
    await expectDatabaseError(
      pool.query(
        `INSERT INTO internal_enrollment_token (
          internal_user_id, token_fingerprint, expires_at
        ) VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
        [internalUserId, randomBytes(32)],
      ),
      '23505',
    );
  });

  it('keeps security audit events append-only', async () => {
    const auditEventId = randomUUID();
    await pool.query(
      `INSERT INTO audit_event (
        id, actor_internal_user_id, actor_role, action, entity_type,
        entity_id, reason, authentication_strength, request_id
      ) VALUES ($1, $2, 'ADMINISTRATOR', $3, $4, $5, $6, 'MFA', $7)`,
      [
        auditEventId,
        internalUserId,
        'INVENTORY_BATCH_IMPORTED',
        'INVENTORY_BATCH',
        inventoryBatchId,
        'Verify append-only database enforcement',
        randomUUID(),
      ],
    );

    await expectDatabaseError(
      pool.query('UPDATE audit_event SET reason = $1 WHERE id = $2', [
        'Attempted mutation',
        auditEventId,
      ]),
      '42501',
    );
    await expectDatabaseError(
      pool.query('DELETE FROM audit_event WHERE id = $1', [auditEventId]),
      '42501',
    );
  });
});

interface VoucherFixture {
  id: string;
  batchId: string;
  productId: string;
  serialFingerprint: Buffer;
  pinFingerprint: Buffer;
}

function insertOutboxEvent(
  client: Pool,
  aggregateId: string,
  aggregateVersion: number,
  eventType: string,
): Promise<unknown> {
  return client.query(
    `INSERT INTO outbox_event (
      event_type, aggregate_type, aggregate_id, aggregate_version
    ) VALUES ($1, 'AGENT', $2, $3)`,
    [eventType, aggregateId, aggregateVersion],
  );
}

async function claimOne(
  client: PoolClient,
  claimToken: string,
): Promise<string | undefined> {
  const result = await client.query<{ id: string }>(
    `WITH candidate AS (
      SELECT id FROM outbox_event
      WHERE state = 'PENDING'
      ORDER BY created_at
      LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    UPDATE outbox_event AS event
    SET state = 'CLAIMED', claimed_at = NOW(), claim_token = $1,
        attempt_count = attempt_count + 1
    FROM candidate
    WHERE event.id = candidate.id
    RETURNING event.id`,
    [claimToken],
  );
  return result.rows[0]?.id;
}

function insertVoucher(pool: Pool, voucher: VoucherFixture): Promise<unknown> {
  return pool.query(
    `INSERT INTO voucher (
      id, batch_id, product_id,
      serial_ciphertext, serial_nonce, serial_auth_tag,
      serial_fingerprint, serial_mask, serial_key_version,
      pin_ciphertext, pin_nonce, pin_auth_tag,
      pin_fingerprint, pin_mask, pin_key_version, updated_at
    ) VALUES (
      $1, $2, $3,
      $4, $5, $6,
      $7, $8, $9,
      $10, $11, $12,
      $13, $14, $9, NOW()
    )`,
    [
      voucher.id,
      voucher.batchId,
      voucher.productId,
      randomBytes(32),
      randomBytes(12),
      randomBytes(16),
      voucher.serialFingerprint,
      '****0001',
      'projects/test/locations/global/keyRings/test/cryptoKeys/voucher/cryptoKeyVersions/1',
      randomBytes(12),
      randomBytes(12),
      randomBytes(16),
      voucher.pinFingerprint,
      '********0001',
    ],
  );
}

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
