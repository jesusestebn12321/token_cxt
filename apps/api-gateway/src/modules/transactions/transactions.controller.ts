import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ParseObjectIdPipe } from '@app/common/pipes/parse-object-id.pipe';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@app/common/decorators/audit-action.decorator';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';
import { Permissions } from '@app/common/decorators/permissions.decorator';
import { Permission } from '@app/common/enums/permission.enum';
import { TwoFactorGuard } from '@app/common/guards/two-factor.guard';
import { ApprovalsService } from './approvals.service';
import { DecideTransactionDto } from './dto/decide-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@ApiBearerAuth('access-token')
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly approvalsService: ApprovalsService,
  ) {}

  @Get()
  @Permissions(Permission.TRANSACTIONS_READ)
  findAll(@Query() query: QueryTransactionsDto) {
    return this.transactionsService.findAll(query);
  }

  @Get(':id')
  @Permissions(Permission.TRANSACTIONS_READ)
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.transactionsService.findOne(id);
  }

  @Post(':id/decision')
  @Permissions(Permission.TRANSACTIONS_APPROVE)
  @UseGuards(TwoFactorGuard)
  @AuditAction('TRANSACTION_DECISION', 'transaction')
  decide(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: DecideTransactionDto,
    @CurrentUser('id') approverId: string,
  ) {
    return this.approvalsService.decide(id, dto, approverId);
  }
}
