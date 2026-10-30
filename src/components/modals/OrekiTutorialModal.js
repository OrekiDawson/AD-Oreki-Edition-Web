import ModalWrapperChoice from "./ModalWrapperChoice.js";
import {
  getChapterGaps,
  getTutorialStageSnapshot,
  getTutorialStartIndex,
  TUTORIAL_CHAPTERS,
  TUTORIAL_LOCKED_PREFIX,
  TUTORIAL_SCHEMA_VERSION,
  TutorialReadingPosition,
} from "../../core/oreki-tutorial.js";
import { ensureTutorialStyles } from "../tutorial/OrekiTutorialStyles.js";

/**
 * 上次读到的章节下标；没有记录或章节已被删掉时退回「当前阶段」定位。
 * @returns {{index: number, resumed: boolean}}
 */
function resolveInitialIndex() {
  const savedId = TutorialReadingPosition.chapterId;
  if (savedId) {
    const index = TUTORIAL_CHAPTERS.findIndex(chapter => chapter.id === savedId);
    if (index >= 0) return { index, resumed: true };
  }
  return { index: getTutorialStartIndex(), resumed: false };
}

/**
 * AD: Oreki Edition — 内置教程弹窗
 *
 * 纯展示：只读取游戏状态，不写 player，也不改任何开关。
 * 正文全部来自 src/core/oreki-tutorial-data.json（经 oreki-tutorial.js 暴露），
 * 本组件只负责排版，不写任何一句正文。
 *
 * 行为约定：
 * - 打开时定位到「当前阶段」对应的章节（getTutorialStartIndex），不再固定停在第 1 章；
 * - 切章时把内容区 scrollTop 归零；
 * - 所属阶段未解锁时，正文顶部显示 TUTORIAL_LOCKED_PREFIX，不把没解锁的机制写成可用；
 * - 阶段判定按「每 15 帧一次 + 状态签名未变就提前返回」执行，不每帧重写 DOM。
 */
