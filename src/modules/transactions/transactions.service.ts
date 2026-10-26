import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { oid } from '../../common/database/object-id';
import { Paginated, paginate } from '../../common/dto/pagination-query.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';

@Injectable()
export class TransactionsService {
  constructor(@InjectModel(Transaction.name) private readonly model: Model<Transaction>) {}

  async findAll(query: QueryTransactionsDto): Promise<Paginated<TransactionDocument>> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.customerId) filter.customerId = oid(query.customerId);
    if (query.tokenSymbol) filter.tokenSymbol = query.tokenSymbol;

    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(query.skip).limit(query.limit),
      this.model.countDocuments(filter),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string): Promise<TransactionDocument> {
    const tx = await this.model.findById(id);
    if (!tx) throw new NotFoundException('Transacción no encontrada');
    return tx;
  }
}
