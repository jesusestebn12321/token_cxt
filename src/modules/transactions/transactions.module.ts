import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsService } from './approvals.service';
import { Approval } from './entities/approval.entity';
import { Transaction } from './entities/transaction.entity';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Approval])],
  controllers: [TransactionsController],
  providers: [TransactionsService, ApprovalsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
