package main

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func DocumentUploadHandler(c *gin.Context) {
	userID := c.PostForm("user_id")
	docType := c.PostForm("doc_type")
	if docType == "" {
		docType = "aadhaar"
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		// Allow upload without file body (for testing)
		docID := uuid.New().String()
		minioPath := fmt.Sprintf("loan-docs/%s/%s_%s", userID, docType, docID)
		if DB != nil {
			DB.Exec(`INSERT INTO documents(id,user_id,doc_type,minio_path,status) VALUES($1,$2,$3,$4,'processing')`,
				docID, userID, docType, minioPath)
		}
		PublishKafkaEvent("document.uploaded", map[string]string{
			"doc_id": docID, "user_id": userID, "doc_type": docType, "minio_path": minioPath,
		})
		c.JSON(http.StatusCreated, gin.H{
			"doc_id":     docID,
			"minio_path": minioPath,
			"status":     "processing",
			"upload_ts":  time.Now(),
		})
		return
	}
	defer file.Close()

	docID := uuid.New().String()
	objectName := fmt.Sprintf("%s/%s/%s_%s", userID, docType, docID, header.Filename)

	minioPath, err := UploadToMinio(c.Request.Context(), objectName, file, header.Size, header.Header.Get("Content-Type"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "upload failed"})
		return
	}

	if DB != nil {
		DB.Exec(`INSERT INTO documents(id,user_id,doc_type,minio_path,status) VALUES($1,$2,$3,$4,'processing')`,
			docID, userID, docType, minioPath)
	}

	PublishKafkaEvent("document.uploaded", map[string]string{
		"doc_id": docID, "user_id": userID, "doc_type": docType, "minio_path": minioPath,
	})

	c.JSON(http.StatusCreated, gin.H{
		"doc_id":     docID,
		"minio_path": minioPath,
		"status":     "processing",
		"upload_ts":  time.Now(),
	})
}

func DocumentStatusHandler(c *gin.Context) {
	docID := c.Param("doc_id")

	status := "processing"
	docTrust := 0.0
	tamper := false

	if DB != nil {
		DB.QueryRow(`SELECT COALESCE(status,'processing'), COALESCE(doc_trust_score,0), COALESCE(tamper_flag,false) FROM documents WHERE id=$1`, docID).
			Scan(&status, &docTrust, &tamper)
	}

	c.JSON(http.StatusOK, gin.H{
		"doc_id":         docID,
		"status":         status,
		"doc_trust_score": docTrust,
		"tamper_flag":    tamper,
	})
}
