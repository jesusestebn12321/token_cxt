import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Model, mongo } from 'mongoose';
import { oid, oidOrNull } from '../../common/database/object-id';
import { Paginated, paginate } from '../../common/dto/pagination-query.dto';
import { AppendAuditInput } from './dto/append-audit.dto';
import { QueryAuditDto } from './dto/query-audit.dto';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

const GENESIS_HASH = '0'.repeat(64);
const MAX_APPEND_ATTEMPTS = 25;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface HashInput {
  seq: number;
  prevHash: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

@Injectable()
export class AuditService {
  /** Cola en memoria: dentro de una instancia los appends se ejecutan de uno en uno. */
  private queueTail: Promise<unknown> = Promise.resolve();

  constructor(@InjectModel(AuditLog.name) private readonly model: Model<AuditLog>) {}

  /**
   * Único punto de escritura: solo INSERT. Serializa los appends de esta instancia
   * (así nunca compiten entre sí) y delega la contención entre instancias en el
   * reintento optimista de `appendWithRetry`.
   */
  append(input: AppendAuditInput): Promise<AuditLogDocument> {
    const result = this.queueTail.then(() => this.appendWithRetry(input));
    this.queueTail = result.catch(() => undefined); // un fallo no bloquea la cola
    return result;
  }

  /**
   * Calcula el siguiente eslabón de la cadena; si otra instancia ganó la carrera por
   * el mismo `seq` (E11000) reintenta con backoff aleatorio.
   */
  private async appendWithRetry(input: AppendAuditInput): Promise<AuditLogDocument> {
    // Normaliza a JSON puro: lo que se hashea es exactamente lo que Mongo almacenará
    const metadata = JSON.parse(JSON.stringify(input.metadata ?? {})) as Record<string, unknown>;

    for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt++) {
      const last = await this.model
        .findOne()
        .sort({ seq: -1 })
        .select('seq hash')
        .lean<{ seq: number; hash: string }>();

      const seq = (last?.seq ?? 0) + 1;
      const prevHash = last?.hash ?? GENESIS_HASH;
      const createdAt = new Date();

      const hashInput: HashInput = {
        seq,
        prevHash,
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        metadata,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        createdAt,
      };

      try {
        return await this.model.create({
          seq,
          prevHash,
          hash: this.computeHash(hashInput),
          actorId: oidOrNull(input.actorId),
          actorEmail: hashInput.actorEmail,
          action: hashInput.action,
          resource: hashInput.resource,
          resourceId: hashInput.resourceId,
          metadata,
          ipAddress: hashInput.ipAddress,
          userAgent: hashInput.userAgent,
          createdAt,
        });
      } catch (error) {
        if (error instanceof mongo.MongoServerError && error.code === 11000) {
          await sleep(Math.random() * 10 * (attempt + 1)); // jitter creciente
          continue;
        }
        throw error;
      }
    }
    throw new ServiceUnavailableException('No se pudo registrar el evento de auditoría (contención)');
  }

  async findAll(query: QueryAuditDto): Promise<Paginated<AuditLogDocument>> {
    const filter: Record<string, unknown> = {};
    if (query.actorId) filter.actorId = oid(query.actorId);
    if (query.action) filter.action = query.action;
    if (query.resource) filter.resource = query.resource;

    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ seq: -1 }).skip(query.skip).limit(query.limit),
      this.model.countDocuments(filter),
    ]);
    return paginate(items, total, query);
  }

  /** Recorre la cadena completa con un cursor (memoria constante) y valida cada hash. */
  async verifyChain(): Promise<{ valid: boolean; checked: number; brokenAtSeq?: number }> {
    let prev = GENESIS_HASH;
    let expectedSeq = 1;
    let checked = 0;

    const cursor = this.model.find().sort({ seq: 1 }).lean().cursor();
    for await (const row of cursor) {
      checked++;
      const expectedHash = this.computeHash({
        seq: row.seq,
        prevHash: prev,
        actorId: row.actorId ? row.actorId.toString() : null,
        actorEmail: row.actorEmail,
        action: row.action,
        resource: row.resource,
        resourceId: row.resourceId,
        metadata: row.metadata,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        createdAt: row.createdAt,
      });
      if (row.seq !== expectedSeq || row.prevHash !== prev || row.hash !== expectedHash) {
        return { valid: false, checked, brokenAtSeq: row.seq };
      }
      prev = row.hash;
      expectedSeq++;
    }
    return { valid: true, checked };
  }

  private computeHash(i: HashInput): string {
    return createHash('sha256')
      .update(
        JSON.stringify([
          i.seq,
          i.prevHash,
          i.actorId,
          i.actorEmail,
          i.action,
          i.resource,
          i.resourceId,
          i.metadata,
          i.ipAddress,
          i.userAgent,
          i.createdAt.toISOString(),
        ]),
      )
      .digest('hex');
  }
}
