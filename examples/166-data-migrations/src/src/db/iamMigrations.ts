import { Migration } from "./migrate";

export const iamMigrations: Migration[] = [
  {
    version: 41,
    name: "role_bindings_add_scope",
    async up(tx) {
      await tx.query("ALTER TABLE role_bindings ADD COLUMN scope text");
      await tx.query("UPDATE role_bindings SET scope = 'org' WHERE scope IS NULL");
      await tx.query("ALTER TABLE role_bindings ALTER COLUMN scope SET NOT NULL");
      await tx.query("ALTER TABLE role_bindings ALTER COLUMN scope SET DEFAULT 'org'");
    },
  },
  {
    version: 42,
    name: "role_bindings_unique_per_scope",
    async up(tx) {
      await tx.query(
        `DELETE FROM role_bindings a USING role_bindings b
          WHERE a.principal_id = b.principal_id
            AND a.role_id = b.role_id
            AND a.scope = b.scope
            AND a.id > b.id`,
      );
      await tx.query(
        "ALTER TABLE role_bindings ADD CONSTRAINT role_bindings_principal_role_scope_key UNIQUE (principal_id, role_id, scope)",
      );
    },
  },
  {
    version: 43,
    name: "api_keys_add_last_used",
    async up(tx) {
      await tx.query("ALTER TABLE api_keys ADD COLUMN last_used_at timestamptz");
      await tx.query("CREATE INDEX api_keys_last_used_idx ON api_keys (last_used_at)");
    },
  },
];
