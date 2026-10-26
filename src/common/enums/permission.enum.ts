export enum Permission {
  // Users / RBAC
  USERS_READ = 'users:read',
  USERS_WRITE = 'users:write',
  USERS_ASSIGN_ROLES = 'users:assign-roles',

  // KYC / AML
  KYC_READ = 'kyc:read',
  KYC_REVIEW = 'kyc:review',

  // Tokens / contratos
  TOKENS_READ = 'tokens:read',
  TOKENS_WRITE = 'tokens:write',
  TOKENS_CONTRACT_OPERATE = 'tokens:contract-operate',

  // Wallets / ledger
  WALLETS_READ = 'wallets:read',
  WALLETS_LOCK_FUNDS = 'wallets:lock-funds',
  LEDGER_READ = 'ledger:read',

  // Transacciones
  TRANSACTIONS_READ = 'transactions:read',
  TRANSACTIONS_APPROVE = 'transactions:approve',

  // Auditoría
  AUDIT_READ = 'audit:read',
}
