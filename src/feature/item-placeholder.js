/** Returns a placeholder <div> for items that have no image_url. */

const SVGS = {
  charm: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`,
  patch: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  pin:   `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  mk:    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
};

function _typeClass(name) {
  const n = name.toLowerCase();
  if (n.startsWith('charm |'))           return 'charm';
  if (n.startsWith('patch |'))           return 'patch';
  if (n.endsWith(' pin'))                return 'pin';
  if (n.includes('music kit'))           return 'mk';
  return 'patch';
}

/**
 * @param {string} itemName
 * @param {'reel-size'|'card-size'|'reveal-size'} sizeClass
 * @returns {HTMLDivElement}
 */
export function makePlaceholder(itemName, sizeClass = 'card-size') {
  const type = _typeClass(itemName);
  const el   = document.createElement('div');
  el.className = `item-placeholder item-placeholder--${type} ${sizeClass}`;
  el.innerHTML  = SVGS[type] ?? SVGS.patch;
  return el;
}
