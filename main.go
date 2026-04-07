package main

import (
	"database/sql"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type RegisterRequest struct {
	FullName string `json:"full_name"`
	Mobile   string `json:"mobile"`
	Email    string `json:"email"`
	DOB      string `json:"dob"`
	Password string `json:"password"`
	Intent   string `json:"intent"`
}

type RegisterResponse struct {
	UserID    string `json:"user_id"`
	OtpToken  string `json:"otp_token"`
	ExpiresIn int    `json:"expires_in"` // in seconds
}

type VerifyOTPRequest struct {
	OtpToken string `json:"otp_token"`
	OtpCode  string `json:"otp_code"`
}

type VerifyOTPResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	UserID       string `json:"user_id"`
	Intent       string `json:"intent"`
}

type LoginRequest struct {
	Mobile   string `json:"mobile"`
	Password string `json:"password"`
}

type LoginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	UserID       string `json:"user_id"`
	KycStatus    string `json:"kyc_status"`
	AppStatus    string `json:"app_status"`
}

type OTPDetails struct {
	OTPCode   string
	Mobile    string
	ExpiresAt time.Time
}

var otpStore = make(map[string]OTPDetails)
var jwtSecret = []byte("hackathon-secret-key-change-in-prod")

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(bytes), err
}

func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

type Claims struct {
	UserID string `json:"user_id"`
	Intent string `json:"intent"`
	jwt.RegisteredClaims
}

func GenerateTokens(userID string, intent string) (string, string, error) {
	expirationTimeAccess := time.Now().Add(15 * time.Minute)
	claimsAccess := &Claims{
		UserID: userID,
		Intent: intent,
		RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(expirationTimeAccess)},
	}
	tokenAccess := jwt.NewWithClaims(jwt.SigningMethodHS256, claimsAccess)
	accessTokenString, err := tokenAccess.SignedString(jwtSecret)
	if err != nil {
		return "", "", err
	}

	expirationTimeRefresh := time.Now().Add(7 * 24 * time.Hour)
	claimsRefresh := &Claims{
		UserID: userID,
		Intent: intent,
		RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(expirationTimeRefresh)},
	}
	tokenRefresh := jwt.NewWithClaims(jwt.SigningMethodHS256, claimsRefresh)
	refreshTokenString, err := tokenRefresh.SignedString(jwtSecret)
	if err != nil {
		return "", "", err
	}
	return accessTokenString, refreshTokenString, nil
}

func RegisterHandler(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload layout: " + err.Error()})
	}
	if req.Mobile == "" || req.Password == "" || req.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Mobile, email, and password are all required fields"})
	}

	if DB != nil {
		var existing string
		err := DB.QueryRow("SELECT id FROM users WHERE mobile=$1 OR email=$2", req.Mobile, req.Email).Scan(&existing)
		if err != sql.ErrNoRows && err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal DB error verifying existing user"})
		}
		if existing != "" {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "User with this mobile or email string already exists"})
		}
	}

	hashedPassword, err := HashPassword(req.Password)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "System failed to cryptographically hash the password"})
	}

	var userID string
	if DB != nil {
		err = DB.QueryRow("INSERT INTO users (mobile, email, password_hash, intent) VALUES ($1, $2, $3, $4) RETURNING id", req.Mobile, req.Email, hashedPassword, req.Intent).Scan(&userID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to strictly save user mapping to Postgres: " + err.Error()})
		}
	} else {
		userID = uuid.New().String()
	}

	otpCode := "123456" // Mock SMS for Hackathon implementation
	otpToken := uuid.New().String()

	otpStore[otpToken] = OTPDetails{
		OTPCode:   otpCode,
		Mobile:    req.Mobile,
		ExpiresAt: time.Now().Add(300 * time.Second),
	}

	return c.Status(fiber.StatusCreated).JSON(RegisterResponse{
		UserID:    userID,
		OtpToken:  otpToken,
		ExpiresIn: 300,
	})
}

func VerifyOTPHandler(c *fiber.Ctx) error {
	var req VerifyOTPRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Malformed payload structure: " + err.Error()})
	}

	otpDetails, exists := otpStore[req.OtpToken]
	if !exists {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid or severely expired OTP token payload"})
	}
	if time.Now().After(otpDetails.ExpiresAt) {
		delete(otpStore, req.OtpToken)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Your OTP token has gracefully expired. Generate a new one."})
	}
	if otpDetails.OTPCode != req.OtpCode {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Incorrect OTP code provided! Strict check failed."})
	}

	var userID, intent string
	if DB != nil {
		err := DB.QueryRow("SELECT id, intent FROM users WHERE mobile=$1", otpDetails.Mobile).Scan(&userID, &intent)
		if err != nil {
			if err == sql.ErrNoRows {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Verified user totally missing from isolated DB record"})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal DB infrastructure anomaly"})
		}
	} else {
		userID = "mock-id-fallback"; intent = "loan"
	}

	delete(otpStore, req.OtpToken)

	accessToken, refreshToken, err := GenerateTokens(userID, intent)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Application failed mapping the JWT token string securely"})
	}

	return c.Status(fiber.StatusOK).JSON(VerifyOTPResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		UserID:       userID,
		Intent:       intent,
	})
}

func LoginHandler(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Mangled JSON layout submitted: " + err.Error()})
	}

	var dbPass, userID, intent string
	if DB != nil {
		err := DB.QueryRow("SELECT id, password_hash, intent FROM users WHERE mobile=$1", req.Mobile).Scan(&userID, &dbPass, &intent)
		if err != nil {
			if err == sql.ErrNoRows {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Phone number not registered anywhere locally"})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Robust DB lookup failed entirely"})
		}
	} else {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Fatal Error: Secure DB is physically inaccessible"})
	}

	if !CheckPasswordHash(req.Password, dbPass) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Incorrect password injected into endpoint"})
	}

	accessToken, refreshToken, err := GenerateTokens(userID, intent)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Authentication token generator crashed silently"})
	}

	return c.Status(fiber.StatusOK).JSON(LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		UserID:       userID,
		KycStatus:    "PENDING",
		AppStatus:    "NEW",
	})
}

func main() {
	InitDB()
	app := fiber.New(fiber.Config{
		AppName: "Hackathon Core API (Fiber Edition)",
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Fiber caught exception: " + err.Error()})
		},
	})

	auth := app.Group("/auth")
	{
		auth.Post("/register", RegisterHandler)
		auth.Post("/verify-otp", VerifyOTPHandler)
		auth.Post("/login", LoginHandler)
	}

	AddModuleRoutes(app)

	log.Println("Starting Exceptionally-Fast Fiber Backend Service on port 8080...")
	if err := app.Listen(":8080"); err != nil {
		log.Fatalf("Fiber severely crashed to start: %v", err)
	}
}
