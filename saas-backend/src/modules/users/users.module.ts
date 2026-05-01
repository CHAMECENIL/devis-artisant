import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PlatformAdmin } from './entities/platform-admin.entity';
import { CommonModule } from '../../common/common.module';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, PlatformAdmin]),

    BullModule.registerQueue({ name: 'email' }),

    CommonModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
