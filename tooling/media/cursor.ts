/**
 * Recordings have no mouse pointer; this draws one that follows the mouse, so a drag
 * or a tap reads in the video. Recording only: never part of the product.
 */
export const cursorScript = `(() => {
  const draw = () => {
    if (document.getElementById('__media-cursor')) return;
    const cursor = document.createElement('div');
    cursor.id = '__media-cursor';
    cursor.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(34,36,42,.35);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);pointer-events:none;z-index:2147483647;transition:transform .12s ease;transform:translate(-100px,-100px)';
    document.documentElement.appendChild(cursor);
    let x = -100, y = -100, pressed = false;
    const place = () => { cursor.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + (pressed ? 0.75 : 1) + ')'; };
    addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; place(); }, true);
    addEventListener('mousedown', () => { pressed = true; place(); }, true);
    addEventListener('mouseup', () => { pressed = false; place(); }, true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', draw); else draw();
})();`;
