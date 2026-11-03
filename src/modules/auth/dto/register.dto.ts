import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { STRONG_PASSWORD, STRONG_PASSWORD_MESSAGE } from '../../../common/validators/password.constants';

export class RegisterDto {
  @ApiProperty({ example: 'ana@exchange.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(STRONG_PASSWORD, { message: STRONG_PASSWORD_MESSAGE })
  password!: string;
}
