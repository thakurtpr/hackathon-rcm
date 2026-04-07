from typing import Literal, Optional

from pydantic import BaseModel


class QuestionItem(BaseModel):
    question_id: str
    question_text: str
    type: Literal["mcq", "free_text"]
    options: Optional[list[str]] = None
    dimension: str  # financial_responsibility|resilience|goal_clarity|risk_awareness|initiative|social_capital


class QuestionResponse(BaseModel):
    app_id: str
    questions: list[QuestionItem]


class DimensionScores(BaseModel):
    fin_resp: float        # financial_responsibility — matches behavioral_results column
    resilience: float
    goal_clarity: float
    risk_aware: float      # risk_awareness — matches behavioral_results column
    initiative: float
    social_cap: float      # social_capital — matches behavioral_results column


class BehavioralResult(BaseModel):
    app_id: str
    pq_score: float        # 0-100, matches eligibility_scores.pq
    dimension_scores: DimensionScores
    question_hash: str     # sha256 of question_ids
    time_flags: list[str]


class FraudCheck(BaseModel):
    check_name: str
    passed: bool
    reason: Optional[str] = None


class FraudResult(BaseModel):
    app_id: str
    fraud_flag: bool
    fraud_reasons: list[str]
    fraud_confidence: float   # 0-100
    checks: list[FraudCheck]


class OCRResult(BaseModel):
    doc_type: str
    ocr_extracted: dict
    doc_trust_score: float    # 0.0-1.0, maps to documents.trust_score
    doc_authentic: bool


class FaceMatchResult(BaseModel):
    face_match_score: float
    face_match_pass: bool
    flag: Literal["passed", "manual_review", "failed", "no_face_detected"]


class KYCResult(BaseModel):
    user_id: str
    doc_id: str
    doc_type: str
    ocr_extracted: dict
    face_match_score: Optional[float] = None
    face_match_pass: Optional[bool] = None
    doc_authentic: bool
    doc_trust_score: float


class ScholarshipMatch(BaseModel):
    name: str
    amount: int
    source: str
    reason: str
    deadline: str


class ScholarshipResult(BaseModel):
    app_id: str
    matched_scholarships: list[ScholarshipMatch]
    total_scholarship_value: int


class ExplanationResult(BaseModel):
    app_id: str
    decision_explanation: str
    improvement_hints: list[str]


class ChatResponse(BaseModel):
    reply: str
    sources: list[str]
    conversation_id: str


class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
    kafka_connected: bool
    qdrant_connected: bool
    llm_provider: str
