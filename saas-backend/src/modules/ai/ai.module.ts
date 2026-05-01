import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { EncryptionService } from '../../common/utils/encryption.util';

@Module({
  controllers: [AiController],
  providers: [AiService, EncryptionService],
  exports: [AiService],
})
export class AiModule {}
