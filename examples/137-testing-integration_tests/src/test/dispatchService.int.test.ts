import { Pool } from "pg";
import { DispatchError, DispatchService } from "../src/dispatchService";

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const service = new DispatchService(pool);

async function seedOrder(id: string, zone: string, status = "ready_for_pickup") {
  await pool.query("INSERT INTO orders (id, zone, status) VALUES ($1, $2, $3)", [id, zone, status]);
}

async function seedCourier(id: string, zone: string, lastDelivery: string | null = null) {
  await pool.query(
    "INSERT INTO couriers (id, zone, status, last_delivery_at) VALUES ($1, $2, 'available', $3)",
    [id, zone, lastDelivery],
  );
}

describe("DispatchService (postgres)", () => {
  beforeEach(async () => {
    await pool.query("TRUNCATE orders");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("assigns the courier who has waited longest in the order's zone", async () => {
    await seedCourier("c-recent", "north", "2026-01-01T12:00:00Z");
    await seedCourier("c-idle", "north", "2026-01-01T08:00:00Z");
    await seedOrder("o-1", "north");

    const courierId = await service.assignCourier("o-1");

    expect(courierId).toBe("c-idle");
    const { rows } = await pool.query("SELECT status FROM couriers WHERE id = $1", ["c-idle"]);
    expect(rows[0].status).toBe("busy");
  });

  it("rejects orders that are not ready for pickup", async () => {
    await seedCourier("c-1", "south");
    await seedOrder("o-2", "south", "preparing");

    await expect(service.assignCourier("o-2")).rejects.toMatchObject({ code: "BAD_STATE" });
  });

  it("never gives the same courier to two concurrent orders", async () => {
    await seedCourier("c-solo", "east");
    await seedOrder("o-3", "east");
    await seedOrder("o-4", "east");

    const results = await Promise.allSettled([service.assignCourier("o-3"), service.assignCourier("o-4")]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(DispatchError);
    expect(rejected[0].reason.code).toBe("NO_COURIER");
  });
});
