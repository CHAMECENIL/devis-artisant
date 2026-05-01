import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PlatformAdmin } from '../users/entities/platform-admin.entity';
import { CommonModule } from '../../common/common.module';

import { AdminAuthService } from './admin-auth.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';

/**
 * Fournisseur du client IORedis.
 *
 * L'application doit exposer un provider avec le token 'IOREDIS_CLIENT'
 * dans un module global (ex: RedisModule), ou on le crée ici directement
 * via une factory. Si le projet dispose déjà d'un RedisModule global,
 * retirez ce provider et importez simplement RedisModule.
 */
const IORedisProvider = {
  provide: 'IOREDIS_CLIENT',
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const Redis = require('ioredis');
    const redisUrl = configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    return new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });
  },
};

@Module({
  imports: [
    TypeOrmModule.forFeature([PlatformAdmin]),

    PassportModule.register({ defaultStrategy: 'admin-jwt' }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.adminSecret'),
        signOptions: { expiresIn: '8h' },
      }),
    }),

    CommonModule,
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminJwtStrategy, IORedisProvider],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}
