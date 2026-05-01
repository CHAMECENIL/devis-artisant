import { Controller, Post, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Reminders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post('devis/:id/send')
  sendManualReminder(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() tenant: any) {
    return this.remindersService.sendManualReminder(id, tenant.id);
  }
}
