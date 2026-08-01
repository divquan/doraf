import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { NoStoreInterceptor } from '../internal-access/no-store.interceptor';
import { BuyerRecoveryService } from './buyer-recovery.service';
import { RequestBuyerRecoveryRequest } from './dto/request-buyer-recovery.request';
import { VerifyBuyerRecoveryRequest } from './dto/verify-buyer-recovery.request';

@Controller('buyer-recovery')
@UseInterceptors(NoStoreInterceptor)
@UseGuards(ThrottlerGuard)
export class BuyerRecoveryController {
  constructor(private readonly recovery: BuyerRecoveryService) {}

  @Post('request')
  @Throttle({ recovery: { limit: 5, ttl: 60_000 } })
  request(@Body() input: RequestBuyerRecoveryRequest) {
    return this.recovery.request(input.orderReference);
  }

  @Post('verify')
  @Throttle({ recovery: { limit: 10, ttl: 60_000 } })
  verify(@Body() input: VerifyBuyerRecoveryRequest) {
    return this.recovery.verify(input.challengeId, input.code);
  }

  @Get('vouchers')
  @Throttle({ recovery: { limit: 20, ttl: 60_000 } })
  reveal(@Headers('authorization') authorization?: string) {
    const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
    if (!match) throw new UnauthorizedException('Recovery access is required');
    return this.recovery.reveal(match[1]);
  }
}
