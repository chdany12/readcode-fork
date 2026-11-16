export class AccountNotFoundError extends Error {
  constructor(public readonly accountId: string) {
    super(`account ${accountId} not found`);
    this.name = "AccountNotFoundError";
  }
}

export class InsufficientFundsError extends Error {
  constructor(public readonly accountId: string, public readonly shortfallMinor: bigint) {
    super(`account ${accountId} has insufficient funds`);
    this.name = "InsufficientFundsError";
  }
}

export class AccountFrozenError extends Error {
  constructor(public readonly accountId: string) {
    super(`account ${accountId} is frozen`);
    this.name = "AccountFrozenError";
  }
}

export class ValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
