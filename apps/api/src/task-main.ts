import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { TaskConsumerModule } from './task-consumer/task-consumer.module';
import type { AppEnvironment } from './config/environment';
import { configureApplication } from './configure-application';

async function bootstrap() {
  const app = await NestFactory.create(TaskConsumerModule, { rawBody: true });
  const config = app.get(ConfigService<AppEnvironment, true>);

  configureApplication(app);

  await app.listen(config.get('PORT', { infer: true }), '0.0.0.0');
}

void bootstrap();
