import { AgentOnboardingService } from './agent-onboarding.service';

const prices = [
  {
    product: {
      id: 'product-1',
      code: 'BECE',
      name: 'BECE Checker',
      scopeDisclosure: 'BECE',
      status: 'ACTIVE' as const,
    },
    pricing: {
      currency: 'GHS',
      basePriceMinor: 1000,
      maximumRetailPriceMinor: 2000,
      retailPriceMinor: 1500,
      profitMinor: 500,
      source: 'DEFAULT' as const,
    },
  },
];

function createService() {
  const prisma = {
    agent: { findUnique: jest.fn().mockResolvedValue({ id: 'agent-1' }) },
    agentOnboarding: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };
  const pricing = { listForAgent: jest.fn().mockResolvedValue(prices) };
  const salesChannels = {
    getForAgent: jest.fn().mockResolvedValue({
      subdomainUrl: 'https://agent.example.com',
      storeName: 'Demo Store',
      slug: 'demo-store',
      webSalesId: 'demo-web-id',
    }),
  };

  return {
    service: new AgentOnboardingService(
      prisma as never,
      pricing as never,
      salesChannels as never,
    ),
    prisma,
  };
}

describe('AgentOnboardingService', () => {
  it('records a started attempt and returns the checklist', async () => {
    const { service, prisma } = createService();
    const existing = {
      currentStep: 0,
      startedAt: null,
      pricesConfiguredAt: null,
      productsReviewedAt: null,
      storefrontSharedAt: null,
      completedAt: null,
      lastDismissedAt: null,
    };
    prisma.agentOnboarding.upsert.mockResolvedValue(existing);
    prisma.agentOnboarding.update.mockResolvedValue({
      ...existing,
      currentStep: 1,
      startedAt: new Date(),
    });
    prisma.agentOnboarding.findUnique.mockResolvedValue({
      ...existing,
      currentStep: 1,
      startedAt: new Date(),
    });

    const result = await service.record('agent-1', 'START');

    // Jest's mock call list is intentionally untyped; only inspect the safe field we assert.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const updateInput = prisma.agentOnboarding.update.mock.calls[0]?.[0] as {
      data?: { currentStep?: number };
    };
    expect(updateInput.data?.currentStep).toBe(1);
    expect(result.status).toBe('IN_PROGRESS');
    expect(result.steps[1].complete).toBe(true);
  });

  it('does not mark onboarding complete until required actions are recorded', async () => {
    const { service, prisma } = createService();
    prisma.agentOnboarding.upsert.mockResolvedValue({
      currentStep: 1,
      startedAt: new Date(),
      pricesConfiguredAt: null,
      productsReviewedAt: null,
      storefrontSharedAt: null,
      completedAt: null,
      lastDismissedAt: null,
    });

    await expect(service.record('agent-1', 'COMPLETE')).rejects.toThrow(
      'Complete the setup checklist before finishing onboarding',
    );
    expect(prisma.agentOnboarding.update).not.toHaveBeenCalled();
  });

  it('records completion after prices, availability, and sharing are verified', async () => {
    const { service, prisma } = createService();
    const existing = {
      currentStep: 2,
      startedAt: new Date(),
      pricesConfiguredAt: null,
      productsReviewedAt: new Date(),
      storefrontSharedAt: new Date(),
      completedAt: null,
      lastDismissedAt: null,
    };
    prisma.agentOnboarding.upsert.mockResolvedValue(existing);
    prisma.agentOnboarding.update.mockResolvedValue({
      ...existing,
      currentStep: 3,
      completedAt: new Date(),
    });
    prisma.agentOnboarding.findUnique.mockResolvedValue({
      ...existing,
      currentStep: 3,
      completedAt: new Date(),
    });

    const result = await service.record('agent-1', 'COMPLETE');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const updateInput = prisma.agentOnboarding.update.mock.calls[0]?.[0] as {
      data?: { currentStep?: number };
    };
    expect(updateInput.data?.currentStep).toBe(4);
    expect(result.status).toBe('COMPLETED');
  });
});
