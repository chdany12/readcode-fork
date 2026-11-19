package dispatch

import (
	"context"
	"errors"
	"sync"
	"time"
)

var (
	ErrQueueFull = errors.New("dispatch queue full")
	ErrClosed    = errors.New("dispatch pool closed")
)

type RideRequest struct {
	ID        string
	PickupLat float64
	PickupLng float64
}

type Match struct {
	RideID   string
	DriverID string
}

type Result struct {
	Request RideRequest
	Match   Match
	Err     error
}

type Matcher interface {
	FindDriver(ctx context.Context, req RideRequest) (Match, error)
}

type MatchPool struct {
	matcher Matcher
	size    int
	timeout time.Duration
	jobs    chan RideRequest
	results chan Result
	wg      sync.WaitGroup

	mu     sync.RWMutex
	closed bool
}

func NewMatchPool(m Matcher, workers, queue int, timeout time.Duration) *MatchPool {
	return &MatchPool{
		matcher: m,
		size:    workers,
		timeout: timeout,
		jobs:    make(chan RideRequest, queue),
		results: make(chan Result, queue),
	}
}

func (p *MatchPool) Start() {
	for i := 0; i < p.size; i++ {
		go p.worker()
	}
}

func (p *MatchPool) worker() {
	p.wg.Add(1)
	defer p.wg.Done()
	for req := range p.jobs {
		ctx, cancel := context.WithTimeout(context.Background(), p.timeout)
		m, err := p.matcher.FindDriver(ctx, req)
		cancel()
		p.results <- Result{Request: req, Match: m, Err: err}
	}
}

func (p *MatchPool) Submit(req RideRequest) error {
	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.closed {
		return ErrClosed
	}
	select {
	case p.jobs <- req:
		return nil
	default:
		return ErrQueueFull
	}
}

func (p *MatchPool) Results() <-chan Result {
	return p.results
}

func (p *MatchPool) Shutdown() {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return
	}
	p.closed = true
	close(p.jobs)
	p.mu.Unlock()

	p.wg.Wait()
	close(p.results)
}
