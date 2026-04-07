package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func InitDB() {
	connStr := "postgres://postgres:Tanmay@123@localhost:5432/postgres?sslmode=disable"
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Println("WARNING: Failed to connect to DB, continuing in MOCK mode:", err)
		return
	}

	err = db.Ping()
	if err != nil {
		log.Println("WARNING: Could not connect to Postgres DB, continuing in graceful MOCK mode:", err)
		return
	}
	DB = db
	fmt.Println("Connected to PostgreSQL successfully!")
}
