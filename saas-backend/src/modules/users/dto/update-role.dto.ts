import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({ enum: ['admin', 'user'], example: 'admin' })
  @IsString()
  @IsIn(['admin', 'user'])
  role: string;
}
