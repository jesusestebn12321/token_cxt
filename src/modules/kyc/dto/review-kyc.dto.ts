import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { KycLevel } from '../enums/kyc-status.enum';

export enum KycDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  REQUEST_MORE_INFO = 'REQUEST_MORE_INFO',
}

export class ReviewKycDto {
  @ApiProperty({ enum: KycDecision })
  @IsEnum(KycDecision)
  decision!: KycDecision;

  @ApiPropertyOptional({ enum: KycLevel, description: 'Nivel otorgado (solo si APPROVE)' })
  @IsOptional()
  @IsEnum(KycLevel)
  grantedLevel?: KycLevel;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  riskScore?: number;

  @ApiPropertyOptional({ description: 'Obligatorio al rechazar o solicitar más información' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
