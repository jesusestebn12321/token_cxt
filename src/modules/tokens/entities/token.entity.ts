import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SmartContract } from './smart-contract.entity';

export enum TokenStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  RETIRED = 'RETIRED',
}

export enum AssetClass {
  REAL_ESTATE = 'REAL_ESTATE',
  PRIVATE_EQUITY = 'PRIVATE_EQUITY',
  FIXED_INCOME = 'FIXED_INCOME',
  COMMODITY = 'COMMODITY',
  ART = 'ART',
  OTHER = 'OTHER',
}

@Entity('tokens')
export class Token extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  symbol!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'enum', enum: AssetClass })
  assetClass!: AssetClass;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'smallint', default: 18 })
  decimals!: number;

  /** Suministro máximo autorizado (string para evitar pérdida de precisión) */
  @Column({ type: 'numeric', precision: 38, scale: 0 })
  maxSupply!: string;

  /** Valoración del activo subyacente en USD (informativa) */
  @Column({ type: 'numeric', precision: 28, scale: 2, nullable: true })
  underlyingValueUsd!: string | null;

  @Column({ type: 'enum', enum: TokenStatus, default: TokenStatus.DRAFT })
  status!: TokenStatus;

  /** Nivel KYC mínimo para poseer/operar el token */
  @Column({ type: 'varchar', length: 20, default: 'INTERMEDIATE' })
  requiredKycLevel!: string;

  @OneToMany(() => SmartContract, (c) => c.token)
  contracts!: SmartContract[];
}
