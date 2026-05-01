import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GedController } from './ged.controller';
import { GedService } from './ged.service';
import { Document } from './entities/document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  controllers: [GedController],
  providers: [GedService],
  exports: [GedService],
})
export class GedModule {}
