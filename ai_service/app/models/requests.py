from typing import Literal, Optional

from pydantic import BaseModel


class AnswerItem(BaseModel):
    question_id: str
    answer: str  # MCQ: "0"|"1"|"2"|"3" (option index). free_text: raw string.
    time_taken_seconds: int


class SubmitAnswersRequest(BaseModel):
    app_id: str
    answers: list[AnswerItem]


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    user_id: Optional[str] = None
    language: Literal["en", "hi", "od"] = "en"
