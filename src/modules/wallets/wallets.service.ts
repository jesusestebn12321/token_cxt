import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Paginated, PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto';
import { FreezeWalletDto } from './dto/freeze-wallet.dto';
import { LockFundsDto } from './dto/lock-funds.dto';
import { Balance } from './entities/balance.entity';
import { FundLock } from './entities/fund-lock.entity';
import { LedgerDirection } from './entities/ledger-entry.entity';
import { Wallet } from './entities/wallet.entity';
import { LedgerService } from './ledger.service';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet) private readonly walletsRepo: Repository<Wallet>,
    @InjectRepository(Balance) private readonly balancesRepo: Repository<Balance>,
    @InjectRepository(FundLock) private readonly locksRepo: Repository<FundLock>,
    private readonly ledger: LedgerService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: PaginationQueryDto): Promise<Paginated<Wallet>> {
    const [items, total] = await this.walletsRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    return paginate(items, total, query);
  }

  async findOne(id: string): Promise<Wallet> {
    const wallet = await this.walletsRepo.findOne({ where: { id }, relations: { balances: true } });
    if (!wallet) throw new NotFoundException('Wallet no encontrada');
    return wallet;
  }

  getBalances(walletId: string): Promise<Balance[]> {
    return this.balancesRepo.find({ where: { walletId }, order: { tokenSymbol: 'ASC' } });
  }

  getLocks(walletId: string): Promise<FundLock[]> {
    return this.locksRepo.find({ where: { walletId }, order: { createdAt: 'DESC' } });
  }

  async setFrozen(id: string, dto: FreezeWalletDto): Promise<Wallet> {
    const wallet = await this.findOne(id);
    wallet.isFrozen = dto.frozen;
    wallet.frozenReason = dto.frozen ? dto.reason : null;
    return this.walletsRepo.save(wallet);
  }

  /** Mueve `available` → `locked` de forma atómica y deja asiento en el ledger. */
  async lockFunds(walletId: string, dto: LockFundsDto, adminId: string): Promise<FundLock> {
    await this.findOne(walletId);

    return this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(Balance)
        .set({
          available: () => '"available" - :amount',
          locked: () => '"locked" + :amount',
        })
        .where('"walletId" = :walletId AND "tokenSymbol" = :symbol AND "available" >= :amount')
        .setParameters({ walletId, symbol: dto.tokenSymbol, amount: dto.amount })
        .returning(['available'])
        .execute();

      if (!result.affected) {
        throw new ConflictException('Saldo disponible insuficiente para bloquear');
      }
      const balanceAfter = (result.raw as { available: string }[])[0]?.available ?? '0';

      const lock = await manager.getRepository(FundLock).save(
        manager.getRepository(FundLock).create({
          walletId,
          tokenSymbol: dto.tokenSymbol,
          amount: dto.amount,
          reason: dto.reason,
          notes: dto.notes ?? null,
          lockedBy: adminId,
          releasedAt: null,
          releasedBy: null,
        }),
      );

      await this.ledger.record(manager, {
        walletId,
        tokenSymbol: dto.tokenSymbol,
        direction: LedgerDirection.DEBIT,
        amount: dto.amount,
        balanceAfter,
        referenceType: 'FUND_LOCK',
        referenceId: lock.id,
      });
      return lock;
    });
  }

  async releaseLock(lockId: string, adminId: string): Promise<FundLock> {
    return this.dataSource.transaction(async (manager) => {
      const lock = await manager.getRepository(FundLock).findOne({
        where: { id: lockId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lock) throw new NotFoundException('Bloqueo no encontrado');
      if (lock.releasedAt) throw new ConflictException('El bloqueo ya fue liberado');

      const result = await manager
        .createQueryBuilder()
        .update(Balance)
        .set({
          available: () => '"available" + :amount',
          locked: () => '"locked" - :amount',
        })
        .where('"walletId" = :walletId AND "tokenSymbol" = :symbol AND "locked" >= :amount')
        .setParameters({ walletId: lock.walletId, symbol: lock.tokenSymbol, amount: lock.amount })
        .returning(['available'])
        .execute();

      if (!result.affected) {
        throw new ConflictException('Inconsistencia: saldo bloqueado insuficiente');
      }
      const balanceAfter = (result.raw as { available: string }[])[0]?.available ?? '0';

      lock.releasedAt = new Date();
      lock.releasedBy = adminId;
      await manager.getRepository(FundLock).save(lock);

      await this.ledger.record(manager, {
        walletId: lock.walletId,
        tokenSymbol: lock.tokenSymbol,
        direction: LedgerDirection.CREDIT,
        amount: lock.amount,
        balanceAfter,
        referenceType: 'FUND_RELEASE',
        referenceId: lock.id,
      });
      return lock;
    });
  }
}
