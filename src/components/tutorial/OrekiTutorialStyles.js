/**
 * AD: Oreki Edition — 教程正文的补充样式（运行时注入一次）
 *
 * 为什么不用 public/stylesheets/oreki.css：
 *   本轮的写权限只在教程相关的 core / components 文件里，不动全局样式表。
 *   这些类只在教程正文里出现，注入一次即可，重复调用按 id 去重。
 *
 * 约定：类名沿用 c-oreki-tut__ 前缀，与 oreki.css 里已有的教程样式同族，
 * 颜色全部走项目已有的 CSS 变量（--color-reality / --color-good / --color-bad），
 * 不写死色值，避免亮暗主题下不可读。
 */

export const TUTORIAL_STYLE_ID = "oreki-tutorial-injected-style";

const CSS = `
.c-oreki-tut__block { margin: 0 0 0.9rem; }
.c-oreki-tut__label {
  margin-bottom: 0.25rem;
  font-size: 1.15rem;
  font-weight: bold;
  letter-spacing: 0.02em;
  color: var(--color-reality);
}
.c-oreki-tut__text { font-size: 1.25rem; line-height: 1.6; }
.c-oreki-tut__list {
  margin: 0;
  padding-left: 1.6rem;
  font-size: 1.25rem;
  line-height: 1.6;
}
.c-oreki-tut__list li { margin-bottom: 0.35rem; }
.c-oreki-tut__auto {
  display: inline-block;
  margin-left: 0.4rem;
  padding: 0 0.4rem;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--color-good);
  white-space: nowrap;
  border: 0.1rem solid var(--color-good);
  border-radius: 0.3rem;
}
.c-oreki-tut__table {
  width: 100%;
  font-size: 1.15rem;
  line-height: 1.5;
  border-collapse: collapse;
}
.c-oreki-tut__table th,
.c-oreki-tut__table td {
  padding: 0.3rem 0.5rem;
  text-align: left;
  vertical-align: top;
  border-bottom: 0.1rem solid rgb(255 255 255 / 12%);
}
.c-oreki-tut__table th { font-weight: bold; color: var(--color-reality); }
.c-oreki-tut__key { width: 32%; white-space: nowrap; }
.c-oreki-tut__src {
  display: block;
  margin-top: 0.1rem;
  font-size: 0.95rem;
  opacity: 0.55;
  word-break: break-all;
}
.c-oreki-tut__trap {
  margin: 0 0 0.9rem;
  padding: 0.6rem 0.8rem;
  font-size: 1.2rem;
  line-height: 1.55;
  background: rgb(255 255 255 / 4%);
  border-left: 0.4rem solid var(--color-bad);
  border-radius: 0.4rem;
}
.c-oreki-tut__trap li { margin-bottom: 0.3rem; }
.c-oreki-tut__locked {
  margin-bottom: 0.8rem;
  padding: 0.5rem 0.8rem;
  font-size: 1.15rem;
  color: var(--color-bad);
  border: 0.1rem solid var(--color-bad);
  border-radius: 0.4rem;
}
.c-oreki-tut__done {
  padding: 0.5rem 0.8rem;
  font-size: 1.2rem;
  line-height: 1.55;
  border: 0.1rem solid var(--color-good);
  border-radius: 0.4rem;
}
.c-oreki-tut__draft {
  margin-bottom: 0.8rem;
  font-size: 1.1rem;
  font-style: italic;
  opacity: 0.7;
}
.c-oreki-tut__dot {
  flex: 0 0 auto;
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 50%;
}
.c-oreki-tut__dot--entered { background: var(--color-good); }
.c-oreki-tut__dot--available { background: var(--color-reality); }
.c-oreki-tut__dot--locked { border: 0.1rem solid rgb(255 255 255 / 35%); }
.c-oreki-tut__details { margin: 0 0 0.6rem; }
.c-oreki-tut__summary {
  padding: 0.4rem 0.2rem;
  font-size: 1.3rem;
  font-weight: bold;
  cursor: pointer;
  color: var(--color-reality);
}
.c-oreki-tut__summary--current { color: var(--color-good); }
`;

/**
 * 注入教程补充样式。可重复调用。
 * @param {Document|null} doc
 */
export function ensureTutorialStyles(doc = typeof document === "undefined" ? null : document) {
  if (!doc || !doc.head) return;
  if (doc.getElementById(TUTORIAL_STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = TUTORIAL_STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}
