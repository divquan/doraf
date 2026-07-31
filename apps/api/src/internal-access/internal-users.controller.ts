import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InternalRole } from '../generated/prisma/client';
import { CurrentInternalPrincipal } from './current-internal-principal.decorator';
import { CreateInternalUserRequest } from './dto/create-internal-user.request';
import { CreateEnrollmentTokenRequest } from './dto/create-enrollment-token.request';
import { InternalRoles } from './internal-roles.decorator';
import { InternalRolesGuard } from './internal-roles.guard';
import { InternalSessionGuard } from './internal-session.guard';
import type { InternalPrincipal } from './internal-access.types';
import { PasskeyAuthService } from './passkey-auth.service';
import { NoStoreInterceptor } from './no-store.interceptor';

@Controller('admin/internal-users')
@UseGuards(InternalSessionGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMINISTRATOR)
@UseInterceptors(NoStoreInterceptor)
export class InternalUsersController {
  constructor(private readonly authentication: PasskeyAuthService) {}

  @Post()
  create(
    @Body() request: CreateInternalUserRequest,
    @CurrentInternalPrincipal() principal: InternalPrincipal,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.authentication.inviteInternalUser({
      displayName: request.displayName,
      role: request.role,
      reason: request.reason,
      requestId: safeRequestId(requestId),
      actor: principal,
    });
  }

  @Post(':userId/enrollment-tokens')
  createEnrollmentToken(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() request: CreateEnrollmentTokenRequest,
    @CurrentInternalPrincipal() principal: InternalPrincipal,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.authentication.createEnrollmentToken({
      internalUserId: userId,
      reason: request.reason,
      requestId: safeRequestId(requestId),
      actor: principal,
    });
  }
}

function safeRequestId(value: string | undefined): string {
  return value && /^[A-Za-z0-9_-]{1,100}$/.test(value) ? value : randomUUID();
}
