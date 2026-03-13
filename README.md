# 字见 (Zijing)

> 智能汉字学习平台 · 结合 AI 与 ESP32-S3 实物识字

## 技术栈

- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **ORM**: Prisma
- **样式**: Tailwind CSS
- **UI**: shadcn/ui (基础组件)
- **数据库**: PostgreSQL (Supabase)
- **缓存**: Redis (Upstash)
- **认证**: JWT

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
# 编辑 .env.local 填写必要配置
```

### 3. 初始化数据库

```bash
npm run prisma:migrate
npm run prisma:generate
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 目录结构

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # 认证路由组（登录/注册）
│   ├── (main)/             # 主应用路由组
│   ├── api/v1/             # API 路由
│   └── admin/              # 管理后台
├── components/
│   ├── ui/                 # 基础 UI 组件
│   └── shared/             # 共享业务组件
├── lib/
│   ├── prisma.ts           # Prisma 客户端单例
│   ├── redis.ts            # Redis 客户端 & 缓存工具
│   └── utils.ts            # 通用工具函数
├── server/
│   ├── middleware/         # API 中间件
│   ├── services/           # 业务服务层
│   └── adapters/           # 反锁定适配器（AI等）
└── types/
    └── index.ts            # 全局类型定义
```

## API 文档

| 路径 | 说明 |
|------|------|
| `GET /api/v1/health` | 健康检查 |
| `POST /api/v1/auth/...` | 认证相关 |
| `GET/POST /api/v1/chars/...` | 汉字查询 |
| `POST /api/v1/convert/...` | 简繁转换 |
| `GET/POST /api/v1/wordbooks/...` | 字书管理 |
| `POST /api/v1/scan/...` | ESP32 扫描识字 |

## 开发命令

```bash
npm run dev            # 开发模式
npm run build          # 生产构建
npm run lint           # 代码检查
npm run prisma:studio  # 数据库可视化
```
