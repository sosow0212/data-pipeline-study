package application

import (
	"context"
	"errors"
	"testing"
	"time"
)

type recordingReader struct{ query EventQuery }

func (r *recordingReader) Find(ctx context.Context, query EventQuery) (EventPage, error) {
	r.query = query
	return EventPage{Total: 12, Page: query.Page, Limit: query.Limit}, nil
}
func TestReadEventsRejectsUnboundedQueries(t *testing.T) {
	valid := EventQuery{Day: time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC), Environment: "production", Page: 1, Limit: 25}
	for _, change := range []func(*EventQuery){
		func(q *EventQuery) { q.Limit = 101 },
		func(q *EventQuery) { q.Page = 0 },
		func(q *EventQuery) { q.Page = 10000 },
		func(q *EventQuery) { q.Level = "OTHER" },
		func(q *EventQuery) { q.Environment = "unknown" },
		func(q *EventQuery) { q.ServiceID = "payment.*" },
	} {
		query := valid
		change(&query)
		_, err := NewReadEvents(&recordingReader{}).Execute(context.Background(), query)
		if !errors.Is(err, ErrInvalidQuery) {
			t.Errorf("invalid query accepted: %+v", query)
		}
	}
}
func TestReadEventsNormalizesUTCDayAndKeepsLiteralSearch(t *testing.T) {
	r := &recordingReader{}
	result, err := NewReadEvents(r).Execute(context.Background(), EventQuery{
		Day: time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC), Environment: "production", Page: 2, Limit: 25, Search: ".*",
	})
	if err != nil || result.Total != 12 || r.query.Day.Hour() != 0 || r.query.Search != ".*" {
		t.Fatalf("read query was not preserved: %+v, %v", r.query, err)
	}
}
