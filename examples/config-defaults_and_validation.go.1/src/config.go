package main

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"time"
)

type Config struct {
	ListenAddr       string
	InventoryURL     string
	SearchTimeout    time.Duration
	HoldTTL          time.Duration
	MaxPassengers    int
	MaxSearchResults int
	CurrencyCode     string
}

func defaults() Config {
	return Config{
		ListenAddr:       ":8080",
		InventoryURL:     "http://inventory.internal:9000",
		SearchTimeout:    4 * time.Second,
		HoldTTL:          15 * time.Minute,
		MaxPassengers:    9,
		MaxSearchResults: 200,
		CurrencyCode:     "USD",
	}
}

func envString(key string, dst *string) {
	if v, ok := os.LookupEnv(key); ok {
		*dst = v
	}
}

func envInt(key string, dst *int) error {
	v, ok := os.LookupEnv(key)
	if !ok {
		return nil
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fmt.Errorf("%s: %w", key, err)
	}
	*dst = n
	return nil
}

func envDuration(key string, dst *time.Duration) error {
	v, ok := os.LookupEnv(key)
	if !ok {
		return nil
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return fmt.Errorf("%s: %w", key, err)
	}
	*dst = d
	return nil
}

func Load() (Config, error) {
	cfg := defaults()
	var errs []error

	envString("BOOKING_LISTEN_ADDR", &cfg.ListenAddr)
	envString("BOOKING_INVENTORY_URL", &cfg.InventoryURL)
	envString("BOOKING_CURRENCY", &cfg.CurrencyCode)

	for _, err := range []error{
		envDuration("BOOKING_SEARCH_TIMEOUT", &cfg.SearchTimeout),
		envDuration("BOOKING_HOLD_TTL", &cfg.HoldTTL),
		envInt("BOOKING_MAX_PASSENGERS", &cfg.MaxPassengers),
		envInt("BOOKING_MAX_RESULTS", &cfg.MaxSearchResults),
	} {
		if err != nil {
			errs = append(errs, err)
		}
	}

	if err := cfg.Validate(); err != nil {
		errs = append(errs, err)
	}
	return cfg, errors.Join(errs...)
}

func (c Config) Validate() error {
	var errs []error

	if c.ListenAddr == "" {
		errs = append(errs, errors.New("listen address is required"))
	}
	u, err := url.Parse(c.InventoryURL)
	if err != nil || u.Host == "" {
		errs = append(errs, fmt.Errorf("inventory url %q is not an absolute url", c.InventoryURL))
	}
	if c.SearchTimeout < 0 {
		errs = append(errs, errors.New("search timeout must be positive"))
	}
	if c.HoldTTL < time.Minute || c.HoldTTL > 2*time.Hour {
		errs = append(errs, fmt.Errorf("hold ttl %s outside 1m..2h", c.HoldTTL))
	}
	if c.MaxPassengers < 1 || c.MaxPassengers > 9 {
		errs = append(errs, fmt.Errorf("max passengers %d outside 1..9", c.MaxPassengers))
	}
	if c.MaxSearchResults < 1 || c.MaxSearchResults > 1000 {
		errs = append(errs, fmt.Errorf("max results %d outside 1..1000", c.MaxSearchResults))
	}
	if len(c.CurrencyCode) != 3 {
		errs = append(errs, fmt.Errorf("currency code %q must be 3 letters", c.CurrencyCode))
	}
	return errors.Join(errs...)
}
