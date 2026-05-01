import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString } from 'class-validator';

export class InviteUserDto {
  @ApiProperty({ example: 'collaborateur@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: ['admin', 'user'], example: 'user' })
  @IsString()
  @IsIn(['admin', 'user'])
  role: string;
}
