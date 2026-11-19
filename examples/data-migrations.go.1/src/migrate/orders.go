package migrate

var OrderMigrations = []Migration{
	{
		Version: 1,
		Name:    "create_orders_and_inventory",
		SQL: `
CREATE TABLE inventory_items (
	sku        text PRIMARY KEY,
	on_hand    integer NOT NULL CHECK (on_hand >= 0)
);
CREATE TABLE orders (
	id          bigserial PRIMARY KEY,
	customer_id bigint NOT NULL,
	status      text NOT NULL,
	created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE order_lines (
	order_id bigint NOT NULL REFERENCES orders(id),
	sku      text NOT NULL REFERENCES inventory_items(sku),
	quantity integer NOT NULL CHECK (quantity > 0),
	PRIMARY KEY (order_id, sku)
);`,
	},
	{
		Version: 2,
		Name:    "add_reserved_quantity",
		SQL: `
ALTER TABLE inventory_items ADD COLUMN reserved integer NOT NULL DEFAULT 0;
ALTER TABLE inventory_items ADD CONSTRAINT reserved_within_stock CHECK (reserved <= on_hand);`,
	},
	{
		Version: 3,
		Name:    "index_orders_by_customer",
		SQL: `
CREATE INDEX orders_customer_created_idx ON orders (customer_id, created_at DESC);`,
	},
}
