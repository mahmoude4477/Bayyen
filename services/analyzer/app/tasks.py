import json
import os

import httpx
from celery import Celery

from .security import callback_headers

celery = Celery("basira", broker=os.environ.get("REDIS_URL", "redis://redis:6379/0"))
celery.conf.update(task_acks_late=True, worker_prefetch_multiplier=1, task_track_started=True)


def send_callback(url: str, payload: dict) -> None:
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
    with httpx.Client(timeout=30) as client:
        response = client.post(url, content=raw, headers=callback_headers(raw))
        response.raise_for_status()


def build_results(job: dict) -> dict:
    results = []
    codes = [item["studentCode"] for item in job["submissions"]]
    for student_index, submission in enumerate(job["submissions"]):
        for question_index, question in enumerate(job["questions"]):
            marker = (student_index + question_index) % 11
            mastery = "MASTERED" if marker > 4 else "PARTIAL" if marker > 1 else "NOT_MASTERED"
            confidence = 0.46 if marker == 0 else 0.68 if marker == 1 else 0.92
            results.append({
                "studentCode": submission["studentCode"],
                "questionId": question["id"],
                "extractedAnswer": question["answerKey"] if mastery == "MASTERED" else "إجابة تحتاج تحقق المعلم",
                "mastery": mastery,
                "score": 1 if mastery == "MASTERED" else 0.5 if mastery == "PARTIAL" else 0,
                "confidence": confidence,
                "needsReview": confidence < 0.7,
            })

    thirds = max(1, len(codes) // 3)
    group_specs = [
        ("foundation", "تأسيس", "بناء المفهوم الأساسي", "نمذجة بصرية ومفردات المفهوم", "coral", codes[:thirds], "تحتاج الأدلة إلى تأسيس موجّه"),
        ("practice", "تدريب", "تدريب موجّه", "تطبيق متدرج مع تغذية راجعة", "amber", codes[thirds:thirds * 2], "إتقان جزئي يحتاج ممارسة"),
        ("mastery", "إتقان", "تطبيق ونقل أثر التعلم", "تحديات مركبة وتفسير الاستراتيجية", "teal", codes[thirds * 2:], "أدلة متسقة على الإتقان"),
    ]
    groups = [{
        "key": key, "label": label, "title": title, "description": description, "color": color,
        "members": [{"studentCode": code, "reason": reason} for code in members],
    } for key, label, title, description, color, members, reason in group_specs]
    gaps = [
        {"slug": "primary-concept", "title": "فهم المفهوم الأساسي", "description": "تظهر إجابات غير مكتملة عند تفسير المفهوم.", "affectedCodes": codes[:thirds], "confidence": 0.91, "evidence": f"{thirds} إجابات متسقة عبر الأسئلة", "color": "#cf6b43", "rank": 1},
        {"slug": "application", "title": "تطبيق الاستراتيجية", "description": "الحاجة إلى ربط الخطوات بسبب الحل.", "affectedCodes": codes[thirds:thirds * 2], "confidence": 0.82, "evidence": "نمط متكرر في التطبيق والتفسير", "color": "#d6a13f", "rank": 2},
    ]
    plans = [{
        "groupKey": group["key"], "objective": group["title"], "duration": "٣ حصص × ٢٥ دقيقة",
        "teacherSteps": ["اعرض دليلًا من إجابات المجموعة", "نمذج التفكير بصوت مسموع", "تحقق من الفهم قبل الانتقال"],
        "explanation": "شرح قصير قائم على الدليل مع إبقاء القرار النهائي للمعلم.",
        "example": "مثال محلول ثم مثال موازٍ يشرحه الطلاب.",
        "activity": "عمل ثنائي باستخدام بطاقات تفسير ومقارنة.",
        "practice": ["سؤال تمهيدي", "تطبيق موجّه", "تطبيق مستقل"],
        "exitTicket": [{"question": "اشرح الفكرة في جملة واحدة.", "answer": "إجابة تربط المفهوم بالاستراتيجية."}],
        "adaptations": {"visual": "دعم بصري وخطوات مرقمة", "language": "تعليمات مختصرة ومثال إضافي"},
    } for group in groups]
    return {"results": results, "gaps": gaps, "groups": groups, "plans": plans}


@celery.task(bind=True, autoretry_for=(httpx.HTTPError,), retry_backoff=True, max_retries=5)
def process_analysis(self, job: dict) -> dict:
    callback = str(job["callbackUrl"])
    send_callback(callback, {"schemaVersion": "analysis-result.v1", "runId": job["runId"], "status": "PROCESSING", "progress": 20, "results": [], "gaps": [], "groups": [], "plans": []})
    output = build_results(job)
    send_callback(callback, {"schemaVersion": "analysis-result.v1", "runId": job["runId"], "status": "REVIEW", "progress": 100, **output})
    return {"runId": job["runId"], "resultCount": len(output["results"])}
