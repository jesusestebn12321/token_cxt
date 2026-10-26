import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import dataSource from '../data-source';
import { Permission } from '../../common/enums/permission.enum';
import { Role } from '../../common/enums/role.enum';
import { PermissionEntity } from '../../modules/users/entities/permission.entity';
import { RoleEntity } from '../../modules/users/entities/role.entity';
import { User } from '../../modules/users/entities/user.entity';

const P = Permission;

/** Matriz rol → permisos. SUPER_ADMIN tiene bypass en los guards. */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: Object.values(P),
  [Role.ADMIN]: [P.USERS_READ, P.USERS_WRITE, P.TOKENS_READ, P.TOKENS_WRITE, P.WALLETS_READ, P.TRANSACTIONS_READ, P.KYC_READ],
  [Role.COMPLIANCE_OFFICER]: [P.KYC_READ, P.KYC_REVIEW, P.WALLETS_READ, P.WALLETS_LOCK_FUNDS, P.TRANSACTIONS_READ, P.LEDGER_READ],
  [Role.OPERATIONS]: [P.TRANSACTIONS_READ, P.TRANSACTIONS_APPROVE, P.WALLETS_READ, P.TOKENS_READ],
  [Role.TREASURY]: [P.TRANSACTIONS_READ, P.TRANSACTIONS_APPROVE, P.WALLETS_READ, P.LEDGER_READ, P.TOKENS_READ, P.TOKENS_CONTRACT_OPERATE],
  [Role.AUDITOR]: [P.AUDIT_READ, P.USERS_READ, P.KYC_READ, P.TOKENS_READ, P.WALLETS_READ, P.LEDGER_READ, P.TRANSACTIONS_READ],
  [Role.SUPPORT]: [P.USERS_READ, P.KYC_READ, P.WALLETS_READ, P.TRANSACTIONS_READ],
};

async function run(): Promise<void> {
  await dataSource.initialize();
  const permRepo = dataSource.getRepository(PermissionEntity);
  const roleRepo = dataSource.getRepository(RoleEntity);
  const userRepo = dataSource.getRepository(User);

  // 1) Permisos
  const permsByCode = new Map<string, PermissionEntity>();
  for (const code of Object.values(Permission)) {
    const existing = await permRepo.findOne({ where: { code } });
    permsByCode.set(code, existing ?? (await permRepo.save(permRepo.create({ code, description: null }))));
  }

  // 2) Roles con sus permisos
  const rolesByName = new Map<string, RoleEntity>();
  for (const [name, codes] of Object.entries(ROLE_PERMISSIONS)) {
    const role =
      (await roleRepo.findOne({ where: { name } })) ??
      roleRepo.create({ name, description: null });
    role.permissions = codes.map((c) => permsByCode.get(c) as PermissionEntity);
    rolesByName.set(name, await roleRepo.save(role));
  }

  // 3) Super admin inicial (cambiar la contraseña tras el primer login)
  const email = (process.env.SEED_ADMIN_EMAIL ?? '').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? '';
  if (email && password.length >= 12) {
    if (!(await userRepo.exists({ where: { email } }))) {
      await userRepo.save(
        userRepo.create({
          email,
          firstName: 'Super',
          lastName: 'Admin',
          passwordHash: await bcrypt.hash(password, 12),
          roles: [rolesByName.get(Role.SUPER_ADMIN) as RoleEntity],
        }),
      );
      console.log(`Super admin creado: ${email}`);
    }
  } else {
    console.warn('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (>=12 chars) no definidos: se omite el super admin');
  }

  await dataSource.destroy();
  console.log('Seed completado');
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
