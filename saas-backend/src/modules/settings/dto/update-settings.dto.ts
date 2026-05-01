import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() companyName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() companyAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() companyPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() companySiret?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) @Min(0) @Max(100) tvaRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) @Min(0) hourlyRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) @Min(0) kmRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) @Min(0) @Max(100) marginMaterial?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() smtpHost?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) smtpPort?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() smtpUser?: string;
  @ApiPropertyOptional({ description: 'Sera chiffré AES-256-GCM' }) @IsOptional() @IsString() smtpPass?: string;
  @ApiPropertyOptional({ description: 'Clé Anthropic — sera chiffrée' }) @IsOptional() @IsString() anthropicKey?: string;
  @ApiPropertyOptional({ description: 'Clé Google Maps — sera chiffrée' }) @IsOptional() @IsString() googleMapsKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() depotAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() companyLogoUrl?: string;
}
