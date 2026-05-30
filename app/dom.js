// Tiny DOM helper so views build nodes (not innerHTML) — avoids injection and
// keeps view code readable.

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v; // callers must pass sanitized strings
    else node.setAttribute(k, v === true ? '' : v);
  }
  append(node, children);
  return node;
}

export function append(node, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function go(path) { location.hash = path; }

// Toasts: a small ephemeral message at the bottom of the viewport. Stacks if
// fired in quick succession; auto-dismisses unless 'sticky'. Replaces alert()
// for everything that's not blocking confirmation.
function toastStack() {
  let s = document.querySelector('.toast-stack');
  if (!s) { s = el('div', { class: 'toast-stack', role: 'status', 'aria-live': 'polite' }); document.body.append(s); }
  return s;
}

export function toast(message, opts = {}) {
  const kind = opts.kind || 'default';        // 'default' | 'success' | 'error'
  const duration = opts.duration ?? (kind === 'error' ? 6000 : 3500);
  const sticky = !!opts.sticky;
  const icon = opts.icon ?? (kind === 'success' ? '✓' : kind === 'error' ? '!' : '·');

  const t = el('div', { class: `toast${kind !== 'default' ? ' is-' + kind : ''}`, role: kind === 'error' ? 'alert' : 'status' },
    el('span', { class: 'toast-icon', 'aria-hidden': 'true' }, icon),
    el('span', { class: 'toast-body' }, message),
  );
  const close = () => {
    if (!t.isConnected) return;
    t.classList.add('is-leaving');
    setTimeout(() => t.remove(), 250);
  };
  t.append(el('button', { class: 'toast-close', 'aria-label': 'Dismiss', onclick: close }, '×'));
  toastStack().append(t);
  if (!sticky) setTimeout(close, duration);
  return { close };
}
