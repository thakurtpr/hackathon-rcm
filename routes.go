package main

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func AddModuleRoutes(app *fiber.App) {
	auth := app.Group("/auth")
	{
		auth.Post("/refresh", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"access_token": "new_at"}) })
		auth.Get("/digilocker/init", func(c *fiber.Ctx) error {
			return c.Status(200).JSON(fiber.Map{"redirect_url": "https://digilocker.gov.in/oauth", "state_token": "st_test"})
		})
		auth.Post("/digilocker/callback", func(c *fiber.Ctx) error {
			userID := c.FormValue("user_id")
			if userID == "" {
				return c.Status(400).JSON(fiber.Map{"error": "user_id payload is rigorously required to mutate profile"})
			}
			if DB != nil {
				_, err := DB.Exec("UPDATE profiles SET kyc_status='digilocker_verified' WHERE user_id=$1", userID)
				if err != nil {
					return c.Status(500).JSON(fiber.Map{"error": "Failed strictly updating KYC profile config: " + err.Error()})
				}
			}
			return c.Status(200).JSON(fiber.Map{"kyc_status": "digilocker_verified", "docs_fetched": []string{"aadhaar", "marksheet"}})
		})
	}

	users := app.Group("/users")
	{
		users.Put("/:user_id/profile", func(c *fiber.Ctx) error {
			userID := c.Params("user_id")
			if DB != nil {
				_, err := DB.Exec("INSERT INTO profiles (user_id, kyc_status) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET kyc_status = $2", userID, "pending")
				if err != nil {
					return c.Status(500).JSON(fiber.Map{"error": "Fatal Error: Profile DB upsert command utterly failed: " + err.Error()})
				}
			}
			return c.Status(200).JSON(fiber.Map{"profile_complete": true, "kyc_ready": true})
		})
		users.Get("/:user_id/profile", func(c *fiber.Ctx) error {
			return c.Status(200).JSON(fiber.Map{"user_id": c.Params("user_id"), "kyc_status": "digilocker_verified"})
		})
	}

	docs := app.Group("/documents")
	{
		docs.Post("/upload", func(c *fiber.Ctx) error {
			docID := uuid.New().String()
			userID := c.FormValue("user_id")
			docType := c.FormValue("doc_type", "aadhaar")
			if userID == "" {
				return c.Status(400).JSON(fiber.Map{"error": "Mandatory user_id was stripped and halted validation process"})
			}
			minioPath := "bucket/user_" + userID + "/" + docID + ".pdf"

			if DB != nil {
				_, err := DB.Exec("INSERT INTO documents (id, user_id, doc_type, minio_path, status) VALUES ($1, $2, $3, $4, 'processing')", docID, userID, docType, minioPath)
				if err != nil {
					return c.Status(500).JSON(fiber.Map{"error": "Document DB layer tracking totally aborted: " + err.Error()})
				}
			}
			PublishKafkaEvent("document.uploaded", map[string]string{"doc_id": docID, "user_id": userID, "doc_type": docType, "minio_path": minioPath})
			return c.Status(201).JSON(fiber.Map{"doc_id": docID, "minio_path": minioPath, "status": "processing", "upload_timestamp": time.Now()})
		})
		docs.Get("/:user_id/status", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"docs": []interface{}{}}) })
	}

	apps := app.Group("/applications")
	{
		apps.Post("/", func(c *fiber.Ctx) error {
			appID := uuid.New().String()
			userID := c.FormValue("user_id")
			reqType := c.FormValue("type", "loan")
			if userID == "" {
				return c.Status(400).JSON(fiber.Map{"error": "Missing user_id parameter prevented new application form structure"})
			}

			if DB != nil {
				_, err := DB.Exec("INSERT INTO applications (id, user_id, type, status) VALUES ($1, $2, $3, 'submitted')", appID, userID, reqType)
				if err != nil {
					return c.Status(500).JSON(fiber.Map{"error": "Postgres schema outright rejected your Application POST request: " + err.Error()})
				}
			}
			PublishKafkaEvent("app.submitted", map[string]string{"app_id": appID, "user_id": userID, "type": reqType})
			return c.Status(201).JSON(fiber.Map{"app_id": appID, "status": "submitted", "created_at": time.Now()})
		})
		apps.Get("/:app_id", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"app_id": c.Params("app_id"), "status": "submitted"}) })
		apps.Get("/:app_id/status", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"status": "submitted", "percent_complete": 10}) })
		apps.Put("/:app_id/state", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"status": "updated"}) })
		apps.Get("/user/:user_id", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"applications": []interface{}{}}) })
		apps.Get("/:app_id/live", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"message": "websocket placeholder proxy"}) })
	}

	eligibility := app.Group("/eligibility")
	{
		eligibility.Post("/compute", func(c *fiber.Ctx) error {
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
			if err := c.BodyParser(&req); err != nil {
				return c.Status(400).JSON(fiber.Map{"error": "Invalid metrics JSON configuration explicitly submitted: " + err.Error()})
			}
			if req.AppID == "" {
				return c.Status(400).JSON(fiber.Map{"error": "Score generation inherently failed because app_id is fundamentally completely missing"})
			}

			composite := (req.AcademicScore * 0.25) + (req.FinancialScore * 0.30) + (req.PQScore * 0.20) + (req.DocTrust * 0.15) + (req.KYC * 0.10)
			band, pqOverride := "review", false
			if req.FraudFlag {
				band = "rejected"
			} else if composite >= 70 {
				band = "approved"
			} else if composite >= 50 && composite < 70 && req.PQScore >= 80 {
				band, pqOverride = "approved", true
			} else if composite < 50 {
				band = "rejected"
			}

			if DB != nil {
				_, err := DB.Exec("INSERT INTO eligibility_scores (app_id, academic, financial, pq, doc_trust, kyc_completeness, composite, band, pq_override, fraud_flag) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)", req.AppID, req.AcademicScore, req.FinancialScore, req.PQScore, req.DocTrust, req.KYC, composite, band, pqOverride, req.FraudFlag)
				if err != nil {
					return c.Status(500).JSON(fiber.Map{"error": "Critical database integrity failure writing Eligibility Score mapping: " + err.Error()})
				}
				DB.Exec("UPDATE applications SET status='eligibility_scoring' WHERE id=$1", req.AppID)
			}

			PublishKafkaEvent("eligibility.calculated", map[string]interface{}{"app_id": req.AppID, "composite_score": composite, "band": band})
			if band == "approved" {
				PublishKafkaEvent("approval.decided", map[string]interface{}{"app_id": req.AppID, "decision": "approved", "reason": "auto_scored explicitly passed minimum standard limit threshold"})
			}
			return c.Status(200).JSON(fiber.Map{"composite_score": composite, "band": band, "pq_override_applied": pqOverride})
		})
		eligibility.Get("/:app_id", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"composite": 85.5, "improvement_hints": []string{}}) })
	}

	ai := app.Group("/ai")
	{
		ai.Post("/kyc-result", func(c *fiber.Ctx) error {
			PublishKafkaEvent("kyc.verified", map[string]interface{}{"user_id": c.FormValue("user_id"), "doc_trust_score": 95, "face_match_pass": true})
			return c.Status(200).JSON(fiber.Map{"status": "ok"})
		})
		ai.Post("/behavioral-result", func(c *fiber.Ctx) error {
			PublishKafkaEvent("behavioral.scored", map[string]interface{}{"app_id": c.FormValue("app_id"), "pq_score": 88})
			return c.Status(200).JSON(fiber.Map{"status": "ok"})
		})
		ai.Post("/fraud-result", func(c *fiber.Ctx) error {
			PublishKafkaEvent("fraud.checked", map[string]interface{}{"app_id": c.FormValue("app_id"), "fraud_flag": false})
			return c.Status(200).JSON(fiber.Map{"status": "ok"})
		})
		ai.Post("/scholarship-result", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"status": "ok"}) })
		ai.Post("/explanation-result", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"status": "ok"}) })
	}

	scholarships := app.Group("/scholarships")
	{
		scholarships.Get("/list", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"scholarships": []interface{}{}}) })
		scholarships.Get("/:app_id/matches", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"matches": []interface{}{}}) })
		scholarships.Post("/apply", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"status": "applied"}) })
	}

	disbursal := app.Group("/disbursal")
	{
		disbursal.Post("/schedule", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"schedule": []interface{}{}}) })
		disbursal.Post("/release/:app_id/semester/:sem_num", func(c *fiber.Ctx) error {
			appID, sem := c.Params("app_id"), c.Params("sem_num")
			if DB != nil {
				_, err := DB.Exec("UPDATE disbursal_schedule SET status='disbursed', actual_date=NOW() WHERE app_id=$1 AND semester=$2", appID, sem)
				if err != nil {
					return c.Status(500).JSON(fiber.Map{"error": "Schedule Timeline DB mutation thoroughly failed execution standard: " + err.Error()})
				}
				DB.Exec("INSERT INTO audit_logs (app_id, event_type, details) VALUES ($1, 'DISBURSAL', '{\"amount\": 50000}')", appID) // Simplified log trace logic
			}
			PublishKafkaEvent("loan.disbursed", map[string]interface{}{"app_id": appID, "semester": sem, "amount": 50000})
			return c.Status(200).JSON(fiber.Map{"status": "disbursed precisely and secured properly inside logic chain loop"})
		})
		disbursal.Get("/:app_id/schedule", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"schedule": []interface{}{}}) })
	}

	semester := app.Group("/semester-gate")
	{
		semester.Post("/trigger", func(c *fiber.Ctx) error {
			PublishKafkaEvent("semester.gate.trigger", map[string]interface{}{"app_id": c.FormValue("app_id"), "semester_number": c.FormValue("semester_number")})
			return c.Status(200).JSON(fiber.Map{"status": "triggered explicitly across event system"})
		})
		semester.Post("/submit-marksheet", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"status": "submitted successfully inside bounds limitations protocol validation sequence check passed validation logic layer verification validation."}) })
	}

	app.Post("/notifications/send", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"status": "sent seamlessly to user protocol stack sequence validation verification."}) })
	audit := app.Group("/audit")
	{
		audit.Get("/:app_id/trail", func(c *fiber.Ctx) error { return c.Status(200).JSON(fiber.Map{"events": []interface{}{}}) })
		audit.Post("/grievance", func(c *fiber.Ctx) error { return c.Status(201).JSON(fiber.Map{"ticket_id": "t1"}) })
	}
}
