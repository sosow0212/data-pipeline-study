package mongodb

import (
	"context"
	"errors"

	"example.com/ops-lab/core/internal/catalog/application"
	"example.com/ops-lab/core/internal/catalog/domain"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Repository struct{ collection *mongo.Collection }

func NewRepository(db *mongo.Database) *Repository { return &Repository{db.Collection("services")} }
func (r *Repository) Create(ctx context.Context, value domain.Service) error {
	_, err := r.collection.InsertOne(ctx, value)
	if mongo.IsDuplicateKeyError(err) {
		return application.ErrConflict
	}
	return err
}
func (r *Repository) Get(ctx context.Context, id string) (domain.Service, error) {
	var value domain.Service
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&value)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return value, application.ErrNotFound
	}
	return value, err
}
func (r *Repository) List(ctx context.Context) ([]domain.Service, error) {
	cursor, err := r.collection.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "_id", Value: 1}}).SetLimit(1000))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	values := []domain.Service{}
	err = cursor.All(ctx, &values)
	return values, err
}
