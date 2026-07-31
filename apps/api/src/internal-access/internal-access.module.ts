import { Module } from '@nestjs/common';
import { INTERNAL_SESSION_REPOSITORY } from './internal-access.types';
import { InternalRolesGuard } from './internal-roles.guard';
import { InternalSessionGuard } from './internal-session.guard';
import { PrismaInternalSessionRepository } from './prisma-internal-session.repository';
import { SessionTokenService } from './session-token.service';
import { EnrollmentTokenService } from './enrollment-token.service';
import { PasskeyAuthController } from './passkey-auth.controller';
import { PasskeyAuthService } from './passkey-auth.service';
import { InternalUsersController } from './internal-users.controller';
import {
  PASSKEY_SERVER,
  SimpleWebAuthnPasskeyServer,
} from './passkey-server.adapter';
import { INTERNAL_AUTH_REPOSITORY } from './passkey-auth.types';
import { PrismaInternalAuthRepository } from './prisma-internal-auth.repository';
import { ThrottlerModule } from '@nestjs/throttler';
import { NoStoreInterceptor } from './no-store.interceptor';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'internal-auth', ttl: 60_000, limit: 20 },
    ]),
  ],
  controllers: [PasskeyAuthController, InternalUsersController],
  providers: [
    SessionTokenService,
    EnrollmentTokenService,
    PrismaInternalSessionRepository,
    PrismaInternalAuthRepository,
    {
      provide: INTERNAL_SESSION_REPOSITORY,
      useExisting: PrismaInternalSessionRepository,
    },
    {
      provide: INTERNAL_AUTH_REPOSITORY,
      useExisting: PrismaInternalAuthRepository,
    },
    {
      provide: PASSKEY_SERVER,
      useClass: SimpleWebAuthnPasskeyServer,
    },
    PasskeyAuthService,
    NoStoreInterceptor,
    InternalSessionGuard,
    InternalRolesGuard,
  ],
  exports: [
    SessionTokenService,
    EnrollmentTokenService,
    INTERNAL_SESSION_REPOSITORY,
    InternalSessionGuard,
    InternalRolesGuard,
  ],
})
export class InternalAccessModule {}
