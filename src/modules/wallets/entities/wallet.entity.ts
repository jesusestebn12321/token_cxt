import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Balance } from './balance.entity';

@Entity('wallets')
export class Wallet extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  customerId!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label!: string | null;

  /** Dirección EVM de depósito asociada (opcional en wallets puramente internas) */
  @Index()
  @Column({ type: 'varchar', length: 42, nullable: true })
  address!: string | null;

  @Column({ type: 'int', nullable: true })
  chainId!: number | null;

  /** Wallet congelada: sin movimientos ni retiros */
  @Column({ type: 'boolean', default: false })
  isFrozen!: boolean;

  @Column({ type: 'text', nullable: true })
  frozenReason!: string | null;

  @OneToMany(() => Balance, (b) => b.wallet)
  balances!: Balance[];
}
