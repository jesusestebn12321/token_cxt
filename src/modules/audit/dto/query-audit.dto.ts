import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryAuditDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  actorId?: string;

  @ApiPropertyOptional({ example: 'KYC_REVIEWED' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ example: 'kyc' })
  @IsOptional()
  @IsString()
  resource?: string;
}
