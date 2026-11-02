import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { ContractStandard } from '../schemas/smart-contract.schema';

export class RegisterContractDto {
  @ApiProperty({ example: 11155111 })
  @IsInt()
  @Min(1)
  chainId!: number;

  @ApiProperty({ example: '0x0000000000000000000000000000000000000000' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'address EVM inválida' })
  address!: string;

  @ApiProperty({ enum: ContractStandard })
  @IsEnum(ContractStandard)
  standard!: ContractStandard;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  deployTxHash?: string;
}
