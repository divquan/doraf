// @ts-nocheck
import { TaskConsumerModule } from './task-consumer.module';
import { WorkerAppModule } from '../worker-app.module';

describe('TaskConsumerModule', () => {
  it('does not provide Redis or polling workers', async () => {
    const taskProviders = Reflect.getMetadata('providers', TaskConsumerModule) || [];
    const taskProviderNames = taskProviders.map((p: any) => (typeof p === 'function' ? p.name : p.provide));
    expect(taskProviderNames).not.toContain('RedisOutboxQueue');
    expect(taskProviderNames).not.toContain('RedisOutboxDispatcher');
    expect(taskProviderNames).not.toContain('RedisOutboxConsumer');
    expect(taskProviderNames).not.toContain('GeneralOutboxWorker');

    // Ensure WorkerAppModule does contain them (sanity)
    const workerProviders = Reflect.getMetadata('providers', WorkerAppModule) || [];
    const workerNames = workerProviders.map((p: any) => (typeof p === 'function' ? p.name : p.provide));
    expect(workerNames).toContain('RedisOutboxQueue');
  });

  it('task consumer imports health module', async () => {
    const imports = Reflect.getMetadata('imports', TaskConsumerModule) || [];
    const importNames = imports.map((m: any) => m.name || m);
    // HealthModule should be present
    expect(importNames).toContain('HealthModule');
  });
});
