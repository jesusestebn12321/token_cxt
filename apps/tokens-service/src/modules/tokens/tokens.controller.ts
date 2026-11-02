import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { PaginationQueryDto } from '@app/common/dto/pagination-query.dto';
import { CreateTokenDto } from './dto/create-token.dto';
import { RegisterContractDto } from './dto/register-contract.dto';
import { UpdateTokenStatusDto } from './dto/update-token-status.dto';
import { TokensService } from './tokens.service';

class TokenIdPayload {
  @IsString()
  @IsNotEmpty()
  readonly id!: string;
}

class UpdateTokenStatusPayload extends UpdateTokenStatusDto {
  @IsString()
  @IsNotEmpty()
  readonly id!: string;
}

class RegisterContractPayload {
  @IsString()
  @IsNotEmpty()
  readonly id!: string;

  @ValidateNested()
  @Type(() => RegisterContractDto)
  readonly dto!: RegisterContractDto;
}

@Controller()
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @MessagePattern({ cmd: 'tokens.findAll' })
  findAll(@Payload() query: PaginationQueryDto) {
    return this.tokensService.findAll(query);
  }

  @MessagePattern({ cmd: 'tokens.findOne' })
  findOne(@Payload() payload: TokenIdPayload) {
    return this.tokensService.findOne(payload.id);
  }

  @MessagePattern({ cmd: 'tokens.create' })
  create(@Payload() dto: CreateTokenDto) {
    return this.tokensService.create(dto);
  }

  @MessagePattern({ cmd: 'tokens.updateStatus' })
  updateStatus(@Payload() payload: UpdateTokenStatusPayload) {
    return this.tokensService.updateStatus(payload.id, payload);
  }

  @MessagePattern({ cmd: 'tokens.registerContract' })
  registerContract(@Payload() payload: RegisterContractPayload) {
    return this.tokensService.registerContract(payload.id, payload.dto);
  }

  @MessagePattern({ cmd: 'tokens.syncContract' })
  syncContract(@Payload() payload: TokenIdPayload) {
    return this.tokensService.syncContract(payload.id);
  }
}
