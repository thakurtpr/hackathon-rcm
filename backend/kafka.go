package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/segmentio/kafka-go"
)

var kafkaBroker string
var kafkaWriters = map[string]*kafka.Writer{}
var kafkaWritersMu sync.RWMutex

func init() {
	kafkaBroker = fmt.Sprintf("%s:%s",
		getEnv("KAFKA_HOST", "localhost"),
		getEnv("KAFKA_PORT", "9092"),
	)
}

func getKafkaWriter(topic string) *kafka.Writer {
	kafkaWritersMu.RLock()
	w, ok := kafkaWriters[topic]
	kafkaWritersMu.RUnlock()
	if ok {
		return w
	}
	kafkaWritersMu.Lock()
	defer kafkaWritersMu.Unlock()
	w = kafka.NewWriter(kafka.WriterConfig{
		Brokers:      []string{kafkaBroker},
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		WriteTimeout: 5 * time.Second,
	})
	kafkaWriters[topic] = w
	return w
}

func PublishKafkaEvent(topic string, payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("kafka marshal error: %v", err)
		return
	}

	w := getKafkaWriter(topic)
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
		// KYC — AI produces "kyc.verified", not "kyc.completed"
		"kyc.completed",
		"kyc.verified",
		// Fraud, behavioral, scholarship, explanation
		"fraud.checked",
		"behavioral.scored",
		"scholarship.matched",
		"explanation.ready",
		// Approval — triggers status update + auto-disbursal schedule
		"approval.decided",
	}

	for i, topic := range topics {
		// Stagger starts by 2s so all readers don't join the group
		// simultaneously, which would trigger cascading rebalances.
		time.Sleep(time.Duration(i) * 2 * time.Second)
		go consumeTopic(ctx, topic)
	}
}

func consumeTopic(ctx context.Context, topic string) {
	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers:           []string{kafkaBroker},
		GroupID:           "backend-svc",
		Topic:             topic,
		MinBytes:          1,
		MaxBytes:          10e6,
		StartOffset:       kafka.LastOffset,
		MaxWait:           5 * time.Second,
		SessionTimeout:    30 * time.Second,
		HeartbeatInterval: 3 * time.Second,
		RebalanceTimeout:  60 * time.Second,
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
	// Both topic names supported: "kyc.completed" (legacy) and "kyc.verified" (current AI output)
	case "kyc.completed", "kyc.verified":
		DB.Exec(`UPDATE applications SET pipeline_stages = jsonb_set(pipeline_stages, '{kyc}', '"completed"'), updated_at=NOW() WHERE id=$1`, appID)
		DB.Exec(`UPDATE applications SET status='kyc_verified', updated_at=NOW() WHERE id=$1 AND status='submitted'`, appID)
		AddAuditLog(appID, "", "KYC_COMPLETED", payload)
		log.Printf("[KAFKA] KYC completed for app %s", appID)

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

	case "approval.decided":
		decision, _ := payload["decision"].(string)
		riskBand, _ := payload["risk_band"].(string)

		newStatus := "under_review"
		if decision == "approved" {
			newStatus = "approved"
		} else if decision == "rejected" {
			newStatus = "rejected"
		}

		DB.Exec(`UPDATE applications SET
			status=$1,
			pipeline_stages = jsonb_set(jsonb_set(pipeline_stages, '{decision}', $2::jsonb), '{eligibility}', '"completed"'),
			updated_at=NOW()
		WHERE id=$3`, newStatus, fmt.Sprintf(`"%s"`, decision), appID)

		AddAuditLog(appID, "", "APPROVAL_DECIDED", payload)
		log.Printf("[KAFKA] Approval decided for app %s: %s (risk: %s)", appID, decision, riskBand)

		// ─── Auto-schedule disbursal on approval ─────────────────────────────
		if decision == "approved" {
			go autoScheduleDisbursal(appID, riskBand)
		}
	}

	// Publish to Redis pubsub for WebSocket broadcast
	data, _ := json.Marshal(map[string]interface{}{
		"topic":   topic,
		"app_id":  appID,
		"payload": payload,
	})
	RedisPublish(context.Background(), fmt.Sprintf("app:%s", appID), string(data))
}

// autoScheduleDisbursal automatically creates a semester-based disbursal schedule
// when a loan is approved. Called from the approval.decided Kafka handler.
func autoScheduleDisbursal(appID, riskBand string) {
	if DB == nil {
		return
	}

	// Check if schedule already exists to prevent duplicates
	var existingCount int
	err := DB.QueryRow(`SELECT COUNT(*) FROM disbursal_schedule WHERE app_id=$1`, appID).Scan(&existingCount)
	if err == nil && existingCount > 0 {
		log.Printf("[DISBURSAL] Schedule already exists for app %s, skipping", appID)
		return
	}

	// Fetch loan_amount from application
	var loanAmount float64
	err = DB.QueryRow(`SELECT COALESCE(loan_amount, 0) FROM applications WHERE id=$1`, appID).Scan(&loanAmount)
	if err != nil {
		log.Printf("[DISBURSAL] Failed to fetch loan amount for app %s: %v", appID, err)
		return
	}
	if loanAmount <= 0 {
		log.Printf("[DISBURSAL] Loan amount is 0 for app %s, using default ₹100000", appID)
		loanAmount = 100000 // Default ₹1 lakh if not set
	}

	semesters := 4
	perSemester := loanAmount / float64(semesters)
	startDate := time.Now().AddDate(0, 1, 0) // 1 month from now

	log.Printf("[DISBURSAL] Auto-scheduling ₹%.0f across %d semesters for app %s", loanAmount, semesters, appID)

	for i := 1; i <= semesters; i++ {
		plannedDate := startDate.AddDate(0, 6*(i-1), 0)
		_, err := DB.Exec(
			`INSERT INTO disbursal_schedule(id,app_id,semester,amount,planned_date,status)
			 VALUES(uuid_generate_v4(),$1,$2,$3,$4,'pending')
			 ON CONFLICT DO NOTHING`,
			appID, i, perSemester, plannedDate.Format("2006-01-02"),
		)
		if err != nil {
			log.Printf("[DISBURSAL] Failed to insert semester %d for app %s: %v", i, appID, err)
		}
	}

	AddAuditLog(appID, "", "DISBURSAL_AUTO_SCHEDULED", map[string]interface{}{
		"loan_amount": loanAmount,
		"semesters":   semesters,
		"risk_band":   riskBand,
	})

	// Update app pipeline to indicate disbursal is scheduled
	DB.Exec(`UPDATE applications SET
		pipeline_stages = jsonb_set(pipeline_stages, '{disbursal}', '"scheduled"'),
		updated_at=NOW()
	WHERE id=$1`, appID)

	log.Printf("[DISBURSAL] Auto-scheduled %d installments of ₹%.0f for app %s", semesters, perSemester, appID)
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
