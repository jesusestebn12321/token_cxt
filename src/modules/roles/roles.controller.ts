import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { catalog } from '../../common/rbac/access-catalog';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';
import { UpsertRoleDto } from './dto/upsert-role.dto';
import { RolesService } from './roles.service';

@ApiTags('Roles')
@ApiBearerAuth('access-token')
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get('catalog')
  @Permissions(Permission.USERS_READ)
  catalog() {
    return catalog();
  }

  @Get()
  @Permissions(Permission.USERS_READ)
  findAll() {
    return this.roles.findAll();
  }

  @Get(':id')
  @Permissions(Permission.USERS_READ)
  findOne(@Param('id', ParseUuidPipe) id: string) {
    return this.roles.findOne(id);
  }

  @Post()
  @Permissions(Permission.USERS_CREATE)
  create(@Body() dto: UpsertRoleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.roles.create(dto, actor.roles);
  }

  @Put(':id')
  @Permissions(Permission.USERS_UPDATE)
  update(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpsertRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.roles.update(id, dto, actor.roles);
  }

  @Delete(':id')
  @Permissions(Permission.USERS_DELETE)
  remove(@Param('id', ParseUuidPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.roles.remove(id, actor.roles);
  }
}
