import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TwoFactorService } from './two-factor/two-factor.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // Los secretos y expiraciones se pasan por token en AuthService (access/refresh/2fa)
    JwtModule.register({}),
    TypeOrmModule.forFeature([RefreshToken]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TwoFactorService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
