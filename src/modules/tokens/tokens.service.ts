import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, mongo } from 'mongoose';
import { oid } from '../../common/database/object-id';
import { Paginated, PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto';
import { ContractService, OnChainTokenState } from './blockchain/contract.service';
import { CreateTokenDto } from './dto/create-token.dto';
import { RegisterContractDto } from './dto/register-contract.dto';
import { UpdateTokenStatusDto } from './dto/update-token-status.dto';
import { SmartContract, SmartContractDocument } from './schemas/smart-contract.schema';
import { Token, TokenDocument } from './schemas/token.schema';

const isDuplicate = (error: unknown): boolean =>
  error instanceof mongo.MongoServerError && error.code === 11000;

@Injectable()
export class TokensService {
  constructor(
    @InjectModel(Token.name) private readonly tokens: Model<Token>,
    @InjectModel(SmartContract.name) private readonly contracts: Model<SmartContract>,
    private readonly contractService: ContractService,
  ) {}

  async create(dto: CreateTokenDto): Promise<TokenDocument> {
    try {
      return await this.tokens.create({
        symbol: dto.symbol,
        name: dto.name,
        assetClass: dto.assetClass,
        description: dto.description ?? null,
        decimals: dto.decimals ?? 18,
        maxSupply: dto.maxSupply,
      });
    } catch (error) {
      if (isDuplicate(error)) throw new ConflictException(`El símbolo ${dto.symbol} ya existe`);
      throw error;
    }
  }

  async findAll(query: PaginationQueryDto): Promise<Paginated<TokenDocument>> {
    const [items, total] = await Promise.all([
      this.tokens.find().sort({ createdAt: -1 }).skip(query.skip).limit(query.limit),
      this.tokens.countDocuments(),
    ]);
    return paginate(items, total, query);
  }

  /** Token + contratos desplegados. */
  async findOne(id: string): Promise<Record<string, unknown>> {
    const token = await this.getOrFail(id);
    const contracts = await this.contracts.find({ tokenId: token._id });
    return { ...token.toJSON(), contracts };
  }

  async updateStatus(id: string, dto: UpdateTokenStatusDto): Promise<TokenDocument> {
    const token = await this.tokens.findByIdAndUpdate(id, { $set: { status: dto.status } }, { returnDocument: 'after' });
    if (!token) throw new NotFoundException('Token no encontrado');
    return token;
  }

  async registerContract(tokenId: string, dto: RegisterContractDto): Promise<SmartContractDocument> {
    await this.getOrFail(tokenId);
    const address = this.contractService.normalizeAddress(dto.address);
    try {
      return await this.contracts.create({
        tokenId: oid(tokenId),
        chainId: dto.chainId,
        address,
        standard: dto.standard,
        deployTxHash: dto.deployTxHash ?? null,
      });
    } catch (error) {
      if (isDuplicate(error)) throw new ConflictException('El contrato ya está registrado en esa red');
      throw error;
    }
  }

  /** Lee el estado on-chain y sincroniza el flag `isPaused` en BD. */
  async syncContract(
    contractId: string,
  ): Promise<{ contract: SmartContractDocument; onChain: OnChainTokenState }> {
    const existing = await this.contracts.findById(contractId);
    if (!existing) throw new NotFoundException('Contrato no encontrado');

    const onChain = await this.contractService.readTokenState(existing.address, existing.chainId);
    const contract = await this.contracts.findByIdAndUpdate(
      contractId,
      { $set: { isPaused: onChain.paused ?? existing.isPaused, lastSyncedAt: new Date() } },
      { returnDocument: 'after' },
    );
    return { contract: contract ?? existing, onChain };
  }

  private async getOrFail(id: string): Promise<TokenDocument> {
    const token = await this.tokens.findById(id);
    if (!token) throw new NotFoundException('Token no encontrado');
    return token;
  }
}
