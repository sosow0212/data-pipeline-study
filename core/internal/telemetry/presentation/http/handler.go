package http

import (
	"errors"

	catalogapp "example.com/ops-lab/core/internal/catalog/application"
	"example.com/ops-lab/core/internal/telemetry/application"
	"example.com/ops-lab/core/internal/telemetry/domain"
	"github.com/gin-gonic/gin"
)

type Handler struct{ ingest *application.Ingest }

func NewHandler(ingest *application.Ingest) *Handler      { return &Handler{ingest} }
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) { router.POST("/events", h.ingestEvent) }
func (h *Handler) ingestEvent(c *gin.Context) {
	var event domain.Event
	if err := c.ShouldBindJSON(&event); err != nil {
		c.JSON(400, gin.H{"error": "invalid JSON"})
		return
	}
	created, err := h.ingest.Execute(c.Request.Context(), event)
	if err != nil {
		status, message := 503, "storage unavailable"
		if errors.Is(err, domain.ErrInvalidEvent) {
			status, message = 400, err.Error()
		}
		if errors.Is(err, catalogapp.ErrNotFound) {
			status, message = 404, err.Error()
		}
		if errors.Is(err, application.ErrEventConflict) {
			status, message = 409, err.Error()
		}
		c.JSON(status, gin.H{"error": message})
		return
	}
	status := 200
	if created {
		status = 202
	}
	c.JSON(status, gin.H{"event_id": event.EventID, "created": created})
}
