import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async assertDatabaseReady(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
