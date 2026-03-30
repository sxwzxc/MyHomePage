# MyHomePage

中文 | [English](./README_en.md)

简洁高效的个人起始页，基于 **Next.js** 静态导出 + **EdgeOne Pages Functions** 构建，使用 KV 存储实现配置持久化。

## 功能一览

### 搜索
- 内置 Google、Bing、百度、DuckDuckGo 搜索引擎，支持自定义添加
- 一键切换引擎，快捷关键词填充，回车即可跳转

### 书签收藏
- 拖拽排序、快速添加、右键菜单编辑/删除
- 卡片 / 紧凑两种布局，1-6 列可调
- 自动获取网站 favicon（三级源回退），支持定时刷新

### 新闻热榜
- 聚合 **11 个热搜来源**：60s 读懂世界、头条热搜、微博、知乎、夸克、百度、B 站、抖音、小红书、豆瓣电影、懂车帝
- 自动轮播 / 手动切换，支持折叠显示
- KV 缓存（30 分钟 TTL）+ 后台增量刷新

### 主页信息
- Canvas 模拟时钟，毫秒级平滑动画
- 实时天气查询（城市可配置）
- 页面访问计数

### 视觉定制
- 6 种渐变动画背景预设（默认 / 海洋 / 日落 / 森林 / 极光 / 烈焰）
- 自定义图片背景（支持模糊和透明度调节）
- 纯色背景

### 安全
- 设置页面支持密码保护，解锁状态会话内有效

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 14 (App Router, `output: 'export'` 静态导出) |
| UI | React 18 + Radix UI + Lucide Icons |
| 样式 | Tailwind CSS 3 + class-variance-authority |
| 后端 | EdgeOne Pages Functions (Cloudflare Workers 格式) |
| 存储 | EdgeOne KV |
| 语言 | TypeScript (前端) / JavaScript (Functions) |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

开发模式下 Functions 运行在 `localhost:8088`，前端页面在 [http://localhost:3000](http://localhost:3000)。

## 常用脚本

```bash
npm run dev    # 启动开发服务器
npm run build  # 生产构建（静态导出到 out/）
npm run lint   # ESLint 校验
```

> 构建时需要网络环境以下载 Google Fonts (Inter)。

## 项目结构

```
├── app/                        # Next.js App Router
│   ├── layout.tsx              # 根布局（字体、元信息）
│   ├── page.tsx                # 主页
│   ├── settings/page.tsx       # 设置页
│   └── globals.css             # 全局样式
├── components/
│   ├── HomepageDashboard.tsx   # 主页仪表盘（搜索、书签、天气、时钟）
│   ├── SettingsDashboard.tsx   # 设置仪表盘（配置管理）
│   ├── NewsSection.tsx         # 新闻热榜组件
│   ├── AnalogClock.tsx         # Canvas 模拟时钟
│   ├── AnimatedBackground.tsx  # 动画背景
│   ├── Kv.tsx                  # KV 存储演示
│   └── ui/                     # 基础 UI 组件（Accordion、Button、ContextMenu）
├── functions/
│   ├── homepage-config/        # 配置读写（KV 键: homepage:config:v1）
│   ├── news/                   # 新闻聚合引擎（11 个来源 + 缓存）
│   ├── favicon-fetch/          # Favicon 获取代理
│   ├── visit/                  # 访问计数器
│   ├── password-verify/        # 密码验证
│   ├── kv-list/                # KV 数据浏览（调试用）
│   └── kv-batch-set/           # KV 批量写入测试
├── lib/
│   ├── homepage-config.ts      # 配置类型定义与默认值
│   ├── utils.ts                # API 调用封装（含 sessionStorage 缓存）
│   └── unlock-state.ts         # 设置页解锁状态管理
├── public/                     # 静态资源
└── next.config.mjs             # 静态导出配置
```

## 环境变量

在 `.env` 文件中配置：

```env
password=your_password_here
```

- `password` — 设置页面访问密码，默认为 `please_change_me`

## 部署

1. 使用 `npm run build` 构建项目，产物在 `out/` 目录
2. 部署到 **EdgeOne Pages**
3. 绑定 KV 命名空间，确保键 `homepage:config:v1` 可用

> Functions 目录采用 Cloudflare Pages Functions 格式，EdgeOne Pages 原生兼容。

## License

MIT
