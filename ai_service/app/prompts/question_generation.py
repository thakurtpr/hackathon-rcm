from datetime import datetime as _dt


def _build_question_generation_prompt(profile_context: str) -> str:
    timestamp = _dt.utcnow().isoformat()
    return f"""You are generating a UNIQUE behavioral assessment for a specific student. NEVER repeat the same questions. Every assessment MUST be different.

GENERATION TIMESTAMP (use this to guarantee uniqueness): {timestamp}

STUDENT PROFILE:
{profile_context}

══════════════════════════════════════════════════
MANDATORY PERSONALIZATION RULES (NEVER VIOLATE):
══════════════════════════════════════════════════

Each question MUST reference the student's specific course, institution, state, and background.
You MUST NOT use generic or template-like phrasing. Every question must feel written exclusively for THIS student.

1. REFERENCE THE STUDENT DIRECTLY:
   - Use their EXACT course name and specific academic challenges of that course
   - Mention their institution or city/region by name in at least 2 questions
   - Use their ACTUAL loan amount (not a hypothetical number) in financial scenarios

2. REGIONAL CONTEXT — apply when identifiable from institution/state:
   - Odisha students: reference Odisha economy, steel/mining industry (Rourkela, Nalco, SAIL),
     OSEDC, Biju Yuva Sashaktikaran Yojana, Madhapur IT sector, agriculture/paddy farming,
     KVIC handicrafts, Odisha Adarsha Vidyalaya, local graduate unemployment patterns
   - Maharashtra: Mumbai financial sector, Pune IT industry, MIDC industrial estates
   - Delhi/NCR: startup ecosystem, metro commute challenges, high cost of living
   - Tamil Nadu: IT exports, TIDCO, automotive industry, engineering college saturation
   - Apply similar regional specificity for any other identifiable state

3. CATEGORY-SPECIFIC CONTEXT:
   - SC/ST/OBC: reference awareness of post-matric scholarships, reservation benefits,
     Dr. Ambedkar schemes, NSP portal, CSIS subsidy eligibility
   - EWS: reference PM Vidya Lakshmi, income certificate requirements, EWS reservation
   - General with low income: reference Vidya Lakshmi portal, bank-specific scholarship schemes

4. INCOME-BASED SCENARIOS:
   - Under ₹1 lakh: questions must reflect acute financial pressure, daily survival decisions,
     first-generation college student challenges, risk of dropping out
   - ₹1–3 lakh: moderate financial stress, juggling part-time work with studies
   - ₹3–6 lakh: aspirational family, managing middle-class expectations
   - Above ₹6 lakh: career ambition vs. financial risk management

5. COURSE-SPECIFIC QUESTIONS:
   - B.Com / BBA: reference accounting principles, business taxes, GST, CA aspirations
   - B.Tech / BE: reference placement season, core vs. IT job market, startup vs. campus offers
   - MBBS / BDS: reference bond requirements, rural postings, NExT exam, high cost of medical education
   - MBA: reference ROI of MBA degree, salary expectations, loan-to-income ratio post-graduation
   - B.Sc / BSc Agriculture: research opportunities, lab equipment access, government job aspirations
   - Law (LLB): reference legal aid, court internships, state bar exam

══════════════════════════════════════════════════
QUESTION ORDER (MANDATORY — EXACTLY 8 QUESTIONS):
══════════════════════════════════════════════════

Q1: MCQ   — financial_responsibility  (scenario using their actual loan amount)
Q2: free_text — resilience            (personal setback question referencing their course)
Q3: free_text — goal_clarity          (references their course and regional career opportunities)
Q4: MCQ   — risk_awareness            (first risk scenario using loan amount and income)
Q5: MCQ   — risk_awareness            (second risk scenario — different angle, e.g. interest rate or job market)
Q6: MCQ   — initiative                (first initiative scenario in their institution/city context)
Q7: MCQ   — initiative                (second initiative scenario — different real challenge in their field)
Q8: MCQ   — social_capital            (family/community scenario for their category/income background)

MCQ options: exactly 4 strings, ordered worst to best behavioral/financial decision.
Free text: open-ended, requires 3–5 sentences for a complete answer.

Return ONLY a valid JSON array. No markdown, no explanation, no preamble:
[
  {{
    "question_id": "q1",
    "question_text": "...(explicitly mentions student's course/institution/loan amount)...",
    "type": "mcq",
    "options": ["option A (worst)", "option B", "option C", "option D (best)"],
    "dimension": "financial_responsibility"
  }},
  ...exactly 8 items total...
]"""


# Module-level prompt template kept for backward compatibility with imports.
# New code should call _build_question_generation_prompt(profile_context) directly.
QUESTION_GENERATION_PROMPT = (
    "DEPRECATED — use _build_question_generation_prompt(profile_context) instead.\n"
    "{profile_context}"
)
