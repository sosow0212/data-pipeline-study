package application

import (
	"context"
	"errors"
	"regexp"
	"time"

	"example.com/ops-lab/core/internal/telemetry/domain"
)

var ErrInvalidQuery = errors.New("invalid event query")
var queryServiceID = regexp.MustCompile(`^[a-z][a-z0-9-]{1,63}$`)

type EventQuery struct {
	Day         time.Time
	Environment string
	ServiceID   string
	Level       string
	Search      string
	Page        int64
	Limit       int64
}

type EventPage struct {
	Items []domain.Event `json:"items"`
	Total int64          `json:"total"`
	Page  int64          `json:"page"`
	Limit int64          `json:"limit"`
}

type EventReader interface {
	Find(context.Context, EventQuery) (EventPage, error)
}

type ReadEvents struct{ reader EventReader }

func NewReadEvents(reader EventReader) *ReadEvents { return &ReadEvents{reader} }
func (r *ReadEvents) Execute(ctx context.Context, query EventQuery) (EventPage, error) {
	if query.Day.IsZero() || query.Day.Year() < 2000 || query.Day.Year() > 2100 ||
		(query.Environment != "production" && query.Environment != "staging") ||
		(query.ServiceID != "" && !queryServiceID.MatchString(query.ServiceID)) ||
		(query.Level != "" && query.Level != "INFO" && query.Level != "WARN" && query.Level != "ERROR") ||
		len(query.Search) > 200 || query.Page < 1 || query.Limit < 1 || query.Limit > 100 ||
		query.Page > 10000/query.Limit+1 {
		return EventPage{}, ErrInvalidQuery
	}
	query.Day = time.Date(query.Day.Year(), query.Day.Month(), query.Day.Day(), 0, 0, 0, 0, time.UTC)
	return r.reader.Find(ctx, query)
}
