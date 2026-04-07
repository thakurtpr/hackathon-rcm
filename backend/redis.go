package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

var RDB *redis.Client

func InitRedis() {
	addr := fmt.Sprintf("%s:%s",
		getEnv("REDIS_HOST", "localhost"),
		getEnv("REDIS_PORT", "6379"),
	)
	RDB = redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: getEnv("REDIS_PASSWORD", ""),
		DB:       0,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := RDB.Ping(ctx).Err(); err != nil {
		log.Printf("WARNING: Redis not reachable: %v", err)
		RDB = nil
		return
	}
	log.Println("Redis connected")
}

func RedisSet(ctx context.Context, key, value string, ttl time.Duration) error {
	if RDB == nil {
		return nil
	}
	return RDB.Set(ctx, key, value, ttl).Err()
}

func RedisGet(ctx context.Context, key string) (string, error) {
	if RDB == nil {
		return "", redis.Nil
	}
	return RDB.Get(ctx, key).Result()
}

func RedisDel(ctx context.Context, key string) error {
	if RDB == nil {
		return nil
	}
	return RDB.Del(ctx, key).Err()
}

func RedisPublish(ctx context.Context, channel, message string) error {
	if RDB == nil {
		return nil
	}
	return RDB.Publish(ctx, channel, message).Err()
}
