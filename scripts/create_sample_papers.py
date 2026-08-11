from __future__ import annotations

import html
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"
HTML_OUTPUT = ROOT / "tmp" / "paper-html"
CHROME = Path("C:/Program Files/Google/Chrome/Application/chrome.exe")

QUESTIONS = [
    "سمِّ البسط والمقام في الكسر ٣/٥.",
    "اشرح ما الذي يمثله المقام في النموذج.",
    "اختر الكسر الأكبر: ٢/٣ أم ٣/٥؟",
    "قارن بين ٣/٥ و٥/٨ مع توضيح السبب.",
    "ضع الكسر ٣/٤ على خط الأعداد.",
]

PAPERS = {
    "S-001": [
        "البسط هو ٣، والمقام هو ٥.",
        "المقام يوضح عدد الأجزاء المتساوية التي قُسّم إليها الكل.",
        "٢/٣ هو الأكبر؛ لأن ٢ × ٥ = ١٠، بينما ٣ × ٣ = ٩.",
        "٣/٥ أصغر من ٥/٨؛ لأنهما يساويان ٢٤/٤٠ و٢٥/٤٠.",
        "أضع النقطة عند ٣/٤ المسافة بين الصفر والواحد، أي عند ٠٫٧٥.",
    ],
    "S-002": [
        "البسط ٣ والمقام ٥.",
        "المقام هو عدد الأجزاء المتساوية في الكل.",
        "٣/٥ هو الأكبر لأن ٣ أكبر من ٢.",
        "٣/٥ أصغر قليلًا من ٥/٨؛ لأن ٠٫٦ أقل من ٠٫٦٢٥.",
        "أقسم المسافة إلى أربعة أجزاء وأضع النقطة عند الجزء الثالث.",
    ],
    "S-003": [
        "البسط ٥ والمقام ٣.",
        "المقام يخبرنا كم جزءًا متساويًا يوجد في الواحد الصحيح.",
        "٢/٣ هو الأكبر.",
        "٥/٨ أكبر؛ لأن ٥ أكبر من ٣.",
        "النقطة تكون بين النصف والواحد، عند العلامة الثالثة من أربع علامات.",
    ],
    "S-004": [
        "البسط هو العدد السفلي، والمقام هو العدد العلوي.",
        "المقام يمثل الأجزاء التي أخذناها.",
        "٣/٥ أكبر لأن العدد ٣ أكبر من ٢.",
        "٣/٥ أكبر من ٥/٨.",
        "أضع ٣/٤ بعد العدد ١ على خط الأعداد.",
    ],
    "S-005": [
        "البسط ٣، والمقام ٥.",
        "المقام عدد الأجزاء المتساوية التي تكوّن الكل.",
        "٢/٣ أكبر؛ استخدمت الضرب التبادلي فحصلت على ١٠ و٩.",
        "الإجابة شُطبت وغير واضحة: ٣/٥ … ٥/٨.",
        "أقسم الفترة من ٠ إلى ١ إلى أربعة أجزاء متساوية، ثم أحدد الجزء الثالث.",
    ],
}

CSS = """
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: Arial, Tahoma, sans-serif; color: #25393e; }
.page { width: 210mm; min-height: 297mm; padding: 15mm 17mm 12mm; direction: rtl; }
.header { display: grid; grid-template-columns: 1fr 35mm; align-items: center; gap: 8mm; }
h1 { margin: 0; color: #183f4a; font-size: 23px; line-height: 1.3; }
.code { padding: 10px 8px; color: #fff; background: #2f7068; border-radius: 3px; text-align: center; direction: ltr; font-size: 17px; font-weight: 700; }
.meta { margin: 4mm 0 3mm; color: #637577; font-size: 11px; }
.rule { height: 1px; margin-bottom: 4mm; background: #dce8e4; }
.cards { display: grid; gap: 2.2mm; }
.card { overflow: hidden; background: #f7f9f6; border: 1px solid #d9e1dd; border-radius: 4px; break-inside: avoid; }
.card:nth-child(even) { background: #fbfaf5; }
.label { padding: 5px 11px 2px; color: #2f7068; font-size: 10px; font-weight: 700; }
.question { margin: 0; padding: 3px 11px 7px; border-bottom: 1px solid #e3e8e5; font-size: 12px; font-weight: 700; line-height: 1.55; }
.answer { margin: 0; padding: 8px 11px 9px; color: #315786; font-size: 12px; line-height: 1.65; }
.answer strong { color: #50636b; font-size: 10px; }
.footer { margin-top: 4mm; color: #879392; text-align: center; font-size: 9px; }
"""


def create_html(student_code: str, answers: list[str]) -> Path:
    cards = []
    for index, (question, answer) in enumerate(zip(QUESTIONS, answers), start=1):
        number = "١٢٣٤٥"[index - 1]
        cards.append(
            '<section class="card">'
            f'<div class="label">السؤال {number}</div>'
            f'<p class="question">{html.escape(question)}</p>'
            f'<p class="answer"><strong>إجابة الطالب:</strong> {html.escape(answer)}</p>'
            "</section>"
        )
    content = f"""<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>{CSS}</style></head>
<body><main class="page">
  <header class="header"><h1>ورقة إجابة تجريبية</h1><div class="code">{student_code}</div></header>
  <p class="meta">المادة: الرياضيات · الصف السادس · الدرس: مقارنة الكسور وترتيبها</p>
  <div class="rule"></div>
  <div class="cards">{''.join(cards)}</div>
  <p class="footer">ملف تدريبي مجهول الهوية أُعد لاختبار مسار التحليل الآلي في منصة بيِن.</p>
</main></body></html>"""
    destination = HTML_OUTPUT / f"{student_code}.html"
    destination.write_text(content, encoding="utf-8")
    return destination


def create_pdf(student_code: str, answers: list[str]) -> Path:
    source = create_html(student_code, answers)
    destination = OUTPUT / f"{student_code}.pdf"
    command = [
        str(CHROME),
        "--headless=new",
        "--disable-gpu",
        "--disable-extensions",
        "--no-pdf-header-footer",
        f"--user-data-dir={ROOT / 'tmp' / 'chrome-pdf-profile'}",
        f"--print-to-pdf={destination}",
        source.as_uri(),
    ]
    subprocess.run(command, check=True, capture_output=True, text=True, timeout=60)
    if not destination.exists() or destination.stat().st_size == 0:
        raise RuntimeError(f"لم يُنشأ الملف {destination}")
    return destination


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    HTML_OUTPUT.mkdir(parents=True, exist_ok=True)
    for code, answers in PAPERS.items():
        print(create_pdf(code, answers))


if __name__ == "__main__":
    main()
