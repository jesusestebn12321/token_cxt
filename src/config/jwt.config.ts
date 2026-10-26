import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET as string,
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET as string,
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  twoFactorExpiresIn: process.env.JWT_TWO_FACTOR_EXPIRES_IN ?? '5m',
  twoFactorIssuer: process.env.TWO_FACTOR_ISSUER ?? 'RWA Exchange Backoffice',
}));
