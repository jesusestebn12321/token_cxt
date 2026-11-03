import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { Permission } from '../../common/enums/permission.enum';
import { Role } from '../../common/enums/role.enum';
import { ACCESS_MODULES, grantsToPermissions } from '../../common/rbac/access-catalog';
import { seedDemoUsers } from './users.seed';

const SEED_ADMIN_EMAIL = 'admin@exchange.com';
const SEED_ADMIN_PASSWORD = 'ChangeMe!Admin1';

const P = Permission;

const ALL_CRUD = grantsToPermissions(
  ACCESS_MODULES.map((item) => ({ module: item.key, actions: ['read', 'create', 'update', 'delete'] })),
);

const ROLE_PERMISSIONS: Record<Role, { description: string; permissions: Permission[] }> = {
  [Role.SUPER_ADMIN]: { description: 'Super administrador', permissions: Object.values(P) },
  [Role.ADMIN]: { description: 'Administrador', permissions: ALL_CRUD },
  [Role.SUPPORT]: {
    description: 'Soporte',
    permissions: grantsToPermissions([{ module: 'users', actions: ['read'] }]),
  },
  [Role.OPERATIONS]: {
    description: 'Operador',
    permissions: grantsToPermissions([{ module: 'users', actions: ['read', 'update'] }]),
  },
  [Role.COMPLIANCE_OFFICER]: {
    description: 'Compliance',
    permissions: grantsToPermissions([{ module: 'users', actions: ['read'] }]),
  },
  [Role.TREASURY]: {
    description: 'Tesorería',
    permissions: grantsToPermissions([{ module: 'users', actions: ['read'] }]),
  },
  [Role.AUDITOR]: {
    description: 'Auditor',
    permissions: grantsToPermissions(
      ACCESS_MODULES.map((item) => ({ module: item.key, actions: ['read'] })),
    ),
  },
};

async function run(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está definida');
  const prisma = new PrismaClient();

  try {
    for (const [name, role] of Object.entries(ROLE_PERMISSIONS)) {
      await prisma.accessRole.upsert({
        where: { name },
        update: {},
        create: { name, description: role.description, permissions: role.permissions },
      });
    }
    console.log(`Roles sincronizados: ${Object.keys(ROLE_PERMISSIONS).length}`);

    const email = SEED_ADMIN_EMAIL.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!exists) {
      await prisma.user.create({
        data: {
          email,
          firstName: 'Super',
          lastName: 'Admin',
          passwordHash: await bcrypt.hash(SEED_ADMIN_PASSWORD, 12),
          roles: [Role.SUPER_ADMIN],
        },
      });
      console.log(`Super admin creado: ${email}`);
    } else {
      console.log(`Super admin ya existe: ${email}`);
    }

    await seedDemoUsers(prisma);
    console.log('Seed completado');
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
