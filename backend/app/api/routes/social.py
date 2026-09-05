"""Social safety circle API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import CurrentUser, DbSession
from app.models.social import Friendship, ThreatAlert
from app.schemas.auth import UserOut
from app.schemas.social import (
    FriendRequest,
    FriendshipOut,
    SafetyGroupCreate,
    SafetyGroupOut,
    AddGroupMemberRequest,
    ThreatShareRequest,
    ThreatAlertOut,
)
from app.services import social_service

router = APIRouter(prefix="/social", tags=["Social Circle"])


def _map_friendship(friendship: Friendship, current_user_id: int) -> dict:
    """Helper to format a friendship ORM model into the FriendshipOut schema."""
    friend = friendship.receiver if friendship.user_id == current_user_id else friendship.sender
    return {
        "id": friendship.id,
        "user_id": friendship.user_id,
        "friend_id": friendship.friend_id,
        "status": friendship.status,
        "created_at": friendship.created_at,
        "friend_name": friend.name,
        "friend_email": friend.email,
    }


def _map_alert(alert: ThreatAlert) -> dict:
    """Helper to format a ThreatAlert ORM model into the ThreatAlertOut schema."""
    risk_score = alert.scan.risk_assessment.overall_score if alert.scan.risk_assessment else 0.0
    risk_level = alert.scan.risk_assessment.risk_level.value if alert.scan.risk_assessment else "UNKNOWN"
    return {
        "id": alert.id,
        "sender_id": alert.sender_id,
        "sender_name": alert.sender.name,
        "sender_email": alert.sender.email,
        "scan_id": alert.scan_id,
        "scan_type": alert.scan.scan_type.value,
        "target_label": alert.scan.target_label,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "note": alert.note,
        "group_id": alert.group_id,
        "group_name": alert.group.name if alert.group else None,
        "created_at": alert.created_at,
        "is_read": alert.is_read,
    }


# ---- Friendships ----


@router.post(
    "/friends/request",
    response_model=FriendshipOut,
    status_code=status.HTTP_201_CREATED,
    summary="Send a friend request to a user by email",
)
def send_request(db: DbSession, current_user: CurrentUser, payload: FriendRequest) -> dict:
    try:
        friendship = social_service.create_friend_request(db, current_user, payload.email)
        return _map_friendship(friendship, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/friends/requests",
    response_model=list[FriendshipOut],
    summary="Get all pending friend requests",
)
def list_pending_requests(db: DbSession, current_user: CurrentUser) -> list[dict]:
    requests = social_service.get_pending_requests(db, current_user.id)
    return [_map_friendship(r, current_user.id) for r in requests]


@router.post(
    "/friends/accept/{request_id}",
    response_model=FriendshipOut,
    summary="Accept a pending friend request",
)
def accept_request(db: DbSession, current_user: CurrentUser, request_id: int) -> dict:
    try:
        friendship = social_service.accept_friend_request(db, current_user.id, request_id)
        return _map_friendship(friendship, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/friends/reject/{request_id}",
    response_model=FriendshipOut,
    summary="Decline a pending friend request",
)
def reject_request(db: DbSession, current_user: CurrentUser, request_id: int) -> dict:
    try:
        friendship = social_service.reject_friend_request(db, current_user.id, request_id)
        return _map_friendship(friendship, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/friends",
    response_model=list[UserOut],
    summary="Get list of active friends",
)
def list_friends(db: DbSession, current_user: CurrentUser) -> list:
    return social_service.get_friends(db, current_user.id)


@router.delete(
    "/friends/{friendship_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a friend connection or cancel a request",
)
def remove_friend(db: DbSession, current_user: CurrentUser, friendship_id: int) -> None:
    try:
        social_service.remove_friendship(db, current_user.id, friendship_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ---- Groups ----


@router.post(
    "/groups",
    response_model=SafetyGroupOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new safety circle group",
)
def create_safety_group(db: DbSession, current_user: CurrentUser, payload: SafetyGroupCreate) -> dict:
    try:
        group = social_service.create_group(db, current_user.id, payload.name)
        # Format GroupMember ORM to UserOut
        members_out = [m.user for m in group.members]
        return {
            "id": group.id,
            "name": group.name,
            "creator_id": group.creator_id,
            "created_at": group.created_at,
            "members": members_out,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/groups",
    response_model=list[SafetyGroupOut],
    summary="Get all safety groups the user belongs to",
)
def list_groups(db: DbSession, current_user: CurrentUser) -> list[dict]:
    groups = social_service.get_groups(db, current_user.id)
    out = []
    for group in groups:
        out.append({
            "id": group.id,
            "name": group.name,
            "creator_id": group.creator_id,
            "created_at": group.created_at,
            "members": [m.user for m in group.members],
        })
    return out


@router.post(
    "/groups/{group_id}/members",
    response_model=UserOut,
    summary="Add a friend to a safety group",
)
def add_group_member(
    db: DbSession, current_user: CurrentUser, group_id: int, payload: AddGroupMemberRequest
) -> UserOut:
    try:
        member = social_service.add_member_to_group(db, current_user.id, group_id, payload.friend_id)
        return member.user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete(
    "/groups/{group_id}/members/{member_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a member from a safety group or leave the group",
)
def remove_group_member(
    db: DbSession, current_user: CurrentUser, group_id: int, member_user_id: int
) -> None:
    try:
        social_service.remove_member_from_group(db, current_user.id, group_id, member_user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete(
    "/groups/{group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a safety group",
)
def delete_safety_group(db: DbSession, current_user: CurrentUser, group_id: int) -> None:
    try:
        social_service.delete_group(db, current_user.id, group_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ---- Threat Alert Sharing ----


@router.post(
    "/share",
    status_code=status.HTTP_201_CREATED,
    summary="Share a fraud/scam detection scan with friends or groups",
)
def share_scam_alert(db: DbSession, current_user: CurrentUser, payload: ThreatShareRequest) -> dict:
    try:
        alerts = social_service.share_threat_alerts(db, current_user.id, payload)
        return {"message": "Threat alert shared successfully.", "shared_count": len(alerts)}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/alerts",
    response_model=list[ThreatAlertOut],
    summary="Get all shared threat alerts received from friends or groups",
)
def get_alerts(db: DbSession, current_user: CurrentUser, unread_only: bool = False) -> list[dict]:
    alerts = social_service.get_received_alerts(db, current_user.id, unread_only)
    return [_map_alert(a) for a in alerts]


@router.post(
    "/alerts/{alert_id}/read",
    response_model=ThreatAlertOut,
    summary="Mark a received threat alert as read",
)
def mark_alert_read(db: DbSession, current_user: CurrentUser, alert_id: int) -> dict:
    try:
        alert = social_service.mark_alert_as_read(db, current_user.id, alert_id)
        return _map_alert(alert)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
