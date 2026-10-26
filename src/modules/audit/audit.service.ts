import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { Paginated, paginate } from '../../common/dto/pagination-query.dto';
import { AppendAuditInput } from './dto/append-audit.dto';
import { QueryAuditDto } from './dto/query-audit.dto';
import { AuditLog } from './entities/audit-log.entity';

const GENESIS_HASH = '0'.repeat(64);
const AUDIT_LOCK_KEY = 947_201; // clave arbitraria para pg_advisory_xact_lock

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
  ) {}

  /** Único punto de escritura: solo INSERT. Serializa la cadena con un advisory lock. */
  async append(input: AppendAuditInput): Promise<AuditLog> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [AUDIT_LOCK_KEY]);

      const last = await manager.getRepository(AuditLog).findOne({
        where: {},
        order: { id: 'DESC' },
        select: { id: true, hash: true },
      });
      const prevHash = last?.hash ?? GENESIS_HASH;
      const createdAt = new Date();

      const entry = manager.getRepository(AuditLog).create({
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        metadata: input.metadata ?? {},
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        prevHash,
        createdAt,
        hash: this.computeHash(prevHash, input, createdAt),
      });
      return manager.getRepository(AuditLog).save(entry);
    });
  }

  async findAll(query: QueryAuditDto): Promise<Paginated<AuditLog>> {
    const qb = this.repo.createQueryBuilder('a').orderBy('a.id', 'DESC');
    if (query.actorId) qb.andWhere('a.actorId = :actorId', { actorId: query.actorId });
    if (query.action) qb.andWhere('a.action = :action', { action: query.action });
    if (query.resource) qb.andWhere('a.resource = :resource', { resource: query.resource });

    const [items, total] = await qb.skip(query.skip).take(query.limit).getManyAndCount();
    return paginate(items, total, query);
  }

  /** Verifica la integridad de la cadena de hashes (O(n); usar por lotes en producción). */
  async verifyChain(): Promise<{ valid: boolean; checked: number; brokenAtId?: string }> {
    const rows = await this.repo.find({ order: { id: 'ASC' } });
    let prev = GENESIS_HASH;
    for (const row of rows) {
      const expected = this.computeHash(
        prev,
        {
          actorId: row.actorId,
          actorEmail: row.actorEmail,
          action: row.action,
          resource: row.resource,
          resourceId: row.resourceId,
          metadata: row.metadata,
          ipAddress: row.ipAddress,
          userAgent: row.userAgent,
        },
        row.createdAt,
      );
      if (row.prevHash !== prev || row.hash !== expected) {
        return { valid: false, checked: rows.length, brokenAtId: row.id };
      }
      prev = row.hash;
    }
    return { valid: true, checked: rows.length };
  }

  private computeHash(prevHash: string, input: AppendAuditInput, createdAt: Date): string {
    return createHash('sha256')
      .update(
        JSON.stringify([
          prevHash,
          input.actorId,
          input.actorEmail,
          input.action,
          input.resource,
          input.resourceId,
          input.metadata ?? {},
          input.ipAddress ?? null,
          input.userAgent ?? null,
          createdAt.toISOString(),
        ]),
      )
      .digest('hex');
  }
}
