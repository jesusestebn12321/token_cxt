import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model, mongo } from 'mongoose';
import { Paginated, PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto';
import { Permission } from '../../common/enums/permission.enum';
import { Role } from '../../common/enums/role.enum';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AccessRole } from './schemas/role.schema';
import { User, UserDocument } from './schemas/user.schema';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(AccessRole.name) private readonly roles: Model<AccessRole>,
  ) {}

  async create(dto: CreateUserDto): Promise<UserDocument> {
    await this.assertRolesExist(dto.roles);
    try {
      const created = await this.users.create({
        email: dto.email.toLowerCase(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        roles: [...new Set(dto.roles)],
      });
      return this.findById(created.id as string); // re-lectura: excluye passwordHash
    } catch (error) {
      if (error instanceof mongo.MongoServerError && error.code === 11000) {
        throw new ConflictException('El email ya está registrado');
      }
      throw error;
    }
  }

  async findAll(query: PaginationQueryDto): Promise<Paginated<UserDocument>> {
    const [items, total] = await Promise.all([
      this.users.find().sort({ createdAt: -1 }).skip(query.skip).limit(query.limit),
      this.users.countDocuments(),
    ]);
    return paginate(items, total, query);
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  /** Incluye passwordHash y twoFactorSecret (campos `select: false`). Solo uso interno de Auth. */
  findByEmailWithSecrets(email: string): Promise<UserDocument | null> {
    return this.users
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash +twoFactorSecret');
  }

  findByIdWithSecrets(id: string): Promise<UserDocument | null> {
    return this.users.findById(id).select('+passwordHash +twoFactorSecret');
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.users.findByIdAndUpdate(id, { $set: dto }, { returnDocument: 'after' });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async assignRoles(id: string, dto: AssignRolesDto): Promise<UserDocument> {
    await this.assertRolesExist(dto.roles);
    const user = await this.users.findByIdAndUpdate(
      id,
      { $set: { roles: [...new Set(dto.roles)] } },
      { returnDocument: 'after' },
    );
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  /** Une los permisos de todos los roles indicados (sin duplicados). */
  async resolvePermissions(roleNames: string[]): Promise<Permission[]> {
    const found = await this.roles.find({ name: { $in: roleNames } }).lean();
    return [...new Set(found.flatMap((r) => r.permissions))] as Permission[];
  }

  verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  isLocked(user: UserDocument): boolean {
    return !!user.lockedUntil && user.lockedUntil.getTime() > Date.now();
  }

  async registerFailedLogin(user: UserDocument): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
    await this.users.updateOne(
      { _id: user._id },
      { $set: { failedLoginAttempts: lockedUntil ? 0 : attempts, lockedUntil } },
    );
  }

  async registerSuccessfulLogin(userId: string): Promise<void> {
    await this.users.updateOne(
      { _id: userId },
      { $set: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } },
    );
  }

  async setTwoFactor(userId: string, secret: string | null, enabled: boolean): Promise<void> {
    await this.users.updateOne(
      { _id: userId },
      { $set: { twoFactorSecret: secret, twoFactorEnabled: enabled } },
    );
  }

  private async assertRolesExist(names: Role[]): Promise<void> {
    const unique = [...new Set(names)];
    const found = await this.roles.find({ name: { $in: unique } }).select('name').lean();
    if (found.length !== unique.length) {
      const known = new Set(found.map((r) => r.name));
      const missing = unique.filter((n) => !known.has(n));
      throw new NotFoundException(`Roles inexistentes: ${missing.join(', ')}`);
    }
  }
}
