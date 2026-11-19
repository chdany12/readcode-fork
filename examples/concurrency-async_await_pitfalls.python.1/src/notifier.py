import asyncio
import logging

log = logging.getLogger("scheduling.notifier")

SMS_TIMEOUT_S = 5.0


class Notifier:
    def __init__(self, smtp_client, sms_gateway):
        self._smtp = smtp_client
        self._sms = sms_gateway

    async def send_confirmation(self, appointment) -> None:
        body = self._render(appointment)
        await asyncio.to_thread(self._smtp.send, appointment.patient_email, body)
        if appointment.patient_phone:
            try:
                await asyncio.wait_for(
                    self._sms.send(appointment.patient_phone, body),
                    timeout=SMS_TIMEOUT_S,
                )
            except asyncio.TimeoutError:
                log.info("sms timed out for appointment %s", appointment.id)

    @staticmethod
    def _render(appointment) -> str:
        return (
            f"Your appointment with {appointment.provider_name} is confirmed "
            f"for {appointment.start:%Y-%m-%d %H:%M}."
        )
