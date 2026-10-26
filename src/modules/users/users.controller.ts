import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Permission } from '../../common/enums/permission.enum';
import { TwoFactorGuard } from '../../common/guards/two-factor.guard';
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
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
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
  assignRoles(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: AssignRolesDto) {
    return this.usersService.assignRoles(id, dto);
  }
}
