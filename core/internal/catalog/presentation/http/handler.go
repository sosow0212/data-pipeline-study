package http

import (
	"errors"
	"net/http"

	"example.com/ops-lab/core/internal/catalog/application"
	"example.com/ops-lab/core/internal/catalog/domain"
	"github.com/gin-gonic/gin"
)

type Handler struct{ service *application.Service }

func NewHandler(service *application.Service) *Handler { return &Handler{service} }
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	router.POST("/services", h.create)
	router.GET("/services", h.list)
	router.GET("/services/:id", h.get)
}
func (h *Handler) create(c *gin.Context) {
	var value domain.Service
	if err := c.ShouldBindJSON(&value); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	if err := h.service.Register(c.Request.Context(), value); err != nil {
		status, message := http.StatusInternalServerError, "storage unavailable"
		if errors.Is(err, domain.ErrInvalidService) {
			status, message = http.StatusBadRequest, err.Error()
		}
		if errors.Is(err, application.ErrConflict) {
			status, message = http.StatusConflict, err.Error()
		}
		c.JSON(status, gin.H{"error": message})
		return
	}
	c.JSON(http.StatusCreated, value)
}
func (h *Handler) list(c *gin.Context) {
	values, err := h.service.List(c.Request.Context())
	if err != nil {
		c.JSON(503, gin.H{"error": "storage unavailable"})
		return
	}
	c.JSON(200, values)
}
func (h *Handler) get(c *gin.Context) {
	value, err := h.service.Get(c.Request.Context(), c.Param("id"))
	if errors.Is(err, application.ErrNotFound) {
		c.JSON(404, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		c.JSON(503, gin.H{"error": "storage unavailable"})
		return
	}
	c.JSON(200, value)
}
