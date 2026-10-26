/** ABI mínimo (human-readable, ethers v6) para lectura de estado on-chain. */
export const ERC20_READ_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function paused() view returns (bool)',
] as const;
