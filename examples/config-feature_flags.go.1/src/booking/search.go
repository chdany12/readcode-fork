package booking

import (
	"context"
	"sort"

	"example.com/travel/flags"
)

type Fare struct {
	ID       string
	Price    int64
	Stops    int
	Duration int
}

type FareSource interface {
	Search(ctx context.Context, origin, dest string) ([]Fare, error)
}

type SearchService struct {
	fares FareSource
	flags *flags.Store
}

func NewSearchService(fares FareSource, f *flags.Store) *SearchService {
	return &SearchService{fares: fares, flags: f}
}

func (s *SearchService) Search(ctx context.Context, userID, origin, dest string) ([]Fare, error) {
	fares, err := s.fares.Search(ctx, origin, dest)
	if err != nil {
		return nil, err
	}
	if s.flags.IsEnabled("fare-ranker-v2", userID, false) {
		sort.SliceStable(fares, func(i, j int) bool {
			return score(fares[i]) < score(fares[j])
		})
	} else {
		sort.SliceStable(fares, func(i, j int) bool {
			return fares[i].Price < fares[j].Price
		})
	}
	return fares, nil
}

func score(f Fare) int64 {
	return f.Price + int64(f.Stops)*4000 + int64(f.Duration)*15
}
