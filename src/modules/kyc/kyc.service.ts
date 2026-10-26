import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { oid } from '../../common/database/object-id';
import { Paginated, paginate } from '../../common/dto/pagination-query.dto';
import { QueryKycDto } from './dto/query-kyc.dto';
import { KycDecision, ReviewKycDto } from './dto/review-kyc.dto';
import { AmlResult, KycStatus } from './enums/kyc-status.enum';
import { KycSubmission, KycSubmissionDocument } from './schemas/kyc-submission.schema';

const FINAL_STATES = [KycStatus.APPROVED, KycStatus.REJECTED];

@Injectable()
export class KycService {
  constructor(@InjectModel(KycSubmission.name) private readonly model: Model<KycSubmission>) {}

  async findAll(query: QueryKycDto): Promise<Paginated<KycSubmissionDocument>> {
    const filter = query.status ? { status: query.status } : {};
    const [items, total] = await Promise.all([
      // cola FIFO de revisión
      this.model.find(filter).sort({ createdAt: 1 }).skip(query.skip).limit(query.limit),
      this.model.countDocuments(filter),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string): Promise<KycSubmissionDocument> {
    const submission = await this.model.findById(id);
    if (!submission) throw new NotFoundException('Solicitud KYC no encontrada');
    return submission;
  }

  /** Toma la solicitud para revisión (atómico: evita que dos oficiales revisen la misma). */
  async claim(id: string, reviewerId: string): Promise<KycSubmissionDocument> {
    const claimed = await this.model.findOneAndUpdate(
      { _id: id, status: KycStatus.PENDING },
      { $set: { status: KycStatus.IN_REVIEW, reviewedBy: oid(reviewerId) } },
      { returnDocument: 'after' },
    );
    if (!claimed) throw new ConflictException('La solicitud no está pendiente o ya fue tomada');
    return claimed;
  }

  async review(id: string, dto: ReviewKycDto, reviewerId: string): Promise<KycSubmissionDocument> {
    const submission = await this.findOne(id);

    if (FINAL_STATES.includes(submission.status)) {
      throw new ConflictException('La solicitud ya fue resuelta');
    }
    if (dto.decision !== KycDecision.APPROVE && !dto.notes) {
      throw new BadRequestException('Las notas son obligatorias al rechazar o pedir más información');
    }
    if (
      dto.decision === KycDecision.APPROVE &&
      submission.screenings.some((s) => s.result === AmlResult.CONFIRMED_MATCH)
    ) {
      throw new ConflictException('No se puede aprobar con coincidencia AML confirmada');
    }

    const nextStatus: Record<KycDecision, KycStatus> = {
      [KycDecision.APPROVE]: KycStatus.APPROVED,
      [KycDecision.REJECT]: KycStatus.REJECTED,
      [KycDecision.REQUEST_MORE_INFO]: KycStatus.MORE_INFO_REQUIRED,
    };

    const set: Record<string, unknown> = {
      status: nextStatus[dto.decision],
      reviewedBy: oid(reviewerId),
      reviewedAt: new Date(),
      reviewNotes: dto.notes ?? null,
    };
    if (dto.riskScore !== undefined) set.riskScore = dto.riskScore;
    if (dto.decision === KycDecision.APPROVE && dto.grantedLevel) {
      set.requestedLevel = dto.grantedLevel;
    }

    // Condicional por estado: si otro revisor resolvió entre medias, no se pisa
    const updated = await this.model.findOneAndUpdate(
      { _id: id, status: { $nin: FINAL_STATES } },
      { $set: set },
      { returnDocument: 'after' },
    );
    if (!updated) throw new ConflictException('La solicitud ya fue resuelta');
    return updated;
  }
}
