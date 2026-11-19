export interface ReceivedMessage {
  body: string;
  receiptHandle: string;
  receiveCount: number;
}

export interface ReceiveOptions {
  maxMessages: number;
  visibilityTimeoutSeconds: number;
  waitTimeSeconds: number;
}

export interface SqsLikeQueue {
  receive(opts: ReceiveOptions): Promise<ReceivedMessage[]>;
  changeVisibility(receiptHandle: string, seconds: number): Promise<void>;
  delete(receiptHandle: string): Promise<void>;
  moveToDeadLetter(receiptHandle: string, reason: string): Promise<void>;
}
