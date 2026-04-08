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

		// Auto-trigger eligibility computation now that we have the PQ score
		if pqScore > 0 {
			go autoComputeEligibility(appID, pqScore)
		}
	}

	PublishKafkaEvent("behavioral.scored", payload)
	AddAuditLog(appID, "", "BEHAVIORAL_RESULT", payload)

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// autoComputeEligibility queries profile/document data and computes the composite
// eligibility score automatically after behavioral scoring completes.
func autoComputeEligibility(appID string, pqScore float64) {
	var academicScore, income float64
	var cibilScore int
	var kycStatus string

	DB.QueryRow(`
		SELECT COALESCE(p.academic_score, 70), COALESCE(p.income, 0),
		       COALESCE(p.cibil_score, 0), COALESCE(p.kyc_status, 'pending')
		FROM profiles p
		JOIN applications a ON a.user_id = p.user_id
		WHERE a.id = $1`, appID,
	).Scan(&academicScore, &income, &cibilScore, &kycStatus)

	if academicScore == 0 {
		academicScore = 70
	}

	// Normalize CIBIL (300–900) to 0–100; if absent, use income tier
	financialScore := 65.0
	if cibilScore >= 300 {
		financialScore = float64(cibilScore-300) / 6.0 // 300→0, 900→100
	} else if income > 0 {
		switch {
		case income >= 1000000:
			financialScore = 90
		case income >= 500000:
			financialScore = 75
		case income >= 200000:
			financialScore = 60
		default:
			financialScore = 45
		}
	}

	// Average doc trust score for the application's user
	var docTrust float64
	DB.QueryRow(`
		SELECT COALESCE(AVG(d.doc_trust_score), 75)
		FROM documents d
		JOIN applications a ON a.user_id = d.user_id
		WHERE a.id = $1 AND d.doc_trust_score > 0`, appID,
	).Scan(&docTrust)
	if docTrust == 0 {
		docTrust = 75
	}

	// KYC completeness
	kycCompleteness := 50.0
	switch kycStatus {
	case "kyc_verified", "digilocker_verified", "approved":
		kycCompleteness = 100
	case "kyc_manual_review":
		kycCompleteness = 65
	}

	composite := academicScore*0.25 + financialScore*0.30 + pqScore*0.20 + docTrust*0.15 + kycCompleteness*0.10

	band := "review"
	switch {
	case composite >= 70:
		band = "approved"
	case composite >= 50 && pqScore >= 80:
		band = "approved"
	case composite < 50:
		band = "rejected"
	}

	DB.Exec(`
		INSERT INTO eligibility_scores(app_id, academic, financial, pq, doc_trust, kyc_completeness, composite, band, risk_band)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,'MEDIUM')
		ON CONFLICT(app_id) DO UPDATE SET
			academic=EXCLUDED.academic, financial=EXCLUDED.financial, pq=EXCLUDED.pq,
			doc_trust=EXCLUDED.doc_trust, kyc_completeness=EXCLUDED.kyc_completeness,
			composite=EXCLUDED.composite, band=EXCLUDED.band`,
		appID, academicScore, financialScore, pqScore, docTrust, kycCompleteness, composite, band,
	)
	DB.Exec(`UPDATE applications SET status='eligibility_scoring', updated_at=NOW() WHERE id=$1`, appID)

	PublishKafkaEvent("eligibility.calculated", map[string]interface{}{
		"app_id": appID, "composite_score": composite, "band": band, "triggered_by": "behavioral",
	})
	AddAuditLog(appID, "", "ELIGIBILITY_AUTO_COMPUTED", map[string]interface{}{
		"composite": composite, "band": band, "pq_score": pqScore,
	})
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
