import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AgentStatus, Prisma } from '../generated/prisma/client';
import type { InternalPrincipal } from '../internal-access/internal-access.types';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AgentAdministrationService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        name: true,
        phoneMask: true,
        status: true,
        createdAt: true,
      },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    return agent;
  }

  async changeStatus(input: {
    agentId: string;
    status: AgentStatus;
    reason: string;
    requestId: string;
    actor: InternalPrincipal;
  }) {
    return this.prisma.$transaction(
      async (transaction) => {
        const agent = await transaction.agent.findUnique({
          where: { id: input.agentId },
          select: { id: true, name: true, phoneMask: true, status: true },
        });
        if (!agent) {
          throw new NotFoundException('Agent not found');
        }
        if (agent.status === input.status) {
          throw new ConflictException(
            input.status === AgentStatus.SUSPENDED
              ? 'Agent is already suspended'
              : 'Agent is already active',
          );
        }

        const updated = await transaction.agent.update({
          where: { id: agent.id },
          data: { status: input.status, version: { increment: 1 } },
          select: { id: true, name: true, phoneMask: true, status: true },
        });
        await transaction.auditEvent.create({
          data: {
            actorInternalUserId: input.actor.userId,
            actorRole: input.actor.role,
            action:
              input.status === AgentStatus.SUSPENDED
                ? 'AGENT_SUSPENDED'
                : 'AGENT_RESTORED',
            entityType: 'AGENT',
            entityId: agent.id,
            reason: input.reason.trim(),
            authenticationStrength: input.actor.authenticationStrength,
            requestId: input.requestId,
            safeMetadata: {
              previousStatus: agent.status,
              resultingStatus: updated.status,
            },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
