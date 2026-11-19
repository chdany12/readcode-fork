CREATE TABLE campaigns (
    id            TEXT PRIMARY KEY,
    daily_budget  NUMERIC(12, 2) NOT NULL,
    cpm           NUMERIC(10, 2) NOT NULL
);

CREATE TABLE campaign_spend (
    campaign_id   TEXT NOT NULL REFERENCES campaigns (id),
    spend_date    DATE NOT NULL,
    spent         NUMERIC(14, 6) NOT NULL DEFAULT 0,
    PRIMARY KEY (campaign_id, spend_date)
);

CREATE TABLE charged_impressions (
    impression_id TEXT PRIMARY KEY,
    campaign_id   TEXT NOT NULL,
    charged_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
