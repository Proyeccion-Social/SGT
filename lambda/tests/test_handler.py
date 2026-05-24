import json
import os
import unittest
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("FROM_ADDRESS", "no-reply@proysocial.org")
os.environ.setdefault("AWS_REGION", "us-east-1")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_record(body: str, message_id: str = "msg-1") -> dict:
    return {"messageId": message_id, "body": body}


def _make_event(*records: dict) -> dict:
    return {"Records": list(records)}


def _valid_body(**overrides) -> str:
    payload = {
        "to": "student@example.com",
        "subject": "Test subject",
        "html": "<p>Hello</p>",
    }
    payload.update(overrides)
    return json.dumps(payload)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestHandler(unittest.TestCase):

    def setUp(self):
        # Re-import handler inside each test so the patched boto3 client is used
        import importlib
        import lambda.handler as handler_module  # noqa: F401 — resolved below
        self.handler_module = handler_module

    @patch("lambda.handler.ses")
    def test_successful_single_message(self, mock_ses):
        """Un mensaje válido se envía correctamente y no aparece en batchItemFailures."""
        mock_ses.send_email.return_value = {"MessageId": "ses-id-1"}

        event = _make_event(_make_record(_valid_body()))
        result = self.handler_module.handler(event, None)

        mock_ses.send_email.assert_called_once()
        call_kwargs = mock_ses.send_email.call_args.kwargs
        assert call_kwargs["FromEmailAddress"] == "no-reply@proysocial.org"
        assert call_kwargs["Destination"]["ToAddresses"] == ["student@example.com"]
        assert result == {"batchItemFailures": []}

    @patch("lambda.handler.ses")
    def test_batch_with_valid_and_malformed_json(self, mock_ses):
        """Batch con un mensaje válido y uno con JSON inválido.

        El malformado se descarta sin reintento; el válido se procesa normalmente.
        """
        mock_ses.send_email.return_value = {"MessageId": "ses-id-2"}

        event = _make_event(
            _make_record(_valid_body(), message_id="msg-ok"),
            _make_record("{ this is not json }", message_id="msg-bad"),
        )
        result = self.handler_module.handler(event, None)

        mock_ses.send_email.assert_called_once()
        assert result == {"batchItemFailures": []}

    @patch("lambda.handler.ses")
    def test_ses_failure_adds_to_batch_item_failures(self, mock_ses):
        """Si SES lanza ClientError, el messageId debe aparecer en batchItemFailures."""
        from botocore.exceptions import ClientError

        mock_ses.send_email.side_effect = ClientError(
            {"Error": {"Code": "MessageRejected", "Message": "Email address not verified"}},
            "SendEmail",
        )

        event = _make_event(_make_record(_valid_body(), message_id="msg-fail"))
        result = self.handler_module.handler(event, None)

        assert result == {"batchItemFailures": [{"itemIdentifier": "msg-fail"}]}

    @patch("lambda.handler.ses")
    def test_missing_required_fields_discards_without_retry(self, mock_ses):
        """Payload con campos requeridos faltantes se descarta sin agregarlo a batchItemFailures."""
        payloads = [
            json.dumps({"subject": "No to field", "html": "<p>x</p>"}),
            json.dumps({"to": "a@b.com", "html": "<p>x</p>"}),          # sin subject
            json.dumps({"to": "a@b.com", "subject": "No html"}),        # sin html
        ]

        for i, body in enumerate(payloads):
            mock_ses.reset_mock()
            event = _make_event(_make_record(body, message_id=f"msg-{i}"))
            result = self.handler_module.handler(event, None)

            mock_ses.send_email.assert_not_called()
            assert result == {"batchItemFailures": []}, f"Falló para payload index {i}"

    @patch("lambda.handler.ses")
    def test_to_as_array_is_forwarded_correctly(self, mock_ses):
        """El campo 'to' puede ser un array de strings."""
        mock_ses.send_email.return_value = {"MessageId": "ses-id-3"}

        body = json.dumps({
            "to": ["alice@example.com", "bob@example.com"],
            "subject": "Multi-recipient",
            "html": "<p>Hi all</p>",
        })
        event = _make_event(_make_record(body))
        self.handler_module.handler(event, None)

        call_kwargs = mock_ses.send_email.call_args.kwargs
        assert call_kwargs["Destination"]["ToAddresses"] == ["alice@example.com", "bob@example.com"]

    @patch("lambda.handler.ses")
    def test_reply_to_is_passed_when_present(self, mock_ses):
        """El campo opcional replyTo se incluye en la llamada a SES."""
        mock_ses.send_email.return_value = {"MessageId": "ses-id-4"}

        body = json.dumps({
            "to": "student@example.com",
            "subject": "Reply test",
            "html": "<p>Reply to me</p>",
            "replyTo": "support@proysocial.org",
        })
        event = _make_event(_make_record(body))
        self.handler_module.handler(event, None)

        call_kwargs = mock_ses.send_email.call_args.kwargs
        assert call_kwargs.get("ReplyToAddresses") == ["support@proysocial.org"]

    @patch("lambda.handler.ses")
    def test_mixed_batch_partial_ses_failure(self, mock_ses):
        """En un batch de 3, solo el que falla en SES aparece en batchItemFailures."""
        from botocore.exceptions import ClientError

        def side_effect(**kwargs):
            to = kwargs["Destination"]["ToAddresses"][0]
            if to == "fail@example.com":
                raise ClientError(
                    {"Error": {"Code": "SendingPausedException", "Message": "Paused"}},
                    "SendEmail",
                )
            return {"MessageId": "ok"}

        mock_ses.send_email.side_effect = side_effect

        event = _make_event(
            _make_record(json.dumps({"to": "ok1@example.com", "subject": "s", "html": "<p/>"}), "msg-1"),
            _make_record(json.dumps({"to": "fail@example.com", "subject": "s", "html": "<p/>"}), "msg-2"),
            _make_record(json.dumps({"to": "ok2@example.com", "subject": "s", "html": "<p/>"}), "msg-3"),
        )
        result = self.handler_module.handler(event, None)

        assert result == {"batchItemFailures": [{"itemIdentifier": "msg-2"}]}
        assert mock_ses.send_email.call_count == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
