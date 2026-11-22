import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGateSummary,
  checkpointExportError,
  classifyFirstReality,
  overallResult,
  validateRunnerOptions,
} from "../web-full-run-policy.mjs";

test("存档导出 API 缺失、抛错或空文本必须成为运行错误", () => {
  assert.match(
    checkpointExportError({ save: null }),
    /exportModifiedSave 不可用/,
  );
  assert.equal(
    checkpointExportError({ save: "ERROR: export failed" }),
    "ERROR: export failed",
  );
  assert.match(
    checkpointExportError({ save: "" }),
    /返回空文本/,
  );
  assert.equal(checkpointExportError({ save: "{}" }), null);
});

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
  assert.equal(gates.postEndgame, "NOT RUN");
  assert.equal(gates.pacing, "NOT RUN");
  assert.equal(overallResult(gates, {
    gameEnd: true,
    totalWallSeconds: 9120,
    maxWallSeconds: 10800,
  }), "GAMEEND-PASS");
});

test("终局后确认回归才判 FAIL，确认不足保持 NOT RUN", () => {
  const short = buildGateSummary({
    gameEnd: true,
    gameEndWallSeconds: 9000,
    totalWallSeconds: 9060,
    maxWallSeconds: 10800,
    confirmSeconds: 60,
    requiredConfirmSeconds: 120,
    confirmRegressions: 0,
    firstRealityWallSeconds: 4300,
  });
  assert.equal(short.postEndgame, "NOT RUN");
  const regressed = buildGateSummary({
    gameEnd: true,
    gameEndWallSeconds: 9000,
    totalWallSeconds: 9120,
    maxWallSeconds: 10800,
    confirmSeconds: 120,
    requiredConfirmSeconds: 120,
    confirmRegressions: 1,
    firstRealityWallSeconds: 4300,
  });
  assert.equal(regressed.postEndgame, "FAIL");
});

test("运行错误必须覆盖 GAMEEND-PASS", () => {
  const gates = buildGateSummary({
    gameEnd: true,
    gameEndWallSeconds: 9000,
    totalWallSeconds: 9120,
    maxWallSeconds: 10800,
    confirmSeconds: 120,
    confirmRegressions: 0,
    firstRealityWallSeconds: 4300,
  });
  assert.equal(overallResult(gates, {
    gameEnd: true,
    totalWallSeconds: 9120,
    maxWallSeconds: 10800,
    errorCount: 1,
  }), "RUNTIME-ERROR");
});

test("终局后稳定性回退必须覆盖 GAMEEND-PASS", () => {
  const gates = buildGateSummary({
    gameEnd: true,
    gameEndWallSeconds: 9000,
    totalWallSeconds: 9120,
    maxWallSeconds: 10800,
    confirmSeconds: 120,
    confirmRegressions: 1,
    firstRealityWallSeconds: 4300,
  });
  assert.equal(gates.postEndgame, "FAIL");
  assert.equal(overallResult(gates, {
    gameEnd: true,
    totalWallSeconds: 9120,
    maxWallSeconds: 10800,
  }), "POST-ENDGAME-FAIL");
});

test("CLI 时间参数必须为正有限数", () => {
  assert.throws(() => validateRunnerOptions({
    maxMinutes: 180,
    sampleMs: Number.NaN,
    shotMs: 60000,
    confirmSeconds: 120,
  }), /--sample-ms/);
  assert.throws(() => validateRunnerOptions({
    maxMinutes: 180,
    sampleMs: 10000,
    shotMs: 0,
    confirmSeconds: 120,
  }), /--shot-ms/);
  assert.throws(() => validateRunnerOptions({
    maxMinutes: 180,
    sampleMs: 10000,
    shotMs: 60000,
    confirmSeconds: Infinity,
  }), /--confirm-sec/);
});
