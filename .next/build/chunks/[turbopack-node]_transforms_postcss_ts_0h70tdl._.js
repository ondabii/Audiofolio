module.exports = [
"[turbopack-node]/transforms/postcss.ts { CONFIG => \"[project]/cloudflare_pages/postcss.config.mjs [postcss] (ecmascript)\" } [postcss] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "chunks/0301_0f1~tdw._.js",
  "chunks/[root-of-the-server]__0gp9.mv._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[turbopack-node]/transforms/postcss.ts { CONFIG => \"[project]/cloudflare_pages/postcss.config.mjs [postcss] (ecmascript)\" } [postcss] (ecmascript)");
    });
});
}),
];