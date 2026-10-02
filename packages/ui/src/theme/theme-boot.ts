/**
 * Inline script for index.html that applies the stored or system theme before the
 * first paint, so pages never flash the wrong palette.
 */
export function themeBootScript(storageKey: string): string {
  return `(function(){try{var p=localStorage.getItem(${JSON.stringify(storageKey)});var d=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}})();`;
}
