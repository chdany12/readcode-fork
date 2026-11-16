export interface QueueMessage<T> {
  id: string;
  body: T;
  deliveryCount: number;
}

export interface QueueClient<T> {
  receive(max: number, waitMs: number): Promise<QueueMessage<T>[]>;
  ack(id: string): Promise<void>;
  nack(id: string, delayMs: number): Promise<void>;
  deadLetter(id: string, reason: string): Promise<void>;
}

export interface PostPublished {
  postId: string;
  authorId: string;
  publishedAt: string;
}
