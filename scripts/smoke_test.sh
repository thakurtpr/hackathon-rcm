#!/bin/bash
# HackForge Smoke Test Script

BASE_AI="http://localhost:8001"
BASE_BE="http://localhost:8000"
BASE_FE="http://localhost:3000"

echo "🔍 Checking HackForge Service Health..."

echo -e "\n1. AI Service Health:"
curl -s $BASE_AI/health | python3 -m json.tool || echo "❌ AI Service NOT REACHABLE"

echo -e "\n2. Backend API Health:"
curl -s $BASE_BE/health | python3 -m json.tool || echo "❌ Backend API NOT REACHABLE"

echo -e "\n3. Frontend Reachability:"
curl -sI $BASE_FE | head -n 1 || echo "❌ Frontend NOT REACHABLE"

echo -e "\n4. Qdrant Seeding Status:"
curl -s http://localhost:6333/collections/scholarships | python3 -m json.tool | grep "vectors_count" || echo "❌ Qdrant/Scholarships NOT FOUND"

echo -e "\n5. Chat Test (English):"
echo "Sending: 'What is the interest rate for education loans?'"
curl -s -X POST $BASE_AI/chat/message \
  -H "Content-Type: application/json" \
  -d '{"user_id":"smoke-test","message":"What is the interest rate for education loans?","language":"en"}' \
  | python3 -m json.tool || echo "❌ Chat endpoint FAILED"

echo -e "\n✅ Smoke Test Complete."
