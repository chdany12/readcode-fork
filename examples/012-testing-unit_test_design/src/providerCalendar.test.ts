import { ProviderCalendar, SlotUnavailableError } from "./providerCalendar";

const nineAm = new Date("2026-05-04T09:00:00Z");
const nineThirty = new Date("2026-05-04T09:30:00Z");
const tenAm = new Date("2026-05-04T10:00:00Z");

describe("ProviderCalendar", () => {
  let calendar: ProviderCalendar;

  beforeAll(() => {
    calendar = new ProviderCalendar("dr-okafor");
    calendar.openSlot(tenAm);
    calendar.openSlot(nineAm);
    calendar.openSlot(nineThirty);
  });

  it("lists open slots in chronological order", () => {
    expect(calendar.available()).toEqual([nineAm, nineThirty, tenAm]);
  });

  it("books an open slot for a patient", () => {
    const slot = calendar.book(nineAm, "pt-100");

    expect(slot.patientId).toBe("pt-100");
    expect(calendar.available()).toEqual([nineThirty, tenAm]);
  });

  it("rejects booking a slot that was never opened", () => {
    expect(() => calendar.book(new Date("2026-05-04T11:00:00Z"), "pt-200")).toThrow(
      SlotUnavailableError,
    );
  });

  it("lets the booking patient cancel and frees the slot", () => {
    calendar.book(nineThirty, "pt-300");

    expect(calendar.cancel(nineThirty, "pt-999")).toBe(false);
    expect(calendar.cancel(nineThirty, "pt-300")).toBe(true);
    expect(calendar.available()).toContainEqual(nineThirty);
  });

  it("returns a copy so callers cannot mutate the stored slot", () => {
    const slot = calendar.book(tenAm, "pt-400");
    slot.patientId = null;

    expect(calendar.available()).not.toContainEqual(tenAm);
  });

  it("allows the first patient to book 9:00", () => {
    const slot = calendar.book(nineAm, "pt-500");
    expect(slot.start).toEqual(nineAm);
  });
});
