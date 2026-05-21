// Coffey AdBlocker - Content Script

(function () {
  'use strict';

  let enabled = true;
  let elementBlocking = true;

  let styleSheet = null;
  let observer = null;
  let hiddenSelectors = new Set();
  let customSelectors = new Set();
  const AD_HIDDEN_CLASS = 'coffey-hidden-ad';
  const COLLAPSIBLE_SELECTOR = [
    'img[src]',
    'img[srcset]',
    'iframe[src]',
    'embed[src]',
    'object[data]',
    'video[src]',
    'audio[src]',
    'source[src]',
  ].join(', ');
  const COLLAPSE_SCAN_INTERVAL_MS = 350;

  let collapseTimerId = null;
  let collapseRunning = false;
  let collapseLastRunAt = 0;

  let pickerActive = false;
  let pickerBox = null;
  let pickerHint = null;
  let pickerTarget = null;
  let previousDocCursor = '';
  let previousBodyCursor = '';

  const SPECIFIC_SELECTORS = [
    'ins.adsbygoogle',
    'amp-ad',
    'amp-auto-ads',
    'amp-embed',
    '[data-ad-client]',
    '[data-ad-slot]',
    '[data-ad-unit-id]',
    '[data-dfp-ad]',
    '[id^="google_ads_"]',
    '[id^="div-gpt-ad"]',
    '[class^="GoogleActiveViewElement"]',
    '.google-auto-placed',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    'iframe[src*="googleadservices.com"]',
    'iframe[src*="adnxs.com"]',
    'iframe[src*="amazon-adsystem.com"]',
    'iframe[src*="taboola.com"]',
    'iframe[src*="outbrain.com"]',
    'iframe[src*="revcontent.com"]',
    'iframe[src*="mgid.com"]',
    'iframe[src*="media.net"]',
    'iframe[src*="adform.net"]',
    'iframe[src*="pubmatic.com"]',
    'iframe[src*="rubiconproject.com"]',
    'iframe[src*="openx.net"]',
    'iframe[src*="criteo.com"]',
    '[id*="taboola"]',
    '[class*="taboola"]',
    '[id*="outbrain"]',
    '[class*="outbrain"]',
  ];

  const SAFE_GENERIC_SELECTORS = [
    '[data-ad-client]',
    '[data-ad-slot]',
    '[data-ad-unit-id]',
    '[data-dfp-ad]',
    '[id^="div-gpt-ad"]',
    '[id^="google_ads_"]',
    '[aria-label="advertisement" i]',
    '[aria-label="ads" i]',
    '[aria-label="iklan" i]',
  ];

  const AD_IFRAME_HINTS = [
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'adnxs.com',
    'amazon-adsystem.com',
    'taboola.com',
    'outbrain.com',
    'revcontent.com',
    'mgid.com',
    'media.net',
    'adform.net',
    'pubmatic.com',
    'rubiconproject.com',
    'openx.net',
    'criteo.com',
  ];

  const PLACEHOLDER_TEXTS = new Set([
    'advertisement',
    'ads',
    'iklan',
    'sponsored',
  ]);

  function normalizeHostname(hostname) {
    return String(hostname || '')
      .toLowerCase()
      .replace(/^www\./, '')
      .trim();
  }

  function escapeCss(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function normalizeResourceURL(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('javascript:')) {
      return '';
    }
    try {
      return new URL(trimmed, location.href).href;
    } catch (_error) {
      return '';
    }
  }

  function ensureStyleSheet() {
    if (styleSheet) return;
    styleSheet = document.createElement('style');
    styleSheet.id = 'coffey-cosmetic-filters';
    styleSheet.textContent = `.${AD_HIDDEN_CLASS} {\n  display: none !important;\n  visibility: hidden !important;\n}\n`;
    (document.head || document.documentElement).appendChild(styleSheet);
  }

  function addCSSRules(selectors) {
    if (!selectors.length) return;
    ensureStyleSheet();
    const rule = `${selectors.join(',\n')} {\n  display: none !important;\n  visibility: hidden !important;\n}\n`;
    styleSheet.textContent += rule;
  }

  function addHiddenSelectors(selectors) {
    const valid = [];
    selectors.forEach((selector) => {
      if (!selector || hiddenSelectors.has(selector)) return;
      hiddenSelectors.add(selector);
      valid.push(selector);
    });
    if (valid.length) addCSSRules(valid);
    return valid.length;
  }

  function injectSpecificFilters() {
    addHiddenSelectors(SPECIFIC_SELECTORS);
  }

  function buildGenericSelectors() {
    return SAFE_GENERIC_SELECTORS.filter((selector) => {
      if (hiddenSelectors.has(selector)) return false;
      try {
        if (!document.querySelector(selector)) return false;
      } catch (_error) {
        return false;
      }
      hiddenSelectors.add(selector);
      return true;
    });
  }

  function markHiddenAdElement(element) {
    if (!element || !(element instanceof Element)) return false;
    if (element.classList.contains(AD_HIDDEN_CLASS)) return false;
    element.classList.add(AD_HIDDEN_CLASS);
    return true;
  }

  function isLikelyAdIframeSrc(src) {
    if (!src || src === 'about:blank' || src === 'javascript:void(0)') return false;
    let hostname = '';
    try {
      hostname = new URL(src, location.href).hostname.toLowerCase();
    } catch (_error) {
      return false;
    }
    return AD_IFRAME_HINTS.some((hint) => hostname.includes(hint));
  }

  function collapseLikelyAdIframes() {
    document.querySelectorAll('iframe[src]').forEach((iframe) => {
      const src = iframe.getAttribute('src') || '';
      if (!isLikelyAdIframeSrc(src)) return;
      markHiddenAdElement(iframe);
    });
  }

  function hideTextAdPlaceholders() {
    const candidates = document.querySelectorAll('div, aside, section');
    candidates.forEach((element) => {
      if (element.classList.contains(AD_HIDDEN_CLASS)) return;
      if (element.querySelector('img, picture, video, canvas, svg')) return;

      const text = (element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!text || text.length > 32 || !PLACEHOLDER_TEXTS.has(text)) return;

      const rect = element.getBoundingClientRect();
      if (rect.width < 120 || rect.height < 60) return;
      if (rect.width > window.innerWidth * 0.95 || rect.height > window.innerHeight * 0.95) return;

      markHiddenAdElement(element);
    });
  }

  function parseFirstSrcsetURL(srcset) {
    if (!srcset || typeof srcset !== 'string') return '';
    const first = srcset.split(',')[0] || '';
    const firstURL = first.trim().split(/\s+/)[0];
    return firstURL || '';
  }

  function getResourceInfoFromElement(element) {
    if (!(element instanceof Element)) return null;

    const tag = element.tagName.toLowerCase();
    let type = '';
    let rawURL = '';

    if (tag === 'img') {
      type = 'image';
      rawURL = element.currentSrc
        || element.getAttribute('src')
        || element.src
        || parseFirstSrcsetURL(element.getAttribute('srcset'));
    } else if (tag === 'iframe') {
      type = 'sub_frame';
      rawURL = element.getAttribute('src') || element.src;
    } else if (tag === 'embed') {
      type = 'object';
      rawURL = element.getAttribute('src') || element.src;
    } else if (tag === 'object') {
      type = 'object';
      rawURL = element.getAttribute('data') || '';
    } else if (tag === 'video' || tag === 'audio') {
      type = 'media';
      rawURL = element.currentSrc || element.getAttribute('src') || element.src;
    } else if (tag === 'source') {
      const parentTag = element.parentElement?.tagName?.toLowerCase();
      type = (parentTag === 'video' || parentTag === 'audio') ? 'media' : 'image';
      rawURL = element.getAttribute('src') || element.src;
    } else {
      return null;
    }

    const normalizedURL = normalizeResourceURL(rawURL);
    if (!normalizedURL) return null;

    return {
      type,
      url: normalizedURL,
      key: `${type} ${normalizedURL}`,
      element,
    };
  }

  function collectCollapsibleResourceCandidates() {
    const grouped = new Map();
    const elements = document.querySelectorAll(COLLAPSIBLE_SELECTOR);

    elements.forEach((element) => {
      if (element.classList.contains(AD_HIDDEN_CLASS)) return;
      const info = getResourceInfoFromElement(element);
      if (!info) return;

      const list = grouped.get(info.key) || [];
      list.push(info.element);
      grouped.set(info.key, list);
    });

    return grouped;
  }

  function stopResourceCollapseScheduler() {
    if (collapseTimerId !== null) {
      window.clearTimeout(collapseTimerId);
      collapseTimerId = null;
    }
    collapseRunning = false;
  }

  function collapseBlockedResourceElements() {
    if (!enabled || !elementBlocking) return;
    if (collapseRunning) return;

    const grouped = collectCollapsibleResourceCandidates();
    if (grouped.size === 0) return;

    collapseRunning = true;
    collapseLastRunAt = Date.now();

    const requests = Array.from(grouped.keys()).map((key) => {
      const separator = key.indexOf(' ');
      return {
        type: key.slice(0, separator),
        url: key.slice(separator + 1),
      };
    });

    chrome.runtime.sendMessage(
      { type: 'MATCH_BLOCKED_RESOURCES', requests },
      (response) => {
        collapseRunning = false;
        if (chrome.runtime.lastError || !response) return;

        const blockedKeys = new Set(
          Array.isArray(response.keys) ? response.keys : []
        );

        if (blockedKeys.size === 0) return;

        blockedKeys.forEach((key) => {
          const matchedElements = grouped.get(key) || [];
          matchedElements.forEach((element) => {
            markHiddenAdElement(element);
          });
        });
      }
    );
  }

  function scheduleResourceCollapse(immediate = false) {
    if (!enabled || !elementBlocking) return;
    if (collapseTimerId !== null) return;

    const elapsed = Date.now() - collapseLastRunAt;
    const delay = immediate ? 0 : Math.max(0, COLLAPSE_SCAN_INTERVAL_MS - elapsed);

    collapseTimerId = window.setTimeout(() => {
      collapseTimerId = null;
      collapseBlockedResourceElements();
    }, delay);
  }

  function startObserver() {
    if (observer) return;
    let pending = false;

    observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (!enabled || !elementBlocking) return;
        const generic = buildGenericSelectors();
        if (generic.length) addCSSRules(generic);
        collapseLikelyAdIframes();
        hideTextAdPlaceholders();
        scheduleResourceCollapse();
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: false,
    });
  }

  function stopObserver() {
    if (!observer) return;
    observer.disconnect();
    observer = null;
    stopResourceCollapseScheduler();
  }

  function clearFilteringStyles() {
    if (styleSheet) {
      styleSheet.remove();
      styleSheet = null;
    }
    hiddenSelectors = new Set();
  }

  function runGenericPhase() {
    if (!enabled || !elementBlocking) return;
    const generic = buildGenericSelectors();
    if (generic.length) addCSSRules(generic);
    collapseLikelyAdIframes();
    hideTextAdPlaceholders();
    scheduleResourceCollapse(true);
    startObserver();
  }

  function rebuildFiltering() {
    stopObserver();
    clearFilteringStyles();

    if (!enabled || !elementBlocking) {
      stopResourceCollapseScheduler();
      stopElementPicker();
      return;
    }

    injectSpecificFilters();
    if (customSelectors.size) {
      addHiddenSelectors(Array.from(customSelectors));
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runGenericPhase, { once: true });
    } else {
      runGenericPhase();
    }
  }

  function loadCustomSelectors(callback) {
    chrome.runtime.sendMessage(
      { type: 'GET_CUSTOM_SELECTORS', hostname: normalizeHostname(location.hostname) },
      (response) => {
        if (chrome.runtime.lastError || !response) {
          customSelectors = new Set();
          callback();
          return;
        }

        const selectors = Array.isArray(response.selectors) ? response.selectors : [];
        customSelectors = new Set(selectors);
        callback();
      }
    );
  }

  function createPickerUI() {
    pickerBox = document.createElement('div');
    pickerBox.style.position = 'fixed';
    pickerBox.style.left = '0';
    pickerBox.style.top = '0';
    pickerBox.style.width = '0';
    pickerBox.style.height = '0';
    pickerBox.style.border = '2px solid #2f66df';
    pickerBox.style.background = 'rgba(47, 102, 223, 0.18)';
    pickerBox.style.pointerEvents = 'none';
    pickerBox.style.zIndex = '2147483646';

    pickerHint = document.createElement('div');
    pickerHint.style.position = 'fixed';
    pickerHint.style.right = '12px';
    pickerHint.style.top = '12px';
    pickerHint.style.zIndex = '2147483647';
    pickerHint.style.background = 'rgba(28, 43, 77, 0.96)';
    pickerHint.style.color = '#ffffff';
    pickerHint.style.padding = '8px 10px';
    pickerHint.style.borderRadius = '6px';
    pickerHint.style.font = '12px/1.35 "Segoe UI", Arial, sans-serif';
    pickerHint.style.pointerEvents = 'none';
    pickerHint.style.maxWidth = '240px';
    pickerHint.textContent = 'Klik elemen iklan untuk blokir, Esc untuk batal';

    document.documentElement.appendChild(pickerBox);
    document.documentElement.appendChild(pickerHint);
  }

  function removePickerUI() {
    if (pickerBox) pickerBox.remove();
    if (pickerHint) pickerHint.remove();
    pickerBox = null;
    pickerHint = null;
    pickerTarget = null;
  }

  function updatePickerHint(text) {
    if (!pickerHint) return;
    pickerHint.textContent = text;
  }

  function isPickerUIElement(target) {
    return target === pickerBox || target === pickerHint;
  }

  function updatePickerTarget(target) {
    if (!pickerBox || !target) return;
    const rect = target.getBoundingClientRect();

    if (rect.width < 3 || rect.height < 3) {
      pickerBox.style.width = '0';
      pickerBox.style.height = '0';
      return;
    }

    pickerTarget = target;
    pickerBox.style.left = `${rect.left}px`;
    pickerBox.style.top = `${rect.top}px`;
    pickerBox.style.width = `${rect.width}px`;
    pickerBox.style.height = `${rect.height}px`;
  }

  function getNthOfType(element) {
    let count = 1;
    let sibling = element;

    while ((sibling = sibling.previousElementSibling)) {
      if (sibling.tagName === element.tagName) {
        count += 1;
      }
    }

    return count;
  }

  function createSelectorPart(element) {
    const tag = element.tagName.toLowerCase();

    if (element.id) {
      return `${tag}#${escapeCss(element.id)}`;
    }

    const classNames = Array.from(element.classList || [])
      .filter((name) => name && name.length <= 40)
      .slice(0, 2);

    if (classNames.length) {
      return `${tag}.${classNames.map(escapeCss).join('.')}`;
    }

    return `${tag}:nth-of-type(${getNthOfType(element)})`;
  }

  function createBestSelector(element) {
    if (!(element instanceof Element)) return '';
    if (element === document.documentElement || element === document.body) return '';

    if (element.id) {
      const idSelector = `#${escapeCss(element.id)}`;
      try {
        if (document.querySelectorAll(idSelector).length === 1) {
          return idSelector;
        }
      } catch (_error) {}
    }

    const parts = [];
    let current = element;
    let depth = 0;

    while (current && current !== document.body && depth < 6) {
      parts.unshift(createSelectorPart(current));
      const candidate = parts.join(' > ');
      try {
        if (document.querySelectorAll(candidate).length === 1) {
          return candidate;
        }
      } catch (_error) {}
      current = current.parentElement;
      depth += 1;
    }

    const fallback = parts.join(' > ');
    try {
      if (fallback && document.querySelector(fallback)) {
        return fallback;
      }
    } catch (_error) {}

    return '';
  }

  function onPickerMouseMove(event) {
    if (!pickerActive) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!target || isPickerUIElement(target)) return;
    if (target === document.documentElement || target === document.body) return;
    updatePickerTarget(target);
  }

  function stopElementPicker(delayMs = 0) {
    const runStop = () => {
      if (!pickerActive) return;

      pickerActive = false;
      window.removeEventListener('mousemove', onPickerMouseMove, true);
      window.removeEventListener('click', onPickerClick, true);
      window.removeEventListener('keydown', onPickerKeyDown, true);

      document.documentElement.style.cursor = previousDocCursor;
      if (document.body) {
        document.body.style.cursor = previousBodyCursor;
      }

      removePickerUI();
    };

    if (delayMs > 0) {
      window.setTimeout(runStop, delayMs);
    } else {
      runStop();
    }
  }

  function onPickerClick(event) {
    if (!pickerActive) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (!pickerTarget || isPickerUIElement(pickerTarget)) {
      updatePickerHint('Elemen tidak valid, coba area lain');
      return;
    }

    const selector = createBestSelector(pickerTarget);
    if (!selector) {
      updatePickerHint('Gagal membuat selector, coba elemen lain');
      return;
    }

    const added = addHiddenSelectors([selector]);
    if (added > 0) {
      customSelectors.add(selector);
      chrome.runtime.sendMessage({
        type: 'ADD_CUSTOM_SELECTOR',
        hostname: normalizeHostname(location.hostname),
        selector,
      });
      chrome.runtime.sendMessage({ type: 'AD_BLOCKED', count: 1 }).catch(() => {});
    }

    updatePickerHint('Elemen iklan diblokir');
    stopElementPicker(800);
  }

  function onPickerKeyDown(event) {
    if (!pickerActive) return;
    if (event.key !== 'Escape') return;
    event.preventDefault();
    stopElementPicker();
  }

  function startElementPicker() {
    if (!enabled || !elementBlocking) return false;
    if (pickerActive) return true;

    pickerActive = true;
    createPickerUI();

    previousDocCursor = document.documentElement.style.cursor;
    document.documentElement.style.cursor = 'crosshair';
    if (document.body) {
      previousBodyCursor = document.body.style.cursor;
      document.body.style.cursor = 'crosshair';
    }

    window.addEventListener('mousemove', onPickerMouseMove, true);
    window.addEventListener('click', onPickerClick, true);
    window.addEventListener('keydown', onPickerKeyDown, true);
    return true;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_ENABLED') {
      enabled = message.enabled !== false;
      rebuildFiltering();
      sendResponse({ success: true });
      return false;
    }

    if (message.type === 'UPDATE_ELEMENT_BLOCKING') {
      elementBlocking = message.enabled !== false;
      rebuildFiltering();
      sendResponse({ success: true });
      return false;
    }

    if (message.type === 'START_ELEMENT_PICKER') {
      const started = startElementPicker();
      sendResponse({ started });
      return false;
    }

    return false;
  });

  chrome.storage.local.get(['enabled', 'elementBlocking'], (data) => {
    enabled = data.enabled !== false;
    elementBlocking = data.elementBlocking !== false;

    loadCustomSelectors(() => {
      rebuildFiltering();
    });
  });
})();
