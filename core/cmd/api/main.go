package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	catalogapp "example.com/ops-lab/core/internal/catalog/application"
	catalogmongo "example.com/ops-lab/core/internal/catalog/infrastructure/mongodb"
	cataloghttp "example.com/ops-lab/core/internal/catalog/presentation/http"
	"example.com/ops-lab/core/internal/platform/config"
	telemetryapp "example.com/ops-lab/core/internal/telemetry/application"
	telemetrykafka "example.com/ops-lab/core/internal/telemetry/infrastructure/kafka"
	telemetrymongo "example.com/ops-lab/core/internal/telemetry/infrastructure/mongodb"
	telemetryhttp "example.com/ops-lab/core/internal/telemetry/presentation/http"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"
)

func main() {
	if err := run(); err != nil {
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
func run() error {
	cfg := config.Load()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	client, err := mongo.Connect(options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		return err
	}
	defer client.Disconnect(context.Background())
	startup, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	if err := client.Ping(startup, readpref.Primary()); err != nil {
		return err
	}
	db := client.Database(cfg.MongoDatabase)
	catalog := catalogapp.NewService(catalogmongo.NewRepository(db))
	events := telemetrymongo.NewRepository(db)
	if err := events.EnsureIndexes(startup); err != nil {
		return err
	}
	publisher := telemetrykafka.NewPublisher(cfg.KafkaAddress, cfg.KafkaTopic)
	defer publisher.Close()
	dispatcher := telemetryapp.NewDispatcher(events, publisher)
	workerDone := make(chan struct{})
	go func() {
		defer close(workerDone)
		ticker := time.NewTicker(250 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				batchCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
				if err := dispatcher.Execute(batchCtx); err != nil && ctx.Err() == nil {
					slog.Error("outbox retry", "error", err)
				}
				cancel()
			}
		}
	}()
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())
	if err := router.SetTrustedProxies(nil); err != nil {
		return err
	}
	router.Use(func(c *gin.Context) { c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 65536); c.Next() })
	router.GET("/healthz", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
	router.GET("/readyz", func(c *gin.Context) {
		checkCtx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := client.Ping(checkCtx, readpref.Primary()); err != nil {
			c.JSON(503, gin.H{"status": "unavailable"})
			return
		}
		c.JSON(200, gin.H{"status": "ready"})
	})
	api := router.Group("/v1")
	cataloghttp.NewHandler(catalog).RegisterRoutes(api)
	telemetryhttp.NewHandler(telemetryapp.NewIngest(events, catalog)).RegisterRoutes(api)
	telemetryhttp.NewReadHandler(telemetryapp.NewReadEvents(events)).RegisterRoutes(api)
	server := &http.Server{Addr: cfg.Address, Handler: router, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second}
	serverErrors := make(chan error, 1)
	go func() { serverErrors <- server.ListenAndServe() }()
	select {
	case err := <-serverErrors:
		stop()
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
	}
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	err = server.Shutdown(shutdownCtx)
	<-workerDone
	return err
}
