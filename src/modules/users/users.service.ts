import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { In, Repository } from 'typeorm';
import { Paginated, PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto';
import { Role } from '../../common/enums/role.enum';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RoleEntity } from './entities/role.entity';
import { User } from './entities/user.entity';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(RoleEntity) private readonly rolesRepo: Repository<RoleEntity>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const email = dto.email.toLowerCase();
    if (await this.usersRepo.exists({ where: { email } })) {
      throw new ConflictException('El email ya está registrado');
    }
    const roles = await this.resolveRoles(dto.roles);
    const user = this.usersRepo.create({
      email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      roles,
    });
    const saved = await this.usersRepo.save(user);
    return this.findById(saved.id);
  }

  async findAll(query: PaginationQueryDto): Promise<Paginated<User>> {
    const [items, total] = await this.usersRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    return paginate(items, total, query);
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  /** Incluye passwordHash y twoFactorSecret (columnas `select: false`). Solo uso interno de Auth. */
  findByEmailWithSecrets(email: string): Promise<User | null> {
    return this.usersRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'r')
      .leftJoinAndSelect('r.permissions', 'p')
      .addSelect(['u.passwordHash', 'u.twoFactorSecret'])
      .where('u.email = :email', { email: email.toLowerCase() })
      .getOne();
  }

  findByIdWithSecrets(id: string): Promise<User | null> {
    return this.usersRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'r')
      .leftJoinAndSelect('r.permissions', 'p')
      .addSelect(['u.passwordHash', 'u.twoFactorSecret'])
      .where('u.id = :id', { id })
      .getOne();
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    Object.assign(user, dto);
    await this.usersRepo.save(user);
    return this.findById(id);
  }

  async assignRoles(id: string, dto: AssignRolesDto): Promise<User> {
    const user = await this.findById(id);
    user.roles = await this.resolveRoles(dto.roles);
    await this.usersRepo.save(user);
    return this.findById(id);
  }

  verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  isLocked(user: User): boolean {
    return !!user.lockedUntil && user.lockedUntil.getTime() > Date.now();
  }

  async registerFailedLogin(user: User): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
    await this.usersRepo.update(user.id, {
      failedLoginAttempts: lockedUntil ? 0 : attempts,
      lockedUntil,
    });
  }

  async registerSuccessfulLogin(userId: string): Promise<void> {
    await this.usersRepo.update(userId, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    });
  }

  async setTwoFactor(userId: string, secret: string | null, enabled: boolean): Promise<void> {
    await this.usersRepo.update(userId, { twoFactorSecret: secret, twoFactorEnabled: enabled });
  }

  private async resolveRoles(names: Role[]): Promise<RoleEntity[]> {
    const unique = [...new Set(names)];
    const roles = await this.rolesRepo.find({ where: { name: In(unique) } });
    if (roles.length !== unique.length) {
      const found = new Set(roles.map((r) => r.name));
      const missing = unique.filter((n) => !found.has(n));
      throw new NotFoundException(`Roles inexistentes: ${missing.join(', ')}`);
    }
    return roles;
  }
}
