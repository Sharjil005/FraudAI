"""Social safety circle schemas."""

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.models.social import FriendshipStatus
from app.schemas.auth import UserOut
from app.schemas.types import AccountEmail


class FriendRequest(BaseModel):
    email: AccountEmail = Field(..., examples=["samad@fraudshield.local"])


class FriendshipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    friend_id: int
    status: FriendshipStatus
    created_at: datetime
    friend_name: str
    friend_email: str


class SafetyGroupCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, examples=["Family Alerts"])


class SafetyGroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    creator_id: int
    created_at: datetime
    members: list[UserOut]


class AddGroupMemberRequest(BaseModel):
    friend_id: int


class ThreatShareRequest(BaseModel):
    scan_id: int
    friend_ids: list[int] = Field(default_factory=list, description="Private friend IDs to share with")
    group_ids: list[int] = Field(default_factory=list, description="Group IDs to share with")
    note: str = Field("", max_length=500, description="Optional personal warning note", examples=["Watch out, I received this SMS today!"])


class ThreatAlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sender_id: int
    sender_name: str
    sender_email: str
    scan_id: int
    scan_type: str
    target_label: str
    risk_score: float
    risk_level: str
    note: str
    group_id: int | None = None
    group_name: str | None = None
    created_at: datetime
    is_read: bool
