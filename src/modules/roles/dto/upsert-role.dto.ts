import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ACCESS_ACTIONS, ACCESS_MODULES, AccessAction } from '../../../common/rbac/access-catalog';

const MODULE_KEYS = ACCESS_MODULES.map((item) => item.key);

export class ModuleGrantDto {
  @ApiProperty({ enum: MODULE_KEYS, example: 'users' })
  @IsIn(MODULE_KEYS)
  module!: (typeof MODULE_KEYS)[number];

  @ApiProperty({ enum: ACCESS_ACTIONS, isArray: true, example: ['read', 'update'] })
  @IsArray()
  @ArrayUnique()
  @IsIn(ACCESS_ACTIONS, { each: true })
  actions!: AccessAction[];
}

export class UpsertRoleDto {
  @ApiProperty({ example: 'SUPPORT', description: 'Soporte, Administrador u Operador usan SUPPORT, ADMIN y OPERATIONS' })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,40}$/, { message: 'El nombre del rol va en mayúsculas, por ejemplo SUPPORT' })
  name!: string;

  @ApiPropertyOptional({ example: 'Soporte' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ type: [ModuleGrantDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleGrantDto)
  grants!: ModuleGrantDto[];
}
