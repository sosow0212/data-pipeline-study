package config

import "os"

type Config struct{ Address, MongoURI, MongoDatabase, KafkaAddress, KafkaTopic string }

func Load() Config {
	return Config{Address: env("HTTP_ADDRESS", ":8080"), MongoURI: env("MONGO_URI", "mongodb://localhost:27027"), MongoDatabase: env("MONGO_DATABASE", "ops_lab"), KafkaAddress: env("KAFKA_ADDRESS", "localhost:19092"), KafkaTopic: env("KAFKA_TOPIC", "app.logs.v1")}
}
func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
