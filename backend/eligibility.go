package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type EligibilityRequest struct {
	AppID         string  `json:"app_id" binding:"required"`
	AcademicScore float64 `json:"academic_score"`
	FinancialScore float64 `json:"financial_score"`
	PQScore       float64 `json:"pq_score"`
	DocTrust      float64 `json:"doc_trust_score"`
	KYC           float64 `json:"kyc_completeness"`
	FraudFlag     bool    `json:"fraud_flag"`
	RiskBand      string  `json:"risk_band"`
}

func ComputeEligibilityHandler(c *gin.Context) {
	var req EligibilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	composite := req.AcademicScore*0.25 + req.FinancialScore*0.30 + req.PQScore*0.20 + req.DocTrust*0.15 + req.KYC*0.10

	band := "review"
	pqOverride := false
	switch {
	case req.FraudFlag:
		band = "rejected"
	case composite >= 70:
		band = "approved"
	case composite >= 50 && req.PQScore >= 80:
		band = "approved"
		pqOverride = true
	case composite < 50:
		band = "rejected"
	}

	riskBand := req.RiskBand
	if riskBand == "" {
		riskBand = "MEDIUM"
	}

	if DB != nil {
		DB.Exec(`
			INSERT INTO eligibility_scores(app_id,academic,financial,pq,doc_trust,kyc_completeness,composite,band,pq_override,fraud_flag,risk_band)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
			ON CONFLICT(app_id) DO UPDATE SET
				academic=EXCLUDED.academic, financial=EXCLUDED.financial, pq=EXCLUDED.pq,
				doc_trust=EXCLUDED.doc_trust, kyc_completeness=EXCLUDED.kyc_completeness,
				composite=EXCLUDED.composite, band=EXCLUDED.band, pq_override=EXCLUDED.pq_override,
				fraud_flag=EXCLUDED.fraud_flag, risk_band=EXCLUDED.risk_band`,
			req.AppID, req.AcademicScore, req.FinancialScore, req.PQScore,
			req.DocTrust, req.KYC, composite, band, pqOverride, req.FraudFlag, riskBand,
		)
		DB.Exec(`UPDATE applications SET status='eligibility_scoring', updated_at=NOW() WHERE id=$1`, req.AppID)
	}

	PublishKafkaEvent("eligibility.calculated", map[string]interface{}{
		"app_id": req.AppID, "composite_score": composite, "band": band, "risk_band": riskBand,
	})
	if band == "approved" {
		PublishKafkaEvent("approval.decided", map[string]interface{}{
			"app_id": req.AppID, "decision": "approved", "reason": "auto_scored", "composite": composite,
		})
	}
	AddAuditLog(req.AppID, "", "ELIGIBILITY_COMPUTED", map[string]interface{}{
		"composite": composite, "band": band, "fraud_flag": req.FraudFlag,
	})

	c.JSON(http.StatusOK, gin.H{
		"app_id":              req.AppID,
		"composite_score":     composite,
		"band":                band,
		"pq_override_applied": pqOverride,
		"risk_band":           riskBand,
		"computed_at":         time.Now(),
	})
}

func GetEligibilityHandler(c *gin.Context) {
	appID := c.Param("app_id")
	result := gin.H{
		"app_id":    appID,
		"composite": 0,
		"band":      "pending",
	}
	if DB != nil {
		var composite, academic, financial, pq, docTrust, kyc float64
		var band, riskBand string
		var pqOverride, fraudFlag bool
		err := DB.QueryRow(`
			SELECT composite, band, COALESCE(risk_band,'MEDIUM'), pq_override, fraud_flag,
			       COALESCE(academic,0), COALESCE(financial,0), COALESCE(pq,0),
			       COALESCE(doc_trust,0), COALESCE(kyc_completeness,0)
			FROM eligibility_scores WHERE app_id=$1`, appID).
			Scan(&composite, &band, &riskBand, &pqOverride, &fraudFlag,
				&academic, &financial, &pq, &docTrust, &kyc)
		if err == nil {
			result = gin.H{
				"app_id":           appID,
				"composite":        composite,
				"band":             band,
				"risk_band":        riskBand,
				"pq_override":      pqOverride,
				"fraud_flag":       fraudFlag,
				"academic":         academic,
				"financial":        financial,
				"pq":               pq,
				"doc_trust":        docTrust,
				"kyc_completeness": kyc,
				"improvement_hints": []string{},
			}
		}
	}
	c.JSON(http.StatusOK, result)
}
