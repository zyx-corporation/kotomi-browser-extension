"""
Kotomi ASR Service — HTTP wrapper around faster-whisper for speech recognition.

Usage:
    python asr_service.py

Endpoints:
    GET  /v1/health      — health check with model info
    POST /v1/transcribe  — transcribe uploaded WAV audio

Environment variables:
    ASR_PORT          — HTTP port (default: 8766)
    ASR_MODEL         — model size (default: "small")
    ASR_DEVICE        — "cpu" or "cuda" (default: "cpu")
    ASR_COMPUTE_TYPE  — "int8", "float16", etc. (default: "int8")
"""

import os
import tempfile
from flask import Flask, request, jsonify

app = Flask(__name__)

# --- Configuration ---
ASR_PORT = int(os.environ.get("ASR_PORT", "8766"))
ASR_MODEL = os.environ.get("ASR_MODEL", "small")
ASR_DEVICE = os.environ.get("ASR_DEVICE", "cpu")
ASR_COMPUTE_TYPE = os.environ.get("ASR_COMPUTE_TYPE", "int8")

# --- Lazy model loading ---
_model = None


def get_model():
    """Lazy-load the faster-whisper model on first request."""
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        print(f"[asr-service] loading model: {ASR_MODEL} on {ASR_DEVICE} (compute: {ASR_COMPUTE_TYPE})")
        _model = WhisperModel(
            ASR_MODEL,
            device=ASR_DEVICE,
            compute_type=ASR_COMPUTE_TYPE,
        )
        print("[asr-service] model loaded")
    return _model


# --- Endpoints ---

@app.route("/v1/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model": ASR_MODEL,
        "device": ASR_DEVICE,
        "compute_type": ASR_COMPUTE_TYPE,
    })


@app.route("/v1/transcribe", methods=["POST"])
def transcribe():
    if "audio" not in request.files:
        return jsonify({"error": "no audio file provided"}), 400

    audio_file = request.files["audio"]

    # Save to temp file (faster-whisper prefers file paths)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        model = get_model()
        segments, info = model.transcribe(
            tmp_path,
            beam_size=5,
            language="ja",  # Default to Japanese; can be parameterized later
            vad_filter=True,
        )

        # Collect all segment text
        full_text = ""
        total_confidence = 0.0
        num_segments = 0

        for segment in segments:
            full_text += segment.text
            total_confidence += segment.avg_logprob
            num_segments += 1

        confidence = None
        if num_segments > 0:
            # Convert log-prob to a 0-1 confidence approximation
            avg_logprob = total_confidence / num_segments
            confidence = round(min(max((avg_logprob + 2.0) / 2.0, 0.0), 1.0), 4)

        result = {
            "text": full_text.strip(),
            "confidence": confidence,
        }

        print(f"[asr-service] transcribed: \"{result['text']}\" (conf: {confidence})")
        return jsonify(result)

    except Exception as e:
        print(f"[asr-service] transcription error: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        os.unlink(tmp_path)


if __name__ == "__main__":
    print(f"[asr-service] starting on http://127.0.0.1:{ASR_PORT}")
    print(f"[asr-service] model={ASR_MODEL} device={ASR_DEVICE} compute={ASR_COMPUTE_TYPE}")
    app.run(host="127.0.0.1", port=ASR_PORT, debug=False)
