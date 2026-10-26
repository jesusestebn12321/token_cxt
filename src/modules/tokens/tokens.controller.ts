import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Permission } from '../../common/enums/permission.enum';
import { TwoFactorGuard } from '../../common/guards/two-factor.guard';
import { CreateTokenDto } from './dto/create-token.dto';
import { RegisterContractDto } from './dto/register-contract.dto';
import { UpdateTokenStatusDto } from './dto/update-token-status.dto';
import { TokensService } from './tokens.service';

@ApiTags('Tokens')
@ApiBearerAuth('access-token')
@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get()
  @Permissions(Permission.TOKENS_READ)
  findAll(@Query() query: PaginationQueryDto) {
    return this.tokensService.findAll(query);
  }

  @Get(':id')
  @Permissions(Permission.TOKENS_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tokensService.findOne(id);
  }

  @Post()
  @Permissions(Permission.TOKENS_WRITE)
  @AuditAction('TOKEN_CREATED', 'token')
  create(@Body() dto: CreateTokenDto) {
    return this.tokensService.create(dto);
  }

  @Patch(':id/status')
  @Permissions(Permission.TOKENS_WRITE)
  @UseGuards(TwoFactorGuard)
  @AuditAction('TOKEN_STATUS_CHANGED', 'token')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTokenStatusDto) {
    return this.tokensService.updateStatus(id, dto);
  }

  @Post(':id/contracts')
  @Permissions(Permission.TOKENS_CONTRACT_OPERATE)
  @UseGuards(TwoFactorGuard)
  @AuditAction('CONTRACT_REGISTERED', 'token')
  registerContract(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RegisterContractDto) {
    return this.tokensService.registerContract(id, dto);
  }

  @Post('contracts/:contractId/sync')
  @Permissions(Permission.TOKENS_READ)
  syncContract(@Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.tokensService.syncContract(contractId);
  }
}
