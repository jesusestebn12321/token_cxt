import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { KycStatus } from '../enums/kyc-status.enum';

export class QueryKycDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: KycStatus })
  @IsOptional()
  @IsEnum(KycStatus)
  status?: KycStatus;
}
