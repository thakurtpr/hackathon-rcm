package main

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func ScheduleDisbursalHandler(c *gin.Context) {
	var req struct {
		AppID       string    `json:"app_id" binding:"required"`
		TotalAmount float64   `json:"total_amount" binding:"required"`
		Semesters   int       `json:"semesters"`
		StartDate   time.Time `json:"start_date"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Semesters <= 0 {
		req.Semesters = 4
	}
	if req.StartDate.IsZero() {
		req.StartDate = time.Now().AddDate(0, 1, 0)
	}

	perSemester := req.TotalAmount / float64(req.Semesters)
	schedule := make([]map[string]interface{}, req.Semesters)

	for i := 1; i <= req.Semesters; i++ {
		id := uuid.New().String()
		plannedDate := req.StartDate.AddDate(0, 6*(i-1), 0)
		if DB != nil {
			DB.Exec(`INSERT INTO disbursal_schedule(id,app_id,semester,amount,planned_date,status) VALUES($1,$2,$3,$4,$5,'pending')`,
				id, req.AppID, i, perSemester, plannedDate.Format("2006-01-02"))
		}
		schedule[i-1] = map[string]interface{}{
			"id":           id,
			"semester":     i,
			"amount":       perSemester,
			"planned_date": plannedDate.Format("2006-01-02"),
			"status":       "pending",
		}
	}

	AddAuditLog(req.AppID, "", "DISBURSAL_SCHEDULED", map[string]interface{}{
		"total": req.TotalAmount, "semesters": req.Semesters,
	})

	c.JSON(http.StatusOK, gin.H{"app_id": req.AppID, "schedule": schedule})
}

func ReleaseDisbursalHandler(c *gin.Context) {
	appID := c.Param("app_id")
	semStr := c.Param("sem_num")
	sem, _ := strconv.Atoi(semStr)

	var amount float64
	if DB != nil {
		DB.QueryRow(`SELECT amount FROM disbursal_schedule WHERE app_id=$1 AND semester=$2`, appID, sem).Scan(&amount)
		DB.Exec(`UPDATE disbursal_schedule SET status='disbursed', actual_date=NOW() WHERE app_id=$1 AND semester=$2`, appID, sem)
	}

	PublishKafkaEvent("loan.disbursed", map[string]interface{}{
		"app_id": appID, "semester": sem, "amount": amount,
	})
	AddAuditLog(appID, "", "DISBURSAL_RELEASED", map[string]interface{}{
		"semester": sem, "amount": amount,
	})

	c.JSON(http.StatusOK, gin.H{
		"app_id":    appID,
		"semester":  sem,
		"amount":    amount,
		"status":    "disbursed",
		"disbursed_at": time.Now(),
	})
}

func GetDisbursalScheduleHandler(c *gin.Context) {
	appID := c.Param("app_id")
	schedule := []map[string]interface{}{}

	if DB != nil {
		rows, err := DB.Query(`SELECT id, semester, amount, COALESCE(planned_date::text,''), COALESCE(actual_date::text,''), status FROM disbursal_schedule WHERE app_id=$1 ORDER BY semester`, appID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var id, status, plannedDate, actualDate string
				var semester int
				var amount float64
				rows.Scan(&id, &semester, &amount, &plannedDate, &actualDate, &status)
				schedule = append(schedule, map[string]interface{}{
					"id":           id,
					"semester":     semester,
					"amount":       amount,
					"planned_date": plannedDate,
					"actual_date":  actualDate,
					"status":       status,
				})
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"app_id": appID, "schedule": schedule})
}

func SemesterGateTriggerHandler(c *gin.Context) {
	var req struct {
		AppID          string `json:"app_id"`
		SemesterNumber int    `json:"semester_number"`
	}
	c.ShouldBindJSON(&req)
	PublishKafkaEvent("semester.gate.trigger", map[string]interface{}{
		"app_id": req.AppID, "semester_number": req.SemesterNumber,
	})
	c.JSON(http.StatusOK, gin.H{"status": "triggered", "app_id": req.AppID, "semester": req.SemesterNumber})
}

func SubmitMarksheetHandler(c *gin.Context) {
	var req struct {
		AppID          string  `json:"app_id"`
		SemesterNumber int     `json:"semester_number"`
		SGPA           float64 `json:"sgpa"`
	}
	c.ShouldBindJSON(&req)

	if req.SGPA < 5.0 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "SGPA below minimum threshold 5.0", "next_action": "manual_review"})
		return
	}

	AddAuditLog(req.AppID, "", "MARKSHEET_SUBMITTED", map[string]interface{}{
		"semester": req.SemesterNumber, "sgpa": req.SGPA,
	})

	c.JSON(http.StatusOK, gin.H{"status": "submitted", "sgpa": req.SGPA, "next_semester_unlocked": req.SGPA >= 5.0})
}
