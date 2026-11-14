export default {
  name: "ModernSidebarCurrency",
  data() {
    return {
      sidebarID: 0,
      // [R112-01-W2] 「最新资源」档（sidebarID === 0）实际解析到的资源 id。
      // 旧实现把「最新解锁资源」的解析放在 computed 里直接读 player 解锁状态，而 player 不是
      // Vue 响应式对象：组件在 created 阶段先调过一次 update()（见 core/ui.js 的全局 mixin），
      // 那次求值发生在 $recompute 依赖挂上之前，之后 sidebarID 恒为 0 不再变化，
      // computed 就永远命中第一次的缓存 —— 侧栏货币固定停在开局资源（新档=反物质），
      // 解锁无限点数 / 永恒点数 / 现实机器后都不会切换；刷新页面（重新挂载）又会切到最新资源。
      // 这里改为由 update() 每帧把「最新可用资源 id」同步进响应式字段，只有真的解锁了新资源
      // 才会触发 computed 重算，刷新前后行为一致。
      defaultResourceID: 2,
      resourceName: "",
      resourceValue: new Decimal(0)
    };
  },
  computed: {
    resourceDB: () => GameDatabase.sidebarResources,
    numDBEntries() {
      return this.resourceDB.length;
    },
    resource() {
      // With "default" sorting, return the latest unlocked resource - otherwise, return the specified one.
      // [R112-01-W2] 「最新资源」档的解析结果由 update() 写进响应式 defaultResourceID；
      // computed 不再直接读 player 解锁状态（读取非响应式状态拿不到依赖，会被永久缓存）。
      const id = this.sidebarID === 0 ? this.defaultResourceID : this.sidebarID;
      return this.resourceDB.find(e => e.id === id) ?? this.resourceDB[0];
    },
    displayValue() {
      // RM + iM seems to cause strange, undesirable linebreaks
      return this.resource.formatValue(this.resourceValue).replace(" + ", "+");
    }
  },
  methods: {
    /** 当前真实可用资源里的最大 id（=「最新资源」档应显示的条目）。只读，不写存档。 */
    latestAvailableResourceID() {
      let latest = 0;
      for (const entry of this.resourceDB) {
        if (entry.isAvailable() && entry.id > latest) latest = entry.id;
      }
      return latest;
    },
    update() {
      this.sidebarID = player.options.sidebarResourceID;
      // [R112-01-W2] 默认档必须每帧按真实解锁状态重算（根因见 data() 里 defaultResourceID 的说明）。
      if (this.sidebarID === 0) {
        const latest = this.latestAvailableResourceID();
        if (latest > 0 && latest !== this.defaultResourceID) this.defaultResourceID = latest;
      }
      this.resourceName = this.resource.resourceName ?? this.resource.optionName;
      this.resourceValue.copyFrom(this.resource.value());
    },
    cycleResource(dir) {
      const oldID = this.sidebarID;
      this.sidebarID = (this.sidebarID + this.numDBEntries + dir) % this.numDBEntries;
      while (this.sidebarID !== oldID) {
        if (this.resource.isAvailable()) break;
        this.sidebarID = (this.sidebarID + this.numDBEntries + dir) % this.numDBEntries;
      }
      player.options.sidebarResourceID = this.sidebarID;
    },
    containerClass() {
      return {
        "c-sidebar-resource": true,
        "c-sidebar-resource-default": this.sidebarID === 0,
      };
    },
    styleObject() {
      const strLen = this.displayValue.length;
      return {
        transform: `scale(${strLen < 10 ? 1 : 10 / strLen})`,
      };
    }
  },
  template: `
  <div
    :class="containerClass()"
    @click.exact="cycleResource(1)"
    @click.shift.exact="cycleResource(-1)"
    data-v-modern-sidebar-currency
  >
    <h2
      :class="resource.formatClass"
      :style="styleObject()"
      data-v-modern-sidebar-currency
    >
      {{ displayValue }}
    </h2>
    <div
      class="c-sidebar-resource__information"
      data-v-modern-sidebar-currency
    >
      <span
        class="c-sidebar-resource__name"
        data-v-modern-sidebar-currency
      >{{ resourceName }}</span>
    </div>
  </div>
  `
};