import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { TwoFactorGuard } from '../../common/guards/two-factor.guard';
import { QueryKycDto } from './dto/query-kyc.dto';
import { ReviewKycDto } from './dto/review-kyc.dto';
import { KycService } from './kyc.service';

@ApiTags('KYC')
@ApiBearerAuth('access-token')
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Get('submissions')
  @Permissions(Permission.KYC_READ)
  findAll(@Query() query: QueryKycDto) {
    return this.kycService.findAll(query);
  }

  @Get('submissions/:id')
  @Permissions(Permission.KYC_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.kycService.findOne(id);
  }

  @Post('submissions/:id/claim')
  @Permissions(Permission.KYC_REVIEW)
  @AuditAction('KYC_CLAIMED', 'kyc')
  claim(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') reviewerId: string) {
    return this.kycService.claim(id, reviewerId);
  }

  @Post('submissions/:id/review')
  @Permissions(Permission.KYC_REVIEW)
  @UseGuards(TwoFactorGuard)
  @AuditAction('KYC_REVIEWED', 'kyc')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewKycDto,
    @CurrentUser('id') reviewerId: string,
  ) {
    return this.kycService.review(id, dto, reviewerId);
  }
}
