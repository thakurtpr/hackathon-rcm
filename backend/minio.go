package main

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"mime/multipart"
	"net/url"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

var MinioClient *minio.Client
var MinioBucket string

func InitMinio() {
	endpoint := fmt.Sprintf("%s:%s",
		getEnv("MINIO_HOST", "localhost"),
		getEnv("MINIO_PORT", "9000"),
	)
	accessKey := getEnv("MINIO_ACCESS_KEY", "minioadmin")
	secretKey := getEnv("MINIO_SECRET_KEY", "minioadmin")
	MinioBucket = getEnv("MINIO_BUCKET", "loan-docs")

	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: false,
	})
	if err != nil {
		log.Printf("WARNING: MinIO init failed: %v", err)
		return
	}

	ctx := context.Background()
	exists, err := client.BucketExists(ctx, MinioBucket)
	if err != nil {
		log.Printf("WARNING: MinIO bucket check failed: %v", err)
		return
	}
	if !exists {
		if err := client.MakeBucket(ctx, MinioBucket, minio.MakeBucketOptions{}); err != nil {
			log.Printf("WARNING: MinIO bucket creation failed: %v", err)
			return
		}
		log.Printf("MinIO bucket '%s' created", MinioBucket)
	}

	MinioClient = client
	log.Println("MinIO connected")
}

func UploadToMinio(ctx context.Context, objectName string, file multipart.File, size int64, contentType string) (string, error) {
	if MinioClient == nil {
		return fmt.Sprintf("mock/%s", objectName), nil
	}
	_, err := MinioClient.PutObject(ctx, MinioBucket, objectName, file, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s/%s", MinioBucket, objectName), nil
}

func UploadBytesToMinio(ctx context.Context, objectName string, data []byte, contentType string) (string, error) {
	if MinioClient == nil {
		return fmt.Sprintf("mock/%s", objectName), nil
	}
	reader := bytes.NewReader(data)
	_, err := MinioClient.PutObject(ctx, MinioBucket, objectName, reader, int64(len(data)), minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s/%s", MinioBucket, objectName), nil
}

func GetMinioPresignedURL(ctx context.Context, objectName string) (string, error) {
	if MinioClient == nil {
		return fmt.Sprintf("http://localhost:9000/%s/%s", MinioBucket, objectName), nil
	}
	reqParams := make(url.Values)
	presigned, err := MinioClient.PresignedGetObject(ctx, MinioBucket, objectName, 0, reqParams)
	if err != nil {
		return "", err
	}
	return presigned.String(), nil
}
