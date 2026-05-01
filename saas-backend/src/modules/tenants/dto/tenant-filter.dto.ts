import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class TenantFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Recherche ILIKE sur companyName, email, slug' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['trial', 'active', 'suspended', 'cancelled'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'UUID du plan tarifaire' })
  @IsOptional()
  @IsString()
  planId?: string;
}
