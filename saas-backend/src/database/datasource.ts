import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env for CLI usage (migrations run outside NestJS context)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * TypeORM DataSource for CLI migrations.
 *
 * Usage:
 *   npm run migrate          → typeorm migration:run   -d dist/database/datasource.js
 *   npm run migrate:revert   → typeorm migration:revert -d dist/database/datasource.js
 *
 * Source entities and migrations point to TypeScript paths so ts-node works too.
 */
const AppDataSource = new DataSource({
  type: 'postgres',
  url:
    process.env.DATABASE_URL ||
    'postgresql://saas_user:saas_password@localhost:5432/saas_db',
  entities: [path.join(__dirname, '..', '**', '*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, 'migrations', '*{.ts,.js}')],
  synchronize: false,
  logging: true,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

export default AppDataSource;
