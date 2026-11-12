// Release safety: prevent a future edit from silently deploying moving main.
// This is a lightweight structural guard; the real deployment must still pass
// Web CI, exact commit checkout, protected environment and live Pages checks.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const deploy = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
assert.match(deploy, /approved_sha:/);
assert.match(deploy, /APPROVED_SHA.*\$\{\{ inputs\.approved_sha \}\}/);
assert.match(deploy, /ref: \$\{\{ inputs\.approved_sha \}\}/);
assert.match(deploy, /git rev-parse HEAD/);
assert.match(deploy, /\$actual.*\$APPROVED_SHA.*\$GITHUB_SHA/);
assert.match(deploy, /needs: gate/);
assert.match(deploy, /environment: web-production/);
assert.match(deploy, /grep -Fxq 'oreki\.net' pages-site\/CNAME/);
console.log("PASS: Pages deploy uses the exact CI-approved Web commit and retains production gates");
