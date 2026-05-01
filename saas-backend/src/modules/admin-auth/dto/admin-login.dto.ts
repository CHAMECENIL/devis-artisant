import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@plateforme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  password: string;
}

export class AdminVerify2faDto {
  @ApiProperty({ description: 'Token temporaire JWT (scope: 2fa-pending) reçu après le login' })
  @IsString()
  @MinLength(1)
  tempToken: string;

  @ApiProperty({ description: 'Code OTP à 6 chiffres reçu par SMS', minLength: 6, maxLength: 6 })
  @IsString()
  @Length(6, 6)
  code: string;
}
