// pre-commit 暂存区检查。本项目运行时零依赖，也没有引入 ESLint / Biome / oxlint，
// 因此这里只做零依赖的语法自检；将来接入 linter 时替换成对应命令即可。
const checkSyntax = (files) => files.map((file) => `node --check "${file}"`);

export default {
    '*.{js,mjs,cjs}': checkSyntax,
};
