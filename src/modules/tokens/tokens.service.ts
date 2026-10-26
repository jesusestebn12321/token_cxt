import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated, PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto';
import { ContractService, OnChainTokenState } from './blockchain/contract.service';
import { CreateTokenDto } from './dto/create-token.dto';
import { RegisterContractDto } from './dto/register-contract.dto';
import { UpdateTokenStatusDto } from './dto/update-token-status.dto';
import { SmartContract } from './entities/smart-contract.entity';
import { Token } from './entities/token.entity';

@Injectable()
export class TokensService {
  constructor(
    @InjectRepository(Token) private readonly tokensRepo: Repository<Token>,
    @InjectRepository(SmartContract) private readonly contractsRepo: Repository<SmartContract>,
    private readonly contractService: ContractService,
  ) {}

  async create(dto: CreateTokenDto): Promise<Token> {
    if (await this.tokensRepo.exists({ where: { symbol: dto.symbol } })) {
      throw new ConflictException(`El símbolo ${dto.symbol} ya existe`);
    }
    return this.tokensRepo.save(
      this.tokensRepo.create({
        symbol: dto.symbol,
        name: dto.name,
        assetClass: dto.assetClass,
        description: dto.description ?? null,
        decimals: dto.decimals ?? 18,
        maxSupply: dto.maxSupply,
      }),
    );
  }

  async findAll(query: PaginationQueryDto): Promise<Paginated<Token>> {
    const [items, total] = await this.tokensRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    return paginate(items, total, query);
  }

  async findOne(id: string): Promise<Token> {
    const token = await this.tokensRepo.findOne({ where: { id }, relations: { contracts: true } });
    if (!token) throw new NotFoundException('Token no encontrado');
    return token;
  }

  async updateStatus(id: string, dto: UpdateTokenStatusDto): Promise<Token> {
    const token = await this.findOne(id);
    token.status = dto.status;
    return this.tokensRepo.save(token);
  }

  async registerContract(tokenId: string, dto: RegisterContractDto): Promise<SmartContract> {
    await this.findOne(tokenId);
    const address = this.contractService.normalizeAddress(dto.address);

    if (await this.contractsRepo.exists({ where: { chainId: dto.chainId, address } })) {
      throw new ConflictException('El contrato ya está registrado en esa red');
    }
    return this.contractsRepo.save(
      this.contractsRepo.create({
        tokenId,
        chainId: dto.chainId,
        address,
        standard: dto.standard,
        deployTxHash: dto.deployTxHash ?? null,
      }),
    );
  }

  /** Lee el estado on-chain y sincroniza el flag `isPaused` en BD. */
  async syncContract(contractId: string): Promise<{ contract: SmartContract; onChain: OnChainTokenState }> {
    const contract = await this.contractsRepo.findOne({ where: { id: contractId } });
    if (!contract) throw new NotFoundException('Contrato no encontrado');

    const onChain = await this.contractService.readTokenState(contract.address, contract.chainId);
    contract.isPaused = onChain.paused ?? contract.isPaused;
    contract.lastSyncedAt = new Date();
    await this.contractsRepo.save(contract);
    return { contract, onChain };
  }
}
