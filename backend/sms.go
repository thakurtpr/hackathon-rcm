package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"time"
)

const fast2smsURL = "https://www.fast2sms.com/dev/bulkV2"

type fast2smsResponse struct {
	Return     bool            `json:"return"`
	RequestID  string          `json:"request_id"`
	Message    json.RawMessage `json:"message"` // string on error, []string on success
	StatusCode int             `json:"status_code"`
}

func (r fast2smsResponse) messageText() string {
	if len(r.Message) == 0 {
		return ""
	}
	// Try string first
	var s string
	if err := json.Unmarshal(r.Message, &s); err == nil {
		return s
	}
	// Try array
	var arr []string
	if err := json.Unmarshal(r.Message, &arr); err == nil && len(arr) > 0 {
		return arr[0]
	}
	return string(r.Message)
}

type fast2smsSendRequest struct {
	Route          string `json:"route"`
	VariablesValues string `json:"variables_values"`
	Flash          int    `json:"flash"`
	Numbers        string `json:"numbers"`
}

// GenerateOTP returns a random 6-digit OTP as a string.
func GenerateOTP() string {
	src := rand.NewSource(time.Now().UnixNano())
	r := rand.New(src)
	return fmt.Sprintf("%06d", r.Intn(1000000))
}

// SendOTPViaSMS sends the OTP to the given mobile number using Fast2SMS.
// Always logs the OTP to console (for dev/testing). Tries Fast2SMS if key is set.
func SendOTPViaSMS(mobile, otp string) error {
	// Always log OTP to console for dev/testing visibility
	log.Printf("╔══════════════════════════════════╗")
	log.Printf("║  OTP for %s: %s  ║", mobile, otp)
	log.Printf("╚══════════════════════════════════╝")

	apiKey := getEnv("FAST2SMS_API_KEY", "")
	if apiKey == "" {
		log.Printf("[SMS] FAST2SMS_API_KEY not set — OTP logged above only")
		return nil
	}

	// Fast2SMS requires POST with JSON body
	payload := fast2smsSendRequest{
		Route:          "otp",
		VariablesValues: otp,
		Flash:          0,
		Numbers:        mobile,
	}
	bodyBytes, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", fast2smsURL, bytes.NewReader(bodyBytes))
	if err != nil {
		log.Printf("[SMS] WARNING: failed to build request: %v — OTP logged above", err)
		return nil
	}
	req.Header.Set("authorization", apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("cache-control", "no-cache")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[SMS] WARNING: HTTP request failed: %v — OTP logged above", err)
		return nil
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var result fast2smsResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		log.Printf("[SMS] WARNING: invalid response from Fast2SMS: %s — OTP logged above", string(respBody))
		return nil
	}

	// status_code 996 = OTP route needs website verification on Fast2SMS dashboard
	if result.StatusCode == 996 {
		log.Printf("[SMS] ACTION NEEDED: Go to fast2sms.com → OTP Message → complete website verification. OTP logged above.")
		return nil
	}

	if !result.Return {
		log.Printf("[SMS] WARNING: Fast2SMS delivery failed (status=%d, msg=%s) — OTP logged above", result.StatusCode, result.messageText())
		return nil
	}

	log.Printf("[SMS] OTP sent to %s via Fast2SMS successfully (request_id: %s)", mobile, result.RequestID)
	return nil
}
