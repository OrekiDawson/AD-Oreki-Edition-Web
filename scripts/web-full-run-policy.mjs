export const FIRST_REALITY_MIN_SECONDS = 70 * 60;
export const FIRST_REALITY_TOLERANCE_SECONDS = 5 * 60;
export const FULL_RUN_SECONDS = 180 * 60;

/**
 * 原版存档导出是独立证据。API 缺失、抛错或返回空文本时必须进入运行错误，
 * 不能让仅观察页面 isGameEnd 的结果升级为 GAMEEND-PASS。
 */
export function checkpointExportError(checkpoint) {
  const save = checkpoint?.save;
  if (typeof save !== "string") {
    return "GameStorage.exportModifiedSave 不可用或未返回文本";
  }
  if (save.startsWith("ERROR:")) return save;
  if (save.length === 0) {
    return "GameStorage.exportModifiedSave 返回空文本";
  }
  return null;
}

/**
 * 只按页面内观测到的真实首次 Reality 时刻判断提前/正常/偏晚。
 *
 * 偏晚不等于五阶段 PACING 已 PASS；还需要后续检查完整阶段时间线。
 */
export function classifyFirstReality(wallSeconds) {
  if (!Number.isFinite(wallSeconds) || wallSeconds < 0) {
    return { status: "NOT RUN", reason: "missing-first-reality-time" };
  }
  if (wallSeconds < FIRST_REALITY_MIN_SECONDS) {
    return {
      status: "FAIL",
      reason: "first-reality-before-70-minutes",
      wallSeconds,
    };
  }
  if (wallSeconds <= FIRST_REALITY_MIN_SECONDS + FIRST_REALITY_TOLERANCE_SECONDS) {
    return {
      status: "PASS-BAND",
      reason: "first-reality-within-70-75-minute-band",
      wallSeconds,
    };
  }
  return {
    status: "NOT RUN",
    reason: "first-reality-after-75-minute-band; full timeline review required",
    wallSeconds,
  };
}

/**
 * 五项门禁独立汇总。PACING 只有在完整时间线经人工核验后才可另行记 PASS；
 * 本工具可以确定提前 Reality 为 FAIL，也能独立判断 ENDGAME 与终局后稳定性。
 */
export function buildGateSummary({
  gameEnd,
  gameEndWallSeconds,
  totalWallSeconds,
  maxWallSeconds,
  confirmSeconds,
  requiredConfirmSeconds = 120,
  confirmRegressions,
  firstRealityWallSeconds,
}) {
  const firstReality = classifyFirstReality(firstRealityWallSeconds);
  const fullBudgetRequested = maxWallSeconds >= FULL_RUN_SECONDS;

  let endgame = "NOT RUN";
  if (gameEnd === true && Number.isFinite(gameEndWallSeconds)) {
    endgame = gameEndWallSeconds <= FULL_RUN_SECONDS ? "PASS" : "FAIL";
  } else if (fullBudgetRequested && totalWallSeconds >= maxWallSeconds) {
    endgame = "FAIL";
  }

  let postEndgame = "NOT RUN";
  if (gameEnd === true) {
    if (confirmRegressions > 0) {
      postEndgame = "FAIL";
    } else if (confirmSeconds >= requiredConfirmSeconds) {
      // 仅持续观察 isGameEnd 不能证明终局后的存档保存、重载和状态恢复。
      postEndgame = "NOT RUN";
    }
  }

  return {
    gameplayLegality: "NOT RUN",
    pacing: firstReality.status === "FAIL" ? "FAIL" : "NOT RUN",
    endgame,
    postEndgame,
    saveCompatibility: "NOT RUN",
    firstReality,
  };
}

export function overallResult(gates, {
  gameEnd,
  totalWallSeconds,
  maxWallSeconds,
  errorCount = 0,
}) {
  if (errorCount > 0) return "RUNTIME-ERROR";
  if (gates.postEndgame === "FAIL") return "POST-ENDGAME-FAIL";
  if (gates.firstReality.status === "FAIL") return "PACING-FAIL";
  if (gameEnd === true) return gates.endgame === "PASS" ? "GAMEEND-PASS" : "GAMEEND-FAIL";
  if (maxWallSeconds >= FULL_RUN_SECONDS && totalWallSeconds >= maxWallSeconds) {
    return "TIMEOUT-FAIL";
  }
  return "STOPPED-NOT-RUN";
}

export function validateRunnerOptions({ maxMinutes, sampleMs, shotMs, confirmSeconds }) {
  for (const [flag, value] of [
    ["--max-min", maxMinutes],
    ["--sample-ms", sampleMs],
    ["--shot-ms", shotMs],
    ["--confirm-sec", confirmSeconds],
  ]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${flag} 必须为正有限数`);
    }
  }
}
