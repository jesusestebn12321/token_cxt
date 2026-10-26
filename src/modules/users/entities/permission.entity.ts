import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('permissions')
export class PermissionEntity extends BaseEntity {
  /** Valor del enum Permission, ej. 'users:read' */
  @Column({ type: 'varchar', length: 100, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;
}
