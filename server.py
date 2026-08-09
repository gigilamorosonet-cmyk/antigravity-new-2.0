"""Antigravity — backend multi-agents.

Vrais appels LLM (Anthropic natif + tout endpoint OpenAI-compatible + webhook),
clés API chiffrées (Fernet), mémoire partagée/privée injectée, skills, routeur
configurable par l'utilisateur, juge de boucle, stats réelles.
"""
from fastapi import FastAPI, WebSocket, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse, PlainTextResponse
import json
import os
import re
import httpx
from pydantic import BaseModel
from pathlib import Path
from datetime import datetime, timezone
from contextlib import contextmanager
import sqlite3
from cryptography.fernet import Fernet

app = FastAPI(title="Antigravity Multi-Agent API")

# CORS restreint aux frontends locaux (élargir lors de l'hébergement public)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174",
                   "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Jeton d'accès optionnel : définir ANTIGRAVITY_TOKEN pour protéger l'API
# (utile dès que le serveur est exposé au-delà de localhost).
ACCESS_TOKEN = os.environ.get("ANTIGRAVITY_TOKEN", "")

@app.middleware("http")
async def auth_guard(request: Request, call_next):
    # /api/hooks/* reste ouvert : c'est la porte d'entrée des sites externes
    if (ACCESS_TOKEN and request.url.path.startswith("/api")
            and not request.url.path.startswith("/api/hooks/")):
        auth = request.headers.get("authorization", "")
        if auth != f"Bearer {ACCESS_TOKEN}":
            from fastapi.responses import JSONResponse
            return JSONResponse({"detail": "Jeton d'accès requis"}, status_code=401)
    return await call_next(request)

# ---------------------------------------------------------------- chiffrement
KEY_FILE = Path(__file__).parent / ".secret.key"
if not KEY_FILE.exists():
    KEY_FILE.write_bytes(Fernet.generate_key())
fernet = Fernet(KEY_FILE.read_bytes())

def enc(s: str) -> str:
    return fernet.encrypt(s.encode()).decode() if s else ""

def dec(s: str) -> str:
    if not s:
        return ""
    try:
        return fernet.decrypt(s.encode()).decode()
    except Exception:
        return s  # legacy plaintext

# ---------------------------------------------------------------- base
DB_PATH = Path(__file__).parent / "agentnexus.db"

@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()

