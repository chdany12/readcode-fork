import { BudgetPacer, CampaignBudget } from "./budgetPacer";

const at = (iso: string) => () => new Date(iso);

const budget = (spent: number, daily = 1_000_000): CampaignBudget => ({
  campaignId: "cmp-42",
  dailyBudgetMicros: daily,
  spentTodayMicros: spent,
});

describe("BudgetPacer.fractionOfDayElapsed", () => {
  it.each([
    ["2026-03-10T00:00:00Z", 0],
    ["2026-03-10T06:00:00Z", 0.25],
    ["2026-03-10T18:00:00Z", 0.75],
  ])("at %s returns %d", (iso, expected) => {
    expect(new BudgetPacer(at(iso)).fractionOfDayElapsed()).toBeCloseTo(expected, 10);
  });
});

describe("BudgetPacer.decide", () => {
  const noon = at("2026-03-10T12:00:00Z");

  it("allows spend that is on pace", () => {
    const pacer = new BudgetPacer(noon);
    expect(pacer.decide(budget(500_000), 1_000)).toEqual({ allow: true, reason: "ok" });
  });

  it("allows spend exactly at the tolerance ceiling", () => {
    const pacer = new BudgetPacer(noon);
    expect(pacer.decide(budget(600_000), 1_000)).toEqual({ allow: true, reason: "ok" });
  });

  it("throttles spend above the tolerance ceiling", () => {
    const pacer = new BudgetPacer(noon);
    expect(pacer.decide(budget(600_001), 1_000)).toEqual({ allow: false, reason: "ahead_of_pace" });
  });

  it("reports exhaustion before pacing when the bid would overrun the budget", () => {
    const pacer = new BudgetPacer(at("2026-03-10T23:59:00Z"));
    expect(pacer.decide(budget(999_500), 1_000)).toEqual({ allow: false, reason: "exhausted" });
  });

  it("allows a bid that lands exactly on the daily budget", () => {
    const pacer = new BudgetPacer(at("2026-03-10T23:59:00Z"));
    expect(pacer.decide(budget(999_000), 1_000)).toEqual({ allow: true, reason: "ok" });
  });

  it("uses a configurable tolerance", () => {
    const strict = new BudgetPacer(noon, 0);
    expect(strict.decide(budget(500_001), 1_000).reason).toBe("ahead_of_pace");
    expect(strict.decide(budget(500_000), 1_000).reason).toBe("ok");
  });
});
