package http

import (
	"errors"
	"strconv"
	"time"

	"example.com/ops-lab/core/internal/telemetry/application"
	"github.com/gin-gonic/gin"
)

type ReadHandler struct{ reader *application.ReadEvents }

func NewReadHandler(reader *application.ReadEvents) *ReadHandler { return &ReadHandler{reader} }
func (h *ReadHandler) RegisterRoutes(router *gin.RouterGroup) {
	router.GET("/events", h.list)
}
func (h *ReadHandler) list(c *gin.Context) {
	day, dayErr := time.Parse("2006-01-02", c.Query("day"))
	page, pageErr := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
	limit, limitErr := strconv.ParseInt(c.DefaultQuery("limit", "25"), 10, 64)
	if dayErr != nil || pageErr != nil || limitErr != nil {
		c.JSON(400, gin.H{"error": "invalid day or pagination"})
		return
	}
	result, err := h.reader.Execute(c.Request.Context(), application.EventQuery{
		Day: day, Environment: c.DefaultQuery("environment", "production"),
		ServiceID: c.Query("service_id"), Level: c.Query("level"), Search: c.Query("search"),
		Page: page, Limit: limit,
	})
	if err != nil {
		if errors.Is(err, application.ErrInvalidQuery) {
			c.JSON(400, gin.H{"error": err.Error()})
		} else {
			c.JSON(503, gin.H{"error": "storage unavailable"})
		}
		return
	}
	c.JSON(200, result)
}
