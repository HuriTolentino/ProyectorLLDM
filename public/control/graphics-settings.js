import { request } from './api.js';
import { escapeHtml } from './html.js';

const fields = [...document.querySelectorAll('[data-graphics-field]')];
const backgroundSelect = document.querySelector('[data-graphics-field="background"]');
const animateBackgroundCheckbox = document.querySelector('[data-graphics-field="animateBackground"]');
const backgroundUpload = document.getElementById('tvBackgroundUpload');
const backgroundMessage = document.getElementById('tvBackgroundMessage');
const background = document.getElementById('settingsBackgroundPreview');
const overlay = document.getElementById('settingsOverlayPreview');
const sample = document.getElementById('settingsGraphicSample');
const toggle = document.getElementById('settingsToggleGraphic');
const uploadMessage = document.getElementById('overlayUploadMessage');
const fieldsByName = Object.fromEntries(fields.map(field => [field.dataset.graphicsField, field]));
const overlayAssets = {
  bannerFont: { kind: 'font', defaultId: 'original', label: 'Según el estilo del banner' },
  bannerImage: { kind: 'image', defaultId: 'none', label: 'Sin imagen' },
  logoImage: { kind: 'image', defaultId: 'official', label: 'Logo oficial' }
};
let draft, previewVisible = true, assets = [];

const builtinBackgrounds = [
  ['institutional', 'Institucional · logo sobre blanco'],
  ['classic', 'Centenario · líneas doradas (animado)'],
  ['transparent', 'Transparente · cámaras en TV (canto → cámaras → canto)']
];

