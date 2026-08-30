"""Aggregate API router: mounts every route module under the API prefix."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import admin, auth, dashboard, reports, scan, scans

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(scan.router)
api_router.include_router(scans.router)
api_router.include_router(dashboard.router)
api_router.include_router(admin.router)
api_router.include_router(reports.router)

__all__ = ["api_router"]
