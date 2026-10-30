import { describe, expect, it } from 'vitest'

import { buildLlmsTxt, resolveSections } from '../src/lib/llms'

const pages = [
  { slug: 'quickstart', title: '快速开始', description: '发出第一个请求。' },
  { slug: 'tools/codex', title: 'Codex', description: '在终端里用 GPT 写代码。' },
  { slug: 'tools/cursor', title: 'Cursor', description: '在编辑器里用 GPT。' },
  { slug: 'changelog', title: '更新日志' },
]

describe('resolveSections', () => {
  it('keeps the sidebar order and labels', () => {
    const sections = resolveSections(
      [
        { label: '集成指南', items: ['tools/codex'] },
        { label: '快速上手', items: ['quickstart', { slug: 'changelog', label: '改动' }] },
      ],
      pages
    )
    expect(sections.map((s) => [s.label, s.groups.map((g) => g.pages.map((p) => p.slug))])).toEqual([
      ['集成指南', [['tools/codex']]],
      ['快速上手', [['quickstart', 'changelog']]],
    ])
  })

  it('keeps sub-labels as their own groups', () => {
    const [section] = resolveSections(
      [
        {
          label: '集成指南',
          items: [
            { label: '编码工具（命令行）', items: ['tools/codex'] },
            { label: '编辑器和插件', items: ['tools/cursor'] },
          ],
        },
      ],
      pages
    )
    expect(section.groups.map((g) => [g.label, g.pages.map((p) => p.slug)])).toEqual([
      ['编码工具（命令行）', ['tools/codex']],
      ['编辑器和插件', ['tools/cursor']],
    ])
  })

  it('fails loudly when the sidebar names a page that does not exist', () => {
    expect(() => resolveSections([{ label: '开始', items: ['quick-start'] }], pages)).toThrow(/quick-start/)
    expect(() =>
      resolveSections([{ label: '开始', items: [{ label: '工具', items: ['tools/zed'] }] }], pages)
    ).toThrow(/tools\/zed/)
  })

  it('refuses a plain page after a sub-label, which would read as part of it', () => {
    expect(() =>
      resolveSections([{ label: '集成指南', items: [{ label: '工具', items: ['tools/codex'] }, 'changelog'] }], pages)
    ).toThrow(/changelog/)
  })
})

describe('buildLlmsTxt', () => {
  it('follows the llms.txt layout and links every page to its Markdown file', () => {
    const text = buildLlmsTxt({
      title: '小熊API 文档',
      summary: '一个 Key 调用 GPT 模型，兼容 OpenAI 接口。',
      intro: ['OpenAI 格式的 Base URL 是 `https://api.little-bear.app/v1`。'],
      docsUrl: 'https://api.little-bear.app/docs',
      sections: resolveSections(
        [
          { label: '快速上手', items: ['quickstart'] },
          { label: '参考', items: ['tools/codex', 'changelog'] },
        ],
        pages
      ),
    })
    expect(text).toBe(
      [
        '# 小熊API 文档',
        '',
        '> 一个 Key 调用 GPT 模型，兼容 OpenAI 接口。',
        '',
        'OpenAI 格式的 Base URL 是 `https://api.little-bear.app/v1`。',
        '',
        '## 快速上手',
        '',
        '- [快速开始](https://api.little-bear.app/docs/quickstart.md): 发出第一个请求。',
        '',
        '## 参考',
        '',
        '- [Codex](https://api.little-bear.app/docs/tools/codex.md): 在终端里用 GPT 写代码。',
        '- [更新日志](https://api.little-bear.app/docs/changelog.md)',
        '',
      ].join('\n')
    )
  })

  it('writes sub-labels as ### headings inside their group', () => {
    const text = buildLlmsTxt({
      title: '小熊API 文档',
      summary: '摘要',
      intro: [],
      docsUrl: 'https://api.little-bear.app/docs',
      sections: resolveSections(
        [
          {
            label: '集成指南',
            items: [
              { label: '编码工具（命令行）', items: ['tools/codex'] },
              { label: '编辑器和插件', items: ['tools/cursor'] },
            ],
          },
        ],
        pages
      ),
    })
    expect(text).toBe(
      [
        '# 小熊API 文档',
        '',
        '> 摘要',
        '',
        '## 集成指南',
        '',
        '### 编码工具（命令行）',
        '',
        '- [Codex](https://api.little-bear.app/docs/tools/codex.md): 在终端里用 GPT 写代码。',
        '',
        '### 编辑器和插件',
        '',
        '- [Cursor](https://api.little-bear.app/docs/tools/cursor.md): 在编辑器里用 GPT。',
        '',
      ].join('\n')
    )
  })
})
