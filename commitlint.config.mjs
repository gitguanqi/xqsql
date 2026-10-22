// Conventional Commits 校验配置：提交信息由 commit-msg 钩子调用。
// 类型白名单与 CHANGELOG 中使用的分类保持一致，其他规则沿用 @commitlint/config-conventional。
export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [
            2,
            'always',
            [
                'feat',
                'fix',
                'docs',
                'style',
                'refactor',
                'perf',
                'test',
                'build',
                'ci',
                'revert',
                'chore',
            ],
        ],
        // 中文提交说明常带较长描述，放开正文行长限制，避免误伤。
        'body-max-line-length': [0, 'always'],
    },
};
