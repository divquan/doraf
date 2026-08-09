import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AppEnvironment } from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';
import { SalesChannelService } from '../src/agent-access/sales-channel.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error(
    'TEST_DATABASE_URL is required for sales-channel database tests',
  );

describe('agent web sales channel', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let service: SalesChannelService;

  beforeAll(async () => {
    const config = {
      get: jest.fn().mockReturnValue(databaseUrl),
    } as unknown as ConfigService<AppEnvironment, true>;
    module = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useFactory: () => new PrismaService(config) },
        SalesChannelService,
      ],
    }).compile();
    prisma = module.get(PrismaService);
    service = module.get(SalesChannelService);
  });

  afterAll(async () => module.close());

  it('resolves an active channel without exposing internal attribution IDs', async () => {
    const tenant = await prisma.agentTenant.create({ data: {} });
    const agent = await prisma.agent.create({
      data: {
        tenantId: tenant.id,
        name: 'Public Store Agent',
        phoneCiphertext: randomBytes(48),
        phoneFingerprint: randomBytes(32),
        phoneMask: '024****654',
        encryptionKeyId: 'test-key-v1',
      },
    });
    const product = await prisma.product.create({
      data: {
        code: `CHANNEL_${randomUUID().replaceAll('-', '').toUpperCase()}`,
        name: 'Public Store Product',
        scopeDisclosure: 'Sales-channel integration product.',
        displayOrder: 97,
        status: 'ACTIVE',
      },
    });
    await prisma.agentProductPrice.create({
      data: {
        agentId: agent.id,
        productId: product.id,
        retailPriceMinor: 2_500,
      },
    });

    const ownChannel = await service.getForAgent(agent.id);
    expect(ownChannel).toMatchObject({
      type: 'WEB',
      publicId: agent.webSalesId,
      subdomainUrl: `https://${agent.webSalesId}.dashchecker.app`,
    });
    const publicStore = await service.resolveWebChannel(agent.webSalesId);
    expect(publicStore.agent).toMatchObject({ displayName: agent.name });
    expect(publicStore).not.toHaveProperty('agent.id');
    expect(publicStore.products).toEqual([
      expect.objectContaining({
        id: product.id,
        retailPriceMinor: 2_500,
        currency: 'GHS',
      }),
    ]);

    // Test updating storefront settings and custom slug
    const updatedChannel = await service.updateStorefront(agent.id, {
      slug: 'test-agent-store',
      storeName: 'Test Agent Storefront',
      whatsappNumber: '233240000000',
    });
    expect(updatedChannel.slug).toBe('test-agent-store');
    expect(updatedChannel.publicId).toBe('test-agent-store');

    const slugResolved = await service.resolveWebChannel('test-agent-store');
    expect(slugResolved.agent).toMatchObject({
      displayName: agent.name,
      storeName: 'Test Agent Storefront',
      whatsappNumber: '233240000000',
    });

    await prisma.agent.update({
      where: { id: agent.id },
      data: { status: 'SUSPENDED' },
    });
    await expect(
      service.resolveWebChannel(agent.webSalesId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
