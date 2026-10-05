package application

import (
	"context"
	"fmt"
)

type Dispatcher struct {
	repository EventRepository
	publisher  Publisher
}

func NewDispatcher(repository EventRepository, publisher Publisher) *Dispatcher {
	return &Dispatcher{repository, publisher}
}
func (d *Dispatcher) Execute(ctx context.Context) error {
	events, err := d.repository.Pending(ctx, 100)
	if err != nil {
		return fmt.Errorf("read outbox: %w", err)
	}
	for _, event := range events {
		if err := d.publisher.Publish(ctx, event); err != nil {
			return fmt.Errorf("publish %s: %w", event.EventID, err)
		}
		// A crash between publishing and this update can produce a duplicate.
		if err := d.repository.MarkPublished(ctx, event.EventID); err != nil {
			return fmt.Errorf("mark published: %w", err)
		}
	}
	return nil
}
