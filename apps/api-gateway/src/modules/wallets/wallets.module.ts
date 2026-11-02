import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LedgerService } from './ledger.service';
import { Balance, BalanceSchema } from './schemas/balance.schema';
import { FundLock, FundLockSchema } from './schemas/fund-lock.schema';
import { LedgerEntry, LedgerEntrySchema } from './schemas/ledger-entry.schema';
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Wallet.name, schema: WalletSchema },
      { name: Balance.name, schema: BalanceSchema },
      { name: FundLock.name, schema: FundLockSchema },
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
    ]),
  ],
  controllers: [WalletsController],
  providers: [WalletsService, LedgerService],
  exports: [WalletsService, LedgerService],
})
export class WalletsModule {}
