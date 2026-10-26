import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Permission } from '../../common/enums/permission.enum';
import { Role } from '../../common/enums/role.enum';
import { AccessRole, AccessRoleSchema } from '../../modules/users/schemas/role.schema';
import { User, UserSchema } from '../../modules/users/schemas/user.schema';

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
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI no está definida');

  await mongoose.connect(uri);
  const Roles = mongoose.model(AccessRole.name, AccessRoleSchema);
  const Users = mongoose.model(User.name, UserSchema);
  await Promise.all([Roles.init(), Users.init()]); // crea índices únicos

  // 1) Roles con sus permisos (upsert idempotente)
  for (const [name, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    await Roles.updateOne({ name }, { $set: { permissions } }, { upsert: true });
  }
  console.log(`Roles sincronizados: ${Object.keys(ROLE_PERMISSIONS).length}`);

  // 2) Super admin inicial (cambiar la contraseña tras el primer login)
  const email = (process.env.SEED_ADMIN_EMAIL ?? '').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? '';
  if (email && password.length >= 12) {
    if (!(await Users.exists({ email }))) {
      await Users.create({
        email,
        firstName: 'Super',
        lastName: 'Admin',
        passwordHash: await bcrypt.hash(password, 12),
        roles: [Role.SUPER_ADMIN],
      });
      console.log(`Super admin creado: ${email}`);
    } else {
      console.log(`Super admin ya existe: ${email}`);
    }
  } else {
    console.warn('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (>=12 chars) no definidos: se omite el super admin');
  }

  await mongoose.disconnect();
  console.log('Seed completado');
}

run().catch(async (err: unknown) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
