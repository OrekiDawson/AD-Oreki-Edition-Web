"""Pre-push Pages asset contract: positive and fail-closed cases."""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_pages_staging import validate_site


class PagesStagingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        for path in (".nojekyll", "src/main.js", "public/icon.png",
                     "modules/helper.js", "public/site.css"):
            f = self.root / path
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(b"asset")
        (self.root / "index.html").write_text(
            '<html><link rel="stylesheet" href="./public/site.css?v=1">'
            '<script src="./src/main.js" type="module"></script>'
            '<script src="https://example.org/remote.js"></script>'
            '</html>', encoding="utf-8"
        )
        (self.root / "CNAME").write_text("oreki.net\n", encoding="utf-8")

    def tearDown(self):
        self.temp.cleanup()

    def test_valid_staging_passes(self):
        self.assertEqual(validate_site(self.root), [])

    def test_missing_core_script_fails(self):
        (self.root / "src/main.js").unlink()
        self.assertTrue(validate_site(self.root))

    def test_missing_linked_asset_fails(self):
        (self.root / "public/site.css").unlink()
        self.assertTrue(any("asset" in e for e in validate_site(self.root)))

    def test_wrong_custom_domain_fails(self):
        (self.root / "CNAME").write_text("example.org\n")
        self.assertTrue(any("CNAME" in e for e in validate_site(self.root)))

    def test_path_traversal_rejected(self):
        (self.root / "index.html").write_text('<img src="../../outside.png">')
        self.assertTrue(any("Unsafe" in e for e in validate_site(self.root)))

    def test_empty_nofiles_cannot_pass(self):
        (self.root / ".nojekyll").unlink()
        self.assertTrue(validate_site(self.root))


if __name__ == "__main__":
    unittest.main()
