import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { FundLockReason } from '../schemas/fund-lock.schema';

export class LockFundsDto {
  @ApiProperty({ example: 'RWAHOUSE1' })
  @IsString()
  tokenSymbol!: string;

  @ApiProperty({
    example: '100.5',
    description: 'Decimal positivo como string (máx. 16 enteros + 18 decimales: límite de Decimal128)',
  })
  @IsString()
  @Matches(/^(?!0+(\.0+)?$)\d{1,16}(\.\d{1,18})?$/, { message: 'amount debe ser un decimal positivo' })
  amount!: string;

  @ApiProperty({ enum: FundLockReason })
  @IsEnum(FundLockReason)
  reason!: FundLockReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
