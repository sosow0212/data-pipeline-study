package domain

import (
	"errors"
	"regexp"
	"strings"
)

var ErrInvalidService = errors.New("invalid service")
var idPattern = regexp.MustCompile(`^[a-z][a-z0-9-]{1,63}$`)

type Service struct {
	ID           string   `json:"id" bson:"_id"`
	Name         string   `json:"name" bson:"name"`
	Team         string   `json:"team" bson:"team"`
	Dependencies []string `json:"dependencies" bson:"dependencies"`
}

func (s Service) Validate() error {
	if !idPattern.MatchString(s.ID) || strings.TrimSpace(s.Name) == "" || len(s.Name) > 120 || strings.TrimSpace(s.Team) == "" || len(s.Team) > 120 {
		return ErrInvalidService
	}
	if len(s.Dependencies) > 20 {
		return ErrInvalidService
	}
	seen := map[string]bool{}
	for _, id := range s.Dependencies {
		if !idPattern.MatchString(id) || id == s.ID || seen[id] {
			return ErrInvalidService
		}
		seen[id] = true
	}
	return nil
}
