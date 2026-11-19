import {
  DynamoDBDocumentClient,
  QueryCommand,
  TransactWriteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

export interface FileVersion {
  workspaceId: string;
  fileId: string;
  version: number;
  blobKey: string;
  sizeBytes: number;
  checksum: string;
  modifiedBy: string;
  modifiedAt: string;
}

const TABLE = process.env.SYNC_TABLE ?? "sync-metadata";

const filePk = (workspaceId: string, fileId: string) => `WS#${workspaceId}#FILE#${fileId}`;
const versionSk = (n: number) => `VER#${n}`;
const HEAD_SK = "HEAD";

export class FileVersionStore {
  constructor(private readonly db: DynamoDBDocumentClient) {}

  async latestVersion(workspaceId: string, fileId: string): Promise<FileVersion | null> {
    const out = await this.db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :ver)",
        ExpressionAttributeValues: { ":pk": filePk(workspaceId, fileId), ":ver": "VER#" },
        ScanIndexForward: false,
        Limit: 1,
      }),
    );
    return (out.Items?.[0] as FileVersion | undefined) ?? null;
  }

  async listVersions(workspaceId: string, fileId: string, limit = 20): Promise<FileVersion[]> {
    const out = await this.db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :ver)",
        ExpressionAttributeValues: { ":pk": filePk(workspaceId, fileId), ":ver": "VER#" },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items ?? []) as FileVersion[];
  }

  async headVersionNumber(workspaceId: string, fileId: string): Promise<number> {
    const out = await this.db.send(
      new GetCommand({ TableName: TABLE, Key: { pk: filePk(workspaceId, fileId), sk: HEAD_SK } }),
    );
    return (out.Item?.version as number | undefined) ?? 0;
  }

  async commitVersion(v: Omit<FileVersion, "version">, expectedHead: number): Promise<number> {
    const next = expectedHead + 1;
    const pk = filePk(v.workspaceId, v.fileId);
    await this.db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLE,
              Item: { pk, sk: versionSk(next), ...v, version: next },
              ConditionExpression: "attribute_not_exists(pk)",
            },
          },
          {
            Put: {
              TableName: TABLE,
              Item: { pk, sk: HEAD_SK, version: next, updatedAt: v.modifiedAt },
              ConditionExpression: "attribute_not_exists(pk) OR version = :expected",
              ExpressionAttributeValues: { ":expected": expectedHead },
            },
          },
        ],
      }),
    );
    return next;
  }
}
