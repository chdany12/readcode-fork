export interface Account {
  id: string;
  customerId: string;
  currency: string;
  balanceMinor: number;
  frozen: boolean;
}

export interface AccountRepo {
  findById(id: string): Promise<Account | null>;
}

export interface TransferCommand {
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  initiatedBy: string;
}

export interface TransferResult {
  transferId: string;
  replayed: boolean;
}

export interface TransferService {
  // Debits and credits in one DB transaction; rejects with InsufficientFunds if needed.
  execute(cmd: TransferCommand): Promise<TransferResult>;
}
