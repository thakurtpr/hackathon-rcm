package main

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// ─── Admin Auth ───────────────────────────────────────────────────────────────

type AdminLoginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// POST /admin/login — verifies against ADMIN_EMAIL / ADMIN_PASSWORD env vars
func AdminLoginHandler(c *gin.Context) {
	var req AdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	adminEmail := getEnv("ADMIN_EMAIL", "admin@hackforge.in")
	adminPassword := getEnv("ADMIN_PASSWORD", "Admin@123")

	if req.Email != adminEmail || req.Password != adminPassword {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid admin credentials"})
		return
	}

	accessToken, _, err := generateTokens("admin", "admin")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": accessToken,
		"email":        adminEmail,
	})
}

// AdminMiddleware validates Bearer JWT and enforces intent == "admin"
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}
		if claims.Intent != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			return
		}
		c.Set("user_id", claims.UserID)
		c.Set("intent", claims.Intent)
		c.Next()
	}
}

type CollegeStat struct {
	College            string `json:"college"`
	Total              int    `json:"total"`
	Verified           int    `json:"verified"`
	Applications       int    `json:"applications"`
	LoanIntent         int    `json:"loan_intent"`
	ScholarshipIntent  int    `json:"scholarship_intent"`
	BothIntent         int    `json:"both_intent"`
}

type AdminOverview struct {
	TotalUsers      int `json:"total_users"`
	VerifiedUsers   int `json:"verified_users"`
	TotalApps       int `json:"total_applications"`
	LoanApps        int `json:"loan_applications"`
	ScholarshipApps int `json:"scholarship_applications"`
	TotalColleges   int `json:"total_colleges"`
}

// GET /admin/stats/overview
func AdminOverviewHandler(c *gin.Context) {
	overview := AdminOverview{}

	if DB == nil {
		c.JSON(http.StatusOK, overview)
		return
	}

	DB.QueryRow(`
		SELECT
			COUNT(*),
			SUM(CASE WHEN is_verified THEN 1 ELSE 0 END),
			COUNT(DISTINCT CASE WHEN college IS NOT NULL AND college != '' THEN college END)
		FROM users
	`).Scan(&overview.TotalUsers, &overview.VerifiedUsers, &overview.TotalColleges)

	DB.QueryRow(`
		SELECT
			COUNT(*),
			SUM(CASE WHEN type = 'loan' THEN 1 ELSE 0 END),
			SUM(CASE WHEN type = 'scholarship' THEN 1 ELSE 0 END)
		FROM applications
	`).Scan(&overview.TotalApps, &overview.LoanApps, &overview.ScholarshipApps)

	c.JSON(http.StatusOK, overview)
}

// GET /admin/stats/colleges
func AdminCollegeStatsHandler(c *gin.Context) {
	if DB == nil {
		c.JSON(http.StatusOK, gin.H{"colleges": []CollegeStat{}})
		return
	}

	rows, err := DB.Query(`
		SELECT
			COALESCE(NULLIF(TRIM(u.college), ''), 'Unknown') AS college,
			COUNT(DISTINCT u.id)                              AS total,
			COUNT(DISTINCT CASE WHEN u.is_verified THEN u.id END) AS verified,
			COUNT(DISTINCT a.id)                              AS applications,
			COUNT(DISTINCT CASE WHEN u.intent = 'loan'        THEN u.id END) AS loan_intent,
			COUNT(DISTINCT CASE WHEN u.intent = 'scholarship' THEN u.id END) AS scholarship_intent,
			COUNT(DISTINCT CASE WHEN u.intent = 'both'        THEN u.id END) AS both_intent
		FROM users u
		LEFT JOIN applications a ON a.user_id = u.id
		GROUP BY COALESCE(NULLIF(TRIM(u.college), ''), 'Unknown')
		ORDER BY total DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	colleges := []CollegeStat{}
	for rows.Next() {
		var s CollegeStat
		if err := rows.Scan(&s.College, &s.Total, &s.Verified, &s.Applications,
			&s.LoanIntent, &s.ScholarshipIntent, &s.BothIntent); err != nil {
			continue
		}
		colleges = append(colleges, s)
	}

	c.JSON(http.StatusOK, gin.H{"colleges": colleges})
}

// GET /admin/users  — paginated full user list with college
func AdminUsersHandler(c *gin.Context) {
	if DB == nil {
		c.JSON(http.StatusOK, gin.H{"users": []gin.H{}})
		return
	}

	college := c.Query("college") // optional filter

	query := `
		SELECT u.id, u.full_name, u.email, u.mobile, COALESCE(u.college,'') AS college,
		       u.intent, u.is_verified, u.created_at,
		       COALESCE(p.kyc_status,'pending') AS kyc_status,
		       COUNT(a.id) AS app_count
		FROM users u
		LEFT JOIN profiles p ON p.user_id = u.id
		LEFT JOIN applications a ON a.user_id = u.id
	`
	args := []interface{}{}
	if college != "" {
		query += ` WHERE LOWER(TRIM(u.college)) = LOWER($1) `
		args = append(args, college)
	}
	query += ` GROUP BY u.id, u.full_name, u.email, u.mobile, u.college, u.intent, u.is_verified, u.created_at, p.kyc_status ORDER BY u.created_at DESC LIMIT 200`

	rows, err := DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type UserRow struct {
		ID         string `json:"id"`
		FullName   string `json:"full_name"`
		Email      string `json:"email"`
		Mobile     string `json:"mobile"`
		College    string `json:"college"`
		Intent     string `json:"intent"`
		IsVerified bool   `json:"is_verified"`
		CreatedAt  string `json:"created_at"`
		KYCStatus  string `json:"kyc_status"`
		AppCount   int    `json:"app_count"`
	}

	users := []UserRow{}
	for rows.Next() {
		var u UserRow
		if err := rows.Scan(&u.ID, &u.FullName, &u.Email, &u.Mobile, &u.College,
			&u.Intent, &u.IsVerified, &u.CreatedAt, &u.KYCStatus, &u.AppCount); err != nil {
			continue
		}
		users = append(users, u)
	}

	c.JSON(http.StatusOK, gin.H{"users": users, "count": len(users)})
}
