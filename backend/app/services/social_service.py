"""Social service: implements business logic for friendships, groups, and threat alerts."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.social import Friendship, FriendshipStatus, SafetyGroup, GroupMember, ThreatAlert
from app.models.user import User
from app.models.scan import Scan
from app.schemas.social import ThreatShareRequest
from app.services.email import send_friend_invite_email

logger = logging.getLogger(__name__)


def create_friend_request(db: Session, sender: User, receiver_email: str) -> Friendship:
    """Create a friend request and send an invitation email."""
    normalized_email = receiver_email.strip().lower()
    if sender.email == normalized_email:
        raise ValueError("You cannot send a friend request to yourself.")

    receiver = db.query(User).filter(User.email == normalized_email).first()
    if not receiver:
        raise ValueError(
            f"The email '{receiver_email}' is not registered on FraudShield. "
            "Please ask your friend to register first!"
        )

    # Check if friendship already exists
    existing = db.query(Friendship).filter(
        or_(
            (Friendship.user_id == sender.id) & (Friendship.friend_id == receiver.id),
            (Friendship.user_id == receiver.id) & (Friendship.friend_id == sender.id),
        )
    ).first()

    if existing:
        if existing.status == FriendshipStatus.ACCEPTED:
            raise ValueError("You are already friends with this user.")
        elif existing.status == FriendshipStatus.PENDING:
            if existing.user_id == sender.id:
                raise ValueError("Friend request is already pending.")
            else:
                # Receiver has already sent a request to sender. Auto-accept it!
                existing.status = FriendshipStatus.ACCEPTED
                db.commit()
                db.refresh(existing)
                return existing
        else:  # REJECTED or reset
            # Reset to PENDING and swap sender if needed
            existing.user_id = sender.id
            existing.friend_id = receiver.id
            existing.status = FriendshipStatus.PENDING
            existing.created_at = datetime.now(UTC)
            db.commit()
            db.refresh(existing)
            # Re-send email
            accept_url = "http://localhost:3000/dashboard/social"
            send_friend_invite_email(sender.name, receiver.email, accept_url)
            return existing

    # Create new pending friendship
    friendship = Friendship(
        user_id=sender.id,
        friend_id=receiver.id,
        status=FriendshipStatus.PENDING,
    )
    db.add(friendship)
    db.commit()
    db.refresh(friendship)

    # Send invite email
    accept_url = "http://localhost:3000/dashboard/social"
    send_friend_invite_email(sender.name, receiver.email, accept_url)

    return friendship


def get_pending_requests(db: Session, user_id: int) -> list[Friendship]:
    """Get all pending friend requests involving the user."""
    return db.query(Friendship).filter(
        Friendship.status == FriendshipStatus.PENDING,
        or_(Friendship.user_id == user_id, Friendship.friend_id == user_id),
    ).all()


def accept_friend_request(db: Session, user_id: int, request_id: int) -> Friendship:
    """Accept a pending friend request."""
    friendship = db.query(Friendship).filter(Friendship.id == request_id).first()
    if not friendship:
        raise ValueError("Friend request not found.")

    if friendship.friend_id != user_id:
        raise ValueError("You can only accept requests sent to you.")

    if friendship.status != FriendshipStatus.PENDING:
        raise ValueError(f"Friend request is not pending (status: {friendship.status.value}).")

    friendship.status = FriendshipStatus.ACCEPTED
    db.commit()
    db.refresh(friendship)
    return friendship


def reject_friend_request(db: Session, user_id: int, request_id: int) -> Friendship:
    """Reject a pending friend request."""
    friendship = db.query(Friendship).filter(Friendship.id == request_id).first()
    if not friendship:
        raise ValueError("Friend request not found.")

    if friendship.friend_id != user_id:
        raise ValueError("You can only decline requests sent to you.")

    if friendship.status != FriendshipStatus.PENDING:
        raise ValueError(f"Friend request is not pending (status: {friendship.status.value}).")

    friendship.status = FriendshipStatus.REJECTED
    db.commit()
    db.refresh(friendship)
    return friendship


def remove_friendship(db: Session, user_id: int, friendship_id: int) -> None:
    """Remove a friendship or cancel a request."""
    friendship = db.query(Friendship).filter(Friendship.id == friendship_id).first()
    if not friendship:
        raise ValueError("Friend connection not found.")

    if friendship.user_id != user_id and friendship.friend_id != user_id:
        raise ValueError("You can only remove your own connections.")

    db.delete(friendship)
    db.commit()


def get_friends(db: Session, user_id: int) -> list[User]:
    """Get list of active friends (accepted friendships)."""
    friendships = db.query(Friendship).filter(
        Friendship.status == FriendshipStatus.ACCEPTED,
        or_(Friendship.user_id == user_id, Friendship.friend_id == user_id),
    ).all()

    friends_ids = []
    for f in friendships:
        friends_ids.append(f.friend_id if f.user_id == user_id else f.user_id)

    if not friends_ids:
        return []

    return db.query(User).filter(User.id.in_(friends_ids)).all()


def create_group(db: Session, creator_id: int, name: str) -> SafetyGroup:
    """Create a new Safety Group and add the creator as a member."""
    clean_name = name.strip()
    if not clean_name:
        raise ValueError("Group name cannot be empty.")

    group = SafetyGroup(name=clean_name, creator_id=creator_id)
    db.add(group)
    db.commit()
    db.refresh(group)

    # Add creator as member
    member = GroupMember(group_id=group.id, user_id=creator_id)
    db.add(member)
    db.commit()
    db.refresh(group)

    return group


def delete_group(db: Session, user_id: int, group_id: int) -> None:
    """Delete a Safety Group (creator only)."""
    group = db.query(SafetyGroup).filter(SafetyGroup.id == group_id).first()
    if not group:
        raise ValueError("Group not found.")

    if group.creator_id != user_id:
        raise ValueError("Only the group creator can delete this group.")

    db.delete(group)
    db.commit()


def get_groups(db: Session, user_id: int) -> list[SafetyGroup]:
    """Get all Safety Groups the user is part of."""
    return db.query(SafetyGroup).join(GroupMember).filter(GroupMember.user_id == user_id).all()


def add_member_to_group(db: Session, user_id: int, group_id: int, friend_id: int) -> GroupMember:
    """Add a friend to an existing Safety Group (creator only)."""
    group = db.query(SafetyGroup).filter(SafetyGroup.id == group_id).first()
    if not group:
        raise ValueError("Group not found.")

    if group.creator_id != user_id:
        raise ValueError("Only the group creator can manage members.")

    # Verify friend_id is actually an active friend of the creator
    friendship = db.query(Friendship).filter(
        Friendship.status == FriendshipStatus.ACCEPTED,
        or_(
            (Friendship.user_id == user_id) & (Friendship.friend_id == friend_id),
            (Friendship.user_id == friend_id) & (Friendship.friend_id == user_id),
        ),
    ).first()

    if not friendship:
        raise ValueError("You can only add registered friends to your group.")

    # Check if friend is already in group
    existing_member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id, GroupMember.user_id == friend_id
    ).first()

    if existing_member:
        raise ValueError("This user is already a member of the group.")

    member = GroupMember(group_id=group_id, user_id=friend_id)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def remove_member_from_group(db: Session, user_id: int, group_id: int, member_user_id: int) -> None:
    """Remove a member from a Safety Group (creator only, or user leaving)."""
    group = db.query(SafetyGroup).filter(SafetyGroup.id == group_id).first()
    if not group:
        raise ValueError("Group not found.")

    # Creator can remove anyone; member can only remove themselves (leave group)
    if group.creator_id != user_id and member_user_id != user_id:
        raise ValueError("You do not have permission to remove this member.")

    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id, GroupMember.user_id == member_user_id
    ).first()

    if not member:
        raise ValueError("Member not found in group.")

    # Creator cannot leave their own group (must delete group instead)
    if group.creator_id == member_user_id and group.creator_id == user_id:
        raise ValueError("As the creator, you cannot leave your own group. Delete the group instead.")

    db.delete(member)
    db.commit()


def share_threat_alerts(db: Session, sender_id: int, payload: ThreatShareRequest) -> list[ThreatAlert]:
    """Share a scan threat with selected friends or safety groups."""
    scan = db.query(Scan).filter(Scan.id == payload.scan_id).first()
    if not scan:
        raise ValueError("Scan record not found.")

    if scan.user_id != sender_id:
        raise ValueError("You can only share scans that you have executed.")

    created_alerts = []

    # 1. Share with private friends
    for friend_id in payload.friend_ids:
        # Verify friendship
        friendship = db.query(Friendship).filter(
            Friendship.status == FriendshipStatus.ACCEPTED,
            or_(
                (Friendship.user_id == sender_id) & (Friendship.friend_id == friend_id),
                (Friendship.user_id == friend_id) & (Friendship.friend_id == sender_id),
            ),
        ).first()

        if not friendship:
            continue  # Skip if not actual friends

        # Check if already shared
        existing = db.query(ThreatAlert).filter(
            ThreatAlert.sender_id == sender_id,
            ThreatAlert.scan_id == payload.scan_id,
            ThreatAlert.receiver_id == friend_id,
        ).first()

        if existing:
            continue

        alert = ThreatAlert(
            sender_id=sender_id,
            scan_id=payload.scan_id,
            receiver_id=friend_id,
            note=payload.note,
        )
        db.add(alert)
        created_alerts.append(alert)

    # 2. Share with safety groups
    for group_id in payload.group_ids:
        # Verify sender is member of the group
        membership = db.query(GroupMember).filter(
            GroupMember.group_id == group_id, GroupMember.user_id == sender_id
        ).first()

        if not membership:
            continue  # Skip if sender is not in the group

        # Check if already shared with this group
        existing = db.query(ThreatAlert).filter(
            ThreatAlert.sender_id == sender_id,
            ThreatAlert.scan_id == payload.scan_id,
            ThreatAlert.group_id == group_id,
        ).first()

        if existing:
            continue

        alert = ThreatAlert(
            sender_id=sender_id,
            scan_id=payload.scan_id,
            group_id=group_id,
            note=payload.note,
        )
        db.add(alert)
        created_alerts.append(alert)

    db.commit()
    return created_alerts


def get_received_alerts(db: Session, user_id: int, unread_only: bool = False) -> list[ThreatAlert]:
    """Retrieve all threat alerts shared with the user directly or via their groups."""
    # Find all groups the user belongs to
    user_groups = db.query(GroupMember.group_id).filter(GroupMember.user_id == user_id).all()
    group_ids = [g[0] for g in user_groups]

    # Query direct or group alerts
    query_filter = or_(
        ThreatAlert.receiver_id == user_id,
        ThreatAlert.group_id.in_(group_ids) if group_ids else False,
    )

    filters = [
        query_filter,
        ThreatAlert.sender_id != user_id
    ]
    if unread_only:
        filters.append(ThreatAlert.is_read == False)

    # Do not show alerts sent by the user themselves
    alerts = db.query(ThreatAlert).filter(*filters).order_by(ThreatAlert.created_at.desc()).all()

    return alerts


def mark_alert_as_read(db: Session, user_id: int, alert_id: int) -> ThreatAlert:
    """Mark a received threat alert as read."""
    alert = db.query(ThreatAlert).filter(ThreatAlert.id == alert_id).first()
    if not alert:
        raise ValueError("Alert not found.")

    # Verify user is indeed the receiver (directly or via group membership)
    is_receiver = alert.receiver_id == user_id
    if not is_receiver and alert.group_id is not None:
        membership = db.query(GroupMember).filter(
            GroupMember.group_id == alert.group_id, GroupMember.user_id == user_id
        ).first()
        if membership:
            is_receiver = True

    if not is_receiver:
        raise ValueError("You do not have access to this alert.")

    alert.is_read = True
    db.commit()
    db.refresh(alert)
    return alert
