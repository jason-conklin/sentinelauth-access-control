"""Optional alerting via Slack and SMTP."""

from __future__ import annotations

import asyncio
import smtplib
from email.message import EmailMessage
from typing import Any, Dict, Optional

import httpx
from loguru import logger

from ..config import Settings


class AlertService:
    """Dispatch security alerts to configured channels."""

    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def enabled(self) -> bool:
        return bool(self.settings.alert_channels)

    async def notify(self, subject: str, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        if not self.enabled:
            logger.debug("Alert skipped (no channels configured): {}", subject)
            return

        tasks = []
        if "slack" in self.settings.alert_channels and self.settings.slack_webhook_url:
            tasks.append(self._send_slack(subject, message, metadata or {}))
        if "email" in self.settings.alert_channels and self.settings.smtp_host:
            tasks.append(self._send_email(subject, message, metadata or {}))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _send_slack(self, subject: str, message: str, metadata: Dict[str, Any]) -> None:
        payload = {
            "text": f"*{subject}*\n{message}\n```{metadata}```",
        }
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(self.settings.slack_webhook_url, json=payload)
        except Exception as exc:  # pragma: no cover - best effort network
            logger.warning("Failed to send Slack alert: {}", exc)

    async def _send_email(self, subject: str, message: str, metadata: Dict[str, Any]) -> None:
        if not self.settings.smtp_user or not self.settings.smtp_pass or not self.settings.smtp_to:
            logger.warning("Skipping email alert; SMTP credentials incomplete")
            return
        email = EmailMessage()
        email["Subject"] = subject
        email["From"] = self.settings.smtp_from or self.settings.smtp_user
        email["To"] = self.settings.smtp_to
        email.set_content(f"{message}\n\nMetadata:\n{metadata}")
        try:
            await asyncio.to_thread(
                self._send_email_blocking,
                email,
            )
        except Exception as exc:  # pragma: no cover - best effort network
            logger.warning("Failed to send email alert: {}", exc)

    def _send_email_blocking(self, email: EmailMessage) -> None:
        with smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port) as smtp:
            smtp.starttls()
            smtp.login(self.settings.smtp_user, self.settings.smtp_pass)
            smtp.send_message(email)
