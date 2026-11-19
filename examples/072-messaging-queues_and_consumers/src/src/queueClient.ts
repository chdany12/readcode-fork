export interface ReceivedMessage {
  id: string;
  body: string;
  receiptHandle: string;
  receiveCount: number;
}

export interface QueueClient {
  receive(queue: string, max: number, waitSec: number): Promise<ReceivedMessage[]>;
  ack(queue: string, receiptHandle: string): Promise<void>;
  changeVisibility(queue: string, receiptHandle: string, timeoutSec: number): Promise<void>;
  send(queue: string, body: string, attributes: Record<string, string>): Promise<void>;
}
