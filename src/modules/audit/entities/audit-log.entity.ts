import {
  BeforeRemove,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Registro append-only con hash encadenado (cada fila incluye el hash de la anterior).
 * Refuerzo adicional recomendado en BD: REVOKE UPDATE, DELETE + trigger que lo impida.
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actorEmail!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  resource!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resourceId!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'char', length: 64 })
  prevHash!: string;

  @Column({ type: 'char', length: 64, unique: true })
  hash!: string;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @BeforeUpdate()
  preventUpdate(): never {
    throw new Error('AuditLog es inmutable: UPDATE no permitido');
  }

  @BeforeRemove()
  preventRemove(): never {
    throw new Error('AuditLog es inmutable: DELETE no permitido');
  }
}
