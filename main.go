package main

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// --- Models ---

type RegisterRequest struct {
	FullName string `json:"full_name" binding:"required,min=3"`
	Mobile   string `json:"mobile" binding:"required,len=10"`
	Email    string `json:"email" binding:"required,email"`
	DOB      string `json:"dob" binding:"required"`
	Password string `json:"password" binding:"required,min=8"`
	Intent   string `json:"intent" binding:"required,oneof=loan scholarship both"`
}

type RegisterResponse struct {
	UserID    string `json:"user_id"`
	OtpToken  string `json:"otp_token"`
	ExpiresIn int    `json:"expires_in"` // in seconds
}

type VerifyOTPRequest struct {
	OtpToken string `json:"otp_token" binding:"required"`
	OtpCode  string `json:"otp_code" binding:"required,len=6"`
}

type VerifyOTPResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	UserID       string `json:"user_id"`
	Intent       string `json:"intent"`
}

type LoginRequest struct {
	Mobile   string `json:"mobile" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	UserID       string `json:"user_id"`
	KycStatus    string `json:"kyc_status"`
	AppStatus    string `json:"app_status"`
}

type User struct {
	ID           string
	FullName     string
	Mobile       string
	Email        string
	DOB          string
	PasswordHash string
	Intent       string
	IsVerified   bool
}

type OTPDetails struct {
	OTPCode   string
	Mobile    string
	ExpiresAt time.Time
}

// --- Databases ---

var users = make(map[string]*User)         // Mobile -> User
var otpStore = make(map[string]OTPDetails) // otpToken -> OTPDetails
var jwtSecret = []byte("hackathon-secret-key-change-in-prod")

// --- Utils ---

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
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTimeAccess),
		},
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
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTimeRefresh),
		},
	}
	tokenRefresh := jwt.NewWithClaims(jwt.SigningMethodHS256, claimsRefresh)
	refreshTokenString, err := tokenRefresh.SignedString(jwtSecret)
	if err != nil {
		return "", "", err
	}

	return accessTokenString, refreshTokenString, nil
}

// --- Handlers ---

func RegisterHandler(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if _, exists := users[req.Mobile]; exists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User with this mobile already exists"})
		return
	}

	hashedPassword, err := HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	userID := uuid.New().String()
	user := &User{
		ID:           userID,
		FullName:     req.FullName,
		Mobile:       req.Mobile,
		Email:        req.Email,
		DOB:          req.DOB,
		PasswordHash: hashedPassword,
		Intent:       req.Intent,
		IsVerified:   false,
	}
	users[req.Mobile] = user

	otpCode := "123456" // Expected value
	otpToken := uuid.New().String()

	otpStore[otpToken] = OTPDetails{
		OTPCode:   otpCode,
		Mobile:    req.Mobile,
		ExpiresAt: time.Now().Add(300 * time.Second),
	}

	c.JSON(http.StatusCreated, RegisterResponse{
		UserID:    userID,
		OtpToken:  otpToken,
		ExpiresIn: 300,
	})
}

func VerifyOTPHandler(c *gin.Context) {
	var req VerifyOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	otpDetails, exists := otpStore[req.OtpToken]
	if !exists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired OTP token"})
		return
	}

	if time.Now().After(otpDetails.ExpiresAt) {
		delete(otpStore, req.OtpToken)
		c.JSON(http.StatusBadRequest, gin.H{"error": "OTP token has expired"})
		return
	}

	if otpDetails.OTPCode != req.OtpCode {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid OTP code"})
		return
	}

	user, exists := users[otpDetails.Mobile]
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	user.IsVerified = true
	delete(otpStore, req.OtpToken)

	accessToken, refreshToken, err := GenerateTokens(user.ID, user.Intent)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tokens"})
		return
	}

	c.JSON(http.StatusOK, VerifyOTPResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		UserID:       user.ID,
		Intent:       user.Intent,
	})
}

func LoginHandler(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, exists := users[req.Mobile]
	if !exists || !CheckPasswordHash(req.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if !user.IsVerified {
		c.JSON(http.StatusForbidden, gin.H{"error": "User not verified, please verify OTP first"})
		return
	}

	accessToken, refreshToken, err := GenerateTokens(user.ID, user.Intent)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tokens"})
		return
	}

	c.JSON(http.StatusOK, LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		UserID:       user.ID,
		KycStatus:    "PENDING",
		AppStatus:    "NEW",
	})
}

func main() {
	InitDB()
	r := gin.Default()

	auth := r.Group("/auth")
	{
		auth.POST("/register", RegisterHandler)
		auth.POST("/verify-otp", VerifyOTPHandler)
		auth.POST("/login", LoginHandler)
	}

	AddModuleRoutes(r)

	log.Println("Starting Backend Service on port 8080...")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
