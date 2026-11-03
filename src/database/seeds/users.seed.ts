import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';

const PASSWORD_POLICY = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s])/;
const DEMO_USER_PASSWORD = 'ChangeMe!Users1';

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

export async function seedDemoUsers(prisma: PrismaClient): Promise<void> {
  if (DEMO_USER_PASSWORD.length < 12 || !PASSWORD_POLICY.test(DEMO_USER_PASSWORD)) {
    console.warn(
      'Contraseña de usuarios de prueba inválida (12+ con mayúscula, minúscula, número y símbolo): se omiten',
    );
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_USER_PASSWORD, 12);
  for (const demo of DEMO_USERS) {
    const email = demo.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) {
      console.log(`Usuario ya existe: ${email}`);
      continue;
    }
    await prisma.user.create({
      data: {
        email,
        firstName: demo.firstName,
        lastName: demo.lastName,
        passwordHash,
        roles: demo.roles,
      },
    });
    console.log(`Usuario creado: ${email} [${demo.roles.join(', ')}]`);
  }
}
