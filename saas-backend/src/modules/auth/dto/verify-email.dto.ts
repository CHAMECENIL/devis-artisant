import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ minLength: 10, description: 'Token de vérification reçu par email' })
  @IsString()
  @MinLength(10)
  token: string;
}
