export const FIRST_REALITY_MIN_SECONDS = 70 * 60;
export const FIRST_REALITY_TOLERANCE_SECONDS = 5 * 60;
export const FULL_RUN_SECONDS = 180 * 60;
export const MAX_CONTINUITY_GAP_SECONDS = 60;
export const OFFLINE_PROGRESS_TOLERANCE_MS = 10_000;

function pushRuntimeError(summary, prefix, message) {
  if (summary.runtimeErrors.some(error => error.startsWith(prefix))) return false;
  summary.runtimeErrors.push(message);
  return true;
}

/**
 * 前台连续运行验收不能把宿主暂停后的原版离线补算当作在线进度。
 * 墙钟使用 Date.now()，单调时钟使用 performance.now()；两者差值可识别
 * 进程或宿主的暂停时间，且不依赖页面内的 visibility 状态。
 */
export function measureContinuity(previous, current) {
  const wallGapSeconds = Math.max(0, (current.wallMs - previous.wallMs) / 1000);
  const monotonicGapSeconds = Math.max(
    0,
    (current.monotonicMs - previous.monotonicMs) / 1000,
  );
  return {
    wallGapSeconds,
    monotonicGapSeconds,
    divergenceSeconds: Math.max(0, wallGapSeconds - monotonicGapSeconds),
  };
}

export function recordContinuityCheck(continuity, previous, current) {
  const measurement = measureContinuity(previous, current);
  continuity.maxObservedDivergenceSeconds = Math.max(
    continuity.maxObservedDivergenceSeconds ?? 0,
    measurement.divergenceSeconds,
  );
  if (measurement.divergenceSeconds <= MAX_CONTINUITY_GAP_SECONDS) return null;
  const result = {
    ...measurement,
    detectedAtIso: new Date(current.wallMs).toISOString(),
  };
  continuity.breaks.push(result);
  return result;
}

export function recordOfflineProgress(summary, snapshot) {
  const rawOfflineTimeUsed = snapshot?.offlineTimeUsed;
  if (rawOfflineTimeUsed === null || rawOfflineTimeUsed === undefined) {
    const message = "offline-time-probe: 无法读取 player.speedrun.offlineTimeUsed";
    pushRuntimeError(summary, "offline-time-probe:", message);
    return message;
  }
  const offlineTimeUsed = Number(rawOfflineTimeUsed);
  if (!Number.isFinite(offlineTimeUsed)) {
    const message = "offline-time-probe: offlineTimeUsed 不是有限数";
    pushRuntimeError(summary, "offline-time-probe:", message);
    return message;
  }
  summary.continuity.offlineTimeUsedMs = offlineTimeUsed;
  if (offlineTimeUsed <= OFFLINE_PROGRESS_TOLERANCE_MS) return null;
  summary.continuity.offlineTimeUsedSeconds = Math.ceil(offlineTimeUsed / 1000);
  const message = `offline-progress: 原版已模拟 ${summary.continuity.offlineTimeUsedSeconds} 秒离线进度`;
  pushRuntimeError(summary, "offline-progress:", message);
  return message;
}

/**
 * offlineTimeUsed 只覆盖存档载入补算；运行期 hibernationCatchup 不会更新它。
 * 因此同时检查页面心跳、页面/Node 墙钟偏差和离线弹窗，捕获渲染进程单独冻结。
 */
export function recordPageContinuity(summary, snapshot, nodeWallSeconds) {
  const heartbeatGapSeconds = Number(snapshot?.maxHeartbeatGapMs) / 1000;
  if (Number.isFinite(heartbeatGapSeconds)
      && heartbeatGapSeconds > MAX_CONTINUITY_GAP_SECONDS) {
    pushRuntimeError(
      summary,
      "page-heartbeat:",
      `page-heartbeat: 页面心跳中断 ${Math.round(heartbeatGapSeconds)} 秒`,
    );
  }
  const pageWallSeconds = Number(snapshot?.pageWallSeconds);
  if (Number.isFinite(pageWallSeconds) && Number.isFinite(nodeWallSeconds)) {
    const divergence = Math.max(0, pageWallSeconds - nodeWallSeconds);
    if (divergence > MAX_CONTINUITY_GAP_SECONDS) {
      pushRuntimeError(
        summary,
        "page-clock:",
        `page-clock: 页面墙钟比 Node 连续时钟多 ${Math.round(divergence)} 秒`,
      );
    }
  }
  if (snapshot?.offlineCatchupSeen) {
    const seconds = Number(snapshot.offlineCatchupSeen.catchupSeconds);
    const suffix = Number.isFinite(seconds) ? `，约 ${Math.round(seconds)} 秒` : "";
    pushRuntimeError(
      summary,
      "offline-catchup-seen:",
      `offline-catchup-seen: 检测到原版离线补算弹窗${suffix}`,
    );
  }
}

/**
 * 运行期间一旦不再满足连续前台条件，补算后的事件仍可保留作诊断，
 * 但五项独立门禁不得继续输出产品 PASS/FAIL。
 */
export function quarantineRuntimeGates(gates, errorCount) {
  if (errorCount <= 0) return gates;
  return {
    ...gates,
    gameplayLegality: "NOT RUN",
    pacing: "NOT RUN",
    endgame: "NOT RUN",
    postEndgame: "NOT RUN",
    saveCompatibility: "NOT RUN",
    invalidatedByRuntimeErrors: errorCount,
  };
}

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

export function recordCheckpointExport(summary, reason, checkpoint) {
  const exportError = checkpointExportError(checkpoint);
  if (exportError) {
    summary.runtimeErrors.push(`checkpoint ${reason}: ${exportError}`);
  }
  return exportError;
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
