import { IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '../entities/document.entity';

export class CreateDocumentDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ enum: DocumentType }) @IsEnum(DocumentType) type: DocumentType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() devisId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string;
}

export class RequestUploadUrlDto {
  @ApiProperty() @IsString() filename: string;
  @ApiProperty() @IsString() mimeType: string;
  @ApiProperty() @IsEnum(DocumentType) type: DocumentType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() devisId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string;
}
