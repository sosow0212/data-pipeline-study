package application

import (
	"context"
	"errors"

	"example.com/ops-lab/core/internal/catalog/domain"
)

var ErrNotFound = errors.New("service not found")
var ErrConflict = errors.New("service already exists")

type Repository interface {
	Create(context.Context, domain.Service) error
	Get(context.Context, string) (domain.Service, error)
	List(context.Context) ([]domain.Service, error)
}

type Service struct{ repository Repository }

func NewService(repository Repository) *Service { return &Service{repository: repository} }
func (s *Service) Register(ctx context.Context, value domain.Service) error {
	if err := value.Validate(); err != nil {
		return err
	}
	return s.repository.Create(ctx, value)
}
func (s *Service) Get(ctx context.Context, id string) (domain.Service, error) {
	return s.repository.Get(ctx, id)
}
func (s *Service) List(ctx context.Context) ([]domain.Service, error) { return s.repository.List(ctx) }
