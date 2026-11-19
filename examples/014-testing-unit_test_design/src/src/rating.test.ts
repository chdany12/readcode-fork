import { quoteShipment, billableWeightKg, Shipment } from "./rating";

describe("billableWeightKg", () => {
  it("uses actual weight for dense parcels", () => {
    expect(billableWeightKg({ weightGrams: 4200, lengthCm: 20, widthCm: 20, heightCm: 10 })).toBe(5);
  });

  it("uses volumetric weight for bulky parcels", () => {
    expect(billableWeightKg({ weightGrams: 500, lengthCm: 50, widthCm: 40, heightCm: 30 })).toBe(12);
  });
});

describe("quoteShipment", () => {
  let shipment: Shipment;

  beforeAll(() => {
    shipment = {
      originZone: 2,
      destinationZone: 2,
      serviceLevel: "ground",
      parcels: [{ weightGrams: 1000, lengthCm: 10, widthCm: 10, heightCm: 10 }],
      surcharges: [],
    };
  });

  it("prices a single same-zone ground parcel", () => {
    expect(quoteShipment(shipment).totalCents).toBe(740);
  });

  it("applies the zone multiplier", () => {
    shipment.destinationZone = 6;
    expect(quoteShipment(shipment).totalCents).toBe(1184);
  });

  it("adds an oversize surcharge for long parcels", () => {
    shipment.parcels = [{ weightGrams: 1000, lengthCm: 130, widthCm: 10, heightCm: 10 }];
    const quote = quoteShipment(shipment);
    expect(shipment.surcharges).toEqual(["oversize"]);
    expect(quote.lines).toHaveLength(1);
  });

  it("does not add an oversize surcharge for normal parcels", () => {
    shipment.parcels = [{ weightGrams: 2000, lengthCm: 30, widthCm: 20, heightCm: 20 }];
    quoteShipment(shipment);
    expect(shipment.surcharges).not.toContain("oversize");
  });

  it("prices express higher than ground", () => {
    const ground = quoteShipment({ ...shipment, serviceLevel: "ground" }).totalCents;
    const express = quoteShipment({ ...shipment, serviceLevel: "express" }).totalCents;
    expect(express).toBeGreaterThan(ground);
  });

  it("rejects an empty shipment", () => {
    expect(() => quoteShipment({ ...shipment, parcels: [] })).toThrow("no parcels");
  });
});
