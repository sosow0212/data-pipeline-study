package application

import (
	"context"
	"errors"
	"testing"
	"time"

	catalogapp "example.com/ops-lab/core/internal/catalog/application"
	catalogdomain "example.com/ops-lab/core/internal/catalog/domain"
	"example.com/ops-lab/core/internal/telemetry/domain"
)

type fakeCatalog struct{ err error }

func (f fakeCatalog) Get(context.Context, string) (catalogdomain.Service, error) {
	return catalogdomain.Service{}, f.err
}

type fakeRepository struct {
	saves, marks int
	events       []domain.Event
	markErr      error
}

func (f *fakeRepository) Save(context.Context, domain.Event) (bool, error) {
	f.saves++
	return true, nil
}
func (f *fakeRepository) Pending(context.Context, int64) ([]domain.Event, error) {
	return f.events, nil
}
func (f *fakeRepository) MarkPublished(context.Context, string) error { f.marks++; return f.markErr }

type fakePublisher struct {
	calls int
	err   error
}

func (f *fakePublisher) Publish(context.Context, domain.Event) error { f.calls++; return f.err }

func validEvent() domain.Event {
	return domain.Event{EventID: "evt-1", SchemaVersion: 1, OccurredAt: time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC), ServiceID: "payment", Environment: "production", Level: "ERROR", Endpoint: "/payments", StatusCode: 503, DurationMS: 1200, Message: "timeout"}
}

func TestIngestRejectsInvalidAndUnknownServiceBeforeSaving(t *testing.T) {
	cases := []struct {
		name             string
		invalid          bool
		catalogErr, want error
	}{
		{name: "invalid", invalid: true, want: domain.ErrInvalidEvent},
		{name: "unknown service", catalogErr: catalogapp.ErrNotFound, want: catalogapp.ErrNotFound},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repository := &fakeRepository{}
			event := validEvent()
			if tc.invalid {
				event.DurationMS = -1
			}
			_, err := NewIngest(repository, fakeCatalog{tc.catalogErr}).Execute(context.Background(), event)
			if !errors.Is(err, tc.want) || repository.saves != 0 {
				t.Fatalf("err=%v saves=%d", err, repository.saves)
			}
		})
	}
}

func TestDispatcherRetriesWithoutMarkingFailedPublish(t *testing.T) {
	repository := &fakeRepository{events: []domain.Event{validEvent()}}
	publisher := &fakePublisher{err: errors.New("broker unavailable")}
	dispatcher := NewDispatcher(repository, publisher)
	if dispatcher.Execute(context.Background()) == nil || repository.marks != 0 {
		t.Fatal("failed publish was marked")
	}
	publisher.err = nil
	if err := dispatcher.Execute(context.Background()); err != nil {
		t.Fatal(err)
	}
	if publisher.calls != 2 || repository.marks != 1 {
		t.Fatalf("calls=%d marks=%d", publisher.calls, repository.marks)
	}
}

func TestDispatcherCanRedeliverAfterMarkFailure(t *testing.T) {
	repository := &fakeRepository{events: []domain.Event{validEvent()}, markErr: errors.New("storage unavailable")}
	publisher := &fakePublisher{}
	dispatcher := NewDispatcher(repository, publisher)
	if dispatcher.Execute(context.Background()) == nil {
		t.Fatal("expected mark failure")
	}
	repository.markErr = nil
	if err := dispatcher.Execute(context.Background()); err != nil {
		t.Fatal(err)
	}
	if publisher.calls != 2 {
		t.Fatal("expected at-least-once redelivery")
	}
}
