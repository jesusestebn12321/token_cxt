import { Check, Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Wallet } from './wallet.entity';

@Entity('balances')
@Index(['walletId', 'tokenSymbol'], { unique: true })
@Check('"available" >= 0')
@Check('"locked" >= 0')
export class Balance extends BaseEntity {
  @Column({ type: 'uuid' })
  walletId!: string;

  @ManyToOne(() => Wallet, (w) => w.balances, { onDelete: 'RESTRICT' })
  wallet!: Wallet;

  @Column({ type: 'varchar', length: 20 })
  tokenSymbol!: string;

  /** Saldo disponible. Valores numéricos como string para no perder precisión. */
  @Column({ type: 'numeric', precision: 38, scale: 18, default: '0' })
  available!: string;

  /** Saldo bloqueado por FundLocks activos */
  @Column({ type: 'numeric', precision: 38, scale: 18, default: '0' })
  locked!: string;
}
