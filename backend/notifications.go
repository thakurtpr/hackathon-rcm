package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/smtp"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type NotificationRequest struct {
	UserID  string `json:"user_id"`
	Channel string `json:"channel"` // email | sms
	Recipient string `json:"recipient"`
	Subject string `json:"subject"`
	Message string `json:"message" binding:"required"`
}

func SendNotificationHandler(c *gin.Context) {
	var req NotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := uuid.New().String()
	if DB != nil {
		DB.Exec(`INSERT INTO notifications(id,user_id,channel,recipient,subject,message,status) VALUES($1,$2,$3,$4,$5,$6,'queued')`,
			id, nullIfEmpty(req.UserID), req.Channel, req.Recipient, req.Subject, req.Message)
	}

	// Async dispatch
	go dispatchNotification(id, req)

	c.JSON(http.StatusOK, gin.H{"notification_id": id, "status": "queued"})
}

func dispatchNotification(id string, req NotificationRequest) {
	var err error
	switch req.Channel {
	case "email":
		err = sendEmail(req.Recipient, req.Subject, req.Message)
	case "sms":
		err = sendSMS(req.Recipient, req.Message)
	default:
		log.Printf("[NOTIFY] unknown channel: %s", req.Channel)
		return
	}

	status := "sent"
	if err != nil {
		status = "failed"
		log.Printf("[NOTIFY] dispatch failed (%s): %v", id, err)
	}

	if DB != nil {
		DB.Exec(`UPDATE notifications SET status=$1 WHERE id=$2`, status, id)
	}
}

func sendEmail(to, subject, body string) error {
	host := getEnv("SMTP_HOST", "")
	port := getEnv("SMTP_PORT", "587")
	user := getEnv("SMTP_USER", "")
	pass := getEnv("SMTP_PASS", "")
	from := getEnv("SMTP_FROM", user)

	if host == "" {
		log.Printf("[EMAIL] SMTP not configured, skipping: to=%s subject=%s", to, subject)
		return nil
	}

	addr := fmt.Sprintf("%s:%s", host, port)
	auth := smtp.PlainAuth("", user, pass, host)
	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s", from, to, subject, body)
	return smtp.SendMail(addr, auth, from, []string{to}, []byte(msg))
}

func sendSMS(to, message string) error {
	accountSID := getEnv("TWILIO_ACCOUNT_SID", "")
	authToken := getEnv("TWILIO_AUTH_TOKEN", "")
	fromNumber := getEnv("TWILIO_FROM_NUMBER", "")

	if accountSID == "" {
		log.Printf("[SMS] Twilio not configured, skipping: to=%s", to)
		return nil
	}

	// Twilio REST API call
	url := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", accountSID)
	data := fmt.Sprintf("From=%s&To=%s&Body=%s", fromNumber, to, message)

	client := &http.Client{Timeout: 10 * time.Second}
	req, _ := http.NewRequestWithContext(context.Background(), "POST", url, nil)
	req.SetBasicAuth(accountSID, authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Body = http.NoBody
	// TODO: set body from data
	_ = data
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("twilio error: %d", resp.StatusCode)
	}
	return nil
}

// StartNotificationWorker processes queued notifications
func StartNotificationWorker(ctx context.Context) {
	log.Println("[NOTIFY] worker started")
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			processQueuedNotifications()
		}
	}
}

func processQueuedNotifications() {
	if DB == nil {
		return
	}
	rows, err := DB.Query(`SELECT id, channel, recipient, subject, message FROM notifications WHERE status='queued' LIMIT 10`)
	if err != nil {
		return
	}
	defer rows.Close()

	type note struct {
		ID, Channel, Recipient, Subject, Message string
	}
	var queue []note
	for rows.Next() {
		var n note
		rows.Scan(&n.ID, &n.Channel, &n.Recipient, &n.Subject, &n.Message)
		queue = append(queue, n)
	}

	for _, n := range queue {
		req := NotificationRequest{Channel: n.Channel, Recipient: n.Recipient, Subject: n.Subject, Message: n.Message}
		dispatchNotification(n.ID, req)
	}
}

func GetAuditTrailHandler(c *gin.Context) {
	appID := c.Param("app_id")
	events := []map[string]interface{}{}

	if DB != nil {
		rows, err := DB.Query(`SELECT id, event_type, details, created_at FROM audit_logs WHERE app_id=$1 ORDER BY created_at ASC`, appID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var id, eventType string
				var detailsJSON []byte
				var createdAt time.Time
				rows.Scan(&id, &eventType, &detailsJSON, &createdAt)
				var details interface{}
				json.Unmarshal(detailsJSON, &details)
				events = append(events, map[string]interface{}{
					"id":         id,
					"event_type": eventType,
					"details":    details,
					"created_at": createdAt,
				})
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"app_id": appID, "events": events})
}

func CreateGrievanceHandler(c *gin.Context) {
	var req struct {
		AppID       string `json:"app_id"`
		UserID      string `json:"user_id"`
		Subject     string `json:"subject"`
		Description string `json:"description" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ticketID := uuid.New().String()
	if DB != nil {
		DB.Exec(`INSERT INTO grievances(id,app_id,user_id,subject,description) VALUES($1,$2,$3,$4,$5)`,
			ticketID, nullIfEmpty(req.AppID), nullIfEmpty(req.UserID), req.Subject, req.Description)
	}

	c.JSON(http.StatusCreated, gin.H{"ticket_id": ticketID, "status": "open"})
}
