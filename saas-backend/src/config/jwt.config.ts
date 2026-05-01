import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  secret: string;
  refreshSecret: string;
  expiresIn: string;
  refreshExpiresIn: string;
  adminSecret: string;
}

export default registerAs(
  'jwt',
  (): JwtConfig => ({
    secret: process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET is required'); })(),
    refreshSecret: process.env.JWT_REFRESH_SECRET || (() => { throw new Error('JWT_REFRESH_SECRET is required'); })(),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    adminSecret: process.env.ADMIN_JWT_SECRET || (() => { throw new Error('ADMIN_JWT_SECRET is required'); })(),
  }),
);
