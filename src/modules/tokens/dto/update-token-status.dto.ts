import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { TokenStatus } from '../schemas/token.schema';

export class UpdateTokenStatusDto {
  @ApiProperty({ enum: TokenStatus })
  @IsEnum(TokenStatus)
  status!: TokenStatus;
}
