"""Positive/negative cases for the incremental repository policy guard."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_repository_policy import inspect


def check(path="src/main.js", blob=b"const ok = true;\n", added=None,
          is_new=False, policy="web"):
    return inspect(path, blob, [] if added is None else added, is_new, policy)


class RepositoryPolicyTests(unittest.TestCase):
    def test_clean_source_is_allowed(self):
        self.assertFalse(check())

    def test_crlf_in_changed_text_is_rejected(self):
        self.assertTrue(check(blob=b"line one\r\nline two\n"))

    def test_binary_blob_is_not_treated_as_crlf_text(self):
        self.assertFalse(check(path="public/icon.png", blob=b"\x89PNG\r\n"))

    def test_new_android_java_payload_is_rejected(self):
        self.assertTrue(check(path="scripts/payload/kotlin/Unexpected.java",
                              is_new=True, policy="android"))

    def test_new_android_smali_payload_is_rejected(self):
        self.assertTrue(check(path="scripts/payload/smali/Unexpected.smali",
                              is_new=True, policy="android"))

    def test_preexisting_smali_compat_file_is_not_banned(self):
        self.assertFalse(check(path="scripts/payload/smali/Legacy.smali",
                               is_new=False, policy="android"))

    def test_new_private_keystore_is_rejected(self):
        self.assertTrue(check(path="config/oreki.jks", is_new=True))

    def test_new_environment_secrets_file_is_rejected(self):
        self.assertTrue(check(path=".env.production", is_new=True))

    def test_example_environment_file_is_allowed(self):
        self.assertFalse(check(path=".env.example", is_new=True))

    def test_new_realistic_github_token_marker_is_rejected(self):
        token = b"gh" + b"p_" + b"A" * 25
        self.assertTrue(check(added=[b"export TOKEN=" + token]))

    def test_old_unchanged_token_like_content_does_not_block_unrelated_edit(self):
        token = b"gh" + b"p_" + b"A" * 25
        self.assertFalse(check(blob=b"export TOKEN=" + token, added=[b"safe code"]))

    def test_new_private_key_pem_header_rejected(self):
        header = b"-----BEGIN " + b"RSA PRIVATE KEY-----"
        self.assertTrue(check(added=[header]))


if __name__ == "__main__":
    unittest.main()