def init_db():
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS agents(
            id INTEGER PRIMARY KEY, name TEXT, kind TEXT,
            provider TEXT, model TEXT, color TEXT, icon TEXT,
            system_prompt TEXT, skills TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS memory(
            id INTEGER PRIMARY KEY, agent_id INTEGER,
            scope TEXT, content TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS messages(
            id INTEGER PRIMARY KEY, agent_id INTEGER,
            role TEXT, content TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS api_keys(
            provider TEXT PRIMARY KEY, key TEXT, base_url TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS skills(
            id INTEGER PRIMARY KEY, name TEXT, category TEXT,
            description TEXT, content TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS requests_log(
            id INTEGER PRIMARY KEY, agent_id INTEGER, provider TEXT, model TEXT,
            tokens_in INTEGER, tokens_out INTEGER, cost REAL, created_at TEXT);
        CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS workflows(
            id INTEGER PRIMARY KEY, name TEXT, data TEXT, updated_at TEXT);
        CREATE TABLE IF NOT EXISTS activity(
            id INTEGER PRIMARY KEY, kind TEXT, agent_id INTEGER, agent_name TEXT,
            title TEXT, content TEXT, cost REAL, created_at TEXT);
        CREATE TABLE IF NOT EXISTS workflow_runs(
            id INTEGER PRIMARY KEY, workflow_name TEXT, logs TEXT,
            cost REAL, steps INTEGER, created_at TEXT);
        CREATE TABLE IF NOT EXISTS integrations(
            id INTEGER PRIMARY KEY, type TEXT, name TEXT, config TEXT,
            agent_id INTEGER, mode TEXT, active INTEGER DEFAULT 1, created_at TEXT);
        CREATE TABLE IF NOT EXISTS inbox(
            id INTEGER PRIMARY KEY, integration_id INTEGER, source TEXT,
            sender TEXT, subject TEXT, content TEXT, draft TEXT,
            status TEXT DEFAULT 'new', error TEXT, created_at TEXT, updated_at TEXT);
        """)
        # colonnes agents externes (migration douce)
        for col in ("base_url TEXT", "api_key TEXT", "api_format TEXT"):
            try:
                c.execute(f"ALTER TABLE agents ADD COLUMN {col}")
            except sqlite3.OperationalError:
                pass
    with db() as c:
        if not c.execute("SELECT id FROM agents LIMIT 1").fetchone():
            defaults = [
                ("Hermes Agent", "agent", "openrouter", "nousresearch/hermes-4-70b", "#a8632f", "zap",
                 "Tu es Hermes, un agent généraliste rapide et direct.", "[]"),
                ("OpenClaw", "agent", "anthropic", "claude-sonnet-4", "#171512", "claw",
                 "Tu es OpenClaw, spécialiste des tâches complexes.", "[]"),
                ("DeepSeek", "model", "deepseek", "deepseek-chat", "#c8802f", "brain",
                 "Tu es un modèle économique pour les tâches simples.", "[]"),
                ("Mistral", "model", "mistral", "mistral-large-latest", "#8a847b", "wind",
                 "Tu es Mistral, équilibré et efficace.", "[]"),
            ]
            now = datetime.now(timezone.utc).isoformat()
            for name, kind, prov, model, color, icon, sp, sk in defaults:
                c.execute(
                    "INSERT INTO agents(name,kind,provider,model,color,icon,system_prompt,skills,created_at)"
                    " VALUES(?,?,?,?,?,?,?,?,?)",
                    (name, kind, prov, model, color, icon, sp, sk, now))

init_db()

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def log_activity(kind: str, agent: dict | None, title: str, content: str = "", cost: float = 0.0):
    """Journal d'activité global — tout ce que les IA font, consultable et exportable."""
    with db() as c:
        c.execute("INSERT INTO activity(kind,agent_id,agent_name,title,content,cost,created_at)"
                  " VALUES(?,?,?,?,?,?,?)",
                  (kind, agent.get("id") if agent else None,
                   agent.get("name") if agent else None,
                   title[:200], content[:1000], cost, now_iso()))

# ---------------------------------------------------------------- coûts
# $ par million de tokens (entrée, sortie) — approximations par préfixe de modèle
PRICING = [
    ("claude-opus", 15, 75), ("claude-sonnet", 3, 15), ("claude-haiku", 1, 5), ("claude", 3, 15),
    ("gpt-4o-mini", 0.15, 0.6), ("gpt-4o", 2.5, 10), ("gpt-4.1-mini", 0.4, 1.6), ("gpt-4.1", 2, 8),
    ("o3", 10, 40), ("o1", 15, 60), ("gpt", 2, 8),
    ("mistral-large", 2, 6), ("mistral-small", 0.2, 0.6), ("mistral", 0.5, 1.5), ("magistral", 2, 5),
    ("deepseek-reasoner", 0.55, 2.19), ("deepseek", 0.27, 1.1),
    ("hermes", 0.3, 0.8),
    ("gemini-2.5-pro", 1.25, 10), ("gemini-2.5-flash", 0.3, 2.5), ("gemini", 0.3, 2.5),
    ("grok-4", 3, 15), ("grok", 2, 10),
    ("llama-4", 0.2, 0.6), ("llama", 0.2, 0.6),
    ("qwen", 0.3, 0.9), ("mixtral", 0.6, 0.6), ("kimi", 0.6, 2.5), ("glm", 0.6, 2.2),
]

def estimate_cost(model: str, t_in: int, t_out: int) -> float:
    m = (model or "").lower().split("/")[-1]
    for prefix, pin, pout in PRICING:
        if m.startswith(prefix):
            return (t_in * pin + t_out * pout) / 1_000_000
    return (t_in * 1 + t_out * 3) / 1_000_000

PROVIDER_BASES = {
    "openai": "https://api.openai.com/v1",
    "mistral": "https://api.mistral.ai/v1",
    "deepseek": "https://api.deepseek.com/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "groq": "https://api.groq.com/openai/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
    "xai": "https://api.x.ai/v1",
    "together": "https://api.together.xyz/v1",
    "fireworks": "https://api.fireworks.ai/inference/v1",
}

def get_key(provider: str):
    with db() as c:
        row = c.execute("SELECT * FROM api_keys WHERE provider=?", (provider,)).fetchone()
    if not row:
        return None
    return {"key": dec(row["key"]), "base_url": row["base_url"]}

def agent_has_key(a: dict) -> bool:
    if a.get("kind") == "external":
        return bool(a.get("base_url"))
    k = get_key(a.get("provider", ""))
    if a.get("provider") == "custom":
        return bool(k and k.get("base_url"))
    return bool(k and k.get("key"))

# ---------------------------------------------------------------- prompt
def build_system_prompt(agent: dict) -> str:
    parts = [agent.get("system_prompt") or "Tu es un assistant utile."]
    with db() as c:
        glob = c.execute("SELECT content FROM memory WHERE scope='global' ORDER BY id").fetchall()
        priv = c.execute("SELECT content FROM memory WHERE scope='private' AND agent_id=? ORDER BY id",
                         (agent["id"],)).fetchall()
        skill_ids = json.loads(agent.get("skills") or "[]")
        skills = []
        if skill_ids:
            marks = ",".join("?" * len(skill_ids))
            skills = c.execute(f"SELECT name, content FROM skills WHERE id IN ({marks})", skill_ids).fetchall()
    if glob:
        parts.append("## Mémoire partagée (commune à tous les agents)\n" + "\n".join(f"- {r['content']}" for r in glob))
    if priv:
        parts.append("## Ta mémoire individuelle\n" + "\n".join(f"- {r['content']}" for r in priv))
    for s in skills:
        parts.append(f"## Skill : {s['name']}\n{s['content']}")
    return "\n\n".join(parts)

# ---------------------------------------------------------------- appels LLM
async def call_anthropic(key: str, model: str, system: str, messages: list):
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
            json={"model": model, "max_tokens": 4096, "system": system, "messages": messages},
        )
    if r.status_code != 200:
        raise HTTPException(502, f"Anthropic {r.status_code} : {r.text[:300]}")
    d = r.json()
    text = "".join(b.get("text", "") for b in d.get("content", []))
    u = d.get("usage", {})
    return text, u.get("input_tokens", 0), u.get("output_tokens", 0)

async def call_openai_compat(base: str, key: str, model: str, system: str, messages: list):
    base = base.rstrip("/")
    if not base.endswith("/v1") and "/v1/" not in base:
        # tolère les bases données sans /v1 (Ollama, LM Studio l'exposent avec)
        probe = base + "/v1"
    else:
        probe = base
    headers = {"Authorization": f"Bearer {key}"} if key else {}
    body = {"model": model, "messages": [{"role": "system", "content": system}] + messages}
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(f"{probe}/chat/completions", headers=headers, json=body)
        if r.status_code == 404 and probe != base:
            r = await client.post(f"{base}/chat/completions", headers=headers, json=body)
    if r.status_code != 200:
        raise HTTPException(502, f"Endpoint {r.status_code} : {r.text[:300]}")
    d = r.json()
    text = d["choices"][0]["message"]["content"] or ""
    u = d.get("usage") or {}
    return text, u.get("prompt_tokens", 0), u.get("completion_tokens", 0)

async def call_webhook(base: str, key: str, system: str, messages: list):
    """Format webhook simple : POST {task, system, history} → {result|reply|response}."""
    headers = {"Authorization": f"Bearer {key}"} if key else {}
    last = messages[-1]["content"] if messages else ""
    async with httpx.AsyncClient(timeout=180) as client:
        r = await client.post(base, headers=headers,
                              json={"task": last, "system": system, "history": messages[:-1]})
    if r.status_code >= 300:
        raise HTTPException(502, f"Webhook {r.status_code} : {r.text[:300]}")
    try:
        d = r.json()
        text = d.get("result") or d.get("reply") or d.get("response") or json.dumps(d)[:2000]
    except Exception:
        text = r.text[:4000]
    return text, 0, 0

async def run_agent(agent: dict, messages: list) -> dict:
    """Exécute une conversation sur l'agent. Retourne reply/cost/tokens/demo."""
    system = build_system_prompt(agent)
    provider = agent.get("provider") or ""
    model = agent.get("model") or ""

    if agent.get("kind") == "external" and agent.get("base_url"):
        key = dec(agent.get("api_key") or "")
        if (agent.get("api_format") or "openai") == "webhook":
            text, t_in, t_out = await call_webhook(agent["base_url"], key, system, messages)
        else:
            text, t_in, t_out = await call_openai_compat(agent["base_url"], key, model or "default", system, messages)
    else:
        cfg = get_key(provider)
        if not cfg or (provider != "custom" and not cfg.get("key")):
            return {
                "reply": f"⚡ [MODE DÉMO] Je suis {agent.get('name')}. Ajoute une clé API "
                         f"« {provider} » dans Connecteurs pour des réponses réelles.",
                "cost": 0.0, "tokens_in": 0, "tokens_out": 0, "demo": True,
            }
        if provider == "anthropic":
            text, t_in, t_out = await call_anthropic(cfg["key"], model, system, messages)
        else:
            base = cfg.get("base_url") or PROVIDER_BASES.get(provider)
            if not base:
                raise HTTPException(400, f"Provider inconnu : {provider}")
            text, t_in, t_out = await call_openai_compat(base, cfg["key"], model, system, messages)

    cost = estimate_cost(model, t_in, t_out)
    log_provider = "externe" if agent.get("kind") == "external" else provider
    with db() as c:
        c.execute("INSERT INTO requests_log(agent_id,provider,model,tokens_in,tokens_out,cost,created_at)"
                  " VALUES(?,?,?,?,?,?,?)",
                  (agent["id"], log_provider, model, t_in, t_out, cost, now_iso()))
    return {"reply": text, "cost": cost, "tokens_in": t_in, "tokens_out": t_out, "demo": False}

def load_agent(agent_id: int) -> dict:
    with db() as c:
        row = c.execute("SELECT * FROM agents WHERE id=?", (agent_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Agent introuvable")
    return dict(row)

# ================================================================ agents
class AgentIn(BaseModel):
    name: str
    kind: str = "agent"
    provider: str = "openrouter"
    model: str = ""
    color: str = "#a8632f"
    icon: str = "bot"
    system_prompt: str = ""
    skills: list = []
    base_url: str | None = None
    api_key: str | None = None
    api_format: str | None = None

def agent_out(r) -> dict:
    a = dict(r)
    a["has_key"] = agent_has_key(a)
    a["skills"] = json.loads(a.get("skills") or "[]")
    a["api_key"] = bool(a.get("api_key"))  # jamais renvoyer la clé au frontend
    return a

@app.get("/api/agents")
async def get_agents():
    with db() as c:
        rows = c.execute("SELECT * FROM agents").fetchall()
    return {"agents": [agent_out(r) for r in rows]}

@app.post("/api/agents")
async def create_agent(body: AgentIn):
    with db() as c:
        cur = c.execute(
            "INSERT INTO agents(name,kind,provider,model,color,icon,system_prompt,skills,base_url,api_key,api_format,created_at)"
            " VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (body.name, body.kind, body.provider, body.model, body.color, body.icon,
             body.system_prompt, json.dumps(body.skills), body.base_url,
             enc(body.api_key) if body.api_key else None, body.api_format, now_iso()))
    return {"id": cur.lastrowid}

@app.put("/api/agents/{agent_id}")
async def update_agent(agent_id: int, body: AgentIn):
    old = load_agent(agent_id)
    api_key = enc(body.api_key) if body.api_key else old.get("api_key")
    with db() as c:
        c.execute(
            "UPDATE agents SET name=?,kind=?,provider=?,model=?,color=?,icon=?,system_prompt=?,skills=?,"
            "base_url=?,api_key=?,api_format=? WHERE id=?",
            (body.name, body.kind, body.provider, body.model, body.color, body.icon,
             body.system_prompt, json.dumps(body.skills), body.base_url, api_key, body.api_format, agent_id))
    return {"ok": True}

@app.delete("/api/agents/{agent_id}")
async def delete_agent(agent_id: int):
    with db() as c:
        c.execute("DELETE FROM agents WHERE id=?", (agent_id,))
    return {"ok": True}

# ================================================================ clés API
@app.get("/api/keys")
async def list_keys():
    with db() as c:
        rows = c.execute("SELECT provider, base_url, created_at FROM api_keys").fetchall()
    return {"keys": [{**dict(r), "masked": "sk-••••••••"} for r in rows]}

@app.post("/api/keys")
async def save_key(data: dict):
    provider = data.get("provider")
    if not provider:
        raise HTTPException(400, "provider requis")
    if provider == "custom" and not data.get("base_url"):
        raise HTTPException(400, "base_url requis pour un endpoint personnalisé")
    with db() as c:
        c.execute("INSERT OR REPLACE INTO api_keys(provider,key,base_url,created_at) VALUES(?,?,?,?)",
                  (provider, enc(data.get("key") or ""), data.get("base_url"), now_iso()))
    return {"ok": True}

@app.delete("/api/keys/{provider}")
async def delete_key(provider: str):
    with db() as c:
        c.execute("DELETE FROM api_keys WHERE provider=?", (provider,))
    return {"ok": True}

# ================================================================ chat
@app.post("/api/chat")
async def chat(data: dict):
    agent_id = data.get("agent_id", 1)
    message = data.get("message", "")
    file_ctx = data.get("file_context")
    agent = load_agent(agent_id)

    with db() as c:
        hist = c.execute(
            "SELECT role, content FROM messages WHERE agent_id=? ORDER BY id DESC LIMIT 20",
            (agent_id,)).fetchall()
    history = [{"role": r["role"], "content": r["content"]} for r in reversed(hist)]

    user_content = f"{message}\n\n[Fichier joint]\n{file_ctx}" if file_ctx else message
    result = await run_agent(agent, history + [{"role": "user", "content": user_content}])

    with db() as c:
        c.execute("INSERT INTO messages(agent_id,role,content,created_at) VALUES(?,?,?,?)",
                  (agent_id, "user", message, now_iso()))
        c.execute("INSERT INTO messages(agent_id,role,content,created_at) VALUES(?,?,?,?)",
                  (agent_id, "assistant", result["reply"], now_iso()))
    log_activity("chat", agent, message[:200], result["reply"][:1000], result["cost"])
    return result

async def stream_anthropic(key: str, model: str, system: str, messages: list):
    """Génère (delta, usage_final) pour l'API Anthropic en streaming."""
    async with httpx.AsyncClient(timeout=180) as client:
        async with client.stream(
            "POST", "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
            json={"model": model, "max_tokens": 4096, "system": system,
                  "messages": messages, "stream": True},
        ) as r:
            if r.status_code != 200:
                body = await r.aread()
                raise HTTPException(502, f"Anthropic {r.status_code} : {body.decode()[:300]}")
            t_in = t_out = 0
            async for line in r.aiter_lines():
                if not line.startswith("data: "):
                    continue
                try:
                    d = json.loads(line[6:])
                except Exception:
                    continue
                if d.get("type") == "content_block_delta":
                    yield d.get("delta", {}).get("text", ""), None
                elif d.get("type") == "message_start":
                    t_in = d.get("message", {}).get("usage", {}).get("input_tokens", 0)
                elif d.get("type") == "message_delta":
                    t_out = d.get("usage", {}).get("output_tokens", t_out)
            yield "", (t_in, t_out)

async def stream_openai_compat(base: str, key: str, model: str, system: str, messages: list):
    base = base.rstrip("/")
    if not base.endswith("/v1") and "/v1/" not in base:
        base = base + "/v1"
    headers = {"Authorization": f"Bearer {key}"} if key else {}
    body = {"model": model, "stream": True,
            "messages": [{"role": "system", "content": system}] + messages}
    async with httpx.AsyncClient(timeout=180) as client:
        async with client.stream("POST", f"{base}/chat/completions", headers=headers, json=body) as r:
            if r.status_code != 200:
                raw = await r.aread()
                raise HTTPException(502, f"Endpoint {r.status_code} : {raw.decode()[:300]}")
            t_in = t_out = 0
            async for line in r.aiter_lines():
                if not line.startswith("data: ") or line.strip() == "data: [DONE]":
                    continue
                try:
                    d = json.loads(line[6:])
                except Exception:
                    continue
                delta = (d.get("choices") or [{}])[0].get("delta", {}).get("content")
                if delta:
                    yield delta, None
                u = d.get("usage")
                if u:
                    t_in, t_out = u.get("prompt_tokens", 0), u.get("completion_tokens", 0)
            yield "", (t_in, t_out)

@app.post("/api/chat/stream")
async def chat_stream(data: dict):
    """Chat en streaming (SSE) — le texte arrive mot à mot."""
    agent_id = data.get("agent_id", 1)
    message = data.get("message", "")
    file_ctx = data.get("file_context")
    agent = load_agent(agent_id)

    with db() as c:
        hist = c.execute(
            "SELECT role, content FROM messages WHERE agent_id=? ORDER BY id DESC LIMIT 20",
            (agent_id,)).fetchall()
    history = [{"role": r["role"], "content": r["content"]} for r in reversed(hist)]
    user_content = f"{message}\n\n[Fichier joint]\n{file_ctx}" if file_ctx else message
    messages = history + [{"role": "user", "content": user_content}]
    system = build_system_prompt(agent)
    provider = agent.get("provider") or ""
    model = agent.get("model") or ""

    def sse(obj):
        return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"

    def finalize(full: str, t_in: int, t_out: int) -> float:
        cost = estimate_cost(model, t_in, t_out)
        log_provider = "externe" if agent.get("kind") == "external" else provider
        with db() as c:
            c.execute("INSERT INTO requests_log(agent_id,provider,model,tokens_in,tokens_out,cost,created_at)"
                      " VALUES(?,?,?,?,?,?,?)",
                      (agent["id"], log_provider, model, t_in, t_out, cost, now_iso()))
            c.execute("INSERT INTO messages(agent_id,role,content,created_at) VALUES(?,?,?,?)",
                      (agent_id, "user", message, now_iso()))
            c.execute("INSERT INTO messages(agent_id,role,content,created_at) VALUES(?,?,?,?)",
                      (agent_id, "assistant", full, now_iso()))
        log_activity("chat", agent, message[:200], full[:1000], cost)
        return cost

    async def gen():
        try:
            # cas sans streaming possible : démo, webhook → un seul bloc
            streamer = None
            if agent.get("kind") == "external" and agent.get("base_url"):
                key = dec(agent.get("api_key") or "")
                if (agent.get("api_format") or "openai") == "webhook":
                    result = await run_agent(agent, messages)
                    with db() as c:
                        c.execute("INSERT INTO messages(agent_id,role,content,created_at) VALUES(?,?,?,?)",
                                  (agent_id, "user", message, now_iso()))
                        c.execute("INSERT INTO messages(agent_id,role,content,created_at) VALUES(?,?,?,?)",
                                  (agent_id, "assistant", result["reply"], now_iso()))
                    log_activity("chat", agent, message[:200], result["reply"][:1000], result["cost"])
                    yield sse({"delta": result["reply"]})
                    yield sse({"done": True, "cost": result["cost"]})
                    return
                streamer = stream_openai_compat(agent["base_url"], key, model or "default", system, messages)
            else:
                cfg = get_key(provider)
                if not cfg or (provider != "custom" and not cfg.get("key")):
                    reply = (f"⚡ [MODE DÉMO] Je suis {agent.get('name')}. Ajoute une clé API "
                             f"« {provider} » dans Connecteurs pour des réponses réelles.")
                    with db() as c:
                        c.execute("INSERT INTO messages(agent_id,role,content,created_at) VALUES(?,?,?,?)",
                                  (agent_id, "user", message, now_iso()))
                        c.execute("INSERT INTO messages(agent_id,role,content,created_at) VALUES(?,?,?,?)",
                                  (agent_id, "assistant", reply, now_iso()))
                    yield sse({"delta": reply})
                    yield sse({"done": True, "cost": 0.0, "demo": True})
                    return
                if provider == "anthropic":
                    streamer = stream_anthropic(cfg["key"], model, system, messages)
                else:
                    base = cfg.get("base_url") or PROVIDER_BASES.get(provider)
                    if not base:
                        raise HTTPException(400, f"Provider inconnu : {provider}")
                    streamer = stream_openai_compat(base, cfg["key"], model, system, messages)

            full = ""
            t_in = t_out = 0
            async for delta, usage in streamer:
                if usage:
                    t_in, t_out = usage
                if delta:
                    full += delta
                    yield sse({"delta": delta})
            if not t_out:
                # certains endpoints ne renvoient pas l'usage en streaming → estimation
                t_in = t_in or sum(len(m["content"]) for m in messages) // 4
                t_out = len(full) // 4
            cost = finalize(full, t_in, t_out)
            yield sse({"done": True, "cost": cost})
        except HTTPException as e:
            yield sse({"error": str(e.detail)})
        except Exception as e:
            yield sse({"error": str(e)})

    return StreamingResponse(gen(), media_type="text/event-stream")

@app.get("/api/messages/{agent_id}")
async def get_messages(agent_id: int):
    with db() as c:
        rows = c.execute(
            "SELECT role, content, created_at FROM messages WHERE agent_id=? ORDER BY id",
            (agent_id,)).fetchall()
    return {"messages": [dict(r) for r in rows]}

@app.delete("/api/messages/{agent_id}")
async def clear_messages(agent_id: int):
    with db() as c:
        c.execute("DELETE FROM messages WHERE agent_id=?", (agent_id,))
    return {"ok": True}

# ================================================================ mémoire
@app.get("/api/memory")
async def get_memory():
    with db() as c:
        rows = c.execute("SELECT * FROM memory ORDER BY id DESC LIMIT 100").fetchall()
    return {"memory": [dict(r) for r in rows]}

@app.post("/api/memory")
async def add_memory(data: dict):
    with db() as c:
        c.execute("INSERT INTO memory(agent_id,scope,content,created_at) VALUES(?,?,?,?)",
                  (data.get("agent_id"), data.get("scope", "global"), data.get("content"), now_iso()))
    return {"ok": True}

@app.put("/api/memory/{mem_id}")
async def move_memory(mem_id: int, data: dict):
    """Déplace une mémoire : vers un agent (privée) ou vers la mémoire globale."""
    scope = data.get("scope", "global")
    agent_id = data.get("agent_id") if scope == "private" else None
    with db() as c:
        c.execute("UPDATE memory SET scope=?, agent_id=? WHERE id=?", (scope, agent_id, mem_id))
    return {"ok": True}

@app.delete("/api/memory/{mem_id}")
async def delete_memory(mem_id: int):
    with db() as c:
        c.execute("DELETE FROM memory WHERE id=?", (mem_id,))
    return {"ok": True}

# ================================================================ skills
class SkillIn(BaseModel):
    name: str
    category: str = "general"
    description: str = ""
    content: str

@app.get("/api/skills")
async def list_skills():
    with db() as c:
        rows = c.execute("SELECT * FROM skills ORDER BY id DESC").fetchall()
    return {"skills": [dict(r) for r in rows]}

@app.get("/api/skills/{skill_id}")
async def get_skill(skill_id: int):
    with db() as c:
        row = c.execute("SELECT * FROM skills WHERE id=?", (skill_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Skill introuvable")
    return dict(row)

@app.post("/api/skills")
async def create_skill(body: SkillIn):
    with db() as c:
        cur = c.execute("INSERT INTO skills(name,category,description,content,created_at) VALUES(?,?,?,?,?)",
                        (body.name, body.category, body.description, body.content, now_iso()))
    return {"id": cur.lastrowid}

@app.delete("/api/skills/{skill_id}")
async def delete_skill(skill_id: int):
    with db() as c:
        c.execute("DELETE FROM skills WHERE id=?", (skill_id,))
    return {"ok": True}

# ================================================================ réglages
@app.get("/api/settings")
async def get_settings():
    with db() as c:
        rows = c.execute("SELECT key, value FROM settings").fetchall()
    return {r["key"]: r["value"] for r in rows}

@app.post("/api/settings")
async def set_settings(data: dict):
    with db() as c:
        for k, v in data.items():
            c.execute("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)", (k, str(v)))
    return {"ok": True}

def get_router_agent() -> dict | None:
    with db() as c:
        row = c.execute("SELECT value FROM settings WHERE key='router_agent_id'").fetchone()
    if not row or not row["value"]:
        return None
    try:
        return load_agent(int(row["value"]))
    except HTTPException:
        return None

# ================================================================ routeur
COMPLEX_RE = re.compile(r"complex|architect|refactor|debug|analys|audit|stratég|optimis|sécurité|plusieurs étapes", re.I)

def heuristic_route(task: str, candidates: list) -> dict:
    """Repli gratuit si aucun routeur configuré : complexe → le plus cher, simple → le moins cher."""
    def price(a):
        return estimate_cost(a.get("model", ""), 1_000_000, 0)
    ordered = sorted(candidates, key=price)
    complex_task = bool(COMPLEX_RE.search(task)) or len(task) > 400
    chosen = ordered[-1] if complex_task else ordered[0]
    return {"agent_id": chosen["id"],
            "reason": "heuristique locale : tâche jugée " + ("complexe" if complex_task else "simple")}

@app.post("/api/route")
async def route_task(data: dict):
    """Le routeur (choisi par l'utilisateur) décide quel agent exécute la tâche."""
    task = data.get("task", "")
    candidate_ids = data.get("candidate_ids") or []
    with db() as c:
        rows = c.execute("SELECT * FROM agents").fetchall()
    agents = [dict(r) for r in rows]
    candidates = [a for a in agents if a["id"] in candidate_ids] if candidate_ids else agents
    if not candidates:
        raise HTTPException(400, "Aucun agent candidat")
    if len(candidates) == 1:
        return {"agent_id": candidates[0]["id"], "reason": "seul candidat"}

    router = get_router_agent()
    if not router or not agent_has_key(router):
        return heuristic_route(task, candidates)

    desc = "\n".join(
        f"- id={a['id']} · {a['name']} · modèle {a['model']} · {a.get('system_prompt','')[:80]}"
        for a in candidates)
    prompt = (
        "Tu es un routeur de tâches. Choisis l'agent le plus adapté.\n"
        "Règle générale : tâche complexe (code, analyse, plusieurs étapes) → agent/modèle puissant ; "
        "tâche simple → modèle économique.\n\n"
        f"Agents disponibles :\n{desc}\n\nTâche : « {task} »\n\n"
        'Réponds UNIQUEMENT en JSON : {"agent_id": <id>, "reason": "<explication courte>"}'
    )
    try:
        res = await run_agent(router, [{"role": "user", "content": prompt}])
        m = re.search(r'\{[^{}]*"agent_id"[^{}]*\}', res["reply"])
        parsed = json.loads(m.group(0)) if m else {}
        agent_id = int(parsed.get("agent_id"))
        if agent_id not in [a["id"] for a in candidates]:
            raise ValueError
        chosen = next(a for a in candidates if a["id"] == agent_id)
        log_activity("routage", router, task[:200],
                     f"→ {chosen['name']} — {parsed.get('reason', '')}", res["cost"])
        return {"agent_id": agent_id, "reason": parsed.get("reason", ""),
                "router": router["name"], "cost": res["cost"]}
    except Exception:
        return heuristic_route(task, candidates)

@app.post("/api/judge")
async def judge(data: dict):
    """Le routeur juge si un résultat satisfait un critère (boucles « jusqu'à réussite »)."""
    criteria = data.get("criteria", "")
    result = data.get("result", "")
    router = get_router_agent()
    if not router or not agent_has_key(router):
        return {"success": True, "reason": "aucun juge configuré — validé par défaut"}
    prompt = (
        f"Critère de réussite : « {criteria} »\n\nRésultat produit :\n{result[:4000]}\n\n"
        'Le critère est-il satisfait ? Réponds UNIQUEMENT en JSON : {"success": true/false, "reason": "<court>"}'
    )
    try:
        res = await run_agent(router, [{"role": "user", "content": prompt}])
        m = re.search(r'\{.*?"success".*?\}', res["reply"], re.S)
        parsed = json.loads(m.group(0)) if m else {}
        log_activity("juge", router, criteria[:200],
                     ("✓ atteint" if parsed.get("success") else "✗ pas encore") + f" — {parsed.get('reason', '')}",
                     res["cost"])
        return {"success": bool(parsed.get("success")), "reason": parsed.get("reason", ""), "cost": res["cost"]}
    except Exception as e:
        return {"success": False, "reason": f"juge indisponible : {e}"}

# ================================================================ workflows
class WorkflowIn(BaseModel):
    name: str
    data: dict

@app.get("/api/workflows")
async def list_workflows():
    with db() as c:
        rows = c.execute("SELECT id, name, updated_at FROM workflows ORDER BY id DESC LIMIT 10").fetchall()
    return {"workflows": [dict(r) for r in rows]}

@app.get("/api/workflows/{wf_id}")
async def get_workflow(wf_id: int):
    with db() as c:
        row = c.execute("SELECT * FROM workflows WHERE id=?", (wf_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Workflow introuvable")
    return {**dict(row), "data": json.loads(row["data"] or "{}")}

@app.post("/api/workflows")
async def save_workflow(body: WorkflowIn):
    with db() as c:
        row = c.execute("SELECT id FROM workflows WHERE name=?", (body.name,)).fetchone()
        if row:
            c.execute("UPDATE workflows SET data=?, updated_at=? WHERE id=?",
                      (json.dumps(body.data), now_iso(), row["id"]))
            return {"id": row["id"]}
        cur = c.execute("INSERT INTO workflows(name,data,updated_at) VALUES(?,?,?)",
                        (body.name, json.dumps(body.data), now_iso()))
    return {"id": cur.lastrowid}

@app.delete("/api/workflows/{wf_id}")
async def del_workflow(wf_id: int):
    with db() as c:
        c.execute("DELETE FROM workflows WHERE id=?", (wf_id,))
    return {"ok": True}

@app.post("/api/workflows/run-task")
async def run_task(data: dict):
    """Exécute une tâche ponctuelle sur un agent (sans l'historique de chat)."""
    agent = load_agent(data.get("agent_id"))
    task = data.get("task", "")
    context = data.get("context")
    content = f"{task}\n\n[Contexte de l'itération précédente]\n{context}" if context else task
    result = await run_agent(agent, [{"role": "user", "content": content}])
    log_activity("tâche", agent, task[:200], result["reply"][:1000], result["cost"])
    return result

# ================================================================ journal d'activité
@app.get("/api/activity")
async def get_activity(limit: int = 200):
    with db() as c:
        rows = c.execute("SELECT * FROM activity ORDER BY id DESC LIMIT ?", (min(limit, 1000),)).fetchall()
    return {"activity": [dict(r) for r in rows]}

@app.delete("/api/activity")
async def clear_activity():
    with db() as c:
        c.execute("DELETE FROM activity")
    return {"ok": True}

@app.get("/api/activity/export")
async def export_activity():
    """Rapport Markdown de tout ce que les IA ont fait, groupé par jour."""
    with db() as c:
        rows = c.execute("SELECT * FROM activity ORDER BY id").fetchall()
    lines = ["# Rapport d'activité — Antigravity", ""]
    day = None
    total = 0.0
    for r in rows:
        d = (r["created_at"] or "")[:10]
        if d != day:
            day = d
            lines += [f"\n## {day}", ""]
        cost = f" · {r['cost']:.4f} $" if r["cost"] else ""
        who = f" — {r['agent_name']}" if r["agent_name"] else ""
        lines.append(f"- **[{r['kind']}]**{who} · {r['created_at'][11:19]}{cost}")
        lines.append(f"  - Demande : {r['title']}")
        if r["content"]:
            lines.append(f"  - Résultat : {r['content'][:400]}")
        total += r["cost"] or 0
    lines += ["", f"---\n**Total : {len(rows)} actions · {total:.4f} $**"]
    return PlainTextResponse(
        "\n".join(lines),
        media_type="text/markdown",
        headers={"Content-Disposition": 'attachment; filename="rapport-antigravity.md"'})

# ================================================================ historique des exécutions
@app.post("/api/runs")
async def save_run(data: dict):
    with db() as c:
        cur = c.execute("INSERT INTO workflow_runs(workflow_name,logs,cost,steps,created_at) VALUES(?,?,?,?,?)",
                        (data.get("workflow_name", ""), json.dumps(data.get("logs", [])),
                         data.get("cost", 0.0), data.get("steps", 0), now_iso()))
    return {"id": cur.lastrowid}

@app.get("/api/runs")
async def list_runs():
    with db() as c:
        rows = c.execute(
            "SELECT id, workflow_name, cost, steps, created_at FROM workflow_runs"
            " ORDER BY id DESC LIMIT 50").fetchall()
    return {"runs": [dict(r) for r in rows]}

@app.get("/api/runs/{run_id}")
async def get_run(run_id: int):
    with db() as c:
        row = c.execute("SELECT * FROM workflow_runs WHERE id=?", (run_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Run introuvable")
    return {**dict(row), "logs": json.loads(row["logs"] or "[]")}

# ================================================================ stats
@app.get("/api/stats")
async def get_stats():
    with db() as c:
        tot = c.execute(
            "SELECT COUNT(*) n, COALESCE(SUM(cost),0) cost,"
            " COALESCE(SUM(tokens_in+tokens_out),0) tokens FROM requests_log").fetchone()
        by_agent = c.execute(
            "SELECT a.name, a.color, COUNT(*) n, SUM(r.cost) cost, SUM(r.tokens_in+r.tokens_out) tokens"
            " FROM requests_log r JOIN agents a ON a.id=r.agent_id GROUP BY r.agent_id"
            " ORDER BY n DESC").fetchall()
        by_day = c.execute(
            "SELECT substr(created_at,1,10) day, COUNT(*) n, SUM(cost) cost FROM requests_log"
            " GROUP BY day ORDER BY day DESC LIMIT 14").fetchall()
        by_provider = c.execute(
            "SELECT provider, COUNT(*) n, SUM(cost) cost FROM requests_log GROUP BY provider").fetchall()
    return {
        "total": dict(tot),
        "by_agent": [dict(r) for r in by_agent],
        "by_day": [dict(r) for r in reversed(by_day)],
        "by_provider": [dict(r) for r in by_provider],
    }

@app.get("/api/health")
async def health():
    return {"status": "ok", "mode": "full"}

# ================================================================ intégrations (email / webhook)
import asyncio
import imaplib
import smtplib
import email as email_lib
from email.header import decode_header, make_header
from email.mime.text import MIMEText
from email.utils import parseaddr

def integ_config(row) -> dict:
    try:
        return json.loads(dec(row["config"] or ""))
    except Exception:
        return {}

def mask_integration(row) -> dict:
    d = dict(row)
    cfg = integ_config(row)
    d["config"] = {k: v for k, v in cfg.items() if k not in ("password",)}
    return d

class IntegrationIn(BaseModel):
    type: str  # 'imap' | 'webhook'
    name: str
    agent_id: int | None = None
    mode: str = "draft"  # 'draft' (brouillon d'abord) | 'auto'
    config: dict = {}

@app.get("/api/integrations")
async def list_integrations():
    with db() as c:
        rows = c.execute("SELECT * FROM integrations ORDER BY id DESC").fetchall()
    return {"integrations": [mask_integration(r) for r in rows]}

@app.post("/api/integrations")
async def create_integration(body: IntegrationIn):
    if body.type == "imap":
        required = ["imap_host", "email", "password"]
        missing = [k for k in required if not body.config.get(k)]
        if missing:
            raise HTTPException(400, f"Champs manquants : {', '.join(missing)}")
    with db() as c:
        cur = c.execute(
            "INSERT INTO integrations(type,name,config,agent_id,mode,active,created_at) VALUES(?,?,?,?,?,1,?)",
            (body.type, body.name, enc(json.dumps(body.config)), body.agent_id, body.mode, now_iso()))
    return {"id": cur.lastrowid}

@app.put("/api/integrations/{integ_id}")
async def update_integration(integ_id: int, data: dict):
    with db() as c:
        row = c.execute("SELECT * FROM integrations WHERE id=?", (integ_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Intégration introuvable")
        active = int(data.get("active", row["active"]))
        mode = data.get("mode", row["mode"])
        agent_id = data.get("agent_id", row["agent_id"])
        c.execute("UPDATE integrations SET active=?, mode=?, agent_id=? WHERE id=?",
                  (active, mode, agent_id, integ_id))
    return {"ok": True}

@app.delete("/api/integrations/{integ_id}")
async def delete_integration(integ_id: int):
    with db() as c:
        c.execute("DELETE FROM integrations WHERE id=?", (integ_id,))
        c.execute("DELETE FROM inbox WHERE integration_id=?", (integ_id,))
    return {"ok": True}

# ---- webhook entrant : n'importe quel site peut déclencher un traitement
@app.post("/api/hooks/{integ_id}")
async def incoming_hook(integ_id: int, data: dict):
    with db() as c:
        row = c.execute("SELECT * FROM integrations WHERE id=? AND type='webhook' AND active=1",
                        (integ_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Webhook inconnu ou désactivé")
    content = data.get("message") or data.get("task") or data.get("content") or json.dumps(data, ensure_ascii=False)
    with db() as c:
        c.execute("INSERT INTO inbox(integration_id,source,sender,subject,content,status,created_at,updated_at)"
                  " VALUES(?,?,?,?,?,'new',?,?)",
                  (integ_id, "webhook", data.get("sender", ""), data.get("subject", "")[:200],
                   str(content)[:8000], now_iso(), now_iso()))
    return {"ok": True, "info": "Reçu — l'agent va traiter la demande."}

# ---- boîte d'entrée
@app.get("/api/inbox")
async def list_inbox():
    with db() as c:
        rows = c.execute(
            "SELECT i.*, g.name AS integration_name, g.type AS integration_type, g.mode AS integration_mode"
            " FROM inbox i LEFT JOIN integrations g ON g.id = i.integration_id"
            " ORDER BY i.id DESC LIMIT 100").fetchall()
    return {"inbox": [dict(r) for r in rows]}

@app.delete("/api/inbox/{item_id}")
async def delete_inbox(item_id: int):
    with db() as c:
        c.execute("DELETE FROM inbox WHERE id=?", (item_id,))
    return {"ok": True}

@app.post("/api/inbox/{item_id}/regenerate")
async def regenerate_draft(item_id: int, data: dict):
    """Refuse le brouillon avec un commentaire → l'agent réessaie."""
    comment = data.get("comment", "")
    with db() as c:
        row = c.execute("SELECT * FROM inbox WHERE id=?", (item_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Message introuvable")
    integ = _get_integration(row["integration_id"])
    agent = _integration_agent(integ)
    prompt = _draft_prompt(dict(row))
    if row["draft"]:
        prompt += f"\n\n[Brouillon précédent — refusé]\n{row['draft']}\n\n[Retour du relecteur humain]\n{comment or 'À améliorer.'}"
    res = await run_agent(agent, [{"role": "user", "content": prompt}])
    with db() as c:
        c.execute("UPDATE inbox SET draft=?, status='drafted', updated_at=? WHERE id=?",
                  (res["reply"], now_iso(), item_id))
    log_activity("intégration", agent, f"Nouveau brouillon : {row['subject'] or row['content'][:60]}",
                 res["reply"][:1000], res["cost"])
    return {"ok": True, "draft": res["reply"]}

@app.post("/api/inbox/{item_id}/approve")
async def approve_draft(item_id: int):
    """Approuve le brouillon : email → envoi SMTP ; webhook → POST au callback si défini."""
    with db() as c:
        row = c.execute("SELECT * FROM inbox WHERE id=?", (item_id,)).fetchone()
    if not row or not row["draft"]:
        raise HTTPException(400, "Aucun brouillon à approuver")
    integ = _get_integration(row["integration_id"])
    sent = await _deliver(dict(row), integ)
    with db() as c:
        c.execute("UPDATE inbox SET status=?, updated_at=? WHERE id=?",
                  ("sent" if sent else "approved", now_iso(), item_id))
    return {"ok": True, "sent": sent}

def _get_integration(integ_id) -> dict:
    with db() as c:
        row = c.execute("SELECT * FROM integrations WHERE id=?", (integ_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Intégration introuvable")
    d = dict(row)
    d["_config"] = integ_config(row)
    return d

def _integration_agent(integ: dict) -> dict:
    if integ.get("agent_id"):
        try:
            return load_agent(integ["agent_id"])
        except HTTPException:
            pass
    router = get_router_agent()
    if router:
        return router
    with db() as c:
        row = c.execute("SELECT * FROM agents LIMIT 1").fetchone()
    if not row:
        raise HTTPException(400, "Aucun agent disponible")
    return dict(row)

def _draft_prompt(item: dict) -> str:
    if item.get("source") == "email":
        return ("Tu as reçu cet email. Rédige la réponse à envoyer, prête telle quelle "
                "(pas de commentaire autour, juste le corps de l'email).\n\n"
                f"De : {item.get('sender', '')}\nSujet : {item.get('subject', '')}\n\n{item.get('content', '')}")
    return ("Tu as reçu cette demande via un webhook. Traite-la et rends le résultat final.\n\n"
            f"{item.get('content', '')}")

async def _deliver(item: dict, integ: dict) -> bool:
    """Envoie la réponse : SMTP pour l'email, callback HTTP pour le webhook."""
    cfg = integ["_config"]
    if item.get("source") == "email":
        def send():
            _, addr = parseaddr(item.get("sender", ""))
            subject = item.get("subject", "")
            if subject and not subject.lower().startswith("re:"):
                subject = f"Re: {subject}"
            msg = MIMEText(item["draft"], "plain", "utf-8")
            msg["Subject"] = subject or "Re: votre message"
            msg["From"] = cfg["email"]
            msg["To"] = addr
            host = cfg.get("smtp_host") or cfg["imap_host"].replace("imap", "smtp")
            port = int(cfg.get("smtp_port", 465))
            with smtplib.SMTP_SSL(host, port, timeout=30) as s:
                s.login(cfg["email"], cfg["password"])
                s.send_message(msg)
        await asyncio.to_thread(send)
        log_activity("intégration", None, f"Email envoyé : {item.get('subject', '')}", item["draft"][:500])
        return True
    callback = cfg.get("callback_url")
    if callback:
        async with httpx.AsyncClient(timeout=30) as client:
            await client.post(callback, json={"result": item["draft"], "subject": item.get("subject", "")})
        log_activity("intégration", None, "Résultat renvoyé au callback", item["draft"][:500])
        return True
    return False

# ---- surveillance IMAP + traitement des nouveaux messages
def _decode_hdr(v: str) -> str:
    try:
        return str(make_header(decode_header(v or "")))
    except Exception:
        return v or ""

def _extract_body(msg) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                try:
                    return part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", "replace")
                except Exception:
                    continue
        return ""
    try:
        return msg.get_payload(decode=True).decode(msg.get_content_charset() or "utf-8", "replace")
    except Exception:
        return str(msg.get_payload())[:4000]

def _poll_imap_once(integ_row: dict):
    cfg = json.loads(dec(integ_row["config"]))
    M = imaplib.IMAP4_SSL(cfg["imap_host"], int(cfg.get("imap_port", 993)))
    try:
        M.login(cfg["email"], cfg["password"])
        M.select("INBOX")
        _, data = M.search(None, "UNSEEN")
        for num in (data[0].split() if data and data[0] else []):
            _, msg_data = M.fetch(num, "(RFC822)")
            msg = email_lib.message_from_bytes(msg_data[0][1])
            sender = _decode_hdr(msg.get("From", ""))
            subject = _decode_hdr(msg.get("Subject", ""))
            body = _extract_body(msg)[:8000]
            with db() as c:
                c.execute("INSERT INTO inbox(integration_id,source,sender,subject,content,status,created_at,updated_at)"
                          " VALUES(?,?,?,?,?,'new',?,?)",
                          (integ_row["id"], "email", sender, subject[:200], body, now_iso(), now_iso()))
    finally:
        try:
            M.logout()
        except Exception:
            pass

async def imap_poller():
    """Toutes les 60 s : relève les boîtes IMAP actives."""
    while True:
        try:
            with db() as c:
                rows = c.execute("SELECT * FROM integrations WHERE type='imap' AND active=1").fetchall()
            for r in rows:
                try:
                    await asyncio.to_thread(_poll_imap_once, dict(r))
                except Exception as e:
                    with db() as c:
                        c.execute("INSERT INTO inbox(integration_id,source,sender,subject,content,status,error,created_at,updated_at)"
                                  " VALUES(?,?,?,?,?,'error',?,?,?)",
                                  (r["id"], "email", "", "Erreur de connexion IMAP", "", str(e)[:300], now_iso(), now_iso()))
                        # évite de spammer : on désactive après une erreur de connexion
                        c.execute("UPDATE integrations SET active=0 WHERE id=?", (r["id"],))
        except Exception:
            pass
        await asyncio.sleep(60)

async def inbox_processor():
    """Toutes les 4 s : les messages 'new' reçoivent un brouillon d'agent ; mode auto → envoi direct."""
    while True:
        try:
            with db() as c:
                rows = c.execute("SELECT * FROM inbox WHERE status='new' ORDER BY id LIMIT 5").fetchall()
            for r in rows:
                item = dict(r)
                try:
                    integ = _get_integration(item["integration_id"])
                    agent = _integration_agent(integ)
                    res = await run_agent(agent, [{"role": "user", "content": _draft_prompt(item)}])
                    status = "drafted"
                    with db() as c:
                        c.execute("UPDATE inbox SET draft=?, status=?, updated_at=? WHERE id=?",
                                  (res["reply"], status, now_iso(), item["id"]))
                    log_activity("intégration", agent,
                                 f"{'Email' if item['source'] == 'email' else 'Webhook'} reçu : {item['subject'] or item['content'][:60]}",
                                 res["reply"][:1000], res["cost"])
                    if integ["mode"] == "auto" and not res.get("demo"):
                        item["draft"] = res["reply"]
                        sent = await _deliver(item, integ)
                        with db() as c:
                            c.execute("UPDATE inbox SET status=?, updated_at=? WHERE id=?",
                                      ("sent" if sent else "approved", now_iso(), item["id"]))
                except Exception as e:
                    with db() as c:
                        c.execute("UPDATE inbox SET status='error', error=?, updated_at=? WHERE id=?",
                                  (str(e)[:300], now_iso(), item["id"]))
        except Exception:
            pass
        await asyncio.sleep(4)

@app.on_event("startup")
async def start_background_tasks():
    asyncio.create_task(imap_poller())
    asyncio.create_task(inbox_processor())

# ================================================================ websocket
ws_connections = []

@app.websocket("/ws/updates")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    ws_connections.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            for conn in ws_connections:
                try:
                    await conn.send_text(data)
                except Exception:
                    pass
    except Exception:
        if websocket in ws_connections:
            ws_connections.remove(websocket)

# ================================================================ frontend SPA
frontend_path = Path(__file__).parent / "dist"
if (frontend_path / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_path / "assets")), name="assets")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    file_path = frontend_path / full_path
    if file_path.exists() and not file_path.is_dir():
        return FileResponse(str(file_path))
    return FileResponse(str(frontend_path / "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
