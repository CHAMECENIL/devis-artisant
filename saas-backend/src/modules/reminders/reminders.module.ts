import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'email' })],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
