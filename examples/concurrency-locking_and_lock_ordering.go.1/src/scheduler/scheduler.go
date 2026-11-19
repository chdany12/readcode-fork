package scheduler

import (
	"errors"
	"sync"
	"time"
)

type JobState int

const (
	Pending JobState = iota
	Running
	Canceled
	Done
)

var (
	ErrNotPending = errors.New("job is not pending")
	ErrRunnerBusy = errors.New("runner is busy")
)

type Job struct {
	ID       string
	mu       sync.Mutex
	state    JobState
	runner   *Runner
	attempts int
}

type Runner struct {
	ID       string
	mu       sync.Mutex
	current  *Job
	lastBeat time.Time
}

type Scheduler struct {
	qmu   sync.Mutex
	queue []*Job

	rmu     sync.RWMutex
	runners []*Runner

	staleAfter time.Duration
	now        func() time.Time
}

func New(staleAfter time.Duration) *Scheduler {
	return &Scheduler{staleAfter: staleAfter, now: time.Now}
}

func (s *Scheduler) AddRunner(r *Runner) {
	s.rmu.Lock()
	defer s.rmu.Unlock()
	r.lastBeat = s.now()
	s.runners = append(s.runners, r)
}

func (s *Scheduler) Enqueue(j *Job) {
	s.qmu.Lock()
	defer s.qmu.Unlock()
	s.queue = append(s.queue, j)
}

func (s *Scheduler) Next() *Job {
	s.qmu.Lock()
	defer s.qmu.Unlock()
	if len(s.queue) == 0 {
		return nil
	}
	j := s.queue[0]
	s.queue = s.queue[1:]
	return j
}

func (s *Scheduler) Assign(j *Job, r *Runner) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	j.mu.Lock()
	defer j.mu.Unlock()

	if j.state != Pending {
		return ErrNotPending
	}
	if r.current != nil {
		return ErrRunnerBusy
	}
	j.state = Running
	j.runner = r
	j.attempts++
	r.current = j
	return nil
}

func (s *Scheduler) Complete(j *Job, r *Runner) {
	r.mu.Lock()
	defer r.mu.Unlock()
	j.mu.Lock()
	defer j.mu.Unlock()

	if r.current == j {
		r.current = nil
	}
	j.runner = nil
	j.state = Done
}

func (s *Scheduler) Cancel(j *Job) {
	j.mu.Lock()
	defer j.mu.Unlock()

	switch j.state {
	case Pending:
		j.state = Canceled
	case Running:
		r := j.runner
		r.mu.Lock()
		defer r.mu.Unlock()
		r.current = nil
		j.runner = nil
		j.state = Canceled
	}
}

func (s *Scheduler) Heartbeat(r *Runner) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.lastBeat = s.now()
}

func (s *Scheduler) ReapStale() int {
	s.rmu.RLock()
	snapshot := make([]*Runner, len(s.runners))
	copy(snapshot, s.runners)
	s.rmu.RUnlock()

	reaped := 0
	for _, r := range snapshot {
		if j := s.reapOne(r); j != nil {
			s.Enqueue(j)
			reaped++
		}
	}
	return reaped
}

func (s *Scheduler) reapOne(r *Runner) *Job {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.current == nil || s.now().Sub(r.lastBeat) < s.staleAfter {
		return nil
	}
	j := r.current
	j.mu.Lock()
	defer j.mu.Unlock()
	j.state = Pending
	j.runner = nil
	r.current = nil
	return j
}
