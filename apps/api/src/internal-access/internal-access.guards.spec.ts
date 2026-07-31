import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { InternalRole } from '../generated/prisma/client';
import {
  INTERNAL_ROLES_KEY,
  INTERNAL_SESSION_REPOSITORY,
  type InternalPrincipal,
  type InternalSessionRepository,
} from './internal-access.types';
import { InternalRolesGuard } from './internal-roles.guard';
import {
  InternalSessionGuard,
  type InternalAuthenticatedRequest,
} from './internal-session.guard';
import { SessionTokenService } from './session-token.service';

describe('internal access guards', () => {
  const principal: InternalPrincipal = {
    userId: '09020e21-530f-49ad-b20f-335b220b05ef',
    sessionId: '9d5b090f-658a-4487-aac6-d626399641ec',
    displayName: 'Test Administrator',
    role: InternalRole.ADMINISTRATOR,
    authenticationStrength: 'PHISHING_RESISTANT',
    authenticatedAt: new Date('2026-07-31T00:00:00Z'),
    stepUpAt: null,
  };
  let sessionGuard: InternalSessionGuard;
  let rolesGuard: InternalRolesGuard;
  let tokens: SessionTokenService;
  let findActive: jest.MockedFunction<
    InternalSessionRepository['findActiveByFingerprint']
  >;

  beforeEach(async () => {
    findActive = jest.fn().mockResolvedValue(principal);
    const module = await Test.createTestingModule({
      providers: [
        SessionTokenService,
        InternalSessionGuard,
        InternalRolesGuard,
        Reflector,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockReturnValue(Buffer.alloc(32, 5).toString('base64')),
          },
        },
        {
          provide: INTERNAL_SESSION_REPOSITORY,
          useValue: { findActiveByFingerprint: findActive },
        },
      ],
    }).compile();

    sessionGuard = module.get(InternalSessionGuard);
    rolesGuard = module.get(InternalRolesGuard);
    tokens = module.get(SessionTokenService);
  });

  it('accepts a valid opaque session and attaches its current principal', async () => {
    const { token } = tokens.create();
    const request = requestWithAuthorization(`Bearer ${token}`);

    await expect(sessionGuard.canActivate(contextFor(request))).resolves.toBe(
      true,
    );
    expect(request.internalPrincipal).toEqual(principal);
    expect(findActive).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed bearer credentials without querying the database', async () => {
    const request = requestWithAuthorization('Bearer short-token');

    await expect(sessionGuard.canActivate(contextFor(request))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(findActive).not.toHaveBeenCalled();
  });

  it('denies Support access to Administrator-only handlers', () => {
    const request = requestWithAuthorization();
    request.internalPrincipal = {
      ...principal,
      role: InternalRole.SUPPORT,
    };
    const handler = (): void => undefined;
    Reflect.defineMetadata(
      INTERNAL_ROLES_KEY,
      [InternalRole.ADMINISTRATOR],
      handler,
    );

    expect(() => rolesGuard.canActivate(contextFor(request, handler))).toThrow(
      ForbiddenException,
    );
  });
});

function requestWithAuthorization(
  authorization?: string,
): InternalAuthenticatedRequest {
  return {
    headers: authorization ? { authorization } : {},
  } as InternalAuthenticatedRequest;
}

function contextFor(
  request: InternalAuthenticatedRequest,
  handler: () => void = () => undefined,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: jest.fn(),
      getNext: jest.fn(),
    }),
    getHandler: () => handler,
    getClass: () => class TestController {},
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  } as ExecutionContext;
}
