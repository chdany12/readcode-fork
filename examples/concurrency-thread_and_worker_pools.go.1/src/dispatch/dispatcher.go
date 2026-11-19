package dispatch

import "log/slog"

type Dispatcher struct {
	pool   *MatchPool
	assign func(Match) error
	log    *slog.Logger
	done   chan struct{}
}

func NewDispatcher(pool *MatchPool, assign func(Match) error, log *slog.Logger) *Dispatcher {
	return &Dispatcher{pool: pool, assign: assign, log: log, done: make(chan struct{})}
}

func (d *Dispatcher) Run() {
	d.pool.Start()
	go func() {
		defer close(d.done)
		for res := range d.pool.Results() {
			if res.Err != nil {
				d.log.Warn("no match", "ride", res.Request.ID, "err", res.Err)
				continue
			}
			if err := d.assign(res.Match); err != nil {
				d.log.Error("assign failed", "ride", res.Match.RideID, "err", err)
			}
		}
	}()
}

func (d *Dispatcher) Request(req RideRequest) error {
	return d.pool.Submit(req)
}

func (d *Dispatcher) Stop() {
	d.pool.Shutdown()
	<-d.done
}
