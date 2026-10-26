import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Token } from './token.entity';

export enum ContractStandard {
  ERC20 = 'ERC20',
  ERC1400 = 'ERC1400', // security token
  ERC3643 = 'ERC3643', // T-REX, permissioned tokens
  ERC1155 = 'ERC1155',
}

@Entity('smart_contracts')
@Index(['chainId', 'address'], { unique: true })
export class SmartContract extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  tokenId!: string;

  @ManyToOne(() => Token, (t) => t.contracts, { onDelete: 'RESTRICT' })
  token!: Token;

  @Column({ type: 'int' })
  chainId!: number;

  /** Dirección EVM en formato checksum (EIP-55) */
  @Column({ type: 'varchar', length: 42 })
  address!: string;

  @Column({ type: 'enum', enum: ContractStandard, default: ContractStandard.ERC3643 })
  standard!: ContractStandard;

  @Column({ type: 'varchar', length: 66, nullable: true })
  deployTxHash!: string | null;

  @Column({ type: 'bigint', nullable: true })
  deployedAtBlock!: string | null;

  @Column({ type: 'boolean', default: false })
  isPaused!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;
}
