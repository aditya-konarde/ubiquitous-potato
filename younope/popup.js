function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Detect current channel from active tab
const currentEl = document.getElementById('current');
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab || !tab.url || !tab.url.includes('youtube.com')) return;
  chrome.tabs.sendMessage(tab.id, { type: 'getChannel' }, (response) => {
    if (chrome.runtime.lastError || !response || !response.handle) return;
    const handle = response.handle;
    chrome.storage.local.get({ blocked: [] }, ({ blocked }) => {
      if (blocked.includes(handle)) {
        currentEl.innerHTML = `<div class="done">@${escapeHtml(handle)} is already blocked</div>`;
      } else {
        currentEl.innerHTML = `<button id="blockCurrent">\u{1F6AB} Block @${escapeHtml(handle)}</button>`;
        document.getElementById('blockCurrent').addEventListener('click', () => {
          blocked.push(handle);
          chrome.storage.local.set({ blocked }, () => {
            currentEl.innerHTML = `<div class="done">\u2713 Blocked @${escapeHtml(handle)}</div>`;
            render(blocked);
          });
        });
      }
      currentEl.style.display = 'block';
    });
  });
});

const input = document.getElementById('input');
const addBtn = document.getElementById('addBtn');
const listEl = document.getElementById('list');

function normalize(name) {
  try { name = decodeURIComponent(name); } catch {}
  return name.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9._-]/g, '');
}

function render(blocked) {
  if (!blocked.length) {
    listEl.innerHTML = '<div class="empty">No channels blocked yet 😇</div>';
    return;
  }
  listEl.innerHTML = blocked.map((ch, i) => `
    <div class="item">
      <span class="name">@${escapeHtml(ch)}</span>
      <button class="rm" data-i="${i}">&times;</button>
    </div>
  `).join('');
  listEl.querySelectorAll('.rm').forEach(btn => {
    btn.addEventListener('click', () => {
      blocked.splice(parseInt(btn.dataset.i), 1);
      chrome.storage.local.set({ blocked }, () => render(blocked));
    });
  });
}

function load() {
  chrome.storage.local.get({ blocked: [] }, ({ blocked }) => render(blocked));
}

addBtn.addEventListener('click', () => {
  const val = normalize(input.value);
  if (!val) return;
  chrome.storage.local.get({ blocked: [] }, ({ blocked }) => {
    if (!blocked.includes(val)) blocked.push(val);
    chrome.storage.local.set({ blocked }, () => {
      input.value = '';
      render(blocked);
    });
  });
});

input.addEventListener('keydown', e => { if (e.key === 'Enter') addBtn.click(); });

document.getElementById('settingsLink').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

load();
input.focus();
