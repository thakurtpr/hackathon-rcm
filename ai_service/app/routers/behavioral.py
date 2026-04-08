import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Response

from app.config import get_settings
from app.kafka import producer as kafka_producer
from app.models.requests import SubmitAnswersRequest
from app.models.responses import QuestionItem, QuestionResponse
from app.pipelines import behavioral_pipeline
from app.services import backend_client, redis_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/questions", response_model=QuestionResponse)
async def get_questions(
    app_id: str,
    user_id: str = Query(default=""),
    force_refresh: bool = Query(default=False),
) -> QuestionResponse:
    """
    Return behavioral assessment questions for the given application.

    If questions are already cached in Redis (TTL 1 hour) they are returned
    immediately unless force_refresh=true is passed, which bypasses the cache
    and generates fresh AI questions from Groq.

    Fetches the student profile from the backend to personalise questions.
    Returns HTTP 503 if the AI generation service fails.
    """
    settings = get_settings()

    # Try to serve from cache first (unless force_refresh requested)
    if not force_refresh:
        questions_raw = await redis_service.get_json(f"questions:{app_id}")
        if questions_raw:
            logger.info(
                "GET /behavioral/questions app_id=%s user_id=%s — served from cache (%d questions)",
                app_id, user_id, len(questions_raw),
            )
            questions = [QuestionItem(**q) for q in questions_raw]
            return QuestionResponse(app_id=app_id, questions=questions)

    # Fetch student profile from backend to personalise questions
    profile: dict = {}
    try:
        profile_data = await backend_client.get_student_profile(app_id=app_id, user_id=user_id)
        if profile_data:
            profile = profile_data
    except Exception as exc:
        logger.warning(
            "Could not fetch profile for app_id=%s user_id=%s — using empty profile: %s",
            app_id, user_id, exc,
        )

    logger.info(
        "GET /behavioral/questions app_id=%s user_id=%s force_refresh=%s — generating fresh questions",
        app_id, user_id, force_refresh,
    )

    try:
        questions_raw = await behavioral_pipeline.generate_questions(
            profile=profile,
            app_id=app_id,
            redis_service=redis_service,
            llm_call_fn=settings.make_llm_call,
            force_refresh=force_refresh,
        )
    except RuntimeError as exc:
        logger.error("Question generation failed for app_id=%s: %s", app_id, exc)
        raise HTTPException(
            status_code=503,
            detail="AI question generation service is temporarily unavailable. Please retry in a moment.",
        )

    logger.info(
        "GET /behavioral/questions app_id=%s — returning %d fresh questions",
        app_id, len(questions_raw),
    )
    questions = [QuestionItem(**q) for q in questions_raw]
    return QuestionResponse(app_id=app_id, questions=questions)


async def _score_and_notify(body: SubmitAnswersRequest) -> None:
    """Background task: score answers, cache result, notify Person B and Kafka."""
    try:
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

        await backend_client.post_behavioral_result(result, body.answers)

        await kafka_producer.produce(
            "behavioral.scored",
            {
                "app_id": body.app_id,
                "pq_score": result.pq_score,
                "dimension_scores": result.dimension_scores.model_dump(),
            },
        )
    except Exception as exc:
        logger.error("Background scoring failed for app_id=%s: %s", body.app_id, exc)


@router.post("/submit", status_code=202)
async def submit_answers(body: SubmitAnswersRequest, background_tasks: BackgroundTasks) -> Response:
    """Accept answers and trigger async scoring. Returns 202 immediately."""
    background_tasks.add_task(_score_and_notify, body)
    return Response(status_code=202)
