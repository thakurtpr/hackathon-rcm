package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Scholarship struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	Description      string  `json:"description"`
	Amount           float64 `json:"amount"`
	Category         string  `json:"category"`
	Gender           string  `json:"gender"`
	State            string  `json:"state"`
	MinIncome        float64 `json:"min_income"`
	MaxIncome        float64 `json:"max_income"`
	MinAcademicScore float64 `json:"min_academic_score"`
	Deadline         string  `json:"deadline"`
	Provider         string  `json:"provider"`
}

func SeedScholarships() {
	if DB == nil {
		return
	}
	var count int
	DB.QueryRow(`SELECT COUNT(*) FROM scholarships`).Scan(&count)
	if count > 0 {
		return
	}

	// Try to load from ai_service/data/scholarships.json
	paths := []string{
		"../ai_service/data/scholarships.json",
		"../ai-service/data/scholarships.json",
		"/app/data/scholarships.json",
	}

	var scholarships []Scholarship
	for _, p := range paths {
		abs, _ := filepath.Abs(p)
		data, err := os.ReadFile(abs)
		if err == nil {
			json.Unmarshal(data, &scholarships)
			break
		}
	}

	if len(scholarships) == 0 {
		// Default seed data
		scholarships = []Scholarship{
			{ID: uuid.New().String(), Name: "NSP Central Sector Scheme", Amount: 12000, Category: "merit", Gender: "all", MaxIncome: 450000, MinAcademicScore: 60, Provider: "GOI"},
			{ID: uuid.New().String(), Name: "Post-Matric SC Scholarship", Amount: 25000, Category: "SC", Gender: "all", MaxIncome: 250000, MinAcademicScore: 50, Provider: "GOI"},
			{ID: uuid.New().String(), Name: "Pragati Scholarship for Girls", Amount: 30000, Category: "merit", Gender: "female", MaxIncome: 800000, MinAcademicScore: 70, Provider: "AICTE"},
			{ID: uuid.New().String(), Name: "INSPIRE Scholarship", Amount: 80000, Category: "science", Gender: "all", MaxIncome: 0, MinAcademicScore: 90, Provider: "DST"},
			{ID: uuid.New().String(), Name: "HDFC Parivartan ECS Scholarship", Amount: 75000, Category: "merit", Gender: "all", MaxIncome: 300000, MinAcademicScore: 55, Provider: "HDFC"},
		}
	}

	for _, s := range scholarships {
		DB.Exec(`INSERT INTO scholarships(id,name,description,amount,category,gender,min_income,max_income,min_academic_score,provider)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
			s.ID, s.Name, s.Description, s.Amount, s.Category, s.Gender,
			s.MinIncome, s.MaxIncome, s.MinAcademicScore, s.Provider,
		)
	}
	log.Printf("Seeded %d scholarships", len(scholarships))
}

func ListScholarshipsHandler(c *gin.Context) {
	scholarships := []Scholarship{}
	if DB != nil {
		rows, err := DB.Query(`SELECT id,name,COALESCE(description,''),COALESCE(amount,0),COALESCE(category,''),COALESCE(gender,'all'),COALESCE(state,''),COALESCE(min_income,0),COALESCE(max_income,0),COALESCE(min_academic_score,0),COALESCE(deadline::text,''),COALESCE(provider,'') FROM scholarships`)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var s Scholarship
				rows.Scan(&s.ID, &s.Name, &s.Description, &s.Amount, &s.Category, &s.Gender, &s.State, &s.MinIncome, &s.MaxIncome, &s.MinAcademicScore, &s.Deadline, &s.Provider)
				scholarships = append(scholarships, s)
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"scholarships": scholarships})
}

func GetScholarshipMatchesHandler(c *gin.Context) {
	appID := c.Param("app_id")
	matches := []map[string]interface{}{}

	if DB != nil {
		rows, err := DB.Query(`
			SELECT sm.id, s.name, s.amount, sm.match_score, sm.status, sm.created_at
			FROM scholarship_matches sm
			JOIN scholarships s ON s.id = sm.scholarship_id
			WHERE sm.app_id=$1
			ORDER BY sm.match_score DESC`, appID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var id, name, status string
				var amount, matchScore float64
				var createdAt time.Time
				rows.Scan(&id, &name, &amount, &matchScore, &status, &createdAt)
				matches = append(matches, map[string]interface{}{
					"match_id":    id,
					"name":        name,
					"amount":      amount,
					"match_score": matchScore,
					"status":      status,
					"created_at":  createdAt,
				})
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"app_id": appID, "matches": matches})
}

func ApplyScholarshipHandler(c *gin.Context) {
	var req struct {
		AppID         string `json:"app_id" binding:"required"`
		ScholarshipID string `json:"scholarship_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := uuid.New().String()
	if DB != nil {
		DB.Exec(`INSERT INTO scholarship_matches(id,app_id,scholarship_id,match_score,status) VALUES($1,$2,$3,0,'applied')`,
			id, req.AppID, req.ScholarshipID)
	}
	AddAuditLog(req.AppID, "", "SCHOLARSHIP_APPLIED", map[string]string{"scholarship_id": req.ScholarshipID})

	c.JSON(http.StatusOK, gin.H{"match_id": id, "status": "applied"})
}
