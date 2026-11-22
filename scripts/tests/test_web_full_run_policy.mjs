import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGateSummary,
  classifyFirstReality,
  overallResult,
} from "../web-full-run-policy.mjs";

test("Reality 早于 70 分钟必须 FAIL", () => {
  assert.equal(classifyFirstReality(4199).status, "FAIL");
});

test("Reality 在 70–75 分钟仅记首现实时间带 PASS-BAND", () => {
  assert.equal(classifyFirstReality(4200).status, "PASS-BAND");
  assert.equal(classifyFirstReality(4500).status, "PASS-BAND");
});

test("Reality 晚于 75 分钟不能自动冒充整套 PACING PASS", () => {
  assert.equal(classifyFirstReality(4501).status, "NOT RUN");
});

test("180 分钟未通关为 ENDGAME FAIL，提前停止为 NOT RUN", () => {
  const timeout = buildGateSummary({
    gameEnd: false,
    gameEndWallSeconds: null,
    totalWallSeconds: 10800,
    maxWallSeconds: 10800,
    confirmSeconds: 0,
    confirmRegressions: 0,
    firstRealityWallSeconds: 5000,
  });
  assert.equal(timeout.endgame, "FAIL");
  const short = buildGateSummary({
    gameEnd: false,
    gameEndWallSeconds: null,
    totalWallSeconds: 600,
    maxWallSeconds: 600,
    confirmSeconds: 0,
    confirmRegressions: 0,
    firstRealityWallSeconds: null,
  });
  assert.equal(short.endgame, "NOT RUN");
});

test("终局后稳定性与总体结果分离", () => {
  const gates = buildGateSummary({
    gameEnd: true,
    gameEndWallSeconds: 9000,
    totalWallSeconds: 9120,
    maxWallSeconds: 10800,
    confirmSeconds: 120,
    confirmRegressions: 0,
    firstRealityWallSeconds: 4300,
  });
  assert.equal(gates.endgame, "PASS");
  assert.equal(gates.postEndgame, "PASS");
  assert.equal(gates.pacing, "NOT RUN");
  assert.equal(overallResult(gates, {
    gameEnd: true,
    totalWallSeconds: 9120,
    maxWallSeconds: 10800,
  }), "GAMEEND-PASS");
});
