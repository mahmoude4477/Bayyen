import json
import os

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, HttpUrl
from redis import Redis

from .security import verify_request
from .tasks import process_analysis

app = FastAPI(title="Basira Analyzer", version="1.0.0")
redis = Redis.from_url(os.environ.get("REDIS_URL", "redis://redis:6379/0"), decode_responses=True)


class Question(BaseModel):
    id: str
    prompt: str
    answerKey: str
    rubric: str | None
    objectiveCode: str


class Submission(BaseModel):
    assetId: str
    studentId: str
    studentCode: str
    downloadUrl: HttpUrl
    contentType: str
    checksum: str | None


class Job(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schemaVersion: str = Field(pattern=r"^analysis-job\.v1$")
    runId: str
    analysisId: str
    callbackUrl: HttpUrl
    locale: str = Field(pattern=r"^ar$")
    questions: list[Question] = Field(min_length=5, max_length=10)
    submissions: list[Submission] = Field(min_length=1, max_length=36)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": os.environ.get("ANALYZER_MODE", "fixture")}


@app.post("/v1/jobs", status_code=202)
async def create_job(request: Request) -> dict[str, str]:
    raw = await request.body()
    headers = request.headers
    if not verify_request(raw, headers.get("x-basira-timestamp", ""), headers.get("x-basira-nonce", ""), headers.get("x-basira-signature", "")):
        raise HTTPException(status_code=401, detail="invalid signature")

    job = Job.model_validate(json.loads(raw))
    replay_key = f"basira:job:{job.runId}"
    existing = redis.get(replay_key)
    if existing:
        return {"jobId": existing, "status": "duplicate"}

    task = process_analysis.delay(job.model_dump(mode="json"))
    redis.set(replay_key, task.id, ex=86400, nx=True)
    return {"jobId": task.id, "status": "queued"}
