// Coffey AdBlocker - Background Service Worker

const MODES = ['off', 'normal', 'optimal'];

let blockedCount = 0;
let sessionBlocked = 0;
const blockedResourcesByTab = new Map();
const COLLAPSIBLE_RESOURCE_TYPES = new Set(['image', 'media', 'object', 'sub_frame']);

function normalizeResourceURL(url) {
  if (typeof url !== 'string' || url.length === 0) return '';
  try {
    return new URL(url).href;
  } catch (_error) {
    return '';
  }
}

function normalizeResourceType(type) {
  return String(type || '').toLowerCase().trim();
}

function resourceKey(type, url) {
  return `${normalizeResourceType(type)} ${url}`;
}

function addBlockedResource(tabId, type, url) {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  const safeType = normalizeResourceType(type);
  if (!COLLAPSIBLE_RESOURCE_TYPES.has(safeType)) return;
  const normalized = normalizeResourceURL(url);
  if (!normalized) return;

  let entry = blockedResourcesByTab.get(tabId);
  if (!entry) {
    entry = {
      set: new Set(),
      queue: [],
    };
    blockedResourcesByTab.set(tabId, entry);
  }

  const key = resourceKey(safeType, normalized);
  if (entry.set.has(key)) return;

  entry.set.add(key);
  entry.queue.push(key);

  if (entry.queue.length <= 1200) return;

  const stale = entry.queue.splice(0, entry.queue.length - 1000);
  stale.forEach((oldKey) => entry.set.delete(oldKey));
}

function isBlockActionMatch(info) {
  const actionFromRule = info?.rule?.action;
  if (typeof actionFromRule === 'string') {
    return actionFromRule === 'block';
  }
  if (typeof actionFromRule?.type === 'string') {
    return actionFromRule.type === 'block';
  }

  const actionFromRequest = info?.request?.action;
  if (typeof actionFromRequest === 'string') {
    return actionFromRequest === 'block';
  }

  // Static ruleset kita saat ini isinya block-rules.
  return true;
}

function getMatchedBlockedResourceKeys(tabId, requests) {
  const entry = blockedResourcesByTab.get(tabId);
  if (!entry || !Array.isArray(requests) || requests.length === 0) {
    return [];
  }

  const matched = new Set();

  requests.forEach((request) => {
    const type = normalizeResourceType(request?.type);
    if (!COLLAPSIBLE_RESOURCE_TYPES.has(type)) return;

    const url = normalizeResourceURL(request?.url);
    if (!url) return;

    const key = resourceKey(type, url);
    if (entry.set.has(key)) {
      matched.add(key);
    }
  });

  return Array.from(matched);
}

function normalizeHostname(hostname) {
  return String(hostname || '')
    .toLowerCase()
    .replace(/^www\./, '')
    .trim();
}

function normalizeMode(mode) {
  return MODES.includes(mode) ? mode : 'optimal';
}

function deriveMode(enabled, elementBlocking) {
  if (enabled === false) return 'off';
  return elementBlocking === false ? 'normal' : 'optimal';
}

function modeToSettings(mode) {
  if (mode === 'off') {
    return { mode: 'off', enabled: false, elementBlocking: false };
  }

  if (mode === 'normal') {
    return { mode: 'normal', enabled: true, elementBlocking: false };
  }

  return { mode: 'optimal', enabled: true, elementBlocking: true };
}

async function setRulesetEnabled(enabled) {
  try {
    if (enabled) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: ['ad_blocklist'],
      });
    } else {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: ['ad_blocklist'],
      });
    }
  } catch (error) {
    console.log('[Coffey] Rule toggle:', error);
  }
}

function sendMessageToAllTabs(payload) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.id) return;
      chrome.tabs.sendMessage(tab.id, payload).catch(() => {});
    });
  });
}

async function applyMode(mode) {
  const settings = modeToSettings(normalizeMode(mode));

  await chrome.storage.local.set({
    mode: settings.mode,
    enabled: settings.enabled,
    elementBlocking: settings.elementBlocking,
  });

  await setRulesetEnabled(settings.enabled);

  sendMessageToAllTabs({ type: 'UPDATE_ENABLED', enabled: settings.enabled });
  sendMessageToAllTabs({ type: 'UPDATE_ELEMENT_BLOCKING', enabled: settings.elementBlocking });

  return settings.mode;
}

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get([
    'totalBlocked',
    'enabled',
    'elementBlocking',
    'sessionBlocked',
    'customSelectors',
    'mode',
  ]);

  const mode = normalizeMode(
    data.mode || deriveMode(data.enabled !== false, data.elementBlocking !== false)
  );
  const settings = modeToSettings(mode);

  await chrome.storage.local.set({
    totalBlocked: data.totalBlocked || 0,
    sessionBlocked: data.sessionBlocked || 0,
    customSelectors: data.customSelectors || {},
    mode: settings.mode,
    enabled: settings.enabled,
    elementBlocking: settings.elementBlocking,
  });

  await setRulesetEnabled(settings.enabled);
  sessionBlocked = data.sessionBlocked || 0;
  console.log('[Coffey AdBlocker] Installed & ready. 3516 domains blocked.');
});

