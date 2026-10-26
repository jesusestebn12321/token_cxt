import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { PermissionEntity } from './permission.entity';

@Entity('roles')
export class RoleEntity extends BaseEntity {
  /** Valor del enum Role, ej. 'COMPLIANCE_OFFICER' */
  @Column({ type: 'varchar', length: 50, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @ManyToMany(() => PermissionEntity, { eager: true })
  @JoinTable({ name: 'role_permissions' })
  permissions!: PermissionEntity[];
}
