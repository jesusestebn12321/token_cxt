import { registerAs } from '@nestjs/config';

export default registerAs('blockchain', () => ({
  defaultChainId: parseInt(process.env.EVM_DEFAULT_CHAIN_ID ?? '11155111', 10),
  rpcUrl: process.env.EVM_RPC_URL ?? '',
}));
