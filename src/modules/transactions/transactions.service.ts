import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Paginated, paginate } from '../../common/dto/pagination-query.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { Transaction } from './entities/transaction.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction) private readonly repo: Repository<Transaction>,
  ) {}

  async findAll(query: QueryTransactionsDto): Promise<Paginated<Transaction>> {
    const where: FindOptionsWhere<Transaction> = {};
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.customerId) where.customerId = query.customerId;
    if (query.tokenSymbol) where.tokenSymbol = query.tokenSymbol;

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    return paginate(items, total, query);
  }

  async findOne(id: string): Promise<Transaction> {
    const tx = await this.repo.findOne({ where: { id }, relations: { approvals: true } });
    if (!tx) throw new NotFoundException('Transacción no encontrada');
    return tx;
  }
}
