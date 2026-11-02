import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ParseObjectIdPipe } from '@app/common/pipes/parse-object-id.pipe';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@app/common/decorators/audit-action.decorator';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';
import { Permissions } from '@app/common/decorators/permissions.decorator';
import { AuthenticatedUser } from '@app/common/interfaces/jwt-payload.interface';
import { PaginationQueryDto } from '@app/common/dto/pagination-query.dto';
import { Permission } from '@app/common/enums/permission.enum';
import { TwoFactorGuard } from '@app/common/guards/two-factor.guard';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions(Permission.USERS_READ)
  findAll(@Query() query: PaginationQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @Permissions(Permission.USERS_READ)
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @Permissions(Permission.USERS_WRITE)
  @UseGuards(TwoFactorGuard)
  @AuditAction('USER_CREATED', 'user')
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.create(dto, actor.roles);
  }

  @Patch(':id')
  @Permissions(Permission.USERS_WRITE)
  @AuditAction('USER_UPDATED', 'user')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Put(':id/roles')
  @Permissions(Permission.USERS_ASSIGN_ROLES)
  @UseGuards(TwoFactorGuard)
  @AuditAction('USER_ROLES_ASSIGNED', 'user')
  assignRoles(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AssignRolesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.assignRoles(id, dto, actor.roles);
  }
}
