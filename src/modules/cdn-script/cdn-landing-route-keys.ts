/**
 * Short keys for GET .../cdn-script/landing/{key} → cdn_list script + bookmark label.
 * Add entries here when adding new scripts; keep keys short for bookmarks.
 */

export interface CdnLandingRouteEntry {
  /** Must match `src/cdn_list/{scriptBaseName}.js` (no .js) */
  scriptBaseName: string;
  /** Optional bookmark button / page title suffix */
  bookmarkLabel?: string;
}

/** Lowercase alphanum keys only — safe in URLs and easy to type */
export const CDN_LANDING_ROUTE_KEYS: Record<string, CdnLandingRouteEntry> = {
  /** page_agent_hierarchical.js — 标准 PageAgent（与官方 demo 同源，全局名历史兼容） */
  pa: {
    scriptBaseName: 'page_agent_hierarchical',
    bookmarkLabel: 'Page Agent · 分层测验',
  },
  /** yxy2_20260430.js — legacy 形策 script */
  yx: {
    scriptBaseName: 'yxy2_20260430',
    bookmarkLabel: '形策脚本 · 书签',
  },
};
