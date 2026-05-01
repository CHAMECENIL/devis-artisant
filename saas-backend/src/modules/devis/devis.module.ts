import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { DevisController } from './devis.controller';
import { DevisService } from './devis.service';
import { Devis } from './entities/devis.entity';
import { DevisLigne } from './entities/devis-ligne.entity';
import { EncryptionService } from '../../common/utils/encryption.util';

@Module({
  imports: [
    TypeOrmModule.forFeature([Devis, DevisLigne]),
    BullModule.registerQueue({ name: 'email' }),
  ],
  controllers: [DevisController],
  providers: [DevisService, EncryptionService],
  exports: [DevisService],
})
export class DevisModule {}
