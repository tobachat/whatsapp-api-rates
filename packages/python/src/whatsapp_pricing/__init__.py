"""Meta WhatsApp Business API per-message rates and a monthly cost estimator.

Pure standard library, no network calls. Data: Meta's published rate card,
compiled by Tobachat (CC BY 4.0).
"""

from __future__ import annotations

import json
from importlib import resources
from typing import Any, Dict, List, Optional

__all__ = ["get_rate", "list_markets", "estimate_monthly_cost", "DATA", "CATEGORIES"]
__version__ = "0.1.0"

CATEGORIES = ("marketing", "utility", "authentication", "service")

DATA: Dict[str, Any] = json.loads(
    resources.files(__package__).joinpath("data.json").read_text(encoding="utf-8")
)


def _find_market(country: str):
    key = country.strip().upper()
    if not key:
        raise ValueError("country is required")
    markets = DATA["markets"]
    for m in markets:
        if m["market"].upper() == key:
            return m, m["type"]
    for m in markets:
        if m["type"] == "country" and key in m["iso_codes"]:
            return m, "country"
    for m in markets:
        if m["type"] == "region" and key in m["iso_codes"]:
            return m, "region"
    # Meta bills every country it does not name under "Other".
    for m in markets:
        if m["market"] == "Other":
            return m, "other"
    raise ValueError('rate data has no "Other" market')


def get_rate(country: str, category: str) -> Dict[str, Any]:
    """Meta's list rate per delivered message.

    `country` is an ISO 3166-1 alpha-2 code or a market name.
    """
    if category not in CATEGORIES:
        raise ValueError(f"unknown category: {category}")
    m, by = _find_market(country)
    return {
        "market": m["market"],
        "matched_by": by,
        "category": category,
        "rate": m[category],
        "currency": DATA["currency"],
        "effective_date": DATA["effective_date"],
        "source": DATA["source"],
    }


def list_markets() -> List[Dict[str, Any]]:
    """Every market on the rate card (countries first, then regions)."""
    return json.loads(json.dumps(DATA["markets"]))


def estimate_monthly_cost(
    country: str,
    marketing: int = 0,
    utility: int = 0,
    authentication: int = 0,
    service: int = 0,
    phone_numbers: Optional[int] = 1,
) -> Dict[str, Any]:
    """Monthly cost at list rates, excl. VAT.

    The first 1,000 service messages per business phone number per month are
    free; everything else is billed per message.
    """
    phones = 1 if phone_numbers is None else phone_numbers
    if not isinstance(phones, int) or phones < 1:
        raise ValueError("phone_numbers must be a positive integer")
    free = DATA["free_service_per_number"] * phones
    counts = {
        "marketing": marketing,
        "utility": utility,
        "authentication": authentication,
        "service": service,
    }
    lines: Dict[str, Any] = {}
    total = 0.0
    market = ""
    for c in CATEGORIES:
        messages = counts[c]
        if messages < 0:
            raise ValueError(f"{c} must be >= 0")
        r = get_rate(country, c)
        market = r["market"]
        billable = max(0, messages - free) if c == "service" else messages
        cost = round(billable * r["rate"], 6)
        lines[c] = {"messages": messages, "billable": billable, "rate": r["rate"], "cost": cost}
        total += cost
    return {
        "market": market,
        "currency": DATA["currency"],
        "lines": lines,
        "total": round(total, 6),
        "free_service_messages": free,
        "effective_date": DATA["effective_date"],
        "source": DATA["source"],
    }
