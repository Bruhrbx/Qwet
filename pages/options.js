const MODES = ['off', 'normal', 'optimal'];

const state = {
  mode: 'optimal',
  requestSeq: 0,
};

function normalizeMode(mode) {
  return MODES.includes(mode) ? mode : 'optimal';
}

function deriveMode(enabled, elementBlocking) {
  if (enabled === false) return 'off';
  return elementBlocking === false ? 'normal' : 'optimal';
}

function setActiveTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach((button) => {
    const active = button.dataset.tab === tabName;
    button.classList.toggle('active', active);
  });

  document.getElementById('panel-settings').hidden = tabName !== 'settings';
  document.getElementById('panel-about').hidden = tabName !== 'about';
}

function setSaveStatus(text, isError = false) {
  const status = document.getElementById('saveStatus');
  status.textContent = text || '';
  status.classList.toggle('error', isError);
}

function setModeUI(mode) {
  const safeMode = normalizeMode(mode);
  state.mode = safeMode;

  document.querySelectorAll('.mode-card').forEach((card) => {
    const cardMode = card.dataset.mode;
    const active = cardMode === safeMode;
    card.classList.toggle('active', active);
    const radio = card.querySelector('input[type="radio"]');
    if (radio) radio.checked = active;
  });
}

function applyMode(mode) {
  const safeMode = normalizeMode(mode);
  const previousMode = state.mode;
  const requestSeq = ++state.requestSeq;

  setModeUI(safeMode);
  setSaveStatus('Menyimpan...');

  chrome.runtime.sendMessage({ type: 'SET_MODE', mode: safeMode }, (response) => {
    if (requestSeq !== state.requestSeq) return;

    if (chrome.runtime.lastError || !response || response.success !== true) {
      setModeUI(previousMode);
      setSaveStatus('Gagal menyimpan mode.', true);
      return;
    }

    const appliedMode = normalizeMode(response.mode || safeMode);
    setModeUI(appliedMode);
    setSaveStatus('Mode tersimpan.');
    window.setTimeout(() => {
      if (requestSeq === state.requestSeq) {
        setSaveStatus('');
      }
    }, 1200);
  });
}

function loadCurrentMode() {
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
    if (chrome.runtime.lastError || !response) return;
    const mode = normalizeMode(
      response.mode || deriveMode(response.enabled !== false, response.elementBlocking !== false)
    );
    setModeUI(mode);
  });
}

function attachEvents() {
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
      setActiveTab(button.dataset.tab || 'settings');
    });
  });

  document.querySelectorAll('.mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      applyMode(card.dataset.mode || 'optimal');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setActiveTab('settings');
  attachEvents();
  loadCurrentMode();
});
