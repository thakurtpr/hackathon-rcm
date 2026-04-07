#!/usr/bin/env python3
"""Seed Redis with Rajan's pre-generated demo data for instant playback."""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

DEMO_APP_ID = "demo-rajan-001"
DEMO_USER_ID = "demo-user-rajan"

RAJAN_QUESTIONS = [
    {
        "question_id": "q1",
        "question_text": "You are a B.Com student at Ravenshaw University. Your first semester loan disbursement of ₹80,000 arrives. Your family's monthly income is ₹23,000. What do you do first?",
        "type": "mcq",
        "options": [
            "Buy a new smartphone to look professional",
            "Give half to family expenses, keep half for yourself",
            "Pay semester fees and keep some for books",
            "Pay the full semester fees, buy required books, and deposit the remainder in a savings account"
        ],
        "dimension": "financial_responsibility"
    },
    {
        "question_id": "q2",
        "question_text": "Your B.Com friend in Cuttack offers to lend you ₹5,000 from your loan money for 2 weeks. What do you do?",
        "type": "mcq",
        "options": [
            "Lend without thinking — he is a friend",
            "Lend half the amount",
            "Politely decline citing loan terms",
            "Explain that student loan funds are meant for educational expenses only and firmly decline"
        ],
        "dimension": "financial_responsibility"
    },
    {
        "question_id": "q3",
        "question_text": "You fail your B.Com Accounts paper in Ravenshaw University's first internal assessment. Your family in Odisha is counting on you. How do you respond?",
        "type": "mcq",
        "options": [
            "Stop studying and consider dropping out",
            "Feel discouraged and study less",
            "Study harder but without any specific plan",
            "Immediately approach the professor for feedback, form a study group, and create a topic-wise revision schedule"
        ],
        "dimension": "resilience"
    },
    {
        "question_id": "q4",
        "question_text": "Your part-time tutoring job in Cuttack ends abruptly mid-semester. You need ₹3,000 for exam fees next month. What do you do?",
        "type": "mcq",
        "options": [
            "Panic and ask family to handle everything",
            "Skip the exam and reappear next year",
            "Look casually for work while hoping for the best",
            "Immediately list all available options: new tutoring students, online gigs, college scholarship office, and bank moratorium request"
        ],
        "dimension": "resilience"
    },
    {
        "question_id": "q5",
        "question_text": "Describe your specific career plan after completing B.Com from Ravenshaw University. Include what steps you will take in the 3 years after graduation.",
        "type": "free_text",
        "options": None,
        "dimension": "goal_clarity"
    },
    {
        "question_id": "q6",
        "question_text": "As a B.Com student from Odisha's SC category taking a ₹4 lakh loan, what risks are you aware of if you borrow more than you need?",
        "type": "mcq",
        "options": [
            "No risk — more money is always better",
            "Slightly higher monthly EMI after graduation",
            "More debt burden and longer repayment period",
            "Higher total interest paid, longer debt obligation reducing your post-graduation financial freedom, and potential credit score impact if EMI is missed"
        ],
        "dimension": "risk_awareness"
    },
    {
        "question_id": "q7",
        "question_text": "Tell me about a specific time when you took initiative — without anyone asking — to solve a problem or improve a situation in your school, home, or community.",
        "type": "free_text",
        "options": None,
        "dimension": "initiative"
    },
    {
        "question_id": "q8",
        "question_text": "How will you use your support network — family, friends, or community organisations in Odisha — to help you succeed in your B.Com course and repay this loan?",
        "type": "free_text",
        "options": None,
        "dimension": "social_capital"
    }
]

RAJAN_BEHAVIORAL_RESULT = {
    "app_id": DEMO_APP_ID,
    "pq_score": 88.0,
    "dimension_scores": {
        "fin_resp": 80.0,
        "resilience": 95.0,
        "goal_clarity": 90.0,
        "risk_aware": 82.0,
        "initiative": 92.0,
        "social_cap": 88.0
    },
    "question_hash": "preseeded",
    "time_flags": []
}


async def seed():
    import redis.asyncio as aioredis

    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    client = aioredis.from_url(redis_url, decode_responses=True)

    await client.setex(
        f"questions:{DEMO_APP_ID}",
        86400,
        json.dumps(RAJAN_QUESTIONS)
    )
    print(f"Cached {len(RAJAN_QUESTIONS)} questions for {DEMO_APP_ID} ✓")

    await client.setex(
        f"behavioral_result:{DEMO_APP_ID}",
        86400,
        json.dumps(RAJAN_BEHAVIORAL_RESULT)
    )
    print(f"Cached behavioral result (PQ={RAJAN_BEHAVIORAL_RESULT['pq_score']}) for {DEMO_APP_ID} ✓")

    await client.aclose()
    print(f"\nDemo seed complete — Rajan ({DEMO_USER_ID}) is ready for instant demo playback.")
    print(f"  App ID : {DEMO_APP_ID}")
    print(f"  PQ Score: {RAJAN_BEHAVIORAL_RESULT['pq_score']}")
    print("  No Groq or Ollama calls needed for this demo user.")


if __name__ == "__main__":
    asyncio.run(seed())
