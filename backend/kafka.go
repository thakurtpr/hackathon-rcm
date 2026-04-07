package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/segmentio/kafka-go"
)

var kafkaBroker string

func init() {
	kafkaBroker = fmt.Sprintf("%s:%s",
		getEnv("KAFKA_HOST", "localhost"),
		getEnv("KAFKA_PORT", "9092"),
	)
}

func PublishKafkaEvent(topic string, payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("kafka marshal error: %v", err)
		return
	}

	w := kafka.NewWriter(kafka.WriterConfig{
		Brokers:      []string{kafkaBroker},
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		WriteTimeout: 5 * time.Second,
	})
	defer w.Close()

	err = w.WriteMessages(context.Background(), kafka.Message{
		Key:   []byte(fmt.Sprintf("%d", time.Now().UnixNano())),
		Value: data,
	})
	if err != nil {
		log.Printf("WARNING: kafka write failed (topic=%s): %v", topic, err)
		return
	}
	log.Printf("[KAFKA] published to %s", topic)
}

func StartKafkaConsumer(ctx context.Context) {
	topics := []string{
		"kyc.completed",
		"fraud.checked",
		"behavioral.scored",
		"scholarship.matched",
		"explanation.ready",
	}

	for _, topic := range topics {
		go consumeTopic(ctx, topic)
	}
}

func consumeTopic(ctx context.Context, topic string) {
	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     []string{kafkaBroker},
		GroupID:     "backend-svc",
		Topic:       topic,
		MinBytes:    1,
		MaxBytes:    10e6,
		StartOffset: kafka.LastOffset,
	})
	defer r.Close()

	log.Printf("[KAFKA] consuming topic: %s", topic)
	for {
		msg, err := r.FetchMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("[KAFKA] fetch error (%s): %v", topic, err)
			time.Sleep(5 * time.Second)
			continue
		}

		var payload map[string]interface{}
		if err := json.Unmarshal(msg.Value, &payload); err != nil {
			log.Printf("[KAFKA] unmarshal error (%s): %v", topic, err)
			r.CommitMessages(ctx, msg)
			continue
		}

		handleKafkaMessage(topic, payload)
		r.CommitMessages(ctx, msg)
	}
}

func handleKafkaMessage(topic string, payload map[string]interface{}) {
	if DB == nil {
		return
	}
	appID, _ := payload["app_id"].(string)
	if appID == "" {
		return
	}

	switch topic {
	case "kyc.completed":
		DB.Exec(`UPDATE applications SET pipeline_stages = jsonb_set(pipeline_stages, '{kyc}', '"completed"'), updated_at=NOW() WHERE id=$1`, appID)
		AddAuditLog(appID, "", "KYC_COMPLETED", payload)

	case "fraud.checked":
		fraudFlag, _ := payload["fraud_flag"].(bool)
		stage := "passed"
		if fraudFlag {
			stage = "flagged"
		}
		DB.Exec(`UPDATE applications SET pipeline_stages = jsonb_set(pipeline_stages, '{fraud}', $2::jsonb), updated_at=NOW() WHERE id=$1`, appID, fmt.Sprintf(`"%s"`, stage))
		AddAuditLog(appID, "", "FRAUD_CHECKED", payload)

	case "behavioral.scored":
		DB.Exec(`UPDATE applications SET pipeline_stages = jsonb_set(pipeline_stages, '{behavioral}', '"scored"'), updated_at=NOW() WHERE id=$1`, appID)
		AddAuditLog(appID, "", "BEHAVIORAL_SCORED", payload)

	case "scholarship.matched":
		DB.Exec(`UPDATE applications SET pipeline_stages = jsonb_set(pipeline_stages, '{scholarship}', '"matched"'), updated_at=NOW() WHERE id=$1`, appID)

	case "explanation.ready":
		DB.Exec(`UPDATE applications SET pipeline_stages = jsonb_set(pipeline_stages, '{explanation}', '"ready"'), updated_at=NOW() WHERE id=$1`, appID)
	}

	// Publish to Redis pubsub for WebSocket broadcast
	data, _ := json.Marshal(map[string]interface{}{
		"topic":   topic,
		"app_id":  appID,
		"payload": payload,
	})
	RedisPublish(context.Background(), fmt.Sprintf("app:%s", appID), string(data))
}

func AddAuditLog(appID, userID, eventType string, details interface{}) {
	if DB == nil {
		return
	}
	data, _ := json.Marshal(details)
	DB.Exec(
		`INSERT INTO audit_logs(app_id, user_id, event_type, details) VALUES($1::uuid, $2::uuid, $3, $4)`,
		nullIfEmpty(appID), nullIfEmpty(userID), eventType, string(data),
	)
}

func nullIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
