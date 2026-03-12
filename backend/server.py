"""
Reverse proxy that bridges the Emergent platform (uvicorn on :8001)
to the Node.js ContentPulse API running on :4000.
"""

from fastapi import FastAPI, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import httpx

NODE_API = "http://localhost:4000"

app = FastAPI(title="ContentPulse Proxy")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = httpx.AsyncClient(base_url=NODE_API, timeout=30.0)


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_api(request: Request, path: str):
    url = f"/api/{path}"
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None)

    body = await request.body()

    resp = await client.request(
        method=request.method,
        url=url,
        headers=headers,
        params=dict(request.query_params),
        content=body if body else None,
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
    resp = await client.get("/health")
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type="application/json",
    )


@app.api_route("/graphql", methods=["GET", "POST"])
async def proxy_graphql(request: Request):
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None)
    body = await request.body()

    resp = await client.request(
        method=request.method,
        url="/graphql",
        headers=headers,
        content=body if body else None,
    )

    excluded = {"transfer-encoding", "content-encoding", "content-length"}
    resp_headers = {k: v for k, v in resp.headers.items() if k.lower() not in excluded}

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=resp_headers,
        media_type=resp.headers.get("content-type"),
    )
