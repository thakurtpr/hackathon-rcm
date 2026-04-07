import logging

from fastapi import APIRouter, HTTPException, Request

from app.config import get_settings
from app.kafka import producer as kafka_producer
from app.models.requests import SubmitAnswersRequest
from app.models.responses import BehavioralResult, QuestionItem, QuestionResponse
from app.pipelines import behavioral_pipeline
from app.services import backend_client, redis_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/questions", response_model=QuestionResponse)
async def get_questions(app_id: str) -> QuestionResponse:
    questions_raw = await redis_service.get_json(f"questions:{app_id}")
    if not questions_raw:
        raise HTTPException(status_code=404, detail=f"Questions not generated yet for application {app_id}")

    questions = [QuestionItem(**q) for q in questions_raw]
    return QuestionResponse(app_id=app_id, questions=questions)


@router.post("/submit", response_model=BehavioralResult)
async def submit_answers(body: SubmitAnswersRequest) -> BehavioralResult:
    settings = get_settings()
    result = await behavioral_pipeline.score_answers(
        body.app_id, body.answers, redis_service, settings.make_llm_call
    )

    await redis_service.set_json(
        f"behavioral_result:{body.app_id}",
        {
            "app_id": result.app_id,
            "pq_score": result.pq_score,
            "dimension_scores": result.dimension_scores.model_dump(),
            "question_hash": result.question_hash,
            "time_flags": result.time_flags,
        },
        ttl=86400,
    )

    await backend_client.post_behavioral_result(result)

    await kafka_producer.produce(
        "behavioral.scored",
        {
            "app_id": body.app_id,
            "pq_score": result.pq_score,
            "dimension_scores": result.dimension_scores.model_dump(),
        },
    )

    return result
