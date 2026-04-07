#!/usr/bin/env python3
"""Seed Redis and Qdrant with Rajan's pre-generated demo data for instant playback."""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

DEMO_APP_ID = "demo-rajan-001"
DEMO_USER_ID = "demo-user-rajan"

# Rajan Kumar — B.Com student, RCM Bhubaneswar, Odisha, SC category
RAJAN_PROFILE = {
    "user_id": DEMO_USER_ID,
    "name": "Rajan Kumar",
    "course": "B.Com",
    "institution": "Ravenshaw University (RCM), Cuttack",
    "state": "Odisha",
    "city": "Bhubaneswar",
    "category": "SC",
    "annual_income": 280000,
    "percentage": 60.0,
    "loan_amount": 400000,
    "gender": "MALE",
    "mobile": "9876543210",
}

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

# 3 pre-matched scholarships appropriate for SC category student from Odisha
RAJAN_SCHOLARSHIPS = [
    {
        "id": "postmatric-sc-odisha",
        "name": "Post Matric Scholarship for SC Students (Odisha)",
        "amount": 23500,
        "reason": "Rajan qualifies as an SC category student from Odisha pursuing B.Com with family income below ₹2.5 lakh threshold."
    },
    {
        "id": "biju-grant-odisha",
        "name": "Biju Yuva Sashaktikaran Yojana Grant",
        "amount": 10000,
        "reason": "Rajan is an Odisha-domicile student in a recognized university pursuing professional/degree education."
    },
    {
        "id": "medhabruti-odisha",
        "name": "Medhabruti Scholarship (Odisha SC/ST)",
        "amount": 15000,
        "reason": "Rajan is an SC student from Odisha at a government-recognized institution with qualifying academic scores."
    }
]

# Loan policy documents for Qdrant RAG (loan_policies collection)
LOAN_POLICY_DOCS = [
    {
        "id": "policy-1",
        "text": (
            "Vidya Lakshmi Portal: Central government portal for education loans. "
            "Loans up to ₹7.5 lakh need no collateral. Interest subsidy available for SC/ST students "
            "under Central Sector Interest Subsidy (CSIS) scheme. Moratorium period: course duration + 1 year."
        ),
        "source": "Vidya Lakshmi Portal",
    },
    {
        "id": "policy-2",
        "text": (
            "SBI Student Loan Scheme: Loans up to ₹20 lakh for Indian universities. "
            "Rate: 10.85% p.a. for amounts above ₹7.5 lakh. 0.50% concession for girl students. "
            "Repayment period up to 15 years after moratorium. CSIS interest subsidy for EWS/LIG families."
        ),
        "source": "SBI Education Loan",
    },
    {
        "id": "policy-3",
        "text": (
            "Pradhan Mantri Vidya Lakshmi Scheme: No collateral for loans up to ₹7.5 lakh. "
            "Simple interest during moratorium. Priority to SC/ST/OBC/Minority/women borrowers. "
            "Annual income threshold for interest subsidy: ₹4.5 lakh (CSIS)."
        ),
        "source": "PM Vidya Lakshmi",
    },
    {
        "id": "policy-4",
        "text": (
            "Odisha State Scholarship: Post Matric Scholarship for SC students. "
            "Annual income limit: ₹2.5 lakh. Covers tuition, non-refundable fees, maintenance allowance. "
            "Apply via National Scholarship Portal by October 31 each year."
        ),
        "source": "Odisha SC/ST Development Dept",
    },
    {
        "id": "policy-5",
        "text": (
            "Education Loan Repayment: EMI calculation uses reducing balance method. "
            "For ₹4 lakh at 10% for 5 years: EMI approx ₹8,497/month. "
            "Prepayment allowed without penalty. Credit score improves with timely EMI payments. "
            "Loan restructuring available in case of job loss during repayment."
        ),
        "source": "RBI Education Loan Guidelines",
    },
    {
        "id": "policy-6",
        "text": (
            "Dr. Ambedkar Central Sector Scheme: Full interest subsidy during moratorium for SC/OBC students "
            "pursuing technical/professional courses. Family income ceiling: ₹8 lakh per annum. "
            "Covers courses at NAAC-accredited institutions."
        ),
        "source": "Ministry of Social Justice",
    },
]


