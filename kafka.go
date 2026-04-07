package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/segmentio/kafka-go"
)

// PublishKafkaEvent pushes an event payload to the specified kafka topic
func PublishKafkaEvent(topic string, payload interface{}) {
	writer := &kafka.Writer{
		Addr:     kafka.TCP("localhost:9092"),
		Topic:    topic,
		Balancer: &kafka.LeastBytes{},
	}
	defer writer.Close()

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		log.Println("Error marshalling payload for Kafka:", err)
		return
	}

	msg := kafka.Message{
		Key:   []byte(fmt.Sprintf("%d", time.Now().UnixNano())),
		Value: payloadBytes,
	}

	err = writer.WriteMessages(context.Background(), msg)
	if err != nil {
		log.Printf("WARNING: Failed to write to Kafka (Topic: %s): %v\n", topic, err)
	} else {
		log.Printf("[KAFKA SUCCESS] Emitted event to topic '%s'\n", topic)
	}
}
