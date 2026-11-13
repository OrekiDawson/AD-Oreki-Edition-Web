// Fail closed if a future edit makes Web production use moving source or bypass tested CI.
// The protected Pages repository independently verifies the exact CI run before deployment.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const deploy = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
assert.match(deploy, /approved_sha:/);
assert.match(deploy, /APPROVED_SHA.*\$\{\{ inputs\.approved_sha \}\}/);
assert.match(deploy, /ref: \$\{\{ inputs\.approved_sha \}\}/);
assert.match(deploy, /git rev-parse HEAD/);
assert.match(deploy, /\$actual.*\$APPROVED_SHA.*\$GITHUB_SHA/);
assert.match(deploy, /actions\/workflows\/ci\.yml\/runs\?head_sha=/);
assert.match(deploy, /event=push/);
assert.match(deploy, /Node checks/);
assert.match(deploy, /Mobile Chromium smoke/);
assert.match(deploy, /needs: gate/);
assert.match(deploy, /environment: web-production/);
assert.match(deploy, /deploy-approved-web\.yml\/dispatches/);
assert.match(deploy, /web_ci_run_id/);
assert.doesNotMatch(deploy, /git -C pages-site push|rsync -a --delete .*pages-site/);
console.log("PASS: Web production dispatch reuses exact source CI and cannot directly push Pages main");
