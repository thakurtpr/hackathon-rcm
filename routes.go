package main

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func AddModuleRoutes(r *gin.Engine) {
	// MODULE 1 - Auth Extras
	auth := r.Group("/auth")
	{
		auth.POST("/refresh", func(c *gin.Context) { c.JSON(200, gin.H{"access_token": "new_at"}) })
		auth.GET("/digilocker/init", func(c *gin.Context) { c.JSON(200, gin.H{"redirect_url": "https://digilocker.gov.in/oauth", "state_token": "st_test"}) })
		auth.POST("/digilocker/callback", func(c *gin.Context) {
            if DB != nil {
                DB.Exec("UPDATE profiles SET kyc_status='digilocker_verified' WHERE user_id=$1", c.PostForm("user_id"))
            }
            c.JSON(200, gin.H{"kyc_status": "digilocker_verified", "docs_fetched": []string{"aadhaar", "marksheet"}})
        })
	}

	// MODULE 2 - User & Profile Service
	users := r.Group("/users")
	{
		users.PUT("/:user_id/profile", func(c *gin.Context) {
            userID := c.Param("user_id")
            if DB != nil {
                DB.Exec("INSERT INTO profiles (user_id, kyc_status) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET kyc_status = $2", userID, "pending")
            }
            c.JSON(200, gin.H{"profile_complete": true, "kyc_ready": true})
        })
		users.GET("/:user_id/profile", func(c *gin.Context) { c.JSON(200, gin.H{"user_id": c.Param("user_id"), "kyc_status": "digilocker_verified"}) })
	}

	// MODULE 3 - Document Service
	docs := r.Group("/documents")
	{
		docs.POST("/upload", func(c *gin.Context) {
            docID := uuid.New().String()
            userID := c.PostForm("user_id")
            docType := c.PostForm("doc_type")
            if docType == "" { docType = "aadhaar" }
            minioPath := "bucket/user_" + userID + "/" + docID + ".pdf"

            if DB != nil {
                DB.Exec("INSERT INTO documents (id, user_id, doc_type, minio_path, status) VALUES ($1, $2, $3, $4, 'processing')", docID, userID, docType, minioPath)
            }
            PublishKafkaEvent("document.uploaded", map[string]string{"doc_id": docID, "user_id": userID, "doc_type": docType, "minio_path": minioPath})
            c.JSON(201, gin.H{"doc_id": docID, "minio_path": minioPath, "status": "processing", "upload_timestamp": time.Now()})
        })
		docs.GET("/:user_id/status", func(c *gin.Context) { c.JSON(200, gin.H{"docs": []interface{}{}}) })
	}

	// MODULE 4 - Application Service
	apps := r.Group("/applications")
	{
		apps.POST("", func(c *gin.Context) {
            appID := uuid.New().String()
            userID := c.PostForm("user_id")
            reqType := c.PostForm("type")
            if reqType == "" { reqType = "loan" }
            if DB != nil {
                DB.Exec("INSERT INTO applications (id, user_id, type, status) VALUES ($1, $2, $3, 'submitted')", appID, userID, reqType)
            }
            PublishKafkaEvent("app.submitted", map[string]string{"app_id": appID, "user_id": userID, "type": reqType})
            c.JSON(201, gin.H{"app_id": appID, "status": "submitted", "created_at": time.Now()})
        })
		apps.GET("/:app_id", func(c *gin.Context) { c.JSON(200, gin.H{"app_id": c.Param("app_id"), "status": "submitted"}) })
		apps.GET("/:app_id/status", func(c *gin.Context) { c.JSON(200, gin.H{"status": "submitted", "percent_complete": 10}) })
		apps.PUT("/:app_id/state", func(c *gin.Context) { c.JSON(200, gin.H{"status": "updated"}) })
		apps.GET("/user/:user_id", func(c *gin.Context) { c.JSON(200, gin.H{"applications": []interface{}{}}) })
		apps.GET("/:app_id/live", func(c *gin.Context) { c.JSON(200, gin.H{"message": "websocket placeholder"}) })
	}

	// MODULE 5 - Eligibility & Scoring Service
	eligibility := r.Group("/eligibility")
	{
		eligibility.POST("/compute", func(c *gin.Context) {
             type ComputeReq struct {
                AppID          string  `json:"app_id"`
                AcademicScore  float64 `json:"academic_score"`
                FinancialScore float64 `json:"financial_score"`
                PQScore        float64 `json:"pq_score"`
                DocTrust       float64 `json:"doc_trust_score"`
                KYC            float64 `json:"kyc_completeness"`
                FraudFlag      bool    `json:"fraud_flag"`
            }
            var req ComputeReq
            if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
            }
            composite := (req.AcademicScore * 0.25) + (req.FinancialScore * 0.30) + (req.PQScore * 0.20) + (req.DocTrust * 0.15) + (req.KYC * 0.10)
            band := "review"
            pqOverride := false
            if req.FraudFlag {
				band = "rejected"
			} else if composite >= 70 { 
				band = "approved" 
			} else if composite >= 50 && composite < 70 && req.PQScore >= 80 { 
				band = "approved"
				pqOverride = true 
			} else if composite < 50 { 
				band = "rejected" 
			}

            if DB != nil {
                DB.Exec("INSERT INTO eligibility_scores (app_id, academic, financial, pq, doc_trust, kyc_completeness, composite, band, pq_override, fraud_flag) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)", req.AppID, req.AcademicScore, req.FinancialScore, req.PQScore, req.DocTrust, req.KYC, composite, band, pqOverride, req.FraudFlag)
                DB.Exec("UPDATE applications SET status='eligibility_scoring' WHERE id=$1", req.AppID)
            }
            
            PublishKafkaEvent("eligibility.calculated", map[string]interface{}{"app_id": req.AppID, "composite_score": composite, "band": band})
            if band == "approved" {
                 PublishKafkaEvent("approval.decided", map[string]interface{}{"app_id": req.AppID, "decision": "approved", "reason": "auto_scored"})
            }
			c.JSON(200, gin.H{"composite_score": composite, "band": band, "pq_override_applied": pqOverride})
		})
		eligibility.GET("/:app_id", func(c *gin.Context) { c.JSON(200, gin.H{"composite": 85.5, "improvement_hints": []string{}}) })
	}

	// MODULE 6 - AI Bridge Endpoints (Mock AI callbacks updating our DB)
	ai := r.Group("/ai")
	{
		ai.POST("/kyc-result", func(c *gin.Context) {
            PublishKafkaEvent("kyc.verified", map[string]interface{}{"user_id": c.PostForm("user_id"), "doc_trust_score": 95, "face_match_pass": true})
            c.JSON(200, gin.H{"status": "ok"})
        })
		ai.POST("/behavioral-result", func(c *gin.Context) { 
            PublishKafkaEvent("behavioral.scored", map[string]interface{}{"app_id": c.PostForm("app_id"), "pq_score": 88})
            c.JSON(200, gin.H{"status": "ok"}) 
        })
		ai.POST("/fraud-result", func(c *gin.Context) { 
            PublishKafkaEvent("fraud.checked", map[string]interface{}{"app_id": c.PostForm("app_id"), "fraud_flag": false})
            c.JSON(200, gin.H{"status": "ok"})
        })
		ai.POST("/scholarship-result", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
		ai.POST("/explanation-result", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
	}

	// MODULE 7 - Scholarship Service
	scholarships := r.Group("/scholarships")
	{
		scholarships.GET("/list", func(c *gin.Context) { c.JSON(200, gin.H{"scholarships": []interface{}{}}) })
		scholarships.GET("/:app_id/matches", func(c *gin.Context) { c.JSON(200, gin.H{"matches": []interface{}{}}) })
		scholarships.POST("/apply", func(c *gin.Context) { c.JSON(200, gin.H{"status": "applied"}) })
	}

	// MODULE 8 - Disbursal Service
	disbursal := r.Group("/disbursal")
	{
		disbursal.POST("/schedule", func(c *gin.Context) { c.JSON(200, gin.H{"schedule": []interface{}{}}) })
		disbursal.POST("/release/:app_id/semester/:sem_num", func(c *gin.Context) {
            appID := c.Param("app_id")
            sem := c.Param("sem_num")
            if DB != nil {
                DB.Exec("UPDATE disbursal_schedule SET status='disbursed', actual_date=NOW() WHERE app_id=$1 AND semester=$2", appID, sem)
                DB.Exec("INSERT INTO audit_logs (app_id, event_type, details) VALUES ($1, 'DISBURSAL', '{\"amount\": 50000}')", appID) // Simplified
            }
            PublishKafkaEvent("loan.disbursed", map[string]interface{}{"app_id": appID, "semester": sem, "amount": 50000})
            c.JSON(200, gin.H{"status": "disbursed"})
        })
		disbursal.GET("/:app_id/schedule", func(c *gin.Context) { c.JSON(200, gin.H{"schedule": []interface{}{}}) })
	}

	// MODULE 9 - Semester Gate Service
	semester := r.Group("/semester-gate")
	{
		semester.POST("/trigger", func(c *gin.Context) { 
            PublishKafkaEvent("semester.gate.trigger", map[string]interface{}{"app_id": c.PostForm("app_id"), "semester_number": c.PostForm("semester_number")})
            c.JSON(200, gin.H{"status": "triggered"})
        })
		semester.POST("/submit-marksheet", func(c *gin.Context) { c.JSON(200, gin.H{"status": "submitted"}) })
	}

	// MODULE 10 - Notification & Module 11 - Audit
	r.POST("/notifications/send", func(c *gin.Context) { c.JSON(200, gin.H{"status": "sent"}) })
	audit := r.Group("/audit")
	{
		audit.GET("/:app_id/trail", func(c *gin.Context) { c.JSON(200, gin.H{"events": []interface{}{}}) })
		audit.POST("/grievance", func(c *gin.Context) { c.JSON(201, gin.H{"ticket_id": "t1"}) })
	}
	log.Println("Added functional module routes with DB and Kafka!")
}
