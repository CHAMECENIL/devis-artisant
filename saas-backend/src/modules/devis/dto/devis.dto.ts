import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsArray, ValidateNested, IsUUID, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { DevisStatut } from '../entities/devis.entity';
import { LigneType } from '../entities/devis-ligne.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDevisLigneDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() ordre?: number;
  @ApiProperty({ enum: LigneType }) @IsEnum(LigneType) type: LigneType;
  @ApiProperty() @IsString() designation: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unite?: string;
  @ApiProperty() @IsNumber() @Min(0) quantite: number;
  @ApiProperty() @IsNumber() @Min(0) prixUnitaireHt: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) remise?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() tvaRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() fournisseur?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() referenceFournisseur?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() prixAchatHt?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isOption?: boolean;
}

export class CreateDevisDto {
  @ApiProperty() @IsString() clientName: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientAddress?: string;
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectType?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) tvaRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) remiseGlobale?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() dureeJours?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateDebut?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateValidite?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notesInternes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() conditionsPaiement?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) acomptePercent?: number;
  @ApiPropertyOptional({ type: [CreateDevisLigneDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDevisLigneDto)
  lignes?: CreateDevisLigneDto[];
}

export class UpdateDevisDto {
  @ApiPropertyOptional() @IsOptional() @IsString() clientName?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(DevisStatut) statut?: DevisStatut;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) tvaRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) remiseGlobale?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() dureeJours?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateDebut?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateValidite?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notesInternes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() conditionsPaiement?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) acomptePercent?: number;
  @ApiPropertyOptional({ type: [CreateDevisLigneDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDevisLigneDto)
  lignes?: CreateDevisLigneDto[];
}

export class GenerateDevisDto {
  @ApiProperty() @IsString() description: string;
  @ApiProperty() @IsString() clientName: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() demoMode?: boolean;
}

export class DevisFilterDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(DevisStatut) statut?: DevisStatut;
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsNumber() @Type(() => Number) page?: number = 1;
  @IsOptional() @IsNumber() @Type(() => Number) limit?: number = 20;
}

export class SendDevisDto {
  @ApiProperty() @IsString() email: string;
  @ApiPropertyOptional() @IsOptional() @IsString() message?: string;
}
