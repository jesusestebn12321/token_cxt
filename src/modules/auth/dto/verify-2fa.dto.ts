import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class VerifyTwoFactorDto {
  @ApiProperty({ description: 'Token temporal devuelto por /auth/login' })
  @IsString()
  twoFactorToken!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}
