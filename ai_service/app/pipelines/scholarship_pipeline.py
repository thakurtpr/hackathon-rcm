import asyncio
import logging
from datetime import date

from app.models.responses import ScholarshipMatch, ScholarshipResult

logger = logging.getLogger(__name__)


def _parse_iso_date(date_str: str) -> date:
    try:
        parts = date_str.split("-")
        return date(int(parts[0]), int(parts[1]), int(parts[2]))
    except Exception:
        return date(2099, 12, 31)


def _matches_filters(payload: dict, profile: dict) -> bool:
    today = date.today()

    deadline_str = payload.get("deadline", "2099-12-31")
    if _parse_iso_date(deadline_str) < today:
        return False

    categories = payload.get("category", ["all"])
    if "all" not in categories:
        student_cat = (profile.get("category") or "general").lower()
        if student_cat not in [c.lower() for c in categories]:
            return False

    max_income = payload.get("income_limit", payload.get("max_family_income"))
    if max_income is not None:
        student_income = profile.get("annual_income", 0)
        if student_income is not None and student_income > max_income:
            return False

    min_pct = payload.get("min_percentage")
    if min_pct is not None:
        student_pct = profile.get("percentage", 0)
        if student_pct is not None and student_pct < min_pct:
            return False

    state = payload.get("state", "all")
    if state != "all":
        student_state = (profile.get("state") or "").lower()
        if student_state != state.lower():
            return False

    gender_filter = payload.get("gender", "any")
    if gender_filter != "any":
        student_gender = (profile.get("gender") or "").upper()
        if student_gender != gender_filter.upper():
            return False

    return True


async def match(
    user_id: str,
    app_id: str,
    backend_client,
    qdrant_service,
    embedder,
    llm_call_fn,
) -> ScholarshipResult:
    profile = await backend_client.get_profile(user_id)
    if not profile:
        return ScholarshipResult(app_id=app_id, matched_scholarships=[], total_scholarship_value=0)

    profile_text = (
        f"Student studying {profile.get('course', 'unknown')} at "
        f"{profile.get('institution', 'unknown')} in {profile.get('state', 'india')}. "
        f"Category: {profile.get('category', 'general')}. "
        f"Family income: ₹{profile.get('annual_income', 0)}/year. "
        f"Academic score: {profile.get('percentage', 0)}%. "
        f"Gender: {profile.get('gender', 'unknown')}. "
        f"Loan type: {profile.get('loan_type', 'education')}."
    )

    embedding = await asyncio.to_thread(embedder.encode, profile_text)
    embedding_list = embedding.tolist()

    results = await qdrant_service.search("scholarships", embedding_list, limit=15)

    filtered = []
    for r in results:
        payload = r.payload if hasattr(r, "payload") else {}
        if _matches_filters(payload, profile):
            filtered.append(r)

    top5 = filtered[:5]
    matched_scholarships = []

    for r in top5:
        payload = r.payload if hasattr(r, "payload") else {}
        scholarship_name = payload.get("name", "Unknown Scholarship")
        description = payload.get("description", "")
        amount = int(payload.get("amount", 0))
        source = payload.get("source", "")
        deadline = payload.get("deadline", "2025-12-31")

        reason_prompt = (
            f"In one sentence, explain specifically why this student qualifies for '{scholarship_name}'. "
            f"Student: {profile_text}. "
            f"Scholarship: {description}. "
            f"Return ONLY the sentence, no quotes."
        )
        try:
            reason = await asyncio.to_thread(llm_call_fn, reason_prompt)
            reason = reason.strip().strip('"').strip("'")
        except Exception:
            reason = f"Student meets the eligibility criteria for {scholarship_name}."

        matched_scholarships.append(
            ScholarshipMatch(
                name=scholarship_name,
                amount=amount,
                source=source,
                reason=reason,
                deadline=deadline,
            )
        )

    total_value = sum(s.amount for s in matched_scholarships)
    return ScholarshipResult(
        app_id=app_id,
        matched_scholarships=matched_scholarships,
        total_scholarship_value=total_value,
    )
