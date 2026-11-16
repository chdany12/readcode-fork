import { randomUUID } from "crypto";
import { Ledger, Posting } from "./ledger";

export interface CompletedVisit {
  appointmentId: string;
  patientId: string;
  payerId: string | null;
  allowedAmountCents: number;
  copayCents: number;
  coinsuranceRate: number;
}

export class VisitBillingService {
  constructor(private readonly ledger: Ledger) {}

  async billVisit(visit: CompletedVisit): Promise<void> {
    if (visit.allowedAmountCents <= 0) throw new Error("allowed amount must be positive");
    if (visit.coinsuranceRate < 0 || visit.coinsuranceRate > 1) {
      throw new Error("coinsurance rate out of range");
    }

    const postings: Posting[] = [
      { account: "revenue:clinical", amountCents: -visit.allowedAmountCents },
    ];

    if (visit.payerId === null) {
      postings.push({ account: `ar:patient:${visit.patientId}`, amountCents: visit.allowedAmountCents });
    } else {
      const copay = Math.min(visit.copayCents, visit.allowedAmountCents);
      const remainder = visit.allowedAmountCents - copay;
      const patientCoins = Math.round(remainder * visit.coinsuranceRate);
      const payerShare = Math.round(remainder * (1 - visit.coinsuranceRate));
      postings.push(
        { account: `ar:patient:${visit.patientId}`, amountCents: copay + patientCoins },
        { account: `ar:payer:${visit.payerId}`, amountCents: payerShare },
      );
    }

    const ok = await this.ledger.post(
      {
        id: randomUUID(),
        memo: `visit ${visit.appointmentId}`,
        postings: postings.filter((p) => p.amountCents !== 0),
        createdAt: new Date(),
      },
      `visit-charge:${visit.appointmentId}`,
    );
    if (!ok) return;
  }

  async recordPatientPayment(patientId: string, amountCents: number, paymentRef: string): Promise<boolean> {
    if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("invalid payment amount");
    return this.ledger.post(
      {
        id: randomUUID(),
        memo: `patient payment ${paymentRef}`,
        postings: [
          { account: "cash:operating", amountCents },
          { account: `ar:patient:${patientId}`, amountCents: -amountCents },
        ],
        createdAt: new Date(),
      },
      `patient-payment:${paymentRef}`,
    );
  }
}
