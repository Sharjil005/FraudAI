"""Shared Pydantic field types."""

from __future__ import annotations

from typing import Annotated

import email_validator
from email_validator import EmailNotValidError, validate_email
from pydantic import AfterValidator, StringConstraints

# FraudShield seeds its demo and administrator accounts on the reserved
# ``.local`` domain (see ADMIN_EMAIL / DEMO_EMAIL in app.core.config), and the
# platform never sends mail, so a globally routable domain is not required.
# email_validator rejects every IANA special-use name unconditionally, and the
# only supported way to relax that is to edit its list — which is what the
# library's own note beside SPECIAL_USE_DOMAIN_NAMES describes. Dropping
# ``local`` keeps every other reserved name (arpa, invalid, onion…) rejected.
if "local" in email_validator.SPECIAL_USE_DOMAIN_NAMES:
    email_validator.SPECIAL_USE_DOMAIN_NAMES.remove("local")


def _normalise_email(value: str) -> str:
    """Validate an address and return it lowercased."""
    try:
        result = validate_email(value, check_deliverability=False)
    except EmailNotValidError as error:
        raise ValueError(f"Enter a valid email address ({error})") from error
    return result.normalized.lower()


AccountEmail = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=3, max_length=254),
    AfterValidator(_normalise_email),
]
"""An email address, normalised to lowercase. Permits the ``.local`` demo domain."""
