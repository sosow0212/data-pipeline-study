package application

import (
	"context"
	"errors"
	"time"

	catalogdomain "example.com/ops-lab/core/internal/catalog/domain"
	"example.com/ops-lab/core/internal/telemetry/domain"
)

var ErrEventConflict = errors.New("event_id already exists with different payload")

type ServiceCatalog interface {
	Get(context.Context, string) (catalogdomain.Service, error)
}
type EventRepository interface {
	Save(context.Context, domain.Event) (bool, error)
	Pending(context.Context, int64) ([]domain.Event, error)
	MarkPublished(context.Context, string) error
}
type Publisher interface {
	Publish(context.Context, domain.Event) error
}

type Ingest struct {
	repository EventRepository
	catalog    ServiceCatalog
}

func NewIngest(repository EventRepository, catalog ServiceCatalog) *Ingest {
	return &Ingest{repository, catalog}
}
func (u *Ingest) Execute(ctx context.Context, event domain.Event) (bool, error) {
	if err := event.Validate(); err != nil {
		return false, err
	}
	if _, err := u.catalog.Get(ctx, event.ServiceID); err != nil {
		return false, err
	}
	// Normalise timestamp representations before comparing immutable event payloads.
	event.OccurredAt = event.OccurredAt.UTC().Truncate(time.Millisecond)
	return u.repository.Save(ctx, event)
}
