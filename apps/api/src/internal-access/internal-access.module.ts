import { Module } from '@nestjs/common';
import { INTERNAL_SESSION_REPOSITORY } from './internal-access.types';
import { InternalRolesGuard } from './internal-roles.guard';
import { InternalSessionGuard } from './internal-session.guard';
import { PrismaInternalSessionRepository } from './prisma-internal-session.repository';
import { SessionTokenService } from './session-token.service';

@Module({
  providers: [
    SessionTokenService,
    PrismaInternalSessionRepository,
    {
      provide: INTERNAL_SESSION_REPOSITORY,
      useExisting: PrismaInternalSessionRepository,
    },
    InternalSessionGuard,
    InternalRolesGuard,
  ],
  exports: [
    SessionTokenService,
    INTERNAL_SESSION_REPOSITORY,
    InternalSessionGuard,
    InternalRolesGuard,
  ],
})
export class InternalAccessModule {}
