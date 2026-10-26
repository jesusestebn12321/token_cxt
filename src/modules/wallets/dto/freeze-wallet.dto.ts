import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

export class FreezeWalletDto {
  @ApiProperty()
  @IsBoolean()
  frozen!: boolean;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}
