#!/usr/bin/env python3
"""Seed Qdrant with scholarships and loan policies."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams
import hashlib

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
DATA_DIR = os.path.join(os.path.dirname(__file__), "../data")

LOAN_POLICIES = [
    {
        "id": "p001",
        "source": "RBI Education Loan Guidelines",
        "text": "RBI education loans cover tuition, examination fees, library and laboratory fees, purchase of books, equipment, instruments, uniforms. Travel expenses, study tours, project work, thesis allowed. Margin: nil up to ₹4 lakh, 5% for above ₹4 lakh domestic, 15% for abroad. Repayment starts one year after course completion or 6 months after getting job, whichever is earlier.",
    },
    {
        "id": "p002",
        "source": "CSIS Interest Subsidy Scheme",
        "text": "Central Scheme to provide Interest Subsidy (CSIS) on education loans for students from economically weaker sections (EWS) with annual family income up to ₹4.5 lakh. Interest subsidy available during moratorium period for loans up to ₹7.5 lakh taken under IBA Model Education Loan Scheme for courses after Class XII in India.",
    },
    {
        "id": "p003",
        "source": "Vidya Lakshmi Portal",
        "text": "Vidya Lakshmi portal is a single window platform for students seeking education loans. Students can apply to multiple banks simultaneously. Portal lists all education loan schemes from public sector banks, private banks, and NBFCs. Common application form (CAF) accepted by all participating banks. Linked with National Scholarship Portal for scholarship applications.",
    },
    {
        "id": "p004",
        "source": "IBA Model Education Loan Scheme",
        "text": "IBA Model Education Loan Scheme provides loans up to ₹10 lakh for studies in India and ₹20 lakh for abroad. No collateral for loans up to ₹4 lakh. For loans between ₹4-7.5 lakh, third party guarantee required. Above ₹7.5 lakh tangible collateral mandatory. Repayment period 5-7 years for up to ₹7.5 lakh, 10-15 years for above. Priority sector classification applies.",
    },
    {
        "id": "p005",
        "source": "PM Vidya Lakshmi Education Loan Scheme 2024",
        "text": "PM Vidya Lakshmi scheme provides financial assistance to meritorious students from low-income families. Loans up to ₹10 lakh with 3% interest subvention for annual family income up to ₹8 lakh. Students admitted to top quality higher education institutions (QHEIs) as per NAAC/NIRF rankings eligible. No collateral or third-party guarantee required.",
    },
]


def ensure_collection(client: QdrantClient, name: str, size: int) -> None:
    existing = [c.name for c in client.get_collections().collections]
    if name not in existing:
        try:
            client.create_collection(
                collection_name=name,
                vectors_config=VectorParams(size=size, distance=Distance.COSINE),
            )
            print(f"  Created collection: {name}")
        except Exception:
            print(f"  Collection already exists (concurrent create): {name}")
    else:
        print(f"  Collection already exists: {name}")


def str_id_to_int(s: str) -> int:
    return int(hashlib.md5(s.encode()).hexdigest(), 16) % (2**63)


def main():
    print("Loading sentence-transformers all-MiniLM-L6-v2...")
    embedder = SentenceTransformer("all-MiniLM-L6-v2")
    print("Model loaded.")

    client = QdrantClient(url=QDRANT_URL)
    print(f"Connected to Qdrant at {QDRANT_URL}")

    ensure_collection(client, "scholarships", 384)
    ensure_collection(client, "loan_policies", 384)
    ensure_collection(client, "face_embeddings", 512)

    # Seed scholarships
    scholarships_path = os.path.join(DATA_DIR, "scholarships.json")
    with open(scholarships_path) as f:
        scholarships = json.load(f)

    scholarship_points = []
    for s in scholarships:
        text = s.get("description", s.get("name", ""))
        emb = embedder.encode(text).tolist()
        scholarship_points.append(
            PointStruct(id=str_id_to_int(s["id"]), vector=emb, payload=s)
        )

    client.upsert(collection_name="scholarships", points=scholarship_points)
    print(f"Seeded {len(scholarship_points)} scholarships ✓")

    # Seed loan policies
    policy_points = []
    for p in LOAN_POLICIES:
        emb = embedder.encode(p["text"]).tolist()
        policy_points.append(
            PointStruct(id=str_id_to_int(p["id"]), vector=emb, payload=p)
        )

    client.upsert(collection_name="loan_policies", points=policy_points)
    print(f"Seeded {len(policy_points)} loan policy documents ✓")
    print("Seeding complete.")


if __name__ == "__main__":
    main()
