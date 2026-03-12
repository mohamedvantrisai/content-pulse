"""
Reverse proxy that bridges the Emergent platform (uvicorn on :8001)
to the Node.js ContentPulse API running on :4000.
Automatically starts and manages the Node.js process.
"""

import subprocess
import time
import os
import signal
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import httpx

NODE_API = "http://localhost:4000"
node_process = None


def start_node_api():
    """Start the Node.js API as a background subprocess."""
    global node_process
    if node_process and node_process.poll() is None:
        return  # Already running

    env = os.environ.copy()
    env["PORT"] = "4000"
    env["NODE_ENV"] = "development"
    env["MONGODB_URI"] = os.environ.get("MONGO_URL", "mongodb://localhost:27017/contentpulse")
    env["JWT_SECRET"] = "contentpulse-dev-secret-key-minimum-32-chars"
    env["ENCRYPTION_KEY"] = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
    env["LOG_LEVEL"] = "info"
    env["CORS_ORIGINS"] = "*"
    env["REDIS_URL"] = ""

    log_file = open("/tmp/node-api.log", "a")
    node_process = subprocess.Popen(
        ["npx", "tsx", "apps/api/src/server.ts"],
        cwd="/app",
        env=env,
        stdout=log_file,
        stderr=log_file,
    )
    print(f"[proxy] Started Node.js API (PID {node_process.pid})", flush=True)

    # Wait for it to be ready
    for _ in range(30):
        try:
            import urllib.request
            resp = urllib.request.urlopen("http://localhost:4000/health", timeout=1)
            if resp.status == 200:
                print("[proxy] Node.js API is ready", flush=True)
                return
        except Exception:
            pass
        time.sleep(1)
    print("[proxy] WARNING: Node.js API may not be ready yet", flush=True)


def stop_node_api():
    """Stop the Node.js API subprocess."""
    global node_process
    if node_process and node_process.poll() is None:
        node_process.terminate()
        try:
            node_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            node_process.kill()
        print(f"[proxy] Stopped Node.js API (PID {node_process.pid})", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_node_api()
    yield
    stop_node_api()


app = FastAPI(title="ContentPulse Proxy", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = httpx.AsyncClient(base_url=NODE_API, timeout=30.0)


def ensure_node_running():
    """Check if Node.js is alive, restart if needed."""
    global node_process
    if node_process is None or node_process.poll() is not None:
        print("[proxy] Node.js API is down, restarting...", flush=True)
        start_node_api()


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_api(request: Request, path: str):
    ensure_node_running()
    url = f"/api/{path}"
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None)

    body = await request.body()

    try:
        resp = await client.request(
            method=request.method,
            url=url,
            headers=headers,
            params=dict(request.query_params),
            content=body if body else None,
        )
    except httpx.ConnectError:
        return Response(
            content=b'{"error":{"code":"PROXY_ERROR","message":"Backend API unavailable"}}',
            status_code=503,
            media_type="application/json",
        )

    excluded = {"transfer-encoding", "content-encoding", "content-length"}
    resp_headers = {k: v for k, v in resp.headers.items() if k.lower() not in excluded}

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=resp_headers,
        media_type=resp.headers.get("content-type"),
    )


@app.api_route("/health", methods=["GET"])
async def proxy_health(request: Request):
    ensure_node_running()
    try:
        resp = await client.get("/health")
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            media_type="application/json",
        )
    except httpx.ConnectError:
        return Response(
            content=b'{"status":"unhealthy","reason":"Node.js API unreachable"}',
            status_code=503,
            media_type="application/json",
        )


@app.api_route("/graphql", methods=["GET", "POST"])
async def proxy_graphql(request: Request):
    ensure_node_running()
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None)
    body = await request.body()

    try:
        resp = await client.request(
            method=request.method,
            url="/graphql",
            headers=headers,
            content=body if body else None,
        )
    except httpx.ConnectError:
        return Response(
            content=b'{"error":{"code":"PROXY_ERROR","message":"Backend API unavailable"}}',
            status_code=503,
            media_type="application/json",
        )

    excluded = {"transfer-encoding", "content-encoding", "content-length"}
    resp_headers = {k: v for k, v in resp.headers.items() if k.lower() not in excluded}

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=resp_headers,
        media_type=resp.headers.get("content-type"),
    )
