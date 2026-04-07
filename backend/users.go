package main

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type ProfileUpsertRequest struct {
	PANHash         string  `json:"pan_hash"`
	AadhaarHash     string  `json:"aadhaar_hash"`
	Income          float64 `json:"income"`
	CibilScore      int     `json:"cibil_score"`
	EmploymentType  string  `json:"employment_type"`
	CollateralValue float64 `json:"collateral_value"`
	AcademicScore   float64 `json:"academic_score"`
	State           string  `json:"state"`
	Gender          string  `json:"gender"`
	Category        string  `json:"category"`
	BankAccount     string  `json:"bank_account"`
	IFSCCode        string  `json:"ifsc_code"`
	KYCStatus       string  `json:"kyc_status"`
}

func CheckPANHandler(c *gin.Context) {
	pan := c.Query("pan")
	if pan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "pan query param required"})
		return
	}

	exists := false
	if DB != nil {
		var count int
		DB.QueryRow(`SELECT COUNT(*) FROM profiles WHERE pan_hash=$1`, pan).Scan(&count)
		exists = count > 0
	}

	c.JSON(http.StatusOK, gin.H{"exists": exists})
}

func CheckAadhaarHandler(c *gin.Context) {
	hash := c.Query("hash")
	if hash == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "hash query param required"})
		return
	}

	exists := false
	if DB != nil {
		var count int
		DB.QueryRow(`SELECT COUNT(*) FROM profiles WHERE aadhaar_hash=$1`, hash).Scan(&count)
		exists = count > 0
	}

	c.JSON(http.StatusOK, gin.H{"exists": exists})
}

func AppCountHandler(c *gin.Context) {
	userID := c.Param("user_id")
	daysStr := c.DefaultQuery("days", "30")
	days, _ := strconv.Atoi(daysStr)
	if days <= 0 {
		days = 30
	}

	count := 0
	if DB != nil {
		DB.QueryRow(
			`SELECT COUNT(*) FROM applications WHERE user_id=$1 AND created_at >= NOW() - INTERVAL '1 day' * $2`,
			userID, days,
		).Scan(&count)
	}

	c.JSON(http.StatusOK, gin.H{"count": count, "user_id": userID, "days": days})
}

func UpdateProfileHandler(c *gin.Context) {
	userID := c.Param("user_id")
	var req ProfileUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if DB != nil {
		_, err := DB.Exec(`
			INSERT INTO profiles(user_id, pan_hash, aadhaar_hash, income, cibil_score, employment_type,
				collateral_value, academic_score, state, gender, category, bank_account, ifsc_code, kyc_status, updated_at)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
			ON CONFLICT (user_id) DO UPDATE SET
				pan_hash=EXCLUDED.pan_hash,
				aadhaar_hash=EXCLUDED.aadhaar_hash,
				income=EXCLUDED.income,
				cibil_score=EXCLUDED.cibil_score,
				employment_type=EXCLUDED.employment_type,
				collateral_value=EXCLUDED.collateral_value,
				academic_score=EXCLUDED.academic_score,
				state=EXCLUDED.state,
				gender=EXCLUDED.gender,
				category=EXCLUDED.category,
				bank_account=EXCLUDED.bank_account,
				ifsc_code=EXCLUDED.ifsc_code,
				kyc_status=CASE WHEN EXCLUDED.kyc_status != '' THEN EXCLUDED.kyc_status ELSE profiles.kyc_status END,
				updated_at=NOW()
		`,
			userID, req.PANHash, req.AadhaarHash, req.Income, req.CibilScore,
			req.EmploymentType, req.CollateralValue, req.AcademicScore,
			req.State, req.Gender, req.Category, req.BankAccount, req.IFSCCode, req.KYCStatus,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		AddAuditLog("", userID, "PROFILE_UPDATED", map[string]string{"kyc_status": req.KYCStatus})
	}

	c.JSON(http.StatusOK, gin.H{
		"profile_complete": true,
		"kyc_ready":        true,
		"updated_at":       time.Now(),
	})
}

func GetProfileHandler(c *gin.Context) {
	userID := c.Param("user_id")

	profile := gin.H{
		"user_id":    userID,
		"kyc_status": "pending",
	}

	if DB != nil {
		row := DB.QueryRow(`
			SELECT COALESCE(kyc_status,'pending'), COALESCE(income,0), COALESCE(cibil_score,0),
			       COALESCE(employment_type,''), COALESCE(academic_score,0),
			       COALESCE(state,''), COALESCE(gender,''), COALESCE(category,'')
			FROM profiles WHERE user_id=$1`, userID)
		var kycStatus, empType, state, gender, category string
		var income, academicScore float64
		var cibilScore int
		if err := row.Scan(&kycStatus, &income, &cibilScore, &empType, &academicScore, &state, &gender, &category); err == nil {
			profile = gin.H{
				"user_id":         userID,
				"kyc_status":      kycStatus,
				"income":          income,
				"cibil_score":     cibilScore,
				"employment_type": empType,
				"academic_score":  academicScore,
				"state":           state,
				"gender":          gender,
				"category":        category,
			}
		}
	}

	c.JSON(http.StatusOK, profile)
}
