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
        "source": "RBI Education Loan Circular 2013",
        "text": "RBI education loan circular 2013 guidelines: Education loans cover tuition fees, examination fees, library and laboratory fees, purchase of books, equipment, instruments, and uniforms. Travel expenses, study tours, project work, and thesis expenses are also eligible. Margin requirement: nil for loans up to ₹4 lakh; 5% for domestic loans above ₹4 lakh; 15% for abroad. Interest rate not to exceed Base Rate plus 3% for loans up to ₹4 lakh.",
    },
    {
        "id": "p002",
        "source": "CSIS Central Interest Subsidy Scheme",
        "text": "Central Scheme to provide Interest Subsidy (CSIS) on education loans: Eligibility for students from economically weaker sections (EWS) with annual family income up to ₹4.5 lakh. Interest subsidy available during moratorium period (course duration plus one year) for loans up to ₹7.5 lakh. Applicable for technical and professional courses at NAAC-accredited or NIRF-ranked institutions in India.",
    },
    {
        "id": "p003",
        "source": "Vidya Lakshmi Portal",
        "text": "Vidya Lakshmi portal registration process: Students visit www.vidyalakshmi.co.in and register with Aadhaar-linked mobile number. Complete the Common Application Form (CAF) once and apply to multiple banks. Portal lists all education loan schemes from public sector banks, private sector banks, and NBFCs. Applications tracked online. Linked with National Scholarship Portal for simultaneous scholarship applications.",
    },
    {
        "id": "p004",
        "source": "IBA Model Education Loan Scheme 2012",
        "text": "IBA Model Education Loan Scheme 2012: Provides loans up to ₹10 lakh for studies in India and ₹20 lakh for studies abroad. Maximum loan amounts without collateral up to ₹7.5 lakh — no tangible collateral required, only third-party guarantee for loans between ₹4–7.5 lakh. Above ₹7.5 lakh tangible collateral mandatory. Repayment 5–7 years for up to ₹7.5 lakh; 10–15 years for above.",
    },
    {
        "id": "p005",
        "source": "PM Vidya Lakshmi Education Loan Scheme 2024",
        "text": "PM Vidya Lakshmi scheme: Financial assistance to meritorious students from low-income families. Loans up to ₹10 lakh with 3% interest subvention for annual family income up to ₹8 lakh. Students admitted to Quality Higher Education Institutions (QHEIs) as per NAAC/NIRF rankings eligible. No collateral or third-party guarantee required. Covers only institutions in India.",
    },
    {
        "id": "p006",
        "source": "RBI Education Loan Repayment Holiday Rules",
        "text": "Repayment holiday (moratorium period) rules: Repayment of education loan starts one year after completion of course or six months after securing employment, whichever is earlier. During moratorium period, banks may charge simple interest or compound interest depending on the scheme. Simple interest during moratorium results in lower total loan burden. Banks cannot demand repayment before the moratorium ends.",
    },
    {
        "id": "p007",
        "source": "RBI Education Loan Prepayment Rules",
        "text": "Prepayment penalty rules for education loans: RBI directs that no prepayment penalty shall be charged on education loans with floating interest rates. For fixed-rate education loans, prepayment charges may apply but should be reasonable. Borrowers can make partial prepayments anytime after starting repayment without penalty on floating-rate loans. Foreclosure of education loan is permitted without penalty.",
    },
    {
        "id": "p008",
        "source": "Income Tax Section 80E",
        "text": "Tax benefit under Section 80E of Income Tax Act: Deduction available on interest paid on education loan taken for higher education. Deduction applies for 8 consecutive years starting from the year repayment begins. No upper limit on the deduction amount — entire interest paid in the year is deductible. Applies to loans for self, spouse, children, or student for whom the individual is a legal guardian. Higher education means full-time studies after Class XII.",
    },
    {
        "id": "p009",
        "source": "IBA Eligible Courses and Institutions",
        "text": "Eligible courses and institutions for education loans under IBA scheme: Approved courses include graduation, post-graduation, professional courses, technical diplomas, and vocational courses from recognized universities. Institutions must be approved by UGC, AICTE, IMC, or equivalent statutory bodies. Courses include medicine, engineering, management, law, agriculture, veterinary, computer science, and other professional disciplines at accredited colleges and universities in India and abroad.",
    },
    {
        "id": "p010",
        "source": "RBI Documentation Requirements",
        "text": "Documentation required for education loan: Completed application form with photograph; Proof of identity (Aadhaar, PAN, passport); Proof of address; Academic records (Class X, XII marksheets, graduation certificates); Admission letter or offer letter from institution; Fee structure or cost of study estimate; Income proof of co-applicant parent (salary slips, IT returns, Form 16); Bank statements for last 6 months; Collateral documents if loan above ₹7.5 lakh; Guarantor details if applicable.",
    },
]


def seed_loan_policies(client: QdrantClient, embedder: SentenceTransformer) -> int:
    """Seed loan_policies collection with at least 10 RBI education loan policy chunks.

    Creates the collection if it doesn't exist, then upserts all LOAN_POLICIES entries.
    Returns the number of policies seeded.
    """
    ensure_collection(client, "loan_policies", 384)
    points = []
    for p in LOAN_POLICIES:
        emb = embedder.encode(p["text"]).tolist()
        points.append(
            PointStruct(id=str_id_to_int(p["id"]), vector=emb, payload=p)
        )
    client.upsert(collection_name="loan_policies", points=points)
    return len(points)


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
