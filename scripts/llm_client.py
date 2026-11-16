"""Cliente do gateway local FreeLLMAPI.

Corrige os cancelamentos de urllib: timeout explicito, retry e fallback
para o modelo que comprovadamente responde.

Uso:
    from llm_client import chat
    print(chat([{"role": "user", "content": "ola"}]))
"""
import json
import os
import time
import urllib.error
import urllib.request

BASE = os.environ.get("FREELLMAPI_BASE_URL", "http://127.0.0.1:3001/v1").rstrip("/")
KEY = os.environ.get("FREELLMAPI_API_KEY", "")
MODEL = os.environ.get("FREELLMAPI_MODEL", "nvidia/nemotron-3-ultra-550b-a55b")
FALLBACK = os.environ.get("FREELLMAPI_FALLBACK_MODEL", "")
TIMEOUT = float(os.environ.get("FREELLMAPI_TIMEOUT", "120"))


class GatewayError(RuntimeError):
    def __init__(self, status, body):
        super().__init__("HTTP %s: %s" % (status, body[:400]))
        self.status = status


def _post(path, payload, timeout):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + KEY,
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise GatewayError(e.code, e.read().decode("utf-8", "replace"))
    except urllib.error.URLError as e:
        raise GatewayError(0, str(e.reason))


def chat(messages, model=None, timeout=None, retries=1, max_tokens=1024):
    """Envia mensagens e devolve o texto. Tenta o fallback antes de desistir."""
    timeout = timeout or TIMEOUT
    fila = [model or MODEL]
    if FALLBACK and FALLBACK not in fila:
        fila.append(FALLBACK)

    ultimo = None
    for m in fila:
        for tentativa in range(retries + 1):
            try:
                data = _post(
                    "/chat/completions",
                    {"model": m, "messages": messages, "max_tokens": max_tokens},
                    timeout,
                )
                return data["choices"][0]["message"]["content"]
            except GatewayError as e:
                ultimo = e
                if e.status in (400, 404):
                    break
                time.sleep(2 * (tentativa + 1))
    raise ultimo


def chat_stream(messages, model=None, timeout=None):
    """Streaming por linha. Bom para modelos lentos."""
    timeout = timeout or TIMEOUT
    payload = {"model": model or MODEL, "messages": messages, "stream": True}
    req = urllib.request.Request(
        BASE + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + KEY},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        for linha in r:
            linha = linha.decode("utf-8").strip()
            if not linha.startswith("data:"):
                continue
            corpo = linha[5:].strip()
            if corpo == "[DONE]":
                return
            try:
                delta = json.loads(corpo)["choices"][0]["delta"].get("content")
            except (KeyError, IndexError, ValueError):
                continue
            if delta:
                yield delta