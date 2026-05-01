import { registerAs } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';

const entityGlob = path.join(__dirname, '..', '**', '*.entity{.ts,.js}');
const migrationGlob = path.join(__dirname, '..', 'database', 'migrations', '*{.ts,.js}');

export const databaseConfig = registerAs('database', (): DataSourceOptions => {
  // SQLite fallback for local dev when PostgreSQL is not running
  if (process.env.SQLITE_DEV === 'true') {
    return {
      type: 'better-sqlite3',
      database: path.join(process.cwd(), 'dev.sqlite'),
      entities: [entityGlob],
      synchronize: true, // auto-create tables in dev
      logging: false,
    } as DataSourceOptions;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return {
    type: 'postgres',
    url,
    entities: [entityGlob],
    migrations: [migrationGlob],
    synchronize: false,
    logging: process.env.NODE_ENV !== 'production',
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
    extra: {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    },
  };
});

/**
 * Standalone DataSource instance used by the TypeORM CLI for migrations.
 * Run migrations with: npx typeorm migration:run -d dist/config/database.config.js
 * Or via npm script: npm run migrate
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || 'postgresql://saas_user:saas_password@localhost:5432/saas_db',
  entities: [path.join(__dirname, '..', '**', '*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, '..', 'database', 'migrations', '*{.ts,.js}')],
  synchronize: false,
  logging: true,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

export default databaseConfig;
