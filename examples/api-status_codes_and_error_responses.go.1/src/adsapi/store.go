package adsapi

import (
	"context"
	"time"
)

type Impression struct {
	EventID   string    `json:"event_id"`
	AdID      string    `json:"ad_id"`
	UserHash  string    `json:"user_hash"`
	Timestamp time.Time `json:"timestamp"`
	CostMicro int64     `json:"cost_micro"`
}

type Campaign struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Paused      bool   `json:"paused"`
	DailyBudget int64  `json:"daily_budget_micro"`
	Spent       int64  `json:"spent_micro"`
}

type RecordResult struct {
	Accepted   int `json:"accepted"`
	Duplicates int `json:"duplicates"`
}

type Store interface {
	GetCampaign(ctx context.Context, id string) (*Campaign, error)
	RecordImpressions(ctx context.Context, campaignID string, batch []Impression) (RecordResult, error)
}
