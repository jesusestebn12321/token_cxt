import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { oid } from '../../common/database/object-id';
import { Paginated, PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto';
import { LedgerDirection, LedgerEntry, LedgerEntryDocument } from './schemas/ledger-entry.schema';

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
  constructor(@InjectModel(LedgerEntry.name) private readonly model: Model<LedgerEntry>) {}

  /** Debe llamarse dentro de la MISMA transacción (session) que modifica el saldo. */
  async record(session: ClientSession, input: RecordLedgerInput): Promise<LedgerEntryDocument> {
    const [entry] = await this.model.create(
      [{ ...input, walletId: oid(input.walletId), referenceId: input.referenceId ?? null }],
      { session },
    );
    return entry as LedgerEntryDocument;
  }

  async findByWallet(
    walletId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<LedgerEntryDocument>> {
    const filter = { walletId: oid(walletId) };
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ _id: -1 }).skip(query.skip).limit(query.limit),
      this.model.countDocuments(filter),
    ]);
    return paginate(items, total, query);
  }
}
