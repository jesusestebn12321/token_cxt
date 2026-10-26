import {
  BeforeRemove,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum LedgerDirection {
  DEBIT = 'DEBIT', // disminuye el saldo disponible
  CREDIT = 'CREDIT', // aumenta el saldo disponible
}

/** Libro mayor append-only: las correcciones se hacen con asientos de reverso. */
@Entity('ledger_entries')
@Index(['walletId', 'tokenSymbol', 'id'])
export class LedgerEntry {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'uuid' })
  walletId!: string;

  @Column({ type: 'varchar', length: 20 })
  tokenSymbol!: string;

  @Column({ type: 'enum', enum: LedgerDirection })
  direction!: LedgerDirection;

  @Column({ type: 'numeric', precision: 38, scale: 18 })
  amount!: string;

  /** Saldo disponible resultante tras aplicar el asiento */
  @Column({ type: 'numeric', precision: 38, scale: 18 })
  balanceAfter!: string;

  /** Ej: 'DEPOSIT', 'WITHDRAWAL', 'FUND_LOCK', 'FUND_RELEASE', 'TRADE' */
  @Index()
  @Column({ type: 'varchar', length: 50 })
  referenceType!: string;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @BeforeUpdate()
  preventUpdate(): never {
    throw new Error('LedgerEntry es inmutable: UPDATE no permitido');
  }

  @BeforeRemove()
  preventRemove(): never {
    throw new Error('LedgerEntry es inmutable: DELETE no permitido');
  }
}
