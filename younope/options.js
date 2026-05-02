function normalize(name) {
  try { name = decodeURIComponent(name); } catch {}
  return name.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9._-]/g, '');
}

const status = document.getElementById('status');
const countEl = document.getElementById('count');
const listEl = document.getElementById('list');

function renderCount(blocked) {
  if (!blocked.length) {
    countEl.textContent = 'No channels blocked yet.';
    listEl.textContent = '';
  } else {
    countEl.innerHTML = `<strong>${blocked.length}</strong> channel${blocked.length !== 1 ? 's' : ''} blocked`;
    listEl.textContent = blocked.map(c => '@' + c).join(', ');
    listEl.style.cssText = 'margin-top:8px;font-size:12px;color:#555;line-height:1.6;word-break:break-word;';
  }
}

chrome.storage.local.get({ blocked: [] }, ({ blocked }) => renderCount(blocked));

document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let raw = reader.result.trim();
    let names;
    try {
      const parsed = JSON.parse(raw);
      names = (Array.isArray(parsed) ? parsed : []).map(normalize).filter(Boolean);
    } catch {
      names = raw.split(/[,\n\r]+/).map(normalize).filter(Boolean);
    }
    if (!names.length) return;
    chrome.storage.local.get({ blocked: [] }, ({ blocked }) => {
      const merged = [...new Set([...blocked, ...names])];
      chrome.storage.local.set({ blocked: merged }, () => {
        const added = merged.length - blocked.length;
        status.textContent = `✓ Imported ${added} new channel${added !== 1 ? 's' : ''} (${merged.length} total)`;
        status.style.display = 'block';
        renderCount(merged);
      });
    });
  };
  reader.readAsText(file);
  e.target.value = '';
});
