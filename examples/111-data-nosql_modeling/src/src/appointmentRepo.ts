import {
  DynamoDBDocumentClient,
  QueryCommand,
  TransactWriteCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.SCHEDULING_TABLE ?? "clinic-scheduling";

export interface Appointment {
  appointmentId: string;
  clinicId: string;
  providerId: string;
  patientId: string;
  slotStart: string;
  durationMin: number;
  reason: string;
}

const providerPk = (clinicId: string, providerId: string) => `CLINIC#${clinicId}#PROV#${providerId}`;
const slotSk = (slotStart: string) => `SLOT#${slotStart}`;
const patientPk = (patientId: string) => `PAT#${patientId}`;

export class SlotConflictError extends Error {}

export class AppointmentRepo {
  constructor(private readonly db: DynamoDBDocumentClient) {}

  async providerDay(clinicId: string, providerId: string, date: string): Promise<Appointment[]> {
    const out = await this.db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :day)",
        ExpressionAttributeValues: {
          ":pk": providerPk(clinicId, providerId),
          ":day": `SLOT#${date}`,
        },
      }),
    );
    return (out.Items ?? []) as Appointment[];
  }

  async patientUpcoming(patientId: string, fromIso: string): Promise<Appointment[]> {
    const out = await this.db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "pk = :pk AND sk >= :from",
        ExpressionAttributeValues: { ":pk": patientPk(patientId), ":from": `APPT#${fromIso}` },
      }),
    );
    return (out.Items ?? []) as Appointment[];
  }

  async book(a: Appointment): Promise<void> {
    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: TABLE,
                Item: { pk: providerPk(a.clinicId, a.providerId), sk: slotSk(a.slotStart), ...a },
              },
            },
            {
              Put: {
                TableName: TABLE,
                Item: {
                  pk: patientPk(a.patientId),
                  sk: `APPT#${a.slotStart}#${a.appointmentId}`,
                  ...a,
                },
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
          ],
        }),
      );
    } catch (err) {
      if ((err as { name?: string }).name === "TransactionCanceledException") {
        throw new SlotConflictError(`slot ${a.slotStart} unavailable for ${a.providerId}`);
      }
      throw err;
    }
  }

  async recordAudit(a: Appointment, actor: string): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          pk: `AUDIT#${a.appointmentId}`,
          sk: `TS#${new Date().toISOString()}`,
          actor,
          action: "BOOKED",
        },
      }),
    );
  }
}
