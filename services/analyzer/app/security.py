import hashlib
import hmac
import os
import time

WINDOW_SECONDS = 300


def _message(timestamp: str, nonce: str, raw_body: bytes) -> bytes:
    return timestamp.encode() + b"." + nonce.encode() + b"." + raw_body


def verify_request(raw_body: bytes, timestamp: str, nonce: str, signature: str) -> bool:
    try:
        if abs(time.time() - int(timestamp)) > WINDOW_SECONDS:
            return False
    except ValueError:
        return False
    key = os.environ["WEB_TO_PYTHON_HMAC_KEYS"].encode()
    expected = hmac.new(key, _message(timestamp, nonce, raw_body), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def callback_headers(raw_body: bytes) -> dict[str, str]:
    timestamp = str(int(time.time()))
    nonce = os.urandom(16).hex()
    key = os.environ["PYTHON_TO_WEB_HMAC_KEYS"].encode()
    signature = hmac.new(key, _message(timestamp, nonce, raw_body), hashlib.sha256).hexdigest()
    return {
        "content-type": "application/json",
        "x-basira-key-id": "v1",
        "x-basira-timestamp": timestamp,
        "x-basira-nonce": nonce,
        "x-basira-signature": signature,
    }
