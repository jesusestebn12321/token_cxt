import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonRpcProvider } from 'ethers';

/**
 * Gestiona proveedores JSON-RPC por chainId.
 * Para multi-chain: leer un mapa chainId→RPC desde config/DB en vez de una sola URL.
 */
@Injectable()
export class EvmProviderService implements OnModuleDestroy {
  private readonly providers = new Map<number, JsonRpcProvider>();

  constructor(private readonly config: ConfigService) {}

  getProvider(chainId?: number): JsonRpcProvider {
    const id = chainId ?? this.config.getOrThrow<number>('blockchain.defaultChainId');
    const cached = this.providers.get(id);
    if (cached) return cached;

    const rpcUrl = this.config.getOrThrow<string>('blockchain.rpcUrl');
    if (!rpcUrl) throw new Error('EVM_RPC_URL no está configurado');

    const provider = new JsonRpcProvider(rpcUrl, id, { staticNetwork: true });
    this.providers.set(id, provider);
    return provider;
  }

  onModuleDestroy(): void {
    this.providers.forEach((p) => p.destroy());
    this.providers.clear();
  }
}
