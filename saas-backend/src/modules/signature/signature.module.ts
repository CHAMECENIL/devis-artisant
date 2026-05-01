import { Module } from '@nestjs/common';
import { SignatureController } from './signature.controller';
import { SignatureService } from './signature.service';
import { EncryptionService } from '../../common/utils/encryption.util';

@Module({
  controllers: [SignatureController],
  providers: [SignatureService, EncryptionService],
})
export class SignatureModule {}
