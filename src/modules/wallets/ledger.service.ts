import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Paginated, PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto';
import { LedgerDirection, LedgerEntry } from './entities/ledger-entry.entity';

export interface RecordLedgerInput {
  walletId: string;
  tokenSymbol: string;
  direction: LedgerDirection;
  amount: string;
  balanceAfter: string;
  referenceType: string;
  referenceId?: string | null;
}

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerEntry) private readonly repo: Repository<LedgerEntry>,
  ) {}

  /** Debe llamarse dentro de la MISMA transacción que modifica el saldo. */
  record(manager: EntityManager, input: RecordLedgerInput): Promise<LedgerEntry> {
    const repo = manager.getRepository(LedgerEntry);
    return repo.save(repo.create({ ...input, referenceId: input.referenceId ?? null }));
  }

  async findByWallet(walletId: string, query: PaginationQueryDto): Promise<Paginated<LedgerEntry>> {
    const [items, total] = await this.repo.findAndCount({
      where: { walletId },
      order: { id: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    return paginate(items, total, query);
  }
}
