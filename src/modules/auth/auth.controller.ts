import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { AuthService, RequestContext } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyTwoFactorDto } from './dto/verify-2fa.dto';
import { EnableTwoFactorDto } from './two-factor/dto/enable-2fa.dto';

const ctxOf = (req: Request): RequestContext => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, ctxOf(req));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  verifyTwoFactor(@Body() dto: VerifyTwoFactorDto, @Req() req: Request) {
    return this.authService.verifyTwoFactorLogin(dto.twoFactorToken, dto.code, ctxOf(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, ctxOf(req));
  }

  @ApiBearerAuth('access-token')
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @ApiBearerAuth('access-token')
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @ApiBearerAuth('access-token')
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  setupTwoFactor(@CurrentUser('id') userId: string) {
    return this.authService.setupTwoFactor(userId);
  }

  @ApiBearerAuth('access-token')
  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  enableTwoFactor(@CurrentUser('id') userId: string, @Body() dto: EnableTwoFactorDto) {
    return this.authService.enableTwoFactor(userId, dto.code);
  }
}
