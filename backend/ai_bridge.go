package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func KYCResultHandler(c *gin.Context) {
	var payload map[string]interface{}
	c.ShouldBindJSON(&payload)

	appID, _ := payload["app_id"].(string)
	userID, _ := payload["user_id"].(string)
	docType, _ := payload["doc_type"].(string)

	if DB != nil {
		if docType == "face_match" {
			// Face match result posted by AI service after comparing Aadhaar photo vs selfie.
			// "result" is one of: "verified", "manual_review", "failed"
			// "similarity" is the cosine similarity score (0.0–1.0)
			faceResult, _ := payload["result"].(string)
			similarity, _ := payload["similarity"].(float64)
			if faceResult == "" {
				faceResult = "pending"
			}
			kycStatus := "kyc_verified"
			if faceResult != "verified" {
				kycStatus = "kyc_manual_review"
			}
			DB.Exec(
				`UPDATE profiles SET kyc_status=$1, face_match_result=$2, face_match_score=$3 WHERE user_id=$4`,
				kycStatus, faceResult, similarity, userID,
			)
		} else {
			// OCR / document trust result
			docTrust, _ := payload["doc_trust_score"].(float64)
			faceMatchPass, _ := payload["face_match_pass"].(bool)
			// Only update kyc_status here if a face match hasn't been stored yet,
			// to avoid overwriting a proper face_match result with the OCR fallback.
			DB.Exec(`
				UPDATE profiles
				SET kyc_status = CASE
					WHEN face_match_result IS NOT NULL THEN kyc_status
					WHEN $1 THEN 'kyc_verified'
					ELSE 'kyc_manual_review'
				END
				WHERE user_id=$2`, faceMatchPass, userID)
			if appID != "" {
				DB.Exec(`
					UPDATE documents SET doc_trust_score=$1, status='verified'
					WHERE user_id=$2 AND doc_type NOT IN ('selfie')
					AND id=(SELECT id FROM documents WHERE user_id=$2 AND doc_type NOT IN ('selfie') ORDER BY created_at DESC LIMIT 1)`,
					docTrust, userID)
			}
		}
	}

	PublishKafkaEvent("kyc.completed", payload)
	AddAuditLog(appID, userID, "KYC_RESULT_RECEIVED", payload)

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func BehavioralResultHandler(c *gin.Context) {
	var payload map[string]interface{}
	c.ShouldBindJSON(&payload)

	appID, _ := payload["app_id"].(string)
	pqScore, _ := payload["pq_score"].(float64)

	if DB != nil && appID != "" {
		DB.Exec(`
			INSERT INTO behavioral_responses(app_id, pq_score, fin_resp, resilience, goal_clarity, risk_aware, initiative, social_cap, question_hash)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
			ON CONFLICT DO NOTHING`,
			appID, pqScore,
			safeFloat(payload, "fin_resp"), safeFloat(payload, "resilience"),
			safeFloat(payload, "goal_clarity"), safeFloat(payload, "risk_aware"),
			safeFloat(payload, "initiative"), safeFloat(payload, "social_cap"),
			safeString(payload, "question_hash"),
		)
	}

	PublishKafkaEvent("behavioral.scored", payload)
	AddAuditLog(appID, "", "BEHAVIORAL_RESULT", payload)

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func FraudResultHandler(c *gin.Context) {
	var payload map[string]interface{}
	c.ShouldBindJSON(&payload)

	appID, _ := payload["app_id"].(string)
	fraudFlag, _ := payload["fraud_flag"].(bool)

	if DB != nil && appID != "" {
		status := "fraud_cleared"
		if fraudFlag {
			status = "fraud_flagged"
			DB.Exec(`UPDATE applications SET status='fraud_flagged', updated_at=NOW() WHERE id=$1`, appID)
		}
		DB.Exec(`UPDATE applications SET pipeline_stages=jsonb_set(pipeline_stages,'{fraud}',$2::jsonb), updated_at=NOW() WHERE id=$1`,
			appID, `"`+status+`"`)
	}

	PublishKafkaEvent("fraud.checked", payload)
	AddAuditLog(appID, "", "FRAUD_RESULT", payload)

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func ScholarshipResultHandler(c *gin.Context) {
	var payload map[string]interface{}
	c.ShouldBindJSON(&payload)

	appID, _ := payload["app_id"].(string)
	PublishKafkaEvent("scholarship.matched", payload)
	AddAuditLog(appID, "", "SCHOLARSHIP_RESULT", payload)

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func ExplanationResultHandler(c *gin.Context) {
	var payload map[string]interface{}
	c.ShouldBindJSON(&payload)

	appID, _ := payload["app_id"].(string)
	explanation, _ := payload["explanation"].(string)

	if DB != nil && appID != "" && explanation != "" {
		DB.Exec(`UPDATE eligibility_scores SET explanation=$1 WHERE app_id=$2`, explanation, appID)
	}

	PublishKafkaEvent("explanation.ready", payload)
	AddAuditLog(appID, "", "EXPLANATION_RESULT", payload)

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func safeFloat(m map[string]interface{}, key string) float64 {
	if v, ok := m[key]; ok {
		if f, ok := v.(float64); ok {
			return f
		}
	}
	return 0
}

func safeString(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
