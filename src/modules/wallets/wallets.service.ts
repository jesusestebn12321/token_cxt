import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, QueryFilter, Types, UpdateQuery } from 'mongoose';
import { dec, oid } from '../../common/database/object-id';
import { runInTransaction } from '../../common/database/transaction.util';
import { Paginated, PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto';
import { FreezeWalletDto } from './dto/freeze-wallet.dto';
import { LockFundsDto } from './dto/lock-funds.dto';
import { LedgerService } from './ledger.service';
import { Balance, BalanceDocument } from './schemas/balance.schema';
import { FundLock, FundLockDocument } from './schemas/fund-lock.schema';
import { LedgerDirection } from './schemas/ledger-entry.schema';
import { Wallet, WalletDocument } from './schemas/wallet.schema';

/*
 * Los importes se declaran `string` en el modelo (getter de Decimal128) pero en las
 * consultas/updates deben viajar como Decimal128. Estos helpers concentran el único
 * cast necesario para que los tipos de Mongoose lo acepten.
 */
const balanceWithAtLeast = (
  walletId: Types.ObjectId,
  tokenSymbol: string,
  field: 'available' | 'locked',
  min: Types.Decimal128,
): QueryFilter<Balance> =>
  ({ walletId, tokenSymbol, [field]: { $gte: min } }) as unknown as QueryFilter<Balance>;

const moveBetweenBuckets = (
  availableDelta: Types.Decimal128,
  lockedDelta: Types.Decimal128,
): UpdateQuery<Balance> =>
  ({ $inc: { available: availableDelta, locked: lockedDelta } }) as unknown as UpdateQuery<Balance>;

@Injectable()
export class WalletsService {
  constructor(
    @InjectModel(Wallet.name) private readonly wallets: Model<Wallet>,
    @InjectModel(Balance.name) private readonly balances: Model<Balance>,
    @InjectModel(FundLock.name) private readonly locks: Model<FundLock>,
    @InjectConnection() private readonly connection: Connection,
    private readonly ledger: LedgerService,
  ) {}

  async findAll(query: PaginationQueryDto): Promise<Paginated<WalletDocument>> {
    const [items, total] = await Promise.all([
      this.wallets.find().sort({ createdAt: -1 }).skip(query.skip).limit(query.limit),
      this.wallets.countDocuments(),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string): Promise<WalletDocument> {
    const wallet = await this.wallets.findById(id);
    if (!wallet) throw new NotFoundException('Wallet no encontrada');
    return wallet;
  }

  getBalances(walletId: string): Promise<BalanceDocument[]> {
    return this.balances.find({ walletId: oid(walletId) }).sort({ tokenSymbol: 1 });
  }

  getLocks(walletId: string): Promise<FundLockDocument[]> {
    return this.locks.find({ walletId: oid(walletId) }).sort({ createdAt: -1 });
  }

  async setFrozen(id: string, dto: FreezeWalletDto): Promise<WalletDocument> {
    const wallet = await this.wallets.findByIdAndUpdate(
      id,
      { $set: { isFrozen: dto.frozen, frozenReason: dto.frozen ? dto.reason : null } },
      { returnDocument: 'after' },
    );
    if (!wallet) throw new NotFoundException('Wallet no encontrada');
    return wallet;
  }

  /** Mueve `available` ? `locked` de forma atómica y deja asiento en el ledger. */
  async lockFunds(walletId: string, dto: LockFundsDto, adminId: string): Promise<FundLockDocument> {
    await this.findOne(walletId);
    const amount = dec(dto.amount);

    return runInTransaction(this.connection, async (session) => {
      // Un solo update atómico: solo se aplica si hay saldo disponible suficiente
      const balance = await this.balances.findOneAndUpdate(
        balanceWithAtLeast(oid(walletId), dto.tokenSymbol, 'available', amount),
        moveBetweenBuckets(dec(`-${dto.amount}`), amount),
        { returnDocument: 'after', session },
      );
      if (!balance) throw new ConflictException('Saldo disponible insuficiente para bloquear');

      const [lock] = await this.locks.create(
        [
          {
            walletId: oid(walletId),
            tokenSymbol: dto.tokenSymbol,
            amount: dto.amount,
            reason: dto.reason,
            notes: dto.notes ?? null,
            lockedBy: oid(adminId),
            releasedAt: null,
            releasedBy: null,
          },
        ],
        { session },
      );
      const created = lock as FundLockDocument;

      await this.ledger.record(session, {
        walletId,
        tokenSymbol: dto.tokenSymbol,
        direction: LedgerDirection.DEBIT,
        amount: dto.amount,
        balanceAfter: balance.available,
        referenceType: 'FUND_LOCK',
        referenceId: created.id as string,
      });
      return created;
    });
  }

  async releaseLock(lockId: string, adminId: string): Promise<FundLockDocument> {
    return runInTransaction(this.connection, async (session) => {
      // Marcar como liberado de forma atómica: solo un request puede ganar
      const lock = await this.locks.findOneAndUpdate(
        { _id: lockId, releasedAt: null },
        { $set: { releasedAt: new Date(), releasedBy: oid(adminId) } },
        { returnDocument: 'after', session },
      );
      if (!lock) {
        const exists = await this.locks.exists({ _id: lockId }).session(session);
        if (!exists) throw new NotFoundException('Bloqueo no encontrado');
        throw new ConflictException('El bloqueo ya fue liberado');
      }

      const amount = dec(lock.amount);
      const balance = await this.balances.findOneAndUpdate(
        balanceWithAtLeast(lock.walletId, lock.tokenSymbol, 'locked', amount),
        moveBetweenBuckets(amount, dec(`-${lock.amount}`)),
        { returnDocument: 'after', session },
      );
      // Si falla se lanza y la transacción revierte también la marca de liberado
      if (!balance) throw new ConflictException('Inconsistencia: saldo bloqueado insuficiente');

      await this.ledger.record(session, {
        walletId: lock.walletId.toString(),
        tokenSymbol: lock.tokenSymbol,
        direction: LedgerDirection.CREDIT,
        amount: lock.amount,
        balanceAfter: balance.available,
        referenceType: 'FUND_RELEASE',
        referenceId: lock.id as string,
      });
      return lock;
    });
  }
}
