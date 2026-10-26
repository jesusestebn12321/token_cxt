import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { RoleEntity } from './role.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', default: false })
  twoFactorEnabled!: boolean;

  /** Secreto TOTP. Recomendado: cifrar en reposo (AES-GCM / KMS) antes de producción. */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  twoFactorSecret!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil!: Date | null;

  @ManyToMany(() => RoleEntity, { eager: true })
  @JoinTable({ name: 'user_roles' })
  roles!: RoleEntity[];
}
