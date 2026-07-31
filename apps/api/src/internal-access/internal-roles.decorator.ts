import { SetMetadata } from '@nestjs/common';
import type { InternalRole } from '../generated/prisma/client';
import { INTERNAL_ROLES_KEY } from './internal-access.types';

export const InternalRoles = (
  ...roles: InternalRole[]
): MethodDecorator & ClassDecorator => SetMetadata(INTERNAL_ROLES_KEY, roles);
