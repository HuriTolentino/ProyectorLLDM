import { updateSongProgress, revealCurrentCard } from './song-cards.js';
import { getSelection } from './selection.js';
import { showToast } from './shell.js';
import { isSameItem } from './html.js';
import { request } from './api.js';
import { updateLiveMonitor } from './monitor.js';
import { updateCarteleriaUi } from './carteleria.js';
import { clearBibleTextSearch, suggestionsDiv, syncBibleSlides, updateInputPlaceholders } from './bible.js';

let globalState = null;
let previousPhase = null;
let lastClearedAt = null;

const statusBadge = document.getElementById("status-badge");
const statusText = document.getElementById("status-text");
const monitorStatusBadge = document.getElementById('monitor-status-badge');
const monitorStatusText = document.getElementById('monitor-status-text');

function clearSearchDraftsOnIdle() {
  const fields = ['themeInput', 'searchBook', 'chapter', 'verse', 'bibleTextSearchInput', 'hymnSearchInput', 'choirSearchInput', 'presentationSearchInput', 'customTextInput', 'choirCustomInput', 'droneCustomInput'];
  for (const id of fields) {
    const input = document.getElementById(id);
    if (!input || input.value === '') continue;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (suggestionsDiv) {
    suggestionsDiv.innerHTML = '';
    suggestionsDiv.classList.remove('show');
  }
  const bibleSlidesSection = document.getElementById('bibleSlidesSection');
  if (bibleSlidesSection) bibleSlidesSection.style.display = 'none';
  clearBibleTextSearch();
  updateInputPlaceholders();
  window.dispatchEvent(new Event('remote-escape-clear'));
}

function updateUiState(state) {
  const returnedToIdle = previousPhase === 'active' && state.phase === 'idle';
  const currentClearedAt = state.workspace?.clearedAt ?? 0;
  const clearedByEscape = lastClearedAt !== null && currentClearedAt > lastClearedAt;
  previousPhase = state.phase;
  lastClearedAt = currentClearedAt;
  globalState = state;
  updateLiveMonitor(state);
  updateCarteleriaUi(state);
  syncBibleSlides(state);
  if (returnedToIdle || clearedByEscape) clearSearchDraftsOnIdle();
  const active = state.phase === 'active';
  statusBadge.className = `status-badge status-${active ? 'active' : 'idle'}`;
  statusText.textContent = active ? 'EN PROYECCIÓN' : 'REPOSO';
  monitorStatusBadge.className = statusBadge.className;
  monitorStatusText.textContent = active ? 'EN VIVO' : 'REPOSO';

  const grids = { hymn: 'hymnSlidesGrid', choir: 'choirSlidesGrid', presentation: 'presentationSlidesGrid', bible: 'bibleSlidesGrid' };
  for (const [type, id] of Object.entries(grids)) {
    const matches = state.phase === 'active' && state.contentType === type && (type === 'bible' || isSameItem(getSelection(type), state.activeItem));
    document.getElementById(id)?.querySelectorAll('.slide-card').forEach((card, index) => {
      const current = matches && state.currentSlideIndex === index;
      card.classList.toggle('active-slide', current);
      if (current) card.setAttribute('aria-current', 'step');
      else card.removeAttribute('aria-current');
    });
    if (type !== 'presentation' && type !== 'bible') updateSongProgress(document.getElementById(id), state, matches);
    revealCurrentCard(document.getElementById(id), matches, state.currentSlideIndex);
  }

}

// ==============================================================
// GESTIÓN DE IP LOCAL Y ENLACE DE CONEXIÓN
// ==============================================================
async function updateNetworkIpDisplay(ipFromServer, refresh = !ipFromServer) {
  let ip = ipFromServer;
  let urls;
  let port = window.location.port || '4000';
  if (refresh) {
    try {
      const res = await request('/api/ip');
      const data = await res.json();
      ip = data.ip;
      port = data.port || port;
      urls = data;
    } catch (_) {
      ip = window.location.hostname;
    }
  }
  const localOnly = !ip || ip === 'localhost' || ip === '127.0.0.1';
  const fullDisplay = localOnly ? 'Sin IP de red local' : (urls?.controlUrl ? new URL(urls.controlUrl).host : `${ip}:${port}`);
  const screenUrl = document.getElementById('transmissionScreenUrl');
  const overlayUrl = document.getElementById('transmissionOverlayUrl');
  if (screenUrl) screenUrl.textContent = localOnly ? 'Conecta la PC a una red local para obtener la dirección.' : (urls?.pantallaUrl || `http://${fullDisplay}/pantalla`);
  if (overlayUrl) overlayUrl.textContent = localOnly ? 'Conecta la PC a una red local para obtener la dirección.' : (urls?.overlayUrl || `http://${fullDisplay}/overlay`);
  const headerEl = document.getElementById('header-ip-address');
  if (headerEl) headerEl.textContent = fullDisplay;
  const monEl = document.getElementById('monitor-ip-text');
  if (monEl) monEl.textContent = ip || window.location.hostname;
}

window.addEventListener('wifi-tab-activated', () => { void updateNetworkIpDisplay(undefined, true); });

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-copy-url]');
  if (!button) return;
  const value = document.getElementById(button.dataset.copyUrl)?.textContent;
  if (!value || value.includes('Calculando')) return;
  try {
    await navigator.clipboard.writeText(value);
    const previous = button.textContent; button.textContent = 'Copiado';
    setTimeout(() => { button.textContent = previous; }, 1400);
  } catch {
    window.prompt('Copia esta dirección:', value);
  }
});



// CONTROL DEL MODAL DE ATAJOS DE TECLADO (F1)

export { globalState, updateNetworkIpDisplay, updateUiState };
