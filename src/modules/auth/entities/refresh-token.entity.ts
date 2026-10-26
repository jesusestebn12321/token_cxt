import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('refresh_tokens')
export class RefreshToken extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  /** SHA-256 del refresh token (nunca se guarda el token en claro) */
  @Index({ unique: true })
  @Column({ type: 'char', length: 64 })
  tokenHash!: string;

  @Column({ type: 'boolean', default: false })
  twoFactorVerified!: boolean;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent!: string | null;
}
