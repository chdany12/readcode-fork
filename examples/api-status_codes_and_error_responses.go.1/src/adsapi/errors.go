package adsapi

import (
	"errors"
	"fmt"
)

var (
	ErrCampaignNotFound = errors.New("campaign not found")
	ErrCampaignPaused   = errors.New("campaign paused")
	ErrBudgetExhausted  = errors.New("daily budget exhausted")
)

type ValidationError struct {
	Field  string
	Reason string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("invalid %s: %s", e.Field, e.Reason)
}
