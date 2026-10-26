export enum TransactionStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PROCESSING = 'PROCESSING', // enviada on-chain, esperando confirmaciones
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum ApprovalDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}
