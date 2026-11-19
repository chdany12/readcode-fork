package eligibility

import (
	"context"
	"errors"
	"fmt"
	"time"
)

var ErrPayerUnavailable = errors.New("payer eligibility service unavailable")

const (
	activeCoverageTTL   = 6 * time.Hour
	inactiveCoverageTTL = 15 * time.Minute
)

type Coverage struct {
	Active     bool
	CopayCents int
	PlanName   string
}

type PayerClient interface {
	Verify(ctx context.Context, patientID, payerID string) (Coverage, error)
}

type cacheKey struct {
	patientID string
	payerID   string
}

type Checker struct {
	payer PayerClient
	cache *TTLCache[cacheKey, Coverage]
}

func NewChecker(payer PayerClient, cache *TTLCache[cacheKey, Coverage]) *Checker {
	return &Checker{payer: payer, cache: cache}
}

func (c *Checker) Check(ctx context.Context, patientID, payerID string) (Coverage, error) {
	key := cacheKey{patientID: patientID, payerID: payerID}
	if cov, ok := c.cache.Get(key); ok {
		return cov, nil
	}

	cov, err := c.payer.Verify(ctx, patientID, payerID)
	if err != nil {
		return Coverage{}, fmt.Errorf("%w: patient %s, payer %s: %v", ErrPayerUnavailable, patientID, payerID, err)
	}

	if cov.Active {
		c.cache.SetWithTTL(key, cov, activeCoverageTTL)
	} else {
		c.cache.SetWithTTL(key, cov, inactiveCoverageTTL)
	}
	return cov, nil
}

func (c *Checker) Invalidate(patientID, payerID string) {
	c.cache.Delete(cacheKey{patientID: patientID, payerID: payerID})
}

func (c *Checker) CanSchedule(ctx context.Context, patientID, payerID string) (bool, error) {
	cov, err := c.Check(ctx, patientID, payerID)
	if err != nil {
		return false, err
	}
	return cov.Active, nil
}
