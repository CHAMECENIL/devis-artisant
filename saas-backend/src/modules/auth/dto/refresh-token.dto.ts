import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token obtenu lors du login' })
  @IsString()
  @MinLength(10)
  refreshToken: string;
}
