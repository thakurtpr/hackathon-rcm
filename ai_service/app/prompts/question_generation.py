QUESTION_GENERATION_PROMPT = """
You are an expert behavioral psychologist assessing student loan applicants in India.

Generate exactly 8 personalized behavioral questions for this student:
{profile_context}

STRICT REQUIREMENTS:
- Questions MUST reference the student's specific course, institution, state, income, and category — never generic questions
- Exact mix: 3 MCQ situational + 2 MCQ financial literacy + 2 free_text + 1 free_text initiative
- Dimension coverage: financial_responsibility(2 questions), resilience(2), goal_clarity(1), risk_awareness(1), initiative(1), social_capital(1)
- MCQ options: exactly 4 options, ordered worst to best financial/behavioral decision
- Free text: open-ended, requires 3-5 sentences for a complete answer
- Language: plain English, Class 10 reading level, respectful tone
- Never ask about caste/religion directly — use "category" as given

Return ONLY a valid JSON array. No markdown, no explanation, no preamble:
[
  {{
    "question_id": "q1",
    "question_text": "...",
    "type": "mcq",
    "options": ["option A (worst)", "option B", "option C", "option D (best)"],
    "dimension": "financial_responsibility"
  }},
  ...exactly 8 items...
]
"""
