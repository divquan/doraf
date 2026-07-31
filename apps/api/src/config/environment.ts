export type NodeEnvironment = 'development' | 'production' | 'test';

export interface AppEnvironment {
  NODE_ENV: NodeEnvironment;
  PORT: number;
  DATABASE_URL: string;
}

const nodeEnvironments = new Set<NodeEnvironment>([
  'development',
  'production',
  'test',
]);

export function validateEnvironment(
  raw: Record<string, unknown>,
): AppEnvironment {
  const nodeEnvironment = raw.NODE_ENV ?? 'development';
  if (
    typeof nodeEnvironment !== 'string' ||
    !nodeEnvironments.has(nodeEnvironment as NodeEnvironment)
  ) {
    throw new Error('NODE_ENV must be development, production, or test');
  }

  const port = Number(raw.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const databaseUrl = raw.DATABASE_URL;
  if (
    typeof databaseUrl !== 'string' ||
    !databaseUrl.startsWith('postgresql://')
  ) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL');
  }

  return {
    NODE_ENV: nodeEnvironment as NodeEnvironment,
    PORT: port,
    DATABASE_URL: databaseUrl,
  };
}
