import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Permission } from '../../common/enums/permission.enum';
import { TwoFactorGuard } from '../../common/guards/two-factor.guard';
import { FreezeWalletDto } from './dto/freeze-wallet.dto';
import { LockFundsDto } from './dto/lock-funds.dto';
import { LedgerService } from './ledger.service';
import { WalletsService } from './wallets.service';

@ApiTags('Wallets')
@ApiBearerAuth('access-token')
@Controller('wallets')
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly ledgerService: LedgerService,
  ) {}

  @Get()
  @Permissions(Permission.WALLETS_READ)
  findAll(@Query() query: PaginationQueryDto) {
    return this.walletsService.findAll(query);
  }

  @Get(':id')
  @Permissions(Permission.WALLETS_READ)
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.walletsService.findOne(id);
  }

  @Get(':id/balances')
  @Permissions(Permission.WALLETS_READ)
  balances(@Param('id', ParseObjectIdPipe) id: string) {
    return this.walletsService.getBalances(id);
  }

  @Get(':id/locks')
  @Permissions(Permission.WALLETS_READ)
  locks(@Param('id', ParseObjectIdPipe) id: string) {
    return this.walletsService.getLocks(id);
  }

  @Get(':id/ledger')
  @Permissions(Permission.LEDGER_READ)
  ledger(@Param('id', ParseObjectIdPipe) id: string, @Query() query: PaginationQueryDto) {
    return this.ledgerService.findByWallet(id, query);
  }

  @Patch(':id/freeze')
  @Permissions(Permission.WALLETS_LOCK_FUNDS)
  @UseGuards(TwoFactorGuard)
  @AuditAction('WALLET_FREEZE_CHANGED', 'wallet')
  freeze(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: FreezeWalletDto) {
    return this.walletsService.setFrozen(id, dto);
  }

  @Post(':id/locks')
  @Permissions(Permission.WALLETS_LOCK_FUNDS)
  @UseGuards(TwoFactorGuard)
  @AuditAction('FUNDS_LOCKED', 'wallet')
  lockFunds(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: LockFundsDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.walletsService.lockFunds(id, dto, adminId);
  }

  @Post('locks/:lockId/release')
  @Permissions(Permission.WALLETS_LOCK_FUNDS)
  @UseGuards(TwoFactorGuard)
  @AuditAction('FUNDS_RELEASED', 'wallet')
  releaseLock(@Param('lockId', ParseObjectIdPipe) lockId: string, @CurrentUser('id') adminId: string) {
    return this.walletsService.releaseLock(lockId, adminId);
  }
}
