/* eslint-disable @typescript-eslint/unbound-method */
import { WalletController } from './wallet.controller';
import type { WalletService } from './wallet.service';
import type { AgentPrincipal } from '../agent-access/agent-access.types';

describe('WalletController', () => {
  let controller: WalletController;
  let service: jest.Mocked<WalletService>;

  const mockPrincipal: AgentPrincipal = {
    agentId: 'agent-uuid-1234',
    tenantId: 'tenant-uuid-5678',
    sessionId: 'session-uuid-9999',
    name: 'Test Agent',
    phoneMask: '+233 24 *** 5678',
    status: 'ACTIVE',
    authenticatedAt: new Date(),
  };

  beforeEach(() => {
    service = {
      getSummary: jest.fn(),
      getTransactions: jest.fn(),
    } as unknown as jest.Mocked<WalletService>;

    controller = new WalletController(service);
  });

  it('passes the authenticated principal agentId to getSummary', async () => {
    const mockSummary = {
      ledgerBalanceMinor: '1500',
      activeHoldsMinor: '0',
      withdrawableMinor: '1500',
      currency: 'GHS',
      isNegative: false,
      negativeBalanceMinor: '0',
    };
    service.getSummary.mockResolvedValue(mockSummary);

    const result = await controller.getSummary(mockPrincipal);

    expect(service.getSummary).toHaveBeenCalledTimes(1);
    expect(service.getSummary).toHaveBeenCalledWith('agent-uuid-1234');
    expect(result).toBe(mockSummary);
  });

  it('passes the authenticated principal agentId and query to getTransactions', async () => {
    const mockQuery = { page: 2, limit: 10 };
    const mockPaginated = {
      items: [],
      pagination: {
        totalItems: 0,
        totalPages: 0,
        currentPage: 2,
        limit: 10,
        hasNextPage: false,
      },
    };
    service.getTransactions.mockResolvedValue(mockPaginated);

    const result = await controller.getTransactions(mockPrincipal, mockQuery);

    expect(service.getTransactions).toHaveBeenCalledTimes(1);
    expect(service.getTransactions).toHaveBeenCalledWith(
      'agent-uuid-1234',
      mockQuery,
    );
    expect(result).toBe(mockPaginated);
  });
});
