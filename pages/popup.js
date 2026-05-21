// Coffey AdBlocker - Popup Script

const MODES = ['off', 'normal', 'optimal'];

const popupState = {
  activeTabId: null,
  activeTabUrl: '',
  mode: 'optimal',
  appliedMode: 'optimal',
  modeRequestSeq: 0,
  statsRequestSeq: 0,
  userModeOverride: false,
};

function normalizeMode(mode) {
  return MODES.includes(mode) ? mode : 'optimal';
}

function modeFromIndex(index) {
  return MODES[Math.max(0, Math.min(2, index))];
}

function modeToIndex(mode) {
  return MODES.indexOf(normalizeMode(mode));
}

function deriveMode(enabled, elementBlocking) {
  if (enabled === false) return 'off';
  return elementBlocking === false ? 'normal' : 'optimal';
}

function formatNumber(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n || 0}`;
}

function isHttpPage(url) {
  return /^https?:\/\//i.test(url || '');
}

function setSiteName(url) {
  const siteNameEl = document.getElementById('siteName');
  if (!url) {
    siteNameEl.textContent = 'Halaman ini';
    return;
  }

  try {
    const hostname = new URL(url).hostname.replace(/^www\./i, '');
    siteNameEl.textContent = hostname || 'Halaman ini';
  } catch (_error) {
    siteNameEl.textContent = 'Halaman ini';
  }
}

function getModeNote(mode) {
  if (mode === 'off') return 'Mode off: semua pemblokiran dimatikan.';
  if (mode === 'normal') return 'Mode normal: hanya blokir jaringan iklan.';
  return 'Mode optimal: blokir jaringan + elemen iklan.';
}

function getStatusText(mode) {
  if (mode === 'off') return 'Nonaktif';
  if (mode === 'normal') return 'Normal';
  return 'Optimal';
}

function updateModeStepButtons(index) {
  document.querySelectorAll('.mode-step').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.index) === index);
  });
}

function setModeUI(mode) {
  const safeMode = normalizeMode(mode);
  const modeIndex = modeToIndex(safeMode);

  popupState.mode = safeMode;
  document.getElementById('modeSlider').value = String(modeIndex);
  document.getElementById('modeSwitch').dataset.index = String(modeIndex);
  document.getElementById('modeValue').textContent = safeMode;
  document.getElementById('statusText').textContent = getStatusText(safeMode);
  document.getElementById('modeNote').textContent = getModeNote(safeMode);
  document.getElementById('popupRoot').dataset.mode = safeMode;
  document.getElementById('footerStatus').classList.toggle('off', safeMode === 'off');
  updateModeStepButtons(modeIndex);
  setPickerButtonState();
}

function setStats(totalBlocked, sessionBlocked) {
  document.getElementById('totalBlocked').textContent = formatNumber(totalBlocked || 0);
  document.getElementById('sessionBlocked').textContent = formatNumber(sessionBlocked || 0);
}

function setPickerButtonState() {
  const pickBtn = document.getElementById('pickElementBtn');

  if (popupState.mode === 'off') {
    pickBtn.disabled = true;
    pickBtn.textContent = 'Mode off: aktifkan dulu';
    return;
  }

  if (popupState.mode === 'normal') {
    pickBtn.disabled = true;
    pickBtn.textContent = 'Pilih mode optimal dulu';
    return;
  }

  const canUse = popupState.activeTabId !== null && isHttpPage(popupState.activeTabUrl);
  pickBtn.disabled = !canUse;
  pickBtn.textContent = canUse
    ? 'Blok elemen iklan di halaman'
    : 'Tidak bisa di halaman ini';
}

function applyMode(mode) {
  const safeMode = normalizeMode(mode);
  const previousMode = popupState.appliedMode;
  const requestSeq = ++popupState.modeRequestSeq;
  popupState.userModeOverride = true;

  setModeUI(safeMode);

  chrome.runtime.sendMessage({ type: 'SET_MODE', mode: safeMode }, (response) => {
    if (requestSeq !== popupState.modeRequestSeq) return;

    if (chrome.runtime.lastError) {
      popupState.userModeOverride = false;
      popupState.appliedMode = previousMode;
      setModeUI(previousMode);
      return;
    }

    if (!response || response.success !== true) {
      popupState.userModeOverride = false;
      popupState.appliedMode = previousMode;
      setModeUI(previousMode);
      return;
    }

    popupState.appliedMode = normalizeMode(response.mode || safeMode);
    setModeUI(popupState.appliedMode);
  });
}

function loadCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    popupState.activeTabId = tab?.id ?? null;
    popupState.activeTabUrl = tab?.url || '';
    setSiteName(popupState.activeTabUrl);
    setPickerButtonState();
  });
}

function loadStats() {
  const requestSeq = ++popupState.statsRequestSeq;

  chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
    if (requestSeq !== popupState.statsRequestSeq) return;
    if (chrome.runtime.lastError || !response) return;

    setStats(response.totalBlocked || 0, response.sessionBlocked || 0);
    if (popupState.userModeOverride) return;

    const mode = normalizeMode(
      response.mode || deriveMode(response.enabled !== false, response.elementBlocking !== false)
    );

    popupState.appliedMode = mode;
    setModeUI(mode);
  });
}

function attachEvents() {
  const modeSlider = document.getElementById('modeSlider');

  modeSlider.addEventListener('input', (event) => {
    const previewMode = modeFromIndex(Number(event.target.value));
    setModeUI(previewMode);
  });

  modeSlider.addEventListener('change', (event) => {
    const selectedMode = modeFromIndex(Number(event.target.value));
    applyMode(selectedMode);
  });

  document.querySelectorAll('.mode-step').forEach((button) => {
    button.addEventListener('click', () => {
      const selectedMode = modeFromIndex(Number(button.dataset.index));
      applyMode(selectedMode);
    });
  });

  document.getElementById('pickElementBtn').addEventListener('click', () => {
    if (popupState.mode !== 'optimal') return;
    if (popupState.activeTabId === null || !isHttpPage(popupState.activeTabUrl)) return;

    chrome.tabs.sendMessage(
      popupState.activeTabId,
      { type: 'START_ELEMENT_PICKER' },
      (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.started) {
          window.close();
        }
      }
    );
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'RESET_STATS' }, () => {
      setStats(0, 0);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  attachEvents();
  loadCurrentTab();
  loadStats();
});
