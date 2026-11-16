import { Pool } from "pg";
import { migrate } from "./migrate";
import { iamMigrations } from "./iamMigrations";

export async function bootIdentityService(pool: Pool, startHttp: () => Promise<void>) {
  try {
    const applied = await migrate(pool, iamMigrations);
    console.log(JSON.stringify({ msg: "iam schema up to date", applied }));
  } catch (err) {
    console.error(JSON.stringify({ msg: "iam migration failed", error: String(err) }));
    process.exitCode = 1;
    return;
  }
  await startHttp();
}
