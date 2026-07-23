import json
import logging
import os

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

FROM_ADDRESS = os.environ.get("FROM_ADDRESS", "no-reply@proysocial.org")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

ses = boto3.client("sesv2", region_name=AWS_REGION)


def _send_email(to: list[str], subject: str, html: str, reply_to: str | None) -> None:
    params = {
        "FromEmailAddress": FROM_ADDRESS,
        "Destination": {"ToAddresses": to},
        "Content": {
            "Simple": {
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {"Html": {"Data": html, "Charset": "UTF-8"}},
            }
        },
    }
    if reply_to:
        params["ReplyToAddresses"] = [reply_to]

    ses.send_email(**params)


def handler(event: dict, context) -> dict:
    batch_item_failures = []

    for record in event.get("Records", []):
        message_id = record["messageId"]

        # --- Deserialize & validate payload ---
        try:
            body = json.loads(record["body"])
        except (json.JSONDecodeError, KeyError) as exc:
            logger.error(
                "Payload malformado — descartado sin reintento",
                extra={"messageId": message_id, "error": str(exc)},
            )
            continue

        to = body.get("to")
        subject = body.get("subject")
        html = body.get("html")
        reply_to = body.get("replyTo")

        if not to or not subject or not html:
            missing = [f for f, v in [("to", to), ("subject", subject), ("html", html)] if not v]
            logger.error(
                "Campos requeridos faltantes — descartado sin reintento",
                extra={"messageId": message_id, "missing": missing},
            )
            continue

        to_list = [to] if isinstance(to, str) else list(to)

        # --- Send via SES v2 ---
        try:
            _send_email(to_list, subject, html, reply_to)
            logger.info(
                "Email enviado correctamente",
                extra={"messageId": message_id, "to": to_list, "subject": subject},
            )
        except ClientError as exc:
            error_code = exc.response["Error"]["Code"]
            logger.error(
                "Error de SES al enviar email — se reintentará",
                extra={
                    "messageId": message_id,
                    "to": to_list,
                    "subject": subject,
                    "sesErrorCode": error_code,
                    "error": str(exc),
                },
            )
            batch_item_failures.append({"itemIdentifier": message_id})

    return {"batchItemFailures": batch_item_failures}
