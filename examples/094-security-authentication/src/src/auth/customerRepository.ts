import type { Pool } from "pg";

export interface Customer {
  id: string;
  email: string;
  passwordHash: string;
  lockedUntil: Date | null;
}

export class CustomerRepository {
  constructor(private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<Customer | null> {
    const { rows } = await this.pool.query(
      "SELECT id, email, password_hash, locked_until FROM customers WHERE email = $1",
      [email]
    );
    if (rows.length === 0) return null;
    return {
      id: rows[0].id,
      email: rows[0].email,
      passwordHash: rows[0].password_hash,
      lockedUntil: rows[0].locked_until,
    };
  }

  async incrementFailedAttempts(id: string): Promise<number> {
    const { rows } = await this.pool.query(
      "UPDATE customers SET failed_attempts = failed_attempts + 1 WHERE id = $1 RETURNING failed_attempts",
      [id]
    );
    return rows[0].failed_attempts;
  }

  async resetFailedAttempts(id: string): Promise<void> {
    await this.pool.query(
      "UPDATE customers SET failed_attempts = 0, locked_until = NULL WHERE id = $1",
      [id]
    );
  }

  async lockUntil(id: string, until: Date): Promise<void> {
    await this.pool.query(
      "UPDATE customers SET locked_until = $2, failed_attempts = 0 WHERE id = $1",
      [id, until]
    );
  }
}
