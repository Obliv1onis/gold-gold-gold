import { CapsuleDataStore } from '../foundation/capsule-data-store.js';

let _activeName = null;
let _idCache    = null; // lazily built: kit name → youtube_id

function _lookupId(kitName) {
  if (!_idCache) {
    _idCache = new Map();
    for (const item of CapsuleDataStore.getAllItems()) {
      if (item.youtube_id && item.name) _idCache.set(item.name, item.youtube_id);
    }
  }
  return _idCache.get(kitName) ?? '';
}

function _close() {
  document.querySelector('.music-kit-modal')?.remove();
  _activeName = null;
  document.querySelectorAll('[data-kit-name]').forEach(c => c.classList.remove('is-playing'));
}

function _open(kitName, youtubeId) {
  document.querySelector('.music-kit-modal')?.remove();
  _activeName = kitName;

  const displayName = kitName.replace(/^(StatTrak™ )?Music Kit \| /, '');

  const modal = document.createElement('div');
  modal.className = 'music-kit-modal';
  modal.addEventListener('click', e => { if (e.target === modal) _close(); });

  const dialog = document.createElement('div');
  dialog.className = 'music-kit-dialog';

  const header = document.createElement('div');
  header.className = 'music-kit-dialog-header';

  const title = document.createElement('span');
  title.className   = 'music-kit-dialog-title';
  title.textContent = displayName;

  const closeBtn = document.createElement('button');
  closeBtn.className   = 'music-kit-dialog-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', _close);

  header.appendChild(title);
  header.appendChild(closeBtn);

  const iframe = document.createElement('iframe');
  iframe.className = 'music-kit-dialog-iframe';
  iframe.setAttribute('allow', 'autoplay; encrypted-media');
  iframe.setAttribute('allowfullscreen', '');
  iframe.src = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`;

  dialog.appendChild(header);
  dialog.appendChild(iframe);
  modal.appendChild(dialog);
  document.body.appendChild(modal);

  document.querySelectorAll('[data-kit-name]').forEach(c => {
    c.classList.toggle('is-playing', c.dataset.kitName === kitName);
  });
}

export const MusicKitPlayer = {
  toggle(kitName, youtubeId) {
    const id = youtubeId || _lookupId(kitName);
    if (!id) return;
    if (_activeName === kitName) { _close(); return; }
    _open(kitName, id);
  },

  close: _close,

  get activeName() { return _activeName; },
};
