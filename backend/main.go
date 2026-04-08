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

// InternalKeyMiddleware allows service-to-service calls from the AI service.
// The AI service sends X-Internal-Key: <shared-secret> instead of a user JWT.
var internalKey = getEnv("INTERNAL_API_KEY", "hackforge-internal-service-key")

func InternalKeyMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.GetHeader("X-Internal-Key")
		if key != internalKey {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid internal key"})
			return
		}
		// Inject a synthetic user_id so downstream handlers that call c.GetString("user_id") don't panic
		c.Set("user_id", "internal-service")
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

		// NOTE: /ai/* callback routes are handled by InternalKeyMiddleware group below —
		// do NOT register them here under JWT or you get a duplicate route panic.

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

	// Admin routes — dedicated admin JWT (intent == "admin")
	r.POST("/admin/login", AdminLoginHandler)
	adminG := r.Group("/admin", AdminMiddleware())
	{
		adminG.GET("/stats/overview", AdminOverviewHandler)
		adminG.GET("/stats/colleges", AdminCollegeStatsHandler)
		adminG.GET("/users", AdminUsersHandler)
	}

	// Internal service-to-service routes (X-Internal-Key auth, not JWT)
	// The AI service calls these to post pipeline results back and to fetch profiles.
	internal := r.Group("/", InternalKeyMiddleware())
	{
		// AI pipeline result callbacks
		iAI := internal.Group("/ai")
		iAI.POST("/kyc-result", KYCResultHandler)
		iAI.POST("/behavioral-result", BehavioralResultHandler)
		iAI.POST("/fraud-result", FraudResultHandler)
		iAI.POST("/scholarship-result", ScholarshipResultHandler)
		iAI.POST("/explanation-result", ExplanationResultHandler)

		// Profile + application read for AI scoring context
		iInternal := internal.Group("/internal")
		iInternal.GET("/users/:user_id/profile", GetProfileHandler)
		iInternal.GET("/applications/:app_id/status", GetApplicationStatusHandler)
	}

	port := getEnv("BACKEND_PORT", "8000")
	log.Printf("Backend service starting on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
