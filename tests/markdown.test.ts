import { describe, expect, it } from 'vitest'

import { markdownPathFor, mdxToMarkdown, renderPageMarkdown } from '../src/lib/markdown'

describe('markdownPathFor', () => {
  it('maps the docs home to index.md', () => {
    expect(markdownPathFor('index')).toBe('index.md')
    expect(markdownPathFor('')).toBe('index.md')
  })

  it('maps nested pages to a sibling .md file', () => {
    expect(markdownPathFor('quickstart')).toBe('quickstart.md')
    expect(markdownPathFor('tools/codex')).toBe('tools/codex.md')
  })
})

describe('mdxToMarkdown', () => {
  it('drops MDX imports but keeps the prose', () => {
    const body = [
      "import { Steps } from '@astrojs/starlight/components'",
      "import Hero from '../../components/Hero.astro';",
      '',
      '先创建一个 API 密钥。',
    ].join('\n')
    expect(mdxToMarkdown(body)).toBe('先创建一个 API 密钥。\n')
  })

  it('unwraps Steps so the numbered list stays', () => {
    const body = ['<Steps>', '', '1. 安装', '2. 配置', '', '</Steps>'].join('\n')
    expect(mdxToMarkdown(body)).toBe('1. 安装\n2. 配置\n')
  })

  it('turns each tab into a bold label followed by its content', () => {
    const body = [
      '<Tabs syncKey="os">',
      '<TabItem label="macOS / Linux">',
      '',
      '```bash',
      'export OPENAI_API_KEY="sk-..."',
      '```',
      '',
      '</TabItem>',
      "<TabItem label='Windows'>",
      '',
      '```powershell',
      '$env:OPENAI_API_KEY="sk-..."',
      '```',
      '',
      '</TabItem>',
      '</Tabs>',
    ].join('\n')
    expect(mdxToMarkdown(body)).toBe(
      [
        '**macOS / Linux**',
        '',
        '```bash',
        'export OPENAI_API_KEY="sk-..."',
        '```',
        '',
        '**Windows**',
        '',
        '```powershell',
        '$env:OPENAI_API_KEY="sk-..."',
        '```',
        '',
      ].join('\n')
    )
  })

  it('keeps the indentation of tabs nested in a list item', () => {
    const body = [
      '1. 设置密钥',
      '',
      '   <Tabs syncKey="os">',
      '   <TabItem label="Windows">',
      '',
      '   ```powershell',
      '   $env:XIAOXIONG_API_KEY="sk-..."',
      '   ```',
      '',
      '   </TabItem>',
      '   </Tabs>',
    ].join('\n')
    expect(mdxToMarkdown(body)).toBe(
      [
        '1. 设置密钥',
        '',
        '   **Windows**',
        '',
        '   ```powershell',
        '   $env:XIAOXIONG_API_KEY="sk-..."',
        '   ```',
        '',
      ].join('\n')
    )
  })

  it('renders asides as blockquotes with a title', () => {
    const body = [
      '<Aside type="caution" title="别把 Key 提交到仓库">',
      '配置文件会被提交，',
      '请用环境变量。',
      '</Aside>',
    ].join('\n')
    expect(mdxToMarkdown(body)).toBe(
      '> **别把 Key 提交到仓库**\n>\n> 配置文件会被提交，\n> 请用环境变量。\n'
    )
  })

  it('keeps paragraphs and lists inside an aside apart', () => {
    const body = ['<Aside type="caution">', '', '第一段。', '', '- 第一条', '- 第二条', '', '</Aside>'].join(
      '\n'
    )
    expect(mdxToMarkdown(body)).toBe(
      '> **注意**\n>\n> 第一段。\n>\n> - 第一条\n> - 第二条\n'
    )
  })

  it('keeps an aside nested in a list item inside that item', () => {
    const body = ['1. 写配置', '', '   <Aside>', '   只改用户目录下的文件。', '   </Aside>'].join('\n')
    expect(mdxToMarkdown(body)).toBe('1. 写配置\n\n   > **说明**\n   >\n   > 只改用户目录下的文件。\n')
  })

  it('gives untitled asides a default Chinese label by type', () => {
    expect(mdxToMarkdown('<Aside>\n只对流式请求有效。\n</Aside>')).toBe(
      '> **说明**\n>\n> 只对流式请求有效。\n'
    )
    expect(mdxToMarkdown('<Aside type="tip">\n先测 curl。\n</Aside>')).toBe(
      '> **提示**\n>\n> 先测 curl。\n'
    )
  })

  it('turns link cards into a list item', () => {
    const body = [
      '<CardGrid>',
      '<LinkCard title="Codex" href="/docs/tools/codex/" description="在终端里写代码" />',
      '<LinkCard title="Cherry Studio" href="/docs/tools/cherry-studio/" />',
      '</CardGrid>',
    ].join('\n')
    expect(mdxToMarkdown(body)).toBe(
      '- [Codex](/docs/tools/codex/)：在终端里写代码\n- [Cherry Studio](/docs/tools/cherry-studio/)\n'
    )
  })

  it('makes link card targets absolute too', () => {
    expect(
      mdxToMarkdown('<LinkCard title="错误码" href="/docs/errors/" />', { origin: 'https://api.little-bear.app' })
    ).toBe('- [错误码](https://api.little-bear.app/docs/errors/)\n')
  })

  it('drops layout-only HTML and unknown self-closing components', () => {
    const body = ['<div class="home-hero">', '<HomeActions />', '## 接入信息', '</div>'].join(
      '\n'
    )
    expect(mdxToMarkdown(body)).toBe('## 接入信息\n')
  })

  it('turns a screenshot line into its alt text, since the image path is build-relative', () => {
    const body = ['点侧边栏的「画图」。', '', '![画图页的新对话页](../../assets/draw/1-start-page.png)'].join('\n')
    expect(mdxToMarkdown(body, { origin: 'https://api.little-bear.app' })).toBe(
      '点侧边栏的「画图」。\n\n（截图：画图页的新对话页）\n'
    )
  })

  it('never touches what is inside code fences', () => {
    const body = ['```html', '<div>', "import x from 'y'", '</div>', '```'].join('\n')
    expect(mdxToMarkdown(body)).toBe(body + '\n')
  })

  it('makes root-relative links absolute when an origin is given', () => {
    expect(
      mdxToMarkdown('见 [错误码](/docs/errors/) 和 [控制台](/keys)。', {
        origin: 'https://api.little-bear.app',
      })
    ).toBe(
      '见 [错误码](https://api.little-bear.app/docs/errors/) 和 [控制台](https://api.little-bear.app/keys)。\n'
    )
  })

  it('leaves links inside code untouched when making links absolute', () => {
    const body = ['看 [错误码](/docs/errors/) 和 `[示例](/path)`。', '', '```md', '[链接](/path)', '```'].join(
      '\n'
    )
    expect(mdxToMarkdown(body, { origin: 'https://api.little-bear.app' })).toBe(
      [
        '看 [错误码](https://api.little-bear.app/docs/errors/) 和 `[示例](/path)`。',
        '',
        '```md',
        '[链接](/path)',
        '```',
        '',
      ].join('\n')
    )
  })

  it('only closes a code fence on a bare fence line', () => {
    const body = ['```text', '```js', "import x from 'y'", '```', "import a from 'b'"].join('\n')
    expect(mdxToMarkdown(body)).toBe(['```text', '```js', "import x from 'y'", '```', ''].join('\n'))
  })

  it('collapses the blank lines left behind by removed tags', () => {
    expect(mdxToMarkdown('上面\n\n<Steps>\n\n\n\n下面\n')).toBe('上面\n\n下面\n')
  })
})

describe('renderPageMarkdown', () => {
  it('puts the title and description on top', () => {
    expect(
      renderPageMarkdown({
        title: '快速开始',
        description: '用 curl 发出第一个请求。',
        body: '## 第一步\n\n内容',
      })
    ).toBe('# 快速开始\n\n> 用 curl 发出第一个请求。\n\n## 第一步\n\n内容\n')
  })

  it('omits the description line when there is none', () => {
    expect(renderPageMarkdown({ title: '更新日志', body: '内容' })).toBe('# 更新日志\n\n内容\n')
  })
})
