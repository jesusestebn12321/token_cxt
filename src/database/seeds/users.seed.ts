import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../modules/users/schemas/user.schema';

/** Misma política que CreateUserDto.password. */
const PASSWORD_POLICY = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s])/;

/**
 * Un usuario de backoffice por rol operativo.
 * El super admin lo crea run-seed.ts con SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 * Todos comparten SEED_USER_PASSWORD. Si el email ya existe, no se toca.
 */
export const DEMO_USERS: Array<{
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
}> = [
  { email: 'maria.admin@exchange.com', firstName: 'María', lastName: 'Admin', roles: [Role.ADMIN] },
  { email: 'carlos.compliance@exchange.com', firstName: 'Carlos', lastName: 'Compliance', roles: [Role.COMPLIANCE_OFFICER] },
  { email: 'laura.ops@exchange.com', firstName: 'Laura', lastName: 'Operaciones', roles: [Role.OPERATIONS] },
  { email: 'pedro.treasury@exchange.com', firstName: 'Pedro', lastName: 'Tesorería', roles: [Role.TREASURY] },
  { email: 'ana.auditor@exchange.com', firstName: 'Ana', lastName: 'Auditora', roles: [Role.AUDITOR] },
  { email: 'sofia.support@exchange.com', firstName: 'Sofía', lastName: 'Soporte', roles: [Role.SUPPORT] },
];

export async function seedDemoUsers(users: Model<User>, password: string): Promise<void> {
  if (password.length < 12 || !PASSWORD_POLICY.test(password)) {
    console.warn(
      'SEED_USER_PASSWORD ausente o inválida (12+ con mayúscula, minúscula, número y símbolo): se omiten los usuarios de prueba',
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  for (const demo of DEMO_USERS) {
    const email = demo.email.toLowerCase();
    if (await users.exists({ email })) {
      console.log(`Usuario ya existe: ${email}`);
      continue;
    }
    await users.create({
      email,
      firstName: demo.firstName,
      lastName: demo.lastName,
      passwordHash,
      roles: demo.roles,
    });
    console.log(`Usuario creado: ${email} [${demo.roles.join(', ')}]`);
  }
}
