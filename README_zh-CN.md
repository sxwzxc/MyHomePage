# MyHomePage

一个基于 **Next.js** 和 **EdgeOne Pages Functions** 的可定制个人起始页，内置多引擎搜索、收藏书签、天气与访问统计，以及 GitHub 趋势“新闻”流，并通过 KV 持久化配置。

## 功能亮点
- 多引擎搜索区：一键切换搜索引擎，快捷关键词填充。
- 书签收藏：支持拖拽排序、快速添加、自定义图标，卡片/紧凑双布局。
- 主页信息：天气查询、访问计数、动态背景。
- 热点新闻：GitHub Trending，支持时间维度与语言筛选、手动刷新、可折叠。
- 配置存储在 `/homepage-config` EdgeOne 函数（KV 键 `homepage:config:v1`），可设置访问锁。

## 开发指南
```bash
npm install
npm run dev
```
在浏览器打开 [http://localhost:3000](http://localhost:3000) 即可预览。可在页面内调整设置，或在 `lib/homepage-config.ts` 修改默认配置。

## 常用脚本
- `npm run dev` – 启动本地开发服务器。
- `npm run lint` – 运行 Next.js ESLint 校验。
- `npm run build` – 生产构建。由于 `app/layout.tsx` 使用了 Google Fonts 的 Inter，构建时需要可访问 Google Fonts 的网络环境。

## 目录概览
- `app/`：App Router 页面与布局。
- `components/`：页面区块组件（搜索、书签、新闻等）。
- `functions/homepage-config/`：EdgeOne 函数，负责在 KV 中持久化配置。
- `lib/`：类型定义、默认配置与工具方法。

## 部署
部署到 EdgeOne Pages 时，请确保 KV 中存在键 `homepage:config:v1`，以便 `/homepage-config` 函数能够持久化用户配置。
