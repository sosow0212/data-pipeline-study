package kafka

import (
	"context"
	"encoding/json"
	"time"

	"example.com/ops-lab/core/internal/telemetry/domain"
	"github.com/segmentio/kafka-go"
)

type Publisher struct{ writer *kafka.Writer }

func NewPublisher(address, topic string) *Publisher {
	return &Publisher{&kafka.Writer{Addr: kafka.TCP(address), Topic: topic, Balancer: &kafka.Hash{}, RequiredAcks: kafka.RequireAll, BatchTimeout: 10 * time.Millisecond, WriteTimeout: 10 * time.Second}}
}
func (p *Publisher) Publish(ctx context.Context, event domain.Event) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return p.writer.WriteMessages(ctx, kafka.Message{Key: []byte(event.ServiceID), Value: payload, Time: event.OccurredAt})
}
func (p *Publisher) Close() error { return p.writer.Close() }
