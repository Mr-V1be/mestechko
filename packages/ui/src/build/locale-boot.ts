/**
 * Where a visitor's choice of language is kept. The web apps share it, so on one site
 * the product site, the dashboard and the widget speak the language picked in any of them.
 */
export const LOCALE_STORAGE_KEY = 'mst-locale';

export interface LocalePages {
  /** The site's base path, e.g. `/` or `/site/`. */
  readonly base: string;
  /** Each language's page under the base; one language owns the root (`''`). */
  readonly paths: Readonly<Record<string, string>>;
  /** The language for a visitor none of whose languages has a page. */
  readonly fallback: string;
}

/**
 * Inline script for the head of a site rendered ahead of time in several languages. It
 * opens the visitor's language before the first paint: the choice stored on this site,
 * otherwise the first browser language the site has a page in, otherwise the fallback.
 * It repeats the platform's language resolution in plain script, because it must run
 * before any module loads.
 */
export function localeBootScript(pages: LocalePages): string {
  const options = JSON.stringify({ ...pages, key: LOCALE_STORAGE_KEY });
  return `(function(o){try{var has=function(l){return Object.prototype.hasOwnProperty.call(o.paths,l);};var path=location.pathname.indexOf(o.base)===0?location.pathname.slice(o.base.length):'';var page=null,root=null;for(var k in o.paths){if(!has(k))continue;if(o.paths[k]===''){root=k;}else if(path.indexOf(o.paths[k])===0){page=k;}}page=page||root;var want=null,stored=null;try{stored=localStorage.getItem(o.key);}catch(e){}if(stored!==null&&has(stored)){want=stored;}else{var langs=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language];for(var i=0;i<langs.length&&!want;i++){var l=String(langs[i]).toLowerCase().split(/[-_]/)[0];if(has(l)){want=l;}}}want=want||o.fallback;if(page!==null&&want!==page){location.replace(o.base+o.paths[want]+location.search+location.hash);}}catch(e){}})(${options});`;
}
