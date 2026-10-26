import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryAuditDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ example: 'KYC_APPROVED' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ example: 'kyc' })
  @IsOptional()
  @IsString()
  resource?: string;
}
