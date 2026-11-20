import { RebuyableMechanicState } from "./game-mechanics/index.js";

export const shop = {};

// The STD/IAP store is retired for Oreki Edition.  Keep this compatibility
// surface so old saves can still be read, but never let purchase history or
// stale IAP flags affect gameplay.
const NO_SHOP_EFFECT = 1;

export const ShopPurchaseData = {
  totalSTD: 0,
  spentSTD: 0,
  respecAvailable: false,
  lastRespec: "",
  unlockedCosmetics: [],

  get availableSTD() {
    return this.totalSTD - this.spentSTD;
  },

  get isIAPEnabled() {
    return false;
  },

  // We also allow for respecs if it's been at least 3 days since the last one
  get timeUntilRespec() {
    const msSinceLast = Date.now() - new Date(ShopPurchaseData.lastRespec).getTime();
    return TimeSpan.fromMilliseconds(3 * 86400 * 1000 - msSinceLast);
  },

  get canRespec() {
    return false;
  },

  updateLocalSTD(newData) {
    this.totalSTD = newData.totalSTD;
    this.spentSTD = newData.spentSTD;
    this.respecAvailable = newData.respecAvailable;
    this.lastRespec = newData.lastRespec ?? 0;
    this.unlockedCosmetics = [...(newData.unlockedCosmetics ?? [])];
    for (const key of Object.keys(GameDatabase.shopPurchases)) this[key] = newData[key] ?? 0;
    if (this.allCosmeticSets > 0) this.unlockedCosmetics = Object.keys(GameDatabase.reality.glyphCosmeticSets);
    GameStorage.save();
  },

  clearLocalSTD() {
    this.totalSTD = 0;
    this.spentSTD = 0;
    this.respecAvailable = false;
    this.unlockedCosmetics = [];
    for (const key of Object.keys(GameDatabase.shopPurchases)) this[key] = 0;
  },

  // Legacy entry point retained for Steam login code. Store effects remain off.
  async syncSTD() {
    return;
  },

  respecRequest() {},

  async respecAll() {
    return false;
  },
};

// We track the local state of shop purchases here, so dynamically add all the keys which exist in the gameDB
for (const key of Object.keys(GameDatabase.shopPurchases)) ShopPurchaseData[key] = 0;

class ShopPurchaseState extends RebuyableMechanicState {
  get currency() {
    return ShopPurchaseData.availableSTD;
  }

  get isAffordable() {
    return this.currency >= this.cost;
  }

  get description() {
    const desc = this.config.description;
    return typeof desc === "function" ? desc() : desc;
  }

  get cost() {
    const cost = this.config.cost;
    return typeof cost === "function" ? cost() : cost;
  }

  // ShopPurchaseData for any particular key is undefined in between page load and STD load,
  // so we need to guard against that causing NaNs to propagate through the save
  get purchases() {
    return ShopPurchaseData[this.config.key] ?? 0;
  }

  set purchases(value) {
    if (!Number.isFinite(value)) return;
    ShopPurchaseData[this.config.key] = value;
  }

  isUnlocked() {
    return player.records.fullGameCompletions > 0 || (this.config.isUnlocked?.() ?? true);
  }

  get lockText() {
    return this.config.lockText;
  }

  get shouldDisplayMult() {
    return Boolean(this.config.multiplier);
  }

  get currentMult() {
    return NO_SHOP_EFFECT;
  }

  get nextMult() {
    return NO_SHOP_EFFECT;
  }

  get currentMultForDisplay() {
    return NO_SHOP_EFFECT;
  }

  get nextMultForDisplay() {
    return NO_SHOP_EFFECT;
  }

  formatEffect(effect) {
    return this.config.formatEffect?.(effect) || formatX(effect, 2, 0);
  }

  async purchase() {
    return false;
  }
}

export const ShopPurchase = mapGameDataToObject(
  GameDatabase.shopPurchases,
  config => new ShopPurchaseState(config)
);

shop.purchaseTimeSkip = function() {
  return false;
};

shop.purchaseLongerTimeSkip = function() {
  return false;
};
