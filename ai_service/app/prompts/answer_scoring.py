ANSWER_SCORING_PROMPT = """
You are scoring a student loan applicant's free-text answer for a behavioral assessment.

Dimension being evaluated: {dimension}
Question: {question_text}
Student's answer: {answer_text}

Scoring rubric for this dimension:
- 0-25: Shows no understanding, impulsive or irresponsible thinking
- 26-50: Some awareness but lacks depth or follow-through planning
- 51-75: Reasonable judgment, shows some maturity
- 76-100: Strong clarity, mature thinking, specific and actionable

Return ONLY valid JSON. No markdown, no explanation:
{{"score": <integer 0 to 100>, "reasoning": "<one sentence explaining the score>"}}
"""
