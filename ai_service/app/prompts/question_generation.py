QUESTION_GENERATION_PROMPT = """
You are an expert behavioral psychologist creating personalized assessment questions for a student loan platform in India. Your goal is to generate questions that feel WRITTEN SPECIFICALLY FOR THIS STUDENT — not generic questionnaires.

STUDENT PROFILE:
{profile_context}

══════════════════════════════════════════════════
MANDATORY PERSONALIZATION RULES (NEVER VIOLATE):
══════════════════════════════════════════════════

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
QUESTION MIX (MANDATORY — EXACTLY 8 QUESTIONS):
══════════════════════════════════════════════════

- Q1: MCQ — financial_responsibility (uses their actual loan amount in scenario)
- Q2: MCQ — resilience (set in their specific institution/city context)
- Q3: free_text — goal_clarity (references their course and regional career opportunities)
- Q4: MCQ — financial_responsibility (income/budget management for their income band)
- Q5: MCQ — resilience (academic setback specific to their course challenges)
- Q6: free_text — initiative (references a real challenge in their field or region)
- Q7: MCQ — risk_awareness (uses their loan amount and expected salary post-graduation)
- Q8: free_text — social_capital (references family/community context for their category/income)

MCQ options: exactly 4, ordered worst to best financial/behavioral decision.
Free text: open-ended question requiring 3–5 sentences for a complete answer.

Return ONLY a valid JSON array. No markdown, no explanation, no preamble:
[
  {{
    "question_id": "q1",
    "question_text": "...(mentions student's course/institution/loan amount directly)...",
    "type": "mcq",
    "options": ["option A (worst)", "option B", "option C", "option D (best)"],
    "dimension": "financial_responsibility"
  }},
  ...exactly 8 items...
]
"""
