import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';

/** Solo lectura: no existen endpoints de escritura/edición/borrado. */
@ApiTags('Audit')
@ApiBearerAuth('access-token')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Permissions(Permission.AUDIT_READ)
  findAll(@Query() query: QueryAuditDto) {
    return this.auditService.findAll(query);
  }

  @Get('verify')
  @Permissions(Permission.AUDIT_READ)
  verify() {
    return this.auditService.verifyChain();
  }
}
