
import re
from sqlalchemy.orm import Session

from app.models.trace import Trace
from app.models.evaluation import Evaluation


# Common words that do not add much meaning
STOP_WORDS = {
    "what", "is", "are", "the", "a", "an",
    "in", "on", "of", "to", "for", "and",
    "how", "why", "explain", "me", "my",
    "this", "that", "it", "with", "from",
    "by", "be", "was", "were", "can", "could",
    "would", "should", "do", "does", "did",
    "i", "you", "we", "they", "he", "she",
    "your", "our", "their", "about", "please"
}


def tokenize(text: str) -> set:
    """
    Convert text into meaningful lowercase words.
    Remove punctuation and common stop words.
    """

    words = re.findall(r"[a-zA-Z0-9]+", text.lower())

    return {
        word for word in words
        if word not in STOP_WORDS and len(word) > 1
    }


# 1. Calculate relevance
def calculate_relevance(input_text: str, output_text: str) -> float:

    input_words = tokenize(input_text)
    output_words = tokenize(output_text)

    if not input_words:
        return 100.0 if output_text.strip() else 0.0

    if not output_text.strip():
        return 0.0

    matched_words = input_words.intersection(output_words)

    score = len(matched_words) / len(input_words) * 100

    return round(score, 2)


# 2. Calculate completeness
def calculate_completeness(output_text: str) -> float:

    words = output_text.split()
    word_count = len(words)

    if word_count == 0:
        return 0.0

    score = 20.0

    # Reward useful answer length
    if word_count >= 5:
        score += 20

    if word_count >= 15:
        score += 20

    if word_count >= 30:
        score += 20

    # Reward basic answer structure
    if re.search(r"[.!?]", output_text):
        score += 10

    # Reward structured explanations
    if re.search(
        r"\b(first|second|finally|because|therefore|for example)\b",
        output_text.lower()
    ):
        score += 10

    return min(score, 100.0)


# 3. Calculate response quality
def calculate_quality(output_text: str, status: str) -> float:

    if status != "success" or not output_text.strip():
        return 0.0

    score = 100.0
    lower_output = output_text.lower()
    word_count = len(output_text.split())

    # Penalize very short answers
    if word_count < 5:
        score -= 30
    elif word_count < 10:
        score -= 10

    # Penalize placeholder or demo responses
    weak_phrases = [
        "demo response",
        "placeholder response",
        "sample output",
        "not implemented",
        "todo:"
    ]

    for phrase in weak_phrases:
        if phrase in lower_output:
            score -= 20

    # Penalize answers that explicitly say they failed
    if "traceback" in lower_output or "internal server error" in lower_output:
        score -= 30

    # Penalize excessive repeated words
    words = lower_output.split()

    if len(words) >= 5:
        unique_ratio = len(set(words)) / len(words)

        if unique_ratio < 0.4:
            score -= 20

    return round(max(score, 0.0), 2)


# 4. Generate actionable evaluation feedback
def generate_feedback(
    relevance_score: float,
    completeness_score: float,
    quality_score: float,
    overall_score: float
) -> str:

    feedback_parts = []

    if relevance_score >= 80:
        feedback_parts.append("The response is highly relevant.")
    elif relevance_score >= 50:
        feedback_parts.append("The response is partially relevant.")
    else:
        feedback_parts.append("The response needs better alignment with the input.")

    if completeness_score >= 80:
        feedback_parts.append("The answer has good completeness.")
    elif completeness_score >= 50:
        feedback_parts.append("The answer could include more explanation.")
    else:
        feedback_parts.append("The answer is too short or lacks structure.")

    if quality_score >= 80:
        feedback_parts.append("Response quality is good.")
    elif quality_score >= 50:
        feedback_parts.append("Response quality needs improvement.")
    else:
        feedback_parts.append("Response quality is poor or the agent failed.")

    if overall_score >= 80:
        feedback_parts.append("Overall performance: Excellent.")
    elif overall_score >= 60:
        feedback_parts.append("Overall performance: Good, with room for improvement.")
    elif overall_score >= 40:
        feedback_parts.append("Overall performance: Average.")
    else:
        feedback_parts.append("Overall performance: Needs significant improvement.")

    return " ".join(feedback_parts)


# 5. Evaluate a trace and save the result
def evaluate_trace(trace_id: str, db: Session):

    # Find the original trace
    trace = db.query(Trace).filter(
        Trace.id == trace_id
    ).first()

    if trace is None:
        return None

    # Calculate individual evaluation scores
    relevance_score = calculate_relevance(
        trace.input,
        trace.output
    )

    completeness_score = calculate_completeness(
        trace.output
    )

    quality_score = calculate_quality(
        trace.output,
        trace.status
    )

    # Calculate weighted overall score
    overall_score = (
        relevance_score * 0.4
        + completeness_score * 0.3
        + quality_score * 0.3
    )

    overall_score = round(overall_score, 2)

    # Generate detailed feedback
    feedback = generate_feedback(
        relevance_score,
        completeness_score,
        quality_score,
        overall_score
    )

    # Create evaluation record
    new_evaluation = Evaluation(
        trace_id=trace.id,
        relevance_score=relevance_score,
        completeness_score=completeness_score,
        quality_score=quality_score,
        overall_score=overall_score,
        feedback=feedback
    )

    # Save evaluation in PostgreSQL
    try:
        db.add(new_evaluation)
        db.commit()
        db.refresh(new_evaluation)

    except Exception:
        db.rollback()
        raise

    return new_evaluation
