import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ description: 'Raison sociale de l\'entreprise' })
  @IsString()
  @MinLength(2)
  companyName: string;

  @ApiProperty({ description: 'Email du premier utilisateur (propriétaire)' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Mot de passe initial (min 8 caractères)' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ description: 'Prénom du propriétaire' })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({ description: 'Nom du propriétaire' })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiPropertyOptional({ description: 'Plan tarifaire : bronze | silver | gold' })
  @IsOptional()
  @IsString()
  planName?: string;

  @ApiPropertyOptional({ description: 'Nombre de jours d\'essai gratuit (défaut: 14)' })
  @IsOptional()
  @IsNumber()
  trialDays?: number;

  @ApiPropertyOptional({ description: 'Numéro SIRET (14 chiffres)' })
  @IsOptional()
  @IsString()
  companySiret?: string;

  @ApiPropertyOptional({ description: 'Téléphone de l\'entreprise' })
  @IsOptional()
  @IsString()
  companyPhone?: string;
}
