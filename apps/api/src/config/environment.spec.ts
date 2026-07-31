import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('applies safe local defaults', () => {
    expect(
      validateEnvironment({
        DATABASE_URL: 'postgresql://localhost:5432/doraf',
      }),
    ).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: 'postgresql://localhost:5432/doraf',
    });
  });

  it('rejects a missing database URL', () => {
    expect(() => validateEnvironment({})).toThrow(
      'DATABASE_URL must be a PostgreSQL connection URL',
    );
  });
});
