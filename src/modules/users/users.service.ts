import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { isUniqueViolation } from '../../common/database/prisma-errors';
import { Paginated, PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto';
import { Permission } from '../../common/enums/permission.enum';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const publicUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  isActive: true,
  twoFactorEnabled: true,
  lastLoginAt: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  roles: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
export type SecretUser = User;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async registerSelf(input: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
  }): Promise<PublicUser> {
    try {
      const created = await this.prisma.user.create({
        data: {
          email: input.email.toLowerCase(),
          firstName: input.firstName,
          lastName: input.lastName,
          passwordHash: await this.hashPassword(input.password),
          roles: [],
        },
        select: { id: true },
      });
      return this.findById(created.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('El email ya está registrado');
      }
      throw error;
    }
  }

  hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  async create(dto: CreateUserDto, actorRoles: readonly string[]): Promise<PublicUser> {
    this.assertCanGrantSuperAdmin(dto.roles, actorRoles);
    await this.assertRolesExist(dto.roles);
    try {
      const created = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          firstName: dto.firstName,
          lastName: dto.lastName,
          passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
          roles: [...new Set(dto.roles)],
        },
        select: { id: true },
      });
      return this.findById(created.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('El email ya está registrado');
      }
      throw error;
    }
  }

  async findAll(query: PaginationQueryDto): Promise<Paginated<PublicUser>> {
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        select: publicUserSelect,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.user.count(),
    ]);
    return paginate(items, total, query);
  }

  async findById(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: publicUserSelect });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  findByEmailWithSecrets(email: string): Promise<SecretUser | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findByIdWithSecrets(id: string): Promise<SecretUser | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<PublicUser> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: dto,
        select: publicUserSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Usuario no encontrado');
      }
      throw error;
    }
  }

  async assignRoles(id: string, dto: AssignRolesDto, actorRoles: readonly string[]): Promise<PublicUser> {
    this.assertCanGrantSuperAdmin(dto.roles, actorRoles);
    await this.assertRolesExist(dto.roles);
    try {
      return await this.prisma.user.update({
        where: { id },
        data: { roles: [...new Set(dto.roles)] },
        select: publicUserSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Usuario no encontrado');
      }
      throw error;
    }
  }

  async resolvePermissions(roleNames: string[]): Promise<Permission[]> {
    const found = await this.prisma.accessRole.findMany({
      where: { name: { in: roleNames } },
      select: { permissions: true },
    });
    return [...new Set(found.flatMap((r) => r.permissions))] as Permission[];
  }

  verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  isLocked(user: Pick<SecretUser, 'lockedUntil'>): boolean {
    return !!user.lockedUntil && user.lockedUntil.getTime() > Date.now();
  }

  async registerFailedLogin(user: Pick<SecretUser, 'id' | 'failedLoginAttempts'>): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: lockedUntil ? 0 : attempts, lockedUntil },
    });
  }

  async registerSuccessfulLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  }

  async setTwoFactor(userId: string, secret: string | null, enabled: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret, twoFactorEnabled: enabled },
    });
  }

  private assertCanGrantSuperAdmin(roles: readonly string[], actorRoles: readonly string[]): void {
    if (roles.includes(Role.SUPER_ADMIN) && !actorRoles.includes(Role.SUPER_ADMIN)) {
      throw new ForbiddenException('Solo un SUPER_ADMIN puede otorgar ese rol');
    }
  }

  private async assertRolesExist(names: Role[]): Promise<void> {
    const unique = [...new Set(names)];
    const found = await this.prisma.accessRole.findMany({
      where: { name: { in: unique } },
      select: { name: true },
    });
    if (found.length !== unique.length) {
      const known = new Set(found.map((r) => r.name));
      const missing = unique.filter((n) => !known.has(n));
      throw new NotFoundException(`Roles inexistentes: ${missing.join(', ')}`);
    }
  }
}
