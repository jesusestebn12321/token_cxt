import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated, paginate } from '../../common/dto/pagination-query.dto';
import { QueryKycDto } from './dto/query-kyc.dto';
import { KycDecision, ReviewKycDto } from './dto/review-kyc.dto';
import { KycSubmission } from './entities/kyc-submission.entity';
import { KycStatus } from './enums/kyc-status.enum';

const FINAL_STATES = new Set([KycStatus.APPROVED, KycStatus.REJECTED]);

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(KycSubmission) private readonly repo: Repository<KycSubmission>,
  ) {}

  async findAll(query: QueryKycDto): Promise<Paginated<KycSubmission>> {
    const [items, total] = await this.repo.findAndCount({
      where: query.status ? { status: query.status } : {},
      order: { createdAt: 'ASC' }, // cola FIFO de revisión
      skip: query.skip,
      take: query.limit,
    });
    return paginate(items, total, query);
  }

  async findOne(id: string): Promise<KycSubmission> {
    const submission = await this.repo.findOne({
      where: { id },
      relations: { documents: true, screenings: true },
    });
    if (!submission) throw new NotFoundException('Solicitud KYC no encontrada');
    return submission;
  }

  /** Toma la solicitud para revisión (evita que dos oficiales revisen la misma). */
  async claim(id: string, reviewerId: string): Promise<KycSubmission> {
    const result = await this.repo.update(
      { id, status: KycStatus.PENDING },
      { status: KycStatus.IN_REVIEW, reviewedBy: reviewerId },
    );
    if (!result.affected) {
      throw new ConflictException('La solicitud no está pendiente o ya fue tomada');
    }
    return this.findOne(id);
  }

  async review(id: string, dto: ReviewKycDto, reviewerId: string): Promise<KycSubmission> {
    const submission = await this.findOne(id);

    if (FINAL_STATES.has(submission.status)) {
      throw new ConflictException('La solicitud ya fue resuelta');
    }
    if (dto.decision !== KycDecision.APPROVE && !dto.notes) {
      throw new BadRequestException('Las notas son obligatorias al rechazar o pedir más información');
    }
    if (dto.decision === KycDecision.APPROVE && submission.screenings.some(
      (s) => s.result === 'CONFIRMED_MATCH',
    )) {
      throw new ConflictException('No se puede aprobar con coincidencia AML confirmada');
    }

    const nextStatus: Record<KycDecision, KycStatus> = {
      [KycDecision.APPROVE]: KycStatus.APPROVED,
      [KycDecision.REJECT]: KycStatus.REJECTED,
      [KycDecision.REQUEST_MORE_INFO]: KycStatus.MORE_INFO_REQUIRED,
    };

    submission.status = nextStatus[dto.decision];
    submission.reviewedBy = reviewerId;
    submission.reviewedAt = new Date();
    submission.reviewNotes = dto.notes ?? null;
    if (dto.riskScore !== undefined) submission.riskScore = dto.riskScore;
    if (dto.decision === KycDecision.APPROVE && dto.grantedLevel) {
      submission.requestedLevel = dto.grantedLevel;
    }
    return this.repo.save(submission);
  }
}
