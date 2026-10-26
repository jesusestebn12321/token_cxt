import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { AssetClass } from '../schemas/token.schema';

export class CreateTokenDto {
  @ApiProperty({ example: 'RWAHOUSE1' })
  @IsString()
  @Matches(/^[A-Z0-9]{2,20}$/, { message: 'symbol: 2-20 caracteres A-Z/0-9' })
  symbol!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ enum: AssetClass })
  @IsEnum(AssetClass)
  assetClass!: AssetClass;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 18 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(18)
  decimals?: number;

  @ApiProperty({ example: '1000000', description: 'Suministro máximo (entero, como string)' })
  @IsString()
  @Matches(/^[1-9]\d{0,37}$/, { message: 'maxSupply debe ser un entero positivo' })
  maxSupply!: string;
}
