"""
Local Quran speech-to-text service. Runs ON YOUR OWN MACHINE; audio never leaves it.

  ./.venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port 8001

Model: tarteel-ai/whisper-base-ar-quran (Apache-2.0), downloaded once from Hugging Face on first start.
Change with ASR_MODEL (e.g. a larger or your own fine-tuned model). Device: ASR_DEVICE=mps|cpu (default: cpu, the safest).
"""
import os
import subprocess
import time

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from transformers import pipeline

MODEL = os.environ.get("ASR_MODEL", "tarteel-ai/whisper-base-ar-quran")
DEVICE = os.environ.get("ASR_DEVICE", "cpu")
MAX_BYTES = 10 * 1024 * 1024
MAX_SECONDS = 90

app = FastAPI(title="Quran ASR (local)")
asr = None


@app.on_event("startup")
def load() -> None:
    global asr
    t = time.time()
    asr = pipeline("automatic-speech-recognition", model=MODEL, device=DEVICE, chunk_length_s=30)
    print(f"model {MODEL} loaded on {DEVICE} in {time.time() - t:.1f}s", flush=True)


def decode(data: bytes) -> np.ndarray:
    """Any audio/video container -> 16 kHz mono float32, using ffmpeg."""
    p = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", "pipe:0", "-f", "f32le", "-ac", "1", "-ar", "16000", "pipe:1"],
        input=data, capture_output=True, timeout=60,
    )
    if p.returncode != 0 or not p.stdout:
        raise HTTPException(400, "Could not decode audio")
    return np.frombuffer(p.stdout, dtype=np.float32)


@app.get("/health")
def health():
    return {"ok": asr is not None, "model": MODEL, "device": DEVICE}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Audio too large")
    audio = decode(data)
    if len(audio) / 16000 > MAX_SECONDS:
        raise HTTPException(413, "Audio too long")
    if len(audio) < 1600:
        return {"text": "", "seconds": 0.0}
    t = time.time()
    out = asr({"raw": audio, "sampling_rate": 16000})
    return {"text": out["text"].strip(), "seconds": round(len(audio) / 16000, 2), "took": round(time.time() - t, 2)}
