import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContractService } from './blockchain/contract.service';
import { EvmProviderService } from './blockchain/evm-provider.service';
import { SmartContract, SmartContractSchema } from './schemas/smart-contract.schema';
import { Token, TokenSchema } from './schemas/token.schema';
import { TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Token.name, schema: TokenSchema },
      { name: SmartContract.name, schema: SmartContractSchema },
    ]),
  ],
  controllers: [TokensController],
  providers: [TokensService, EvmProviderService, ContractService],
  exports: [TokensService, ContractService],
})
export class TokensModule {}
