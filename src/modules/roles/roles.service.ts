import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccessRole, Prisma } from '@prisma/client';
import { isUniqueViolation } from '../../common/database/prisma-errors';
import { Role } from '../../common/enums/role.enum';
import {
  ModuleGrant,
  grantsToPermissions,
  permissionsToGrants,
} from '../../common/rbac/access-catalog';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertRoleDto } from './dto/upsert-role.dto';

export interface RoleView {
  id: string;
  name: string;
  description: string | null;
  grants: ModuleGrant[];
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<RoleView[]> {
    const roles = await this.prisma.accessRole.findMany({ orderBy: { name: 'asc' } });
    return roles.map(presentRole);
  }

  async findOne(id: string): Promise<RoleView> {
    const role = await this.prisma.accessRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Rol no encontrado');
    return presentRole(role);
  }

  async create(dto: UpsertRoleDto, actorRoles: readonly string[]): Promise<RoleView> {
    this.assertCanEdit(dto.name, actorRoles);
    const permissions = grantsToPermissions(dto.grants);
    try {
      const created = await this.prisma.accessRole.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          permissions,
        },
      });
      return presentRole(created);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Ya existe un rol con ese nombre');
      throw error;
    }
  }

  async update(id: string, dto: UpsertRoleDto, actorRoles: readonly string[]): Promise<RoleView> {
    const current = await this.prisma.accessRole.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Rol no encontrado');
    this.assertCanEdit(current.name, actorRoles);
    this.assertCanEdit(dto.name, actorRoles);

    try {
      const updated = await this.prisma.accessRole.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description ?? null,
          permissions: grantsToPermissions(dto.grants),
        },
      });
      if (current.name !== updated.name) {
        await this.renameOnUsers(current.name, updated.name);
      }
      return presentRole(updated);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Ya existe un rol con ese nombre');
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Rol no encontrado');
      }
      throw error;
    }
  }

  async remove(id: string, actorRoles: readonly string[]): Promise<{ deleted: true }> {
    const current = await this.prisma.accessRole.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Rol no encontrado');
    this.assertCanEdit(current.name, actorRoles);
    const assigned = await this.prisma.user.count({ where: { roles: { has: current.name } } });
    if (assigned > 0) {
      throw new ConflictException('El rol está asignado a usuarios y no se puede eliminar');
    }
    await this.prisma.accessRole.delete({ where: { id } });
    return { deleted: true };
  }

  private assertCanEdit(name: string, actorRoles: readonly string[]): void {
    if (name === Role.SUPER_ADMIN && !actorRoles.includes(Role.SUPER_ADMIN)) {
      throw new ForbiddenException('Solo un SUPER_ADMIN puede modificar ese rol');
    }
  }

  private async renameOnUsers(from: string, to: string): Promise<void> {
    const holders = await this.prisma.user.findMany({
      where: { roles: { has: from } },
      select: { id: true, roles: true },
    });
    for (const user of holders) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { roles: user.roles.map((role) => (role === from ? to : role)) },
      });
    }
  }
}

function presentRole(role: AccessRole): RoleView {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    grants: permissionsToGrants(role.permissions),
    permissions: role.permissions,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}
