from migrations.runner import Migration

ORDER_MIGRATIONS = [
    Migration(
        version=1,
        name="create_orders_and_stock",
        statements=(
            """
            CREATE TABLE stock_levels (
                sku       text PRIMARY KEY,
                on_hand   integer NOT NULL CHECK (on_hand >= 0)
            )
            """,
            """
            CREATE TABLE orders (
                id          bigserial PRIMARY KEY,
                customer_id bigint NOT NULL,
                status      text NOT NULL,
                created_at  timestamptz NOT NULL DEFAULT now()
            )
            """,
        ),
    ),
    Migration(
        version=2,
        name="add_fulfillment_warehouse",
        statements=(
            "ALTER TABLE orders ADD COLUMN warehouse_id integer",
            "UPDATE orders SET warehouse_id = 1 WHERE warehouse_id IS NULL",
            "ALTER TABLE orders ALTER COLUMN warehouse_id SET NOT NULL",
        ),
    ),
    Migration(
        version=3,
        name="track_reserved_stock",
        statements=(
            "ALTER TABLE stock_levels ADD COLUMN reserved integer NOT NULL DEFAULT 0",
            "ALTER TABLE stock_levels ADD CONSTRAINT reserved_le_on_hand CHECK (reserved <= on_hand)",
        ),
    ),
]