export default {
  name: "OrekiTutorialModal",
  components: {
    ModalWrapperChoice,
  },
  data() {
    ensureTutorialStyles();
    const initial = resolveInitialIndex();
    return {
      chapters: TUTORIAL_CHAPTERS,
      schemaVersion: TUTORIAL_SCHEMA_VERSION,
      index: initial.index,
      stage: getTutorialStageSnapshot(),
      stageSig: "",
      frameTick: 0,
      lockedPrefix: TUTORIAL_LOCKED_PREFIX,
      // 用户手动点过目录（或从上次位置续读）之后就不再让自动定位抢走焦点
      navigated: initial.resumed,
      // 由「玩家主动关闭」置真，用来区分「被别的弹窗顶掉」与「读完了」
      closedByUser: false,
    };
  },
  computed: {
    chapter() {
      return this.chapters[this.index] || this.chapters[0];
    },
    isFirst() {
      return this.index === 0;
    },
    isLast() {
      return this.index === this.chapters.length - 1;
    },
    chapterStage() {
      // 用已经算好的 stage 快照，避免每次渲染再判定一遍阶段
      if (!this.chapter.stageKey) return null;
      const row = this.stage.rows.find(item => item.key === this.chapter.stageKey);
      return row ? { status: row.status, statusText: row.statusText, name: row.name } : null;
    },
    isLocked() {
      return this.chapterStage !== null && this.chapterStage.status === "locked";
    },
    stageDots() {
      // 目录里每个章节的状态点：只为「属于某个阶段」的章节显示
      const map = {};
      for (const row of this.stage.rows) map[row.key] = row.status;
      return map;
    },
    hasSteps() {
      return Array.isArray(this.chapter.steps) && this.chapter.steps.length > 0;
    },
    hasBuyOrder() {
      return Array.isArray(this.chapter.buyOrder) && this.chapter.buyOrder.length > 0;
    },
    hasNumbers() {
      return Array.isArray(this.chapter.numbers) && this.chapter.numbers.length > 0;
    },
    hasTraps() {
      return Array.isArray(this.chapter.traps) && this.chapter.traps.length > 0;
    },
    hasTable() {
      const table = this.chapter.table;
      return Boolean(table && Array.isArray(table.head) && Array.isArray(table.rows)
        && table.head.length > 0 && table.rows.length > 0);
    },
    /** 草稿章（有 draft 标记且没有 steps）显示「本章正在编写中」占位卡 */
    chapterGaps() {
      return getChapterGaps(this.chapter);
    },
    showPlaceholder() {
      return Boolean(this.chapter.draft) && this.chapterGaps.pending.length > 0;
    },
  },
  created() {
    this.stageSig = this.stageSignature(this.stage);
    // 玩家主动关（× / 「关闭教程」 / Esc）才是「读完了」；被别的弹窗顶掉不会派发 CLOSE_MODAL，
    // 所以这个监听同时充当「这次销毁是不是用户意图」的判据。
    this.on$(GAME_EVENT.CLOSE_MODAL, () => {
      this.closedByUser = true;
    });
  },
  beforeDestroy() {
    // 被更高优先级弹窗顶掉时，组件会被销毁再重建；记下章节，回来接着读。
    TutorialReadingPosition.chapterId = this.closedByUser ? null : this.chapter.id;
  },
  mounted() {
    this.resetScroll();
  },
  methods: {
    update() {
      // 每 15 帧（约 4 次/秒）才重新判定一次阶段，避免每帧做无意义的重算
      this.frameTick += 1;
      if (this.frameTick % 15 !== 0) return;
      const next = getTutorialStageSnapshot();
      const sig = this.stageSignature(next);
      if (sig === this.stageSig) return;
      this.stageSig = sig;
      this.stage = next;
      // 玩家还没自己翻过章时，跟着阶段变化重新定位
      if (!this.navigated) this.index = getTutorialStartIndex();
    },
    stageSignature(stage) {
      return `${stage.key}|${stage.rows.map(row => row.status).join(",")}`;
    },
    resetScroll() {
      this.$nextTick(() => {
        const box = this.$refs.scroll;
        if (box) box.scrollTop = 0;
      });
    },
    goTo(index) {
      if (index < 0 || index >= this.chapters.length) return;
      this.navigated = true;
      this.index = index;
      this.resetScroll();
    },
    prevChapter() {
      this.goTo(this.index - 1);
    },
    nextChapter() {
      this.goTo(this.index + 1);
    },
    backToCurrent() {
      this.navigated = false;
      this.index = getTutorialStartIndex();
      this.resetScroll();
    },
    stageLabelOf(chapter) {
      if (!chapter.stageKey) return null;
      return this.stageDots[chapter.stageKey] || null;
    },
    close() {
      EventHub.dispatch(GAME_EVENT.CLOSE_MODAL);
    },
  },
  template: `
  <ModalWrapperChoice
    :show-confirm="false"
    :use-enter-to-confirm="false"
    @cancel="close"
  >
    <template #header>
      内置教程
    </template>
    <template #cancel-text>
      关闭教程
    </template>
    <div class="c-oreki-tut">
      <div class="c-oreki-tut__layout">
        <nav class="c-oreki-tut__nav">
          <button
            v-for="(item, i) in chapters"
            :key="item.id"
            class="c-oreki-tut__nav-btn"
            :class="{ 'c-oreki-tut__nav-btn--active': i === index }"
            @click="goTo(i)"
          >
            <span class="c-oreki-tut__nav-index">{{ i }}</span>
            <span class="c-oreki-tut__nav-title">{{ item.title }}</span>
            <span
              v-if="stageLabelOf(item)"
              class="c-oreki-tut__dot"
              :class="'c-oreki-tut__dot--' + stageLabelOf(item)"
            />
          </button>
        </nav>
        <div class="c-oreki-tut__main">
          <div class="c-oreki-tut__head">
            <span class="c-oreki-tut__head-title">{{ chapter.title }}</span>
            <span class="c-oreki-tut__head-subtitle">{{ chapter.subtitle }}</span>
          </div>
          <div
            ref="scroll"
            class="c-oreki-tut__scroll"
          >
            <div
              v-if="isLocked"
              class="c-oreki-tut__locked"
            >
              {{ lockedPrefix }}{{ chapterStage.name }}的机制现在还不能用，本章只是提前告诉你它长什么样。
            </div>
            <div
              v-if="chapter.draft && !showPlaceholder"
              class="c-oreki-tut__draft"
            >
              本章尚未写完（草稿），内容可能只有骨架。
            </div>
            <div
              v-if="showPlaceholder"
              class="c-oreki-tut__placeholder"
            >
              <div class="c-oreki-tut__placeholder-title">
                本章正在编写中
              </div>
              <div class="c-oreki-tut__placeholder-body">
                <p>
                  这一章只写到骨架，还没有可执行的操作步骤。下面是已经写好的部分，可以照它判断自己走到哪一步；缺的部分补完后会自动出现在这里，不需要你另找攻略。
                </p>
                <p>已有内容：{{ chapterGaps.ready.length ? chapterGaps.ready.join("、") : "无" }}</p>
                <p>还缺内容：{{ chapterGaps.pending.join("、") }}</p>
              </div>
            </div>
            <div class="c-oreki-tut__current">
              <div class="c-oreki-tut__current-label">
                你现在的阶段
              </div>
              <div class="c-oreki-tut__current-name">
                {{ stage.name }}
              </div>
              <div class="c-oreki-tut__current-focus">
                {{ stage.focus }}
              </div>
            </div>

            <section class="c-oreki-tut__block">
              <div class="c-oreki-tut__label">
                阶段目标
              </div>
              <div class="c-oreki-tut__text">
                {{ chapter.stageGoal }}
              </div>
            </section>

            <section class="c-oreki-tut__block">
              <div class="c-oreki-tut__label">
                进入条件
              </div>
              <div class="c-oreki-tut__text">
                {{ chapter.entry }}
              </div>
            </section>

            <section
              v-if="hasSteps"
              class="c-oreki-tut__block"
            >
              <div class="c-oreki-tut__label">
                具体操作
              </div>
              <ol class="c-oreki-tut__list">
                <li
                  v-for="(step, si) in chapter.steps"
                  :key="'step' + si"
                >
                  {{ step.text }}
                  <span
                    v-if="step.auto"
                    class="c-oreki-tut__auto"
                  >已自动化</span>
                </li>
              </ol>
            </section>

            <section
              v-if="hasBuyOrder"
              class="c-oreki-tut__block"
            >
              <div class="c-oreki-tut__label">
                购买优先级
              </div>
              <ol class="c-oreki-tut__list">
                <li
                  v-for="(item, bi) in chapter.buyOrder"
                  :key="'buy' + bi"
                >
                  {{ item }}
                </li>
              </ol>
            </section>

            <section
              v-if="chapter.automation"
              class="c-oreki-tut__block"
            >
              <div class="c-oreki-tut__label">
                自动化配置（哪些事不用你做）
              </div>
              <div class="c-oreki-tut__text">
                {{ chapter.automation }}
              </div>
            </section>

            <section
              v-if="chapter.challenges"
              class="c-oreki-tut__block"
            >
              <div class="c-oreki-tut__label">
                挑战攻略
              </div>
              <div class="c-oreki-tut__text">
                {{ chapter.challenges }}
              </div>
            </section>

            <section
              v-if="hasNumbers"
              class="c-oreki-tut__block"
            >
              <div class="c-oreki-tut__label">
                关键数值
              </div>
              <table class="c-oreki-tut__table">
                <tbody>
                  <tr
                    v-for="(num, ni) in chapter.numbers"
                    :key="'num' + ni"
                  >
                    <td class="c-oreki-tut__key">
                      {{ num.label }}
                    </td>
                    <td>
                      {{ num.value }}
                      <span class="c-oreki-tut__src">{{ num.src }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section
              v-if="hasTable"
              class="c-oreki-tut__block"
            >
              <div class="c-oreki-tut__label">
                对照表
              </div>
              <table class="c-oreki-tut__table">
                <thead>
                  <tr>
                    <th
                      v-for="(head, hi) in chapter.table.head"
                      :key="'th' + hi"
                    >
                      {{ head }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, ri) in chapter.table.rows"
                    :key="'tr' + ri"
                  >
                    <td
                      v-for="(cell, ci) in row"
                      :key="'td' + ci"
                    >
                      {{ cell }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section class="c-oreki-tut__block">
              <div class="c-oreki-tut__label">
                完成判据
              </div>
              <div class="c-oreki-tut__done">
                {{ chapter.done }}
              </div>
            </section>

            <section class="c-oreki-tut__block">
              <div class="c-oreki-tut__label">
                下一步
              </div>
              <div class="c-oreki-tut__text">
                {{ chapter.next }}
              </div>
            </section>

            <section
              v-if="hasTraps"
              class="c-oreki-tut__block"
            >
              <div class="c-oreki-tut__label">
                常见卡点
              </div>
              <ul class="c-oreki-tut__trap">
                <li
                  v-for="(trap, ti) in chapter.traps"
                  :key="'trap' + ti"
                >
                  {{ trap }}
                </li>
              </ul>
            </section>

            <section
              v-if="chapter.note"
              class="c-oreki-tut__block"
            >
              <div class="c-oreki-tut__text">
                {{ chapter.note }}
              </div>
            </section>
          </div>
          <div class="c-oreki-tut__footer">
            <button
              class="o-primary-btn c-oreki-tut__nav-move"
              :class="{ 'c-oreki-tut__nav-move--disabled': isFirst }"
              @click="prevChapter"
            >
              上一章
            </button>
            <button
              class="o-primary-btn c-oreki-tut__nav-move"
              @click="backToCurrent"
            >
              回到当前进度
            </button>
            <span class="c-oreki-tut__counter">{{ index }} / {{ chapters.length - 1 }}</span>
            <button
              class="o-primary-btn c-oreki-tut__nav-move"
              :class="{ 'c-oreki-tut__nav-move--disabled': isLast }"
              @click="nextChapter"
            >
              下一章
            </button>
          </div>
        </div>
      </div>
    </div>
  </ModalWrapperChoice>
  `
};
