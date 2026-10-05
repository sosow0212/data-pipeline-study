package mongodb

import (
	"context"
	"reflect"
	"regexp"
	"time"

	"example.com/ops-lab/core/internal/telemetry/application"
	"example.com/ops-lab/core/internal/telemetry/domain"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type record struct {
	domain.Event `bson:",inline"`
	ReceivedAt   time.Time  `bson:"received_at"`
	PublishedAt  *time.Time `bson:"published_at"`
}
type Repository struct{ collection *mongo.Collection }

func NewRepository(db *mongo.Database) *Repository { return &Repository{db.Collection("events")} }
func (r *Repository) EnsureIndexes(ctx context.Context) error {
	_, err := r.collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "published_at", Value: 1}, {Key: "received_at", Value: 1}}},
		{Keys: bson.D{{Key: "environment", Value: 1}, {Key: "occurred_at", Value: -1}, {Key: "_id", Value: -1}}},
	})
	return err
}
func (r *Repository) Save(ctx context.Context, event domain.Event) (bool, error) {
	_, err := r.collection.InsertOne(ctx, record{Event: event, ReceivedAt: time.Now().UTC()})
	if !mongo.IsDuplicateKeyError(err) {
		return err == nil, err
	}
	var existing record
	if err := r.collection.FindOne(ctx, bson.M{"_id": event.EventID}).Decode(&existing); err != nil {
		return false, err
	}
	if !reflect.DeepEqual(existing.Event, event) {
		return false, application.ErrEventConflict
	}
	return false, nil
}
func (r *Repository) Pending(ctx context.Context, limit int64) ([]domain.Event, error) {
	cursor, err := r.collection.Find(ctx, bson.M{"published_at": nil}, options.Find().SetSort(bson.D{{Key: "received_at", Value: 1}}).SetLimit(limit))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var records []record
	if err := cursor.All(ctx, &records); err != nil {
		return nil, err
	}
	events := make([]domain.Event, 0, len(records))
	for _, value := range records {
		events = append(events, value.Event)
	}
	return events, nil
}
func (r *Repository) MarkPublished(ctx context.Context, id string) error {
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": bson.M{"published_at": time.Now().UTC()}})
	return err
}

func (r *Repository) Find(ctx context.Context, query application.EventQuery) (application.EventPage, error) {
	filter := bson.M{"environment": query.Environment, "occurred_at": bson.M{"$gte": query.Day, "$lt": query.Day.AddDate(0, 0, 1)}}
	if query.ServiceID != "" {
		filter["service_id"] = query.ServiceID
	}
	if query.Level != "" {
		filter["level"] = query.Level
	}
	if query.Search != "" {
		pattern := bson.M{"$regex": regexp.QuoteMeta(query.Search), "$options": "i"}
		filter["$or"] = bson.A{bson.M{"message": pattern}, bson.M{"trace_id": pattern}, bson.M{"endpoint": pattern}, bson.M{"_id": pattern}}
	}
	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return application.EventPage{}, err
	}
	cursor, err := r.collection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "occurred_at", Value: -1}, {Key: "_id", Value: -1}}).SetSkip((query.Page-1)*query.Limit).SetLimit(query.Limit))
	if err != nil {
		return application.EventPage{}, err
	}
	defer cursor.Close(ctx)
	var records []record
	if err := cursor.All(ctx, &records); err != nil {
		return application.EventPage{}, err
	}
	items := make([]domain.Event, 0, len(records))
	for _, value := range records {
		items = append(items, value.Event)
	}
	return application.EventPage{Items: items, Total: total, Page: query.Page, Limit: query.Limit}, nil
}
