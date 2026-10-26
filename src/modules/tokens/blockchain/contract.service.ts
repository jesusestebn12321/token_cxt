import { Injectable } from '@nestjs/common';
import { Contract, getAddress } from 'ethers';
import { ERC20_READ_ABI } from './abis/erc20.abi';
import { EvmProviderService } from './evm-provider.service';

export interface OnChainTokenState {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  paused: boolean | null;
}

/**
 * Operaciones de LECTURA on-chain. Las operaciones de escritura (mint, burn, pause,
 * whitelist) NO deben firmarse con una clave en el backend: usar un firmante
 * gestionado (KMS/HSM) o un multisig (Safe) con flujo de aprobación.
 */
@Injectable()
export class ContractService {
  constructor(private readonly evm: EvmProviderService) {}

  normalizeAddress(address: string): string {
    return getAddress(address); // lanza error si es inválida; devuelve checksum
  }

  async readTokenState(address: string, chainId?: number): Promise<OnChainTokenState> {
    const contract = new Contract(
      this.normalizeAddress(address),
      ERC20_READ_ABI,
      this.evm.getProvider(chainId),
    );

    const [name, symbol, decimals, totalSupply, paused] = await Promise.all([
      contract.getFunction('name')() as Promise<string>,
      contract.getFunction('symbol')() as Promise<string>,
      contract.getFunction('decimals')() as Promise<bigint>,
      contract.getFunction('totalSupply')() as Promise<bigint>,
      (contract.getFunction('paused')() as Promise<boolean>).catch(() => null),
    ]);

    return {
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply: totalSupply.toString(),
      paused,
    };
  }
}
