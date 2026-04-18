# 🚀 JobPilot — 智能招聘职位提取与解析助手

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0-brightgreen.svg)]()
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-orange.svg)]()
[![Lark CLI](https://img.shields.io/badge/Lark-CLI-blue.svg)](https://github.com/larksuite/cli)

**JobPilot** 是一款帮助求职者高效管理投递信息的工具。它能从招聘网站提取岗位信息，通过 AI 分析岗位要求，并将结果保存到飞书多维表格中，帮你建立个人求职管理系统。

---

## 📖 这个工具能帮你做什么？

如果你正在找工作，可能遇到过这些问题：

- 投递了太多岗位，记不清哪家公司、什么职位
- 每个岗位的 JD（职位描述）都很长，抓不住重点
- 想对比不同岗位的要求，但信息太分散
- 面试前想针对性准备，但不知道从何下手

**JobPilot 可以帮你：**

- 📋 **一键提取** 岗位信息（公司、职位、薪资、地点等）
- 🤖 **AI 分析** 岗位核心要求和能力模型
- 📝 **生成建议** 针对性的面试准备清单
- 📊 **统一管理** 所有投递记录在飞书多维表格中

---

## ✨ 主要功能

| 功能 | 说明 |
|------|------|
| **智能提取** | 从招聘网页自动识别并提取岗位关键信息 |
| **手动选取** | 对于未适配的网站，支持手动划选文本提取 |
| **AI 解析** | 提取能力要求、生成面试准备建议 |
| **简历匹配** | 对比简历与岗位要求，给出匹配度分析 |
| **数据入库** | 一键保存到飞书多维表格，方便追踪投递状态 |

---

## 📋 使用前准备

### 必需环境

- **Node.js** (版本 18.0 或以上) - [下载地址](https://nodejs.org/)
- **Chrome 浏览器** - 用于安装插件

### 必需账号

- **Coze 平台账号** - 用于 AI 解析功能
  - 访问 [Coze 平台](https://www.coze.cn/) 注册账号
  - 获取 API Token：个人设置 → API Token → 创建新 Token
  - 创建 Workflow（工作流）并获取 Workflow ID

### 飞书配置（数据入库功能必需）

本工具的核心功能之一是将解析后的 JD 数据自动存入飞书多维表格，需要配置 [lark-cli](https://github.com/larksuite/cli)：

```bash
# 1. 安装 lark-cli
npm install -g @larksuite/cli

# 2. 登录认证
lark-cli auth login

# 3. 验证登录状态
lark-cli auth status
```

> 💡 **提示**：lark-cli 是飞书官方命令行工具，支持 200+ 命令，可操作飞书多维表格、日历、文档等。

---

## 🛠️ 安装步骤

### 第一步：下载项目

```bash
git clone https://github.com/你的用户名/lark-jobpilot-skill.git
cd lark-jobpilot-skill
```

### 第二步：安装依赖

```bash
npm install
npm run build
```

### 第三步：初始化配置

```bash
node dist/coze-parser.js --init
```

这会在你的用户目录下创建配置文件：
- **Windows**: `C:\Users\你的用户名\.jobpilot\config.json`
- **Mac/Linux**: `~/.jobpilot/config.json`

编辑该文件，填入你的 Coze API Token 和 Workflow ID：

```json
{
  "coze_api_token": "你的Coze_API_Token",
  "coze_workflow_id": "你的Workflow_ID",
  "coze_api_base": "https://api.coze.cn"
}
```

> 🔒 **安全提示**：配置文件存放在用户目录下，不会被 Git 跟踪，避免敏感信息泄露。

### 第四步：安装 Chrome 插件

1. 打开 Chrome 浏览器，地址栏输入 `chrome://extensions/`
2. 打开右上角的「开发者模式」开关
3. 点击「加载已解压的扩展程序」
4. 选择项目中的 `chrome-extension` 文件夹
5. 安装成功后，建议将插件固定到工具栏

---

## 🚀 使用方法

### 步骤一：提取 JD 信息

#### 方式一：自动提取（推荐）

适用于 Boss 直聘等已适配的招聘网站：

1. 打开目标岗位的详情页面
2. 点击浏览器工具栏的 JobPilot 插件图标
3. 插件会自动提取岗位信息并复制到剪贴板

#### 方式二：手动选取

适用于所有招聘网站：

1. 用鼠标选中岗位描述的文字
2. 点击插件图标
3. 选中的内容会被格式化并复制到剪贴板

### 步骤二：解析并入库

#### 仅解析 JD（不保存）

```bash
node dist/coze-parser.js "岗位描述内容..."
```

解析结果会以 JSON 格式输出到终端。

#### 解析并保存到飞书多维表格

```bash
# 方式一：自动创建新的多维表格（推荐首次使用）
node dist/coze-parser.js "岗位描述..." --save --create-base

# 方式二：保存到已有的多维表格
node dist/coze-parser.js "岗位描述..." --save --base-token <Token> --table-id <TableID>
```

执行成功后，会返回多维表格的访问链接，你可以直接在飞书中查看和管理数据。

#### 进阶：带简历匹配分析

```bash
node dist/coze-parser.js "岗位描述..." "./resume.txt" --save --create-base
```

---

## 📊 飞书多维表格字段说明

入库的数据包含以下字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| 岗位名称 | 文本 | 职位名称 |
| 公司名称 | 文本 | 招聘公司 |
| 工作地点 | 文本 | 工作城市/地址 |
| 薪资待遇 | 文本 | 薪资范围 |
| 核心关键词 | 文本 | JD 核心要求关键词 |
| 能力雷达图解析 | 文本 | 三维度能力分析 |
| 备考行动清单 | 文本 | 面试准备建议 |
| 综合匹配度 | 文本 | 简历匹配度得分 |
| JD 原文 | 文本 | 原始 JD 内容 |

> 💡 **提示**：你可以在飞书多维表格中自行添加「投递状态」等字段来追踪投递进度。

---

## ❓ 常见问题

<details>
<summary><b>Q: 提示 "Coze API Token 未配置" 怎么办？</b></summary>

请执行以下步骤：
1. 运行 `node dist/coze-parser.js --init` 创建配置文件
2. 编辑配置文件（位置见上方说明）
3. 填入你的 Coze API Token 和 Workflow ID
</details>

<details>
<summary><b>Q: lark-cli 登录失败怎么办？</b></summary>

1. 确保已安装最新版 lark-cli：`npm install -g @larksuite/cli`
2. 重新执行登录：`lark-cli auth login`
3. 按提示在浏览器中完成授权
4. 验证状态：`lark-cli auth status`
</details>

<details>
<summary><b>Q: 如何获取已有的多维表格 Token？</b></summary>

1. 打开飞书多维表格
2. 点击右上角「...」→「更多」→「查看 API 信息」
3. 复制 App Token
</details>

<details>
<summary><b>Q: 可以不用飞书吗？</b></summary>

可以。如果你只需要 JD 解析功能，不需要配置飞书。解析结果会直接输出到终端。但推荐使用飞书多维表格来长期管理和追踪投递进度。
</details>

<details>
<summary><b>Q: 配置文件存放在哪里？安全吗？</b></summary>

配置文件存放在用户主目录下（`~/.jobpilot/config.json`），不会被 Git 跟踪，也不会被上传到代码仓库，相对安全。
</details>

---

## 📚 更多文档

- [详细配置指南](./skills/lark-jobpilot-skill/SKILL.md) - Coze Workflow 完整配置说明
- [lark-cli 官方文档](https://github.com/larksuite/cli) - 飞书命令行工具使用指南

---

## 🤝 参与贡献

欢迎提交 Issue 反馈问题，或提交 Pull Request 改进代码。

如果某个招聘网站无法正常提取，欢迎提供网站信息和页面结构，我们会尽快适配。

---

## 📄 开源协议

本项目基于 [MIT License](https://opensource.org/licenses/MIT) 开源。
