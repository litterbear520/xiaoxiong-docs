# 小熊API 文档

小熊API 的使用文档，用 [Astro Starlight](https://starlight.astro.build) 搭建，线上地址是每条线路的 `/docs/`，比如 <https://api.little-bear.app/docs/>。

## 常用命令

```bash
bun install          # 安装依赖
bun run dev          # 本地预览 http://localhost:4321/docs/
bun run test         # 单元测试 + 内容检查
bun run check        # 类型检查
bun run build        # 构建到 dist/，顺带检查所有内部链接
scripts/deploy.sh    # 测试、构建并发布（服务器写在不入库的 scripts/deploy.env）
```

## 目录

| 路径 | 内容 |
| --- | --- |
| `src/content/docs/` | 每页的正文（MDX），文件路径就是网址 |
| `src/site.ts` | 侧栏顺序、站点名称、控制台链接白名单 |
| `src/components/` | 首页大标题、标题旁的「复制页面」按钮、顶栏链接 |
| `src/styles/theme.css` | 配色和排版（仿 Claude 文档） |
| `src/lib/` | 把每页转成 Markdown、生成 `llms.txt` |
| `src/pages/` | `/docs/<页面>.md`、`/docs/llms.txt` 和 404 页 |

## 加一页

1. 在 `src/content/docs/` 下新建 `.mdx`，frontmatter 写 `title` 和一句话的 `description`。
2. 在 `src/site.ts` 的 `sidebarSections` 里加上它的路径。
3. `bun run test && bun run build`，确认测试和链接检查都通过。

## 写作规则

- 开头一句话说清这页讲什么，不加形容词。
- 标题用动词开头，比如「创建 API 密钥」「检测连接」。
- 每一步后面写成功是什么样。
- 报错原文照贴，后面紧跟原因和解决办法。
- 有选择就做成表，并给默认值。
- 提示框少用，警告只留给泄露密钥这类事。
- 称呼读者用「你」。
- 示例里的地址统一用主线路 `https://api.little-bear.app`，密钥用 `sk-你的密钥` 或环境变量 `XIAOXIONG_API_KEY`。
- 示例要先实际跑通再写进文档。
