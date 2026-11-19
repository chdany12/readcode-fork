package config

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"time"
)

type Config struct {
	HTTPAddr           string
	DatabaseURL        string
	DispatchTimeout    time.Duration
	MaxActiveOrders    int
	SurgePricingOn     bool
	CourierPingEvery   time.Duration
}

func Default() Config {
	return Config{
		HTTPAddr:         ":8080",
		DispatchTimeout:  20 * time.Second,
		MaxActiveOrders:  3,
		SurgePricingOn:   true,
		CourierPingEvery: 15 * time.Second,
	}
}

type fileConfig struct {
	HTTPAddr         *string `json:"http_addr"`
	DatabaseURL      *string `json:"database_url"`
	DispatchTimeout  *string `json:"dispatch_timeout"`
	MaxActiveOrders  *int    `json:"max_active_orders"`
	SurgePricingOn   *bool   `json:"surge_pricing_on"`
	CourierPingEvery *string `json:"courier_ping_every"`
}

func Load(path string, getenv func(string) string) (Config, error) {
	cfg := Default()
	var errs []error

	if path != "" {
		data, err := os.ReadFile(path)
		if err != nil {
			return Config{}, fmt.Errorf("read config %s: %w", path, err)
		}
		dec := json.NewDecoder(bytes.NewReader(data))
		dec.DisallowUnknownFields()
		var fc fileConfig
		if err := dec.Decode(&fc); err != nil {
			return Config{}, fmt.Errorf("parse config %s: %w", path, err)
		}
		errs = append(errs, applyFile(&cfg, fc)...)
	}

	errs = append(errs, applyEnv(&cfg, getenv)...)
	errs = append(errs, cfg.validate()...)
	if err := errors.Join(errs...); err != nil {
		return Config{}, fmt.Errorf("invalid configuration: %w", err)
	}
	return cfg, nil
}

func applyFile(cfg *Config, fc fileConfig) []error {
	var errs []error
	if fc.HTTPAddr != nil {
		cfg.HTTPAddr = *fc.HTTPAddr
	}
	if fc.DatabaseURL != nil {
		cfg.DatabaseURL = *fc.DatabaseURL
	}
	if fc.MaxActiveOrders != nil {
		cfg.MaxActiveOrders = *fc.MaxActiveOrders
	}
	if fc.SurgePricingOn != nil {
		cfg.SurgePricingOn = *fc.SurgePricingOn
	}
	errs = append(errs, parseDuration("dispatch_timeout", fc.DispatchTimeout, &cfg.DispatchTimeout)...)
	errs = append(errs, parseDuration("courier_ping_every", fc.CourierPingEvery, &cfg.CourierPingEvery)...)
	return errs
}

func parseDuration(name string, raw *string, dst *time.Duration) []error {
	if raw == nil {
		return nil
	}
	d, err := time.ParseDuration(*raw)
	if err != nil {
		return []error{fmt.Errorf("%s: %w", name, err)}
	}
	*dst = d
	return nil
}

func applyEnv(cfg *Config, getenv func(string) string) []error {
	var errs []error
	if v := getenv("DISPATCH_HTTP_ADDR"); v != "" {
		cfg.HTTPAddr = v
	}
	if v := getenv("DISPATCH_DATABASE_URL"); v != "" {
		cfg.DatabaseURL = v
	}
	if v := getenv("DISPATCH_MAX_ACTIVE_ORDERS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			errs = append(errs, fmt.Errorf("DISPATCH_MAX_ACTIVE_ORDERS: %w", err))
		} else {
			cfg.MaxActiveOrders = n
		}
	}
	if v := getenv("DISPATCH_SURGE_PRICING_ON"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			errs = append(errs, fmt.Errorf("DISPATCH_SURGE_PRICING_ON: %w", err))
		} else {
			cfg.SurgePricingOn = b
		}
	}
	return errs
}

func (c Config) validate() []error {
	var errs []error
	if c.DatabaseURL == "" {
		errs = append(errs, errors.New("database_url is required"))
	} else if u, err := url.Parse(c.DatabaseURL); err != nil || u.Scheme == "" || u.Host == "" {
		errs = append(errs, errors.New("database_url must be an absolute URL"))
	}
	if c.MaxActiveOrders < 1 || c.MaxActiveOrders > 10 {
		errs = append(errs, fmt.Errorf("max_active_orders must be between 1 and 10, got %d", c.MaxActiveOrders))
	}
	if c.DispatchTimeout <= 0 {
		errs = append(errs, errors.New("dispatch_timeout must be positive"))
	}
	if c.CourierPingEvery <= 0 || c.CourierPingEvery > c.DispatchTimeout {
		errs = append(errs, errors.New("courier_ping_every must be positive and not exceed dispatch_timeout"))
	}
	return errs
}

// Redacted returns a copy that is safe to log.
func (c Config) Redacted() Config {
	if c.DatabaseURL != "" {
		if u, err := url.Parse(c.DatabaseURL); err == nil && u.User != nil {
			u.User = url.User(u.User.Username())
			c.DatabaseURL = u.String()
		}
	}
	return c
}
