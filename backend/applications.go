package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func CreateApplicationHandler(c *gin.Context) {
	var req struct {
		UserID     string  `json:"user_id"`
		Type       string  `json:"type"`
		LoanAmount float64 `json:"loan_amount"`
	}
	c.ShouldBindJSON(&req)

	if req.UserID == "" {
		if uid, ok := c.Get("user_id"); ok {
			req.UserID, _ = uid.(string)
		}
		if req.UserID == "" {
			req.UserID = uuid.New().String()
		}
	}
	if req.Type == "" {
		req.Type = "loan"
	}

	// --- Idempotency key check (Redis) ---
	idempotencyKey := c.GetHeader("X-Idempotency-Key")
	if idempotencyKey != "" && RDB != nil {
		ctx := c.Request.Context()
		redisKey := "idempotency:" + idempotencyKey
		cached, err := RDB.Get(ctx, redisKey).Result()
		if err == nil && cached != "" {
			// Return cached response as-is
			c.Header("Content-Type", "application/json")
			c.String(http.StatusOK, cached)
			return
		}
	}

	// --- Duplicate active application check ---
	if DB != nil {
		var existingID string
		err := DB.QueryRow(
			`SELECT id FROM applications WHERE user_id = $1 AND status != 'rejected' LIMIT 1`,
			req.UserID,
		).Scan(&existingID)
		if err == nil && existingID != "" {
			c.JSON(http.StatusConflict, gin.H{
				"error":  "You already have an active application",
				"app_id": existingID,
			})
			return
		}
	}

	appID := uuid.New().String()
	now := time.Now()
	if DB != nil {
		DB.Exec(`INSERT INTO applications(id,user_id,type,status,loan_amount,pipeline_stages) VALUES($1,$2,$3,'submitted',$4,'{}')`,
			appID, req.UserID, req.Type, req.LoanAmount)
	}

	PublishKafkaEvent("app.submitted", map[string]interface{}{
		"app_id": appID, "user_id": req.UserID, "type": req.Type,
	})
	AddAuditLog(appID, req.UserID, "APPLICATION_CREATED", map[string]string{"type": req.Type})

	responseBody := gin.H{
		"app_id":     appID,
		"status":     "submitted",
		"created_at": now,
	}

	// Store response in Redis for idempotency (TTL = 24h)
	if idempotencyKey != "" && RDB != nil {
		ctx := c.Request.Context()
		redisKey := "idempotency:" + idempotencyKey
		if encoded, err := json.Marshal(responseBody); err == nil {
			RDB.Set(ctx, redisKey, string(encoded), 86400*time.Second)
		}
	}

	c.JSON(http.StatusCreated, responseBody)
}

func GetApplicationHandler(c *gin.Context) {
	appID := c.Param("app_id")
	if DB == nil {
		c.JSON(http.StatusOK, gin.H{"app_id": appID, "status": "submitted"})
		return
	}
	var status, userID string
	var pipelineJSON []byte
	err := DB.QueryRow(`SELECT status, user_id, pipeline_stages FROM applications WHERE id=$1`, appID).
		Scan(&status, &userID, &pipelineJSON)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "application not found"})
		return
	}
	var pipeline map[string]interface{}
	json.Unmarshal(pipelineJSON, &pipeline)
	c.JSON(http.StatusOK, gin.H{
		"app_id":          appID,
		"user_id":         userID,
		"status":          status,
		"pipeline_stages": pipeline,
	})
}

func GetApplicationStatusHandler(c *gin.Context) {
	appID := c.Param("app_id")
	status := "submitted"
	var pipelineJSON []byte
	if DB != nil {
		DB.QueryRow(`SELECT status, pipeline_stages FROM applications WHERE id=$1`, appID).Scan(&status, &pipelineJSON)
	}
	var pipeline map[string]interface{}
	json.Unmarshal(pipelineJSON, &pipeline)
	c.JSON(http.StatusOK, gin.H{"app_id": appID, "status": status, "pipeline_stages": pipeline})
}

func UpdateApplicationStateHandler(c *gin.Context) {
	appID := c.Param("app_id")
	var req struct {
		Status string `json:"status"`
		Stage  string `json:"stage"`
		Value  string `json:"value"`
	}
	c.ShouldBindJSON(&req)
	if DB != nil && req.Status != "" {
		DB.Exec(`UPDATE applications SET status=$1, updated_at=NOW() WHERE id=$2`, req.Status, appID)
	}
	if DB != nil && req.Stage != "" && req.Value != "" {
		DB.Exec(`UPDATE applications SET pipeline_stages=jsonb_set(pipeline_stages,$2::text[],$3::jsonb), updated_at=NOW() WHERE id=$1`,
			appID, fmt.Sprintf("{%s}", req.Stage), fmt.Sprintf(`"%s"`, req.Value))
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func ListUserApplicationsHandler(c *gin.Context) {
	userID := c.Param("user_id")
	apps := []map[string]interface{}{}
	if DB != nil {
		rows, err := DB.Query(`SELECT id, type, status, created_at FROM applications WHERE user_id=$1 ORDER BY created_at DESC`, userID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var id, appType, status string
				var createdAt time.Time
				rows.Scan(&id, &appType, &status, &createdAt)
				apps = append(apps, map[string]interface{}{
					"app_id": id, "type": appType, "status": status, "created_at": createdAt,
				})
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"applications": apps})
}

// WebSocketHandler — real-time pipeline status via Redis pubsub
func WebSocketHandler(c *gin.Context) {
	appID := c.Param("app_id")

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("[WS] client connected for app %s", appID)

	if RDB == nil {
		// No Redis: send mock updates
		for i := 0; i < 10; i++ {
			time.Sleep(3 * time.Second)
			conn.WriteJSON(gin.H{"type": "stage_update", "app_id": appID, "stage": "processing", "status": "pending"})
		}
		return
	}

	ctx := c.Request.Context()
	sub := RDB.Subscribe(ctx, fmt.Sprintf("app:%s", appID))
	defer sub.Close()

	// Send current pipeline state
	if DB != nil {
		var pipelineJSON []byte
		DB.QueryRow(`SELECT pipeline_stages FROM applications WHERE id=$1`, appID).Scan(&pipelineJSON)
		var pipeline map[string]interface{}
		json.Unmarshal(pipelineJSON, &pipeline)
		conn.WriteJSON(gin.H{"type": "current_state", "app_id": appID, "pipeline_stages": pipeline})
	}

	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				return
			}
		}
	}()

	ch := sub.Channel()
	for {
		select {
		case <-done:
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			if err := conn.WriteMessage(websocket.TextMessage, []byte(msg.Payload)); err != nil {
				return
			}
		case <-ctx.Done():
			return
		}
	}
}

// HealthHandler checks all dependencies
func HealthHandler(c *gin.Context) {
	dbOK := DB != nil
	redisOK := RDB != nil
	minioOK := MinioClient != nil

	status := "ok"
	if !dbOK && !redisOK {
		status = "degraded"
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   status,
		"db":       dbOK,
		"redis":    redisOK,
		"minio":    minioOK,
		"service":  "backend-api",
		"version":  "1.0.0",
	})
}