function option(value, label, selected) {
  return `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
}

function renderBackgroundOptions() {
  if (!backgroundSelect || !draft) return;
  const current = draft.graphics.background || 'institutional';
  const customAssets = assets.filter(asset => ['image', 'background'].includes(asset.kind));
  backgroundSelect.innerHTML =
    builtinBackgrounds.map(([id, name]) => option(id, name, current)).join('') +
    customAssets.map(asset => {
      const tag = asset.mediaType === 'video' ? ' · Video' : asset.mediaType === 'html' ? ' · Animado' : '';
      return option(asset.id, `${asset.name}${tag}`, current);
    }).join('');
  backgroundSelect.value = current;
  if (animateBackgroundCheckbox) {
    animateBackgroundCheckbox.disabled = current !== 'classic';
  }
}

function renderOverlayAssetOptions() {
  for (const [key, { kind, defaultId, label }] of Object.entries(overlayAssets)) {
    const current = draft.graphics[key];
    const available = assets.filter(asset => asset.kind === kind && !asset.id.startsWith('preset-'));
    const options = [[defaultId, label], ...available.map(asset => [asset.id, asset.name])];
    if (!options.some(([id]) => id === current)) options.push([current, 'Archivo seleccionado']);
    fieldsByName[key].innerHTML = options.map(([id, name]) => option(id, name, current)).join('');
  }
}

function updateEnabledFields() {
  const custom = draft.graphics.bannerStyle === 'custom';
  fieldsByName.bannerTone.disabled = draft.graphics.bannerStyle !== 'angular';
  fieldsByName.bannerImageFit.disabled = !custom || draft.graphics.bannerImage === 'none';
  fieldsByName.bannerColor.disabled = !custom || draft.graphics.bannerImage !== 'none';
  fieldsByName.bannerTextColor.disabled = !custom;
  fieldsByName.bannerWidth.setCustomValidity(
    fieldsByName.bannerWidth.valueAsNumber > 0 && fieldsByName.bannerWidth.valueAsNumber < 240 ? 'Usa 0 o un ancho de al menos 240 px.' : '');
  fieldsByName.bannerHeight.setCustomValidity(
    fieldsByName.bannerHeight.valueAsNumber > 0 && fieldsByName.bannerHeight.valueAsNumber < 80 ? 'Usa 0 o un alto de al menos 80 px.' : '');
  fieldsByName.logoColor.options[0].textContent = draft.graphics.logoImage === 'official' ? 'Dorado oficial' : 'Colores originales';
  animateBackgroundCheckbox.disabled = draft.graphics.background !== 'classic';
}

function graphicSample() {
  const church = draft.church;
  return {
    bible: { type: 'bible', book: 'Juan', chapterVerse: '3:16' },
    theme: { type: 'theme', theme: church.name },
    choir: { type: 'choir', text: 'El coro canta' },
    special: { type: 'special', book: 'Carta Apostólica' },
    drone: { type: 'drone', location: church.city, tag: [church.name, church.address].filter(Boolean).join(' • ') },
    minister: { type: 'minister', minister: document.getElementById('ministerInput')?.value.trim() || 'P.E. ELIAS DÍAZ', location: church.city || church.address || 'ECOSANTUARIO, ECUADOR' }
  }[sample.value];
}
function updatePreview(includeSample = false) {
  if (!draft) return;
  if (includeSample) { previewVisible = true; toggle.textContent = 'Ocultar ejemplo'; }
  for (const frame of [background, overlay]) frame.contentWindow?.postMessage({
    type: 'GRAPHICS_PREVIEW', settings: draft,
    graphic: includeSample && frame === overlay ? graphicSample() : undefined
  }, location.origin);
}
fields.forEach(field => field.addEventListener('input', () => {
  if (!draft) return;
  const key = field.dataset.graphicsField;
  draft.graphics[key] = field.type === 'checkbox' ? field.checked
    : ['range', 'number'].includes(field.type) ? (field.value === '' ? null : Number(field.value)) : field.value;
  if (key === 'bannerImage' && field.value !== 'none') {
    fieldsByName.bannerStyle.value = draft.graphics.bannerStyle = 'custom';
  }
  updateEnabledFields();
  updatePreview();
}));
for (const input of document.querySelectorAll('[data-overlay-upload]')) {
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file || !draft) return;
    const targetDraft = draft;
    const key = input.dataset.overlayUpload;
    const data = new FormData();
    data.append('file', file);
    input.disabled = true;
    uploadMessage.textContent = 'Importando archivo…';
    try {
      const asset = await (await request('/api/song-assets/' + overlayAssets[key].kind, { method: 'POST', body: data })).json();
      if (draft !== targetDraft) return;
      if (!assets.some(item => item.id === asset.id)) assets.push(asset);
      draft.graphics[key] = asset.id;
      if (key === 'bannerImage') fieldsByName.bannerStyle.value = draft.graphics.bannerStyle = 'custom';
      if (key === 'logoImage') fieldsByName.logoColor.value = draft.graphics.logoColor = 'official';
      renderOverlayAssetOptions();
      updateEnabledFields();
      updatePreview();
      uploadMessage.textContent = `«${asset.name}» importado. Guarda los ajustes para aplicarlo al overlay.`;
    } catch (error) {
      if (draft === targetDraft) uploadMessage.textContent = error.message;
    } finally {
      input.disabled = false;
      input.value = '';
    }
  });
}
if (backgroundUpload) {
  backgroundUpload.addEventListener('change', async event => {
    const input = event.target;
    const file = input.files[0];
    if (!file || !draft) return;
    const targetDraft = draft;
    const data = new FormData();
    data.append('file', file);
    input.disabled = true;
    if (backgroundMessage) backgroundMessage.textContent = 'Importando fondo de reposo…';
    try {
      const asset = await (await request('/api/song-assets/background', { method: 'POST', body: data })).json();
      if (draft !== targetDraft) return;
      assets = await (await request('/api/song-assets')).json();
      if (draft !== targetDraft) return;
      targetDraft.graphics.background = asset.id;
      renderBackgroundOptions();
      updatePreview();
      if (backgroundMessage) backgroundMessage.textContent = `Fondo «${asset.name}» importado. Pulsa Guardar para aplicarlo en las TV.`;
    } catch (error) {
      if (backgroundMessage) backgroundMessage.textContent = error.message;
    } finally {
      input.disabled = false;
      input.value = '';
    }
  });
}
sample.addEventListener('change', () => updatePreview(true));
document.getElementById('settingsReplayGraphic').addEventListener('click', () => updatePreview(true));
toggle.addEventListener('click', () => {
  if (!draft) return;
  if (!previewVisible) { updatePreview(true); return; }
  previewVisible = false;
  toggle.textContent = 'Mostrar ejemplo';
  overlay.contentWindow?.postMessage({ type: 'GRAPHICS_PREVIEW', settings: draft, hideGraphic: true }, location.origin);
});
background.addEventListener('load', () => updatePreview());
overlay.addEventListener('load', () => updatePreview(true));
export async function openGraphicsSettings(settings) {
  if (!settings?.graphics) throw new Error('Reinicia el servidor de Proyector LLDM y recarga la página para activar los ajustes de gráficos.');
  draft = settings;
  previewVisible = true; toggle.textContent = 'Ocultar ejemplo';
  uploadMessage.textContent = '';
  if (backgroundMessage) backgroundMessage.textContent = '';
  try {
    assets = await (await request('/api/song-assets')).json();
  } catch {
    assets = [];
  }
  if (draft !== settings) return;
  renderBackgroundOptions();
  renderOverlayAssetOptions();
  fields.forEach(field => {
    const value = draft.graphics[field.dataset.graphicsField];
    if (field.type === 'checkbox') field.checked = value !== false;
    else field.value = value;
  });
  updateEnabledFields();
  background.src = '/idle.html?appearancePreview=1';
  overlay.src = '/overlay?obs=1&appearancePreview=1';
}
export function closeGraphicsSettings() {
  draft = null;
  uploadMessage.textContent = '';
  if (backgroundMessage) backgroundMessage.textContent = '';
  background.src = overlay.src = 'about:blank';
}
