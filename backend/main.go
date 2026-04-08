package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

var jwtSecret = []byte(getEnv("JWT_SECRET", "hackforge-secret-change-in-production"))

// Claims for JWT
type Claims struct {
	UserID string `json:"user_id"`
	Intent string `json:"intent"`
	jwt.RegisteredClaims
}

// JWTMiddleware validates Bearer token
func JWTMiddleware() gin.HandlerFunc {
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
		c.Set("user_id", claims.UserID)
		c.Set("intent", claims.Intent)
		c.Next()
	}
}

func main() {
	InitDB()
	InitRedis()
	InitMinio()

	if DB != nil {
		if err := RunMigrations(); err != nil {
			log.Printf("WARNING: migrations failed: %v", err)
		}
		SeedScholarships()
	}

	go StartKafkaConsumer(context.Background())
	go StartNotificationWorker(context.Background())

	r := gin.Default()

	// CORS
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	r.GET("/health", HealthHandler)

	// Public auth routes
	auth := r.Group("/auth")
	{
		auth.POST("/register", RegisterHandler)
		auth.POST("/verify-otp", VerifyOTPHandler)
		auth.POST("/login", LoginHandler)
		auth.POST("/refresh", RefreshTokenHandler)
		auth.GET("/digilocker/init", DigiLockerInitHandler)
		auth.POST("/digilocker/callback", DigiLockerCallbackHandler)
	}

	// Protected routes
	p := r.Group("/", JWTMiddleware())
	{
		users := p.Group("/users")
		users.GET("/check-pan", CheckPANHandler)
		users.GET("/check-aadhaar", CheckAadhaarHandler)
		users.GET("/:user_id/app-count", AppCountHandler)
		users.PUT("/:user_id/profile", UpdateProfileHandler)
		users.GET("/:user_id/profile", GetProfileHandler)

		docs := p.Group("/documents")
		docs.POST("/upload", DocumentUploadHandler)
		docs.GET("/user/:user_id/status", UserDocumentsStatusMapHandler)
		docs.GET("/:doc_id/status", DocumentStatusHandler)

		apps := p.Group("/applications")
		apps.POST("", CreateApplicationHandler)
		apps.GET("/:app_id", GetApplicationHandler)
		apps.GET("/:app_id/status", GetApplicationStatusHandler)
		apps.PUT("/:app_id/state", UpdateApplicationStateHandler)
		apps.GET("/user/:user_id", ListUserApplicationsHandler)

		elig := p.Group("/eligibility")
		elig.POST("/compute", ComputeEligibilityHandler)
		elig.GET("/:app_id", GetEligibilityHandler)

		ai := p.Group("/ai")
		ai.POST("/kyc-result", KYCResultHandler)
		ai.POST("/behavioral-result", BehavioralResultHandler)
		ai.POST("/fraud-result", FraudResultHandler)
		ai.POST("/scholarship-result", ScholarshipResultHandler)
		ai.POST("/explanation-result", ExplanationResultHandler)

		sch := p.Group("/scholarships")
		sch.GET("/list", ListScholarshipsHandler)
		sch.GET("/:app_id/matches", GetScholarshipMatchesHandler)
		sch.POST("/apply", ApplyScholarshipHandler)

		dis := p.Group("/disbursal")
		dis.POST("/schedule", ScheduleDisbursalHandler)
		dis.POST("/release/:app_id/semester/:sem_num", ReleaseDisbursalHandler)
		dis.GET("/:app_id/schedule", GetDisbursalScheduleHandler)

		sem := p.Group("/semester-gate")
		sem.POST("/trigger", SemesterGateTriggerHandler)
		sem.POST("/submit-marksheet", SubmitMarksheetHandler)

		p.POST("/notifications/send", SendNotificationHandler)

		audit := p.Group("/audit")
		audit.GET("/:app_id/trail", GetAuditTrailHandler)
		audit.POST("/grievance", CreateGrievanceHandler)
	}

	// WebSocket endpoint (auth via query param token)
	r.GET("/applications/:app_id/live", WebSocketHandler)

	port := getEnv("BACKEND_PORT", "8000")
	log.Printf("Backend service starting on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
