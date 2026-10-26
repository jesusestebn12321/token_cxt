import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { FundLockReason } from '../entities/fund-lock.entity';

export class LockFundsDto {
  @ApiProperty({ example: 'RWAHOUSE1' })
  @IsString()
  tokenSymbol!: string;

  @ApiProperty({ example: '100.5', description: 'Decimal positivo como string (máx. 18 decimales)' })
  @IsString()
  @Matches(/^(?!0+(\.0+)?$)\d{1,20}(\.\d{1,18})?$/, { message: 'amount debe ser un decimal positivo' })
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
