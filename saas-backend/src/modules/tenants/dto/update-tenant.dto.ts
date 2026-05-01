import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTenantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companySiret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyPhone?: string;

  @ApiPropertyOptional({ enum: ['trial', 'active', 'suspended', 'cancelled'] })
  @IsOptional()
  @IsIn(['trial', 'active', 'suspended', 'cancelled'])
  status?: string;

  @ApiPropertyOptional({ description: 'UUID du plan tarifaire' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ description: 'IBAN (sera chiffré par le service)' })
  @IsOptional()
  @IsString()
  ibanEncrypted?: string;

  @ApiPropertyOptional({ description: 'Prolonger / raccourcir la période d\'essai' })
  @IsOptional()
  @IsNumber()
  trialDays?: number;
}