chrome.storage.local.get(['sessionBlocked'], (data) => {
  sessionBlocked = data.sessionBlocked || 0;
});

chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener(async (info) => {
  if (!isBlockActionMatch(info)) return;

  blockedCount++;
  sessionBlocked++;
  addBlockedResource(info?.request?.tabId, info?.request?.type, info?.request?.url);

  const data = await chrome.storage.local.get(['totalBlocked']);
  await chrome.storage.local.set({
    totalBlocked: (data.totalBlocked || 0) + 1,
    sessionBlocked,
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  blockedResourcesByTab.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    blockedResourcesByTab.delete(tabId);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATS') {
    chrome.storage.local.get(
      ['totalBlocked', 'sessionBlocked', 'enabled', 'elementBlocking', 'mode'],
      (data) => {
        const mode = normalizeMode(
          data.mode || deriveMode(data.enabled !== false, data.elementBlocking !== false)
        );
        sendResponse({
          totalBlocked: data.totalBlocked || 0,
          sessionBlocked: data.sessionBlocked || 0,
          enabled: data.enabled !== false,
          elementBlocking: data.elementBlocking !== false,
          mode,
          rulesCount: 3516,
        });
      }
    );
    return true;
  }

  if (message.type === 'SET_MODE') {
    (async () => {
      const mode = await applyMode(message.mode);
      sendResponse({ success: true, mode });
    })();
    return true;
  }

  if (message.type === 'TOGGLE_ENABLED') {
    chrome.storage.local.get(['elementBlocking'], (data) => {
      const targetMode = message.enabled !== false
        ? (data.elementBlocking === false ? 'normal' : 'optimal')
        : 'off';

      (async () => {
        const mode = await applyMode(targetMode);
        sendResponse({ success: true, enabled: mode !== 'off', mode });
      })();
    });
    return true;
  }

  if (message.type === 'TOGGLE_ELEMENT_BLOCKING') {
    chrome.storage.local.get(['enabled'], (data) => {
      let targetMode = 'optimal';
      if (data.enabled === false) {
        targetMode = 'off';
      } else if (message.enabled === false) {
        targetMode = 'normal';
      }

      (async () => {
        const mode = await applyMode(targetMode);
        sendResponse({ success: true, mode, elementBlocking: mode === 'optimal' });
      })();
    });
    return true;
  }

  if (message.type === 'GET_CUSTOM_SELECTORS') {
    const hostname = normalizeHostname(message.hostname);
    chrome.storage.local.get(['customSelectors'], (data) => {
      const selectors = data.customSelectors?.[hostname] || [];
      sendResponse({ selectors });
    });
    return true;
  }

  if (message.type === 'MATCH_BLOCKED_RESOURCES') {
    const tabId = sender?.tab?.id;
    if (!Number.isInteger(tabId) || tabId < 0) {
      sendResponse({ keys: [] });
      return false;
    }

    sendResponse({
      keys: getMatchedBlockedResourceKeys(tabId, message.requests),
    });
    return false;
  }

  if (message.type === 'ADD_CUSTOM_SELECTOR') {
    const hostname = normalizeHostname(message.hostname);
    const selector = String(message.selector || '').trim();

    if (!hostname || !selector) {
      sendResponse({ success: false });
      return false;
    }

    chrome.storage.local.get(['customSelectors'], (data) => {
      const customSelectors = data.customSelectors || {};
      const currentList = Array.isArray(customSelectors[hostname]) ? customSelectors[hostname] : [];

      if (!currentList.includes(selector)) {
        currentList.push(selector);
      }

      customSelectors[hostname] = currentList.slice(-300);

      chrome.storage.local.set({ customSelectors }, () => {
        sendResponse({
          success: true,
          hostname,
          count: customSelectors[hostname].length,
        });
      });
    });
    return true;
  }

  if (message.type === 'AD_BLOCKED') {
    const count = Math.max(1, Number(message.count) || 0);
    sessionBlocked += count;

    chrome.storage.local.get(['totalBlocked', 'sessionBlocked'], (data) => {
      chrome.storage.local.set({
        totalBlocked: (data.totalBlocked || 0) + count,
        sessionBlocked: (data.sessionBlocked || 0) + count,
      });
    });
    return false;
  }

  if (message.type === 'RESET_STATS') {
    chrome.storage.local.set({ totalBlocked: 0, sessionBlocked: 0 }, () => {
      blockedCount = 0;
      sessionBlocked = 0;
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
});
