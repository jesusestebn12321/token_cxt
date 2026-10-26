import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractService } from './blockchain/contract.service';
import { EvmProviderService } from './blockchain/evm-provider.service';
import { SmartContract } from './entities/smart-contract.entity';
import { Token } from './entities/token.entity';
import { TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';

@Module({
  imports: [TypeOrmModule.forFeature([Token, SmartContract])],
  controllers: [TokensController],
  providers: [TokensService, EvmProviderService, ContractService],
  exports: [TokensService, ContractService],
})
export class TokensModule {}
