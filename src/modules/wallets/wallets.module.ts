import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Balance } from './entities/balance.entity';
import { FundLock } from './entities/fund-lock.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { Wallet } from './entities/wallet.entity';
import { LedgerService } from './ledger.service';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, Balance, FundLock, LedgerEntry])],
  controllers: [WalletsController],
  providers: [WalletsService, LedgerService],
  exports: [WalletsService, LedgerService],
})
export class WalletsModule {}
