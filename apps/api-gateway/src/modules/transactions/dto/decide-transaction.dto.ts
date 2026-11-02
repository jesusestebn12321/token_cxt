import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApprovalDecision } from '../enums/transaction-status.enum';

export class DecideTransactionDto {
  @ApiProperty({ enum: ApprovalDecision })
  @IsEnum(ApprovalDecision)
  decision!: ApprovalDecision;

  @ApiPropertyOptional({ description: 'Obligatorio al rechazar' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
