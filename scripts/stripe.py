import stripe
import streamlit as st


def create_checkout_session(user_id: str, email: str, plan: str, refresh_token: str) -> str:
    stripe.api_key = st.secrets.stripe.api_key

    plans = {
        "starter": {"amount": 1500, "name": "Dashboard Analytics – Starter"},
        "pro":     {"amount": 3500, "name": "Dashboard Analytics – Pro"},
        "agency":  {"amount": 15000, "name": "Dashboard Analytics – Agency"},
    }

    try:
        base_url = st.secrets["app_url"]
    except Exception:
        base_url = "https://localhost:8502"

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "chf",
                "product_data": {"name": plans[plan]["name"]},
                "unit_amount": plans[plan]["amount"],
                "recurring": {"interval": "month"},
            },
            "quantity": 1,
        }],
        mode="subscription",
        success_url=(
            f"{base_url}/?payment=success"
            f"&session_id={{CHECKOUT_SESSION_ID}}"
            f"&refresh_token={refresh_token}"
        ),
        cancel_url=f"{base_url}/?payment=cancelled&refresh_token={refresh_token}",
        customer_email=email,
        metadata={"user_id": user_id, "plan": plan},
    )
    return session.url


def verify_and_get_metadata(session_id: str) -> dict | None:
    stripe.api_key = st.secrets.stripe.api_key
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        if session.status == "complete":
            return {
                "user_id": session.metadata.get("user_id"),
                "plan": session.metadata.get("plan"),
            }
    except Exception:
        pass
    return None
