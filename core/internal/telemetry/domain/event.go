package domain

import (
	"errors"
	"regexp"
	"strings"
	"time"
)

var ErrInvalidEvent = errors.New("invalid event")
var eventIDPattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$`)
var serviceIDPattern = regexp.MustCompile(`^[a-z][a-z0-9-]{1,63}$`)

type Event struct {
	EventID       string    `json:"event_id" bson:"_id"`
	SchemaVersion int       `json:"schema_version" bson:"schema_version"`
	OccurredAt    time.Time `json:"occurred_at" bson:"occurred_at"`
	ServiceID     string    `json:"service_id" bson:"service_id"`
	Environment   string    `json:"environment" bson:"environment"`
	Level         string    `json:"level" bson:"level"`
	Endpoint      string    `json:"endpoint" bson:"endpoint"`
	StatusCode    int       `json:"status_code" bson:"status_code"`
	DurationMS    int64     `json:"duration_ms" bson:"duration_ms"`
	TraceID       string    `json:"trace_id" bson:"trace_id"`
	UserID        string    `json:"user_id" bson:"user_id"`
	Message       string    `json:"message" bson:"message"`
}

func (e Event) Validate() error {
	if !eventIDPattern.MatchString(e.EventID) || !serviceIDPattern.MatchString(e.ServiceID) || e.SchemaVersion != 1 || e.OccurredAt.IsZero() || e.OccurredAt.Year() < 2000 || e.OccurredAt.Year() > 2100 {
		return ErrInvalidEvent
	}
	if e.Environment != "production" && e.Environment != "staging" {
		return ErrInvalidEvent
	}
	if e.Level != "INFO" && e.Level != "WARN" && e.Level != "ERROR" {
		return ErrInvalidEvent
	}
	if e.StatusCode < 100 || e.StatusCode > 599 || e.DurationMS < 0 || e.DurationMS > 3600000 {
		return ErrInvalidEvent
	}
	if !strings.HasPrefix(e.Endpoint, "/") || len(e.Endpoint) > 256 || strings.TrimSpace(e.Message) == "" || len(e.Message) > 4096 || len(e.TraceID) > 128 || len(e.UserID) > 128 {
		return ErrInvalidEvent
	}
	return nil
}
