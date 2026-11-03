import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { STRONG_PASSWORD, STRONG_PASSWORD_MESSAGE } from '../../../common/validators/password.constants';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token opaco devuelto al solicitar la recuperación' })
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(STRONG_PASSWORD, { message: STRONG_PASSWORD_MESSAGE })
  password!: string;
}
