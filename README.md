# Parse_JD — JD 招聘解析助手

> lark-cli 自定义 Skill：解析招聘 JD 并存入飞书多维表格

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/你的用户名/Parse_JD.git
cd Parse_JD
```

### 2. 安装依赖

```bash
npm install
npm run build
```

### 3. 配置环境变量

创建 `.env` 文件：

```bash
COZE_API_TOKEN=你的Coze_API_Token
COZE_WORKFLOW_ID=你的JobHunter_Core_Engine_Workflow_ID
```

### 4. 运行测试

```bash
# 仅解析 JD
node dist/coze-parser.js "岗位职责：负责大模型产品..."

# JD 解析 + 简历匹配
node dist/coze-parser.js "岗位职责..." "./resume.txt"
```

## 详细配置指南

请查看 [SKILL.md](./skills/Parse_JD/SKILL.md) 获取完整的 Coze Workflow 配置指南。

## 功能特性

- ✅ JD 智能解析（公司、岗位、地点、薪资）
- ✅ 能力雷达图分析（产品基本功、AI技术理解、场景商业化）
- ✅ 备考行动清单生成
- ✅ 简历匹配度分析
- ✅ 一键写入飞书多维表格

## 技术栈

- Node.js + TypeScript
- Coze Workflow API
- lark-cli (飞书 CLI)

## License

MIT
