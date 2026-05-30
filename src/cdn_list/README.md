# CDN static scripts

`page_agent_hierarchical.js` is produced by the page-agent workspace:

```bash
cd packages/page-agent/packages/page-agent
npm run build:hierarchical
```

Source entry: `packages/page-agent/packages/page-agent/src/hierarchical-demo.ts`  
行为：与官方 `demo.ts` 相同的标准 **PageAgent**（完整面板与工具链）；入口全局仍为 `PageAgentHierarchical` 仅用于兼容书签/CDN 文件名。

After build, `packages/page-agent/scripts/copy-hierarchical-cdn.mjs` copies the IIFE to this folder. Keep the basename in sync with `KNOWN_CDN_SCRIPT_BASE_NAMES` in `apps/vue-app1/src/api/cdnScript.ts`.
