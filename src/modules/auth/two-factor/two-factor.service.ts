import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';

@Injectable()
export class TwoFactorService {
  constructor(private readonly config: ConfigService) {
    authenticator.options = { window: 1 }; // tolera ±30s de desfase de reloj
  }

  generateSecret(): string {
    return authenticator.generateSecret();
  }

  buildOtpAuthUrl(accountEmail: string, secret: string): string {
    const issuer = this.config.getOrThrow<string>('jwt.twoFactorIssuer');
    return authenticator.keyuri(accountEmail, issuer, secret);
  }

  verify(code: string, secret: string): boolean {
    try {
      return authenticator.verify({ token: code, secret });
    } catch {
      return false;
    }
  }
}