async def seed_redis(client) -> None:
    """Seed all Redis keys for the demo user."""
    # Questions cache
    await client.setex(
        f"questions:{DEMO_APP_ID}",
        86400,
        json.dumps(RAJAN_QUESTIONS)
    )
    print(f"  Cached {len(RAJAN_QUESTIONS)} questions → questions:{DEMO_APP_ID}")

    # Behavioral/PQ result cache (both key variants for compatibility)
    await client.setex(
        f"behavioral_result:{DEMO_APP_ID}",
        86400,
        json.dumps(RAJAN_BEHAVIORAL_RESULT)
    )
    print(f"  Cached PQ result (score={RAJAN_BEHAVIORAL_RESULT['pq_score']}) → behavioral_result:{DEMO_APP_ID}")

    # pq_result key alias (used by some callers)
    await client.setex(
        f"pq_result:{DEMO_APP_ID}",
        86400,
        json.dumps(RAJAN_BEHAVIORAL_RESULT)
    )
    print(f"  Cached PQ result alias → pq_result:{DEMO_APP_ID}")

    # Rajan profile cache
    await client.setex(
        f"profile:{DEMO_USER_ID}",
        86400,
        json.dumps(RAJAN_PROFILE)
    )
    print(f"  Cached profile → profile:{DEMO_USER_ID}")

    # Pre-matched scholarships
    await client.setex(
        f"scholarships:{DEMO_APP_ID}",
        86400,
        json.dumps(RAJAN_SCHOLARSHIPS)
    )
    print(f"  Cached {len(RAJAN_SCHOLARSHIPS)} pre-matched scholarships → scholarships:{DEMO_APP_ID}")


async def seed_qdrant_loan_policies() -> None:
    """Seed Qdrant loan_policies collection with policy documents."""
    try:
        from qdrant_client import QdrantClient
        from qdrant_client.models import Distance, PointStruct, VectorParams
        import hashlib

        qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
        client = QdrantClient(url=qdrant_url)

        # Ensure collection exists (384-dim for all-MiniLM-L6-v2)
        existing = [c.name for c in client.get_collections().collections]
        if "loan_policies" not in existing:
            client.create_collection(
                collection_name="loan_policies",
                vectors_config=VectorParams(size=384, distance=Distance.COSINE),
            )
            print("  Created loan_policies collection in Qdrant")

        # Try to use sentence-transformers for real embeddings
        try:
            from sentence_transformers import SentenceTransformer
            embedder = SentenceTransformer("all-MiniLM-L6-v2")
            use_real_embeddings = True
            print("  Using sentence-transformers for embeddings")
        except ImportError:
            use_real_embeddings = False
            print("  sentence-transformers not available — using zero-padded embeddings")

        for doc in LOAN_POLICY_DOCS:
            numeric_id = int(hashlib.md5(doc["id"].encode()).hexdigest(), 16) % (2 ** 63)
            if use_real_embeddings:
                vector = embedder.encode(doc["text"]).tolist()
            else:
                vector = [0.0] * 384

            client.upsert(
                collection_name="loan_policies",
                points=[PointStruct(
                    id=numeric_id,
                    vector=vector,
                    payload={
                        "text": doc["text"],
                        "source": doc["source"],
                        "_str_id": doc["id"],
                    }
                )]
            )

        print(f"  Seeded {len(LOAN_POLICY_DOCS)} loan policy docs → Qdrant loan_policies")

    except Exception as exc:
        print(f"  Qdrant seed skipped (Qdrant not reachable): {exc}")


async def seed() -> None:
    import redis.asyncio as aioredis

    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    client = aioredis.from_url(redis_url, decode_responses=True)

    print(f"\nSeeding Redis at {redis_url} ...")
    await seed_redis(client)
    await client.aclose()

    print(f"\nSeeding Qdrant loan_policies (demo docs) ...")
    await seed_qdrant_loan_policies()

    # Also seed the full RBI policy corpus from seed_qdrant.py
    print(f"\nSeeding Qdrant loan_policies (full RBI policy corpus) ...")
    try:
        from qdrant_client import QdrantClient
        from sentence_transformers import SentenceTransformer
        from scripts.seed_qdrant import seed_loan_policies

        qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
        qdrant_client = QdrantClient(url=qdrant_url)
        embedder = SentenceTransformer("all-MiniLM-L6-v2")
        count = seed_loan_policies(qdrant_client, embedder)
        print(f"  Seeded {count} RBI policy chunks → Qdrant loan_policies")
    except Exception as exc:
        print(f"  Full RBI policy seeding skipped: {exc}")

    print(f"\nDemo seed complete — Rajan ({DEMO_USER_ID}) ready for instant demo playback.")
    print(f"  App ID   : {DEMO_APP_ID}")
    print(f"  User ID  : {DEMO_USER_ID}")
    print(f"  PQ Score : {RAJAN_BEHAVIORAL_RESULT['pq_score']}")
    print(f"  Scholarships: {len(RAJAN_SCHOLARSHIPS)} pre-matched")
    print(f"  Loan Policies: {len(LOAN_POLICY_DOCS)} docs in Qdrant")
    print("  No Groq or Ollama calls needed for this demo user.")


if __name__ == "__main__":
    asyncio.run(seed())
