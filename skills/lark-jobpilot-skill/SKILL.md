---
name: lark-jobpilot-skill
version: 1.0.0
description: "JD 招聘解析助手：解析招聘 JD 并存入飞书多维表格。当用户需要解析 JD、分析岗位描述、管理求职进度时使用。"
metadata:
  requires:
    bins: ["lark-cli", "node"]
  env:
    - COZE_API_TOKEN
    - COZE_WORKFLOW_ID
    - BITABLE_APP_TOKEN
    - TABLE_ID
---


# lark-jobpilot-skill — JD 招聘解析助手

> **前置条件：** 确保已安装并配置 [lark-cli](https://github.com/larksuite/cli)（飞书命令行工具）。

将非结构化的招聘 JD 文本，通过 Coze Workflow AI 解析为结构化数据，并写入飞书多维表格，实现求职信息的长期管理和追踪。

## 快速开始

```
┌─────────────────────────────────────────────────────────────┐
│                    lark-jobpilot-skill 使用流程                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1        Step 2        Step 3        Step 4          │
│  配置工作流 ──►  创建表格  ──►  解析 JD  ──►  管理进度        │
│                                                             │
│  主工作流      多维表格      一键调用      更新投递          │
│  + 子工作流    + 字段        + 入库        + 筛选           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1：配置 Coze Workflow

### 工作流架构

```
JobHunter_Core_Engine（主工作流）
├── JD_Analyzer（子工作流）
│   └── 开始 → 大模型 → 代码 → 结束
├── Resume_Match（子工作流）
│   └── 开始 → read → 大模型 → 代码 → 结束
└── 代码节点（合并输出）
```

---

### 1.1 创建 JD_Analyzer 子工作流

#### 工作流结构：开始 → 大模型 → 代码 → 结束

#### 节点 1：开始

| 配置项 | 值 |
|--------|-----|
| 输入变量名 | `jd_text` |
| 类型 | String |

#### 节点 2：大模型

**系统提示词（直接复制）：**

```
# Role
你是一位资深的大厂 AI 业务线产品总监兼高级招聘专家。

# Task
仔细阅读用户输入的【岗位JD】，执行两项动作：
1. 提取基础画像：精准抓取该岗位的公司、名称、地点与薪资。
2. 深度能力拆解：根据预设的【分析框架】，提取核心能力要求，并输出结构化的能力模型与备考行动点（Action Items）。

# Framework (分析框架)
请全局扫描 JD 文本，严格按照以下三大维度进行均衡拆解。切勿遗漏任何一个维度的核心要求,若JD中未提及某维度，请结合行业标准给出基础建议：
1.产品基本功（Hard Skills）：重点提取需求洞察、PRD 撰写、项目管理、以及与数据相关的能力（如数据需求明确、清洗逻辑与质量评估等）。
2.AI 技术理解（AI Literacy）：重点提取对 LLM 边界/局限性的认知、Prompt Engineering 能力、Agent/Workflow 机制理解、懂 RAG/Fine-tuning 基本概念以及 AI 方案的评估与验证能力（如 Bad case 处理、准确率指标等）。
3.场景落地与商业化（Business Sense）：重点提取 AI 在具体业务场景中的降本增效逻辑、ROI 评估方法、以及基于 AI 能力的用户体验设计。

# Output Content(输出内容)
## 0. 岗位基础画像
- **公司名称**：[提取出的公司名]
- **岗位名称**：[提取出的具体 Title]
- **工作地点**：[提取出的城市]
- **薪资待遇**：[提取出的薪资范围]
> *注意：以上四项如果 JD 中未提供或未明确写出，请严格输出"未提供"，绝对禁止凭空捏造。*

## 1. 核心评估看板
- **核心关键词**：提取3-5个代表该 JD 核心调性的词汇。
- **能力雷达图解析**：分点列出上述三个维度在该 JD 中的具体体现。
- **备考清单（Action Items）**：针对该 JD，列出3条最紧迫、最具实操性的准备动作，同时要在每一条的后面说明分别对应的是哪一部分能力。

# Constraints
1. 绝对客观：只基于输入的 JD 进行拆解，严禁为了凑字数而捏造 JD 中不存在的具体业务场景。
2. 拒绝废话：不要输出"你好"、"请看以下分析"等任何寒暄语。直接输出 Markdown 结果。

# input
待分析的岗位JD文本：{{jd_text}}

# Output Format
请严格以 JSON 格式输出，不要包含任何前言后语和 Markdown 代码块标记。JSON 结构必须严格遵守以下契约：
{
  "company": "公司名称，如无则输出 未提供",
  "title": "岗位名称，如无则输出 未提供",
  "location": "工作地点，如无则输出 未提供",
  "salary": "薪资待遇，如无则输出 未提供",
  "core_keywords": ["关键词1", "关键词2", "关键词3"],
  "radar_analysis": {
    "hard_skills": "产品基本功的具体体现...",
    "ai_literacy": "AI 技术理解的具体体现...",
    "business_sense": "场景落地与商业化的具体体现..."
  },
  "action_items": ["备考动作1", "备考动作2", "备考动作3"]
}
```

#### 节点 3：代码

**输入变量：** 大模型节点的输出（变量名：`raw_text`）

**代码（直接复制）：**

```javascript
async function main({ params }) {
    let text = params.raw_text || "";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let parsedData = {};
    try {
        parsedData = JSON.parse(text);
    } catch (e) {
        parsedData = {
            company: "解析失败", title: "解析失败", location: "解析失败", salary: "解析失败",
            core_keywords: ["系统错误"],
            radar_analysis: { hard_skills: "无", ai_literacy: "无", business_sense: "无" },
            action_items: ["请检查大模型输出或重试"]
        };
    }

    return {
        company: parsedData.company || "未提供",
        title: parsedData.title || "未提供",
        location: parsedData.location || "未提供",
        salary: parsedData.salary || "面议",
        core_keywords: Array.isArray(parsedData.core_keywords) ? parsedData.core_keywords.join("，") : "无",
        radar_analysis: typeof parsedData.radar_analysis === 'object' ?
            `【产品基本功】\n${parsedData.radar_analysis.hard_skills || "无"}\n\n【AI技术理解】\n${parsedData.radar_analysis.ai_literacy || "无"}\n\n【场景商业感】\n${parsedData.radar_analysis.business_sense || "无"}`
            : "无分析",
        action_items: Array.isArray(parsedData.action_items) ?
            parsedData.action_items.map((item, index) => `${index + 1}. ${item}`).join("\n")
            : "无行动建议"
    };
}
```

**输出变量（均为 String 类型）：**

| 变量名 | 类型 | 说明 |
|--------|------|------|
| `company` | String | 公司名称 |
| `title` | String | 岗位名称 |
| `location` | String | 工作地点 |
| `salary` | String | 薪资待遇 |
| `core_keywords` | String | 核心关键词（逗号分隔） |
| `radar_analysis` | String | 能力雷达分析（格式化文本） |
| `action_items` | String | 备考清单（带序号） |

#### 节点 4：结束

接受代码节点输出的 7 个变量。

---

### 1.2 创建 Resume_Match 子工作流

#### 工作流结构：开始 → read → 大模型 → 代码 → 结束

#### 节点 1：开始

| 配置项 | 值 |
|--------|-----|
| 输入变量名 1 | `jd` |
| 类型 | String |
| 输入变量名 2 | `resume_file` |
| 类型 | File |

#### 节点 2：read

**输入：** 开始节点的 `resume_file`（作为 URL）

**输出：** 简历文本内容

#### 节点 3：大模型

**输入变量：**
- 开始节点的 `jd`
- read 节点的输出

**系统提示词（直接复制）：**

```
# Role
你是一位字节跳动/腾讯级别的资深 AI 业务线产品线负责人，以毒舌、极其看重 ROI 和技术落地著称。你正在评估一份零基础跨行者的简历。

# Task
阅读用户输入的{{jd_text}}}与{{resume_text}}，提取简历中的非 AI 经历（包括建筑专业项目、社团、兼职或任何杂项经历），强行挖掘其底层能力，并将其映射为 AI PM 的三大核心维度，最终给出一份"降维打击"式的匹配度诊断报告。

# Assessment Rules (核心打分与扣分规则)
1. 产品基本功 (Hard Skills)：
   - 满分标准：有完整的数据清洗逻辑、PRD 撰写能力或复杂多方项目统筹经验。
   - 核心减分项：缺乏业务数据指标（如转化率、ROI）的意识。
2. AI 技术理解 (AI Literacy)：
   - 满分标准：有明确的"AI 评估动作"（如建立 Bad Case 评测集、设计准确率指标、针对模型不稳定性设计产品兜底机制）。
   - 核心减分项：只会罗列"使用了 ChatGPT/Midjourney"，缺乏对大模型技术边界（幻觉、Token成本）的认知。
3. 场景商业感 (Business Sense)：
   - 满分标准：能准确切入所在领域（哪怕是建筑或传统行业）的业务痛点，并证明 AI 的降本增效价值。
   - 核心减分项：强行使用 AI 解决伪需求，没有思考 ROI。

# Output Content
## 1. 核心评估看板 (Scoreboard)
| 评估维度 | 细分得分 | 最致命的 Gap (仅列1条最要命的) |
| :--- | :--- | :--- |
| **产品基本功** | 0-100 | [识别缺陷] |
| **AI技术理解** | 0-100 | [识别缺陷] |
| **场景商业感** | 0-100 | [识别缺陷] |
| **综合匹配度** | **加权总分** | **[用毒舌面试官的口吻给出一句刻薄但准确的定性评价]** |

## 2. 诊断关键词 (Diagnosis Keywords)
- [优势关键词1]：...
- [致命伤关键词2]：...

## 3. 简历精修对比表 (Resume Refinement)
> 识别用户简历中的具体经历（无论是否为建筑学），提取其底层逻辑（如协调、规划、成本控制），按 STAR 法则重写为 AI PM 话术。
| 原始描述 | 跨界能力提取 | 大厂 AI PM 化重写 (STAR版) |
| :--- | :--- | :--- |
| [摘录颗粒度最粗的句子] | [说明此动作体现了什么底层能力] | [用 AI 行业术语重写，体现数据与结果] |

## 4. 补齐短板行动方案 (Action Plan)
> 针对最低分的维度，给出 1 个能证明其业务能力的实操项目。
- **推荐项目**：[结合用户的跨行业背景，推荐一个切中实际痛点的 AI 工作流/Agent 搭建项目]
- **考核重点**：[面试官会如何刁难这个项目，用户应该重点准备什么]

# Output Format
请严格以 JSON 格式输出，不要包含任何前言后语和 Markdown 代码块标记（如 ```json）。JSON 结构必须严格遵守以下契约，禁止随意删减或增加 Key：
{
  "overall_score": "综合匹配度总分（纯数字或百分比）",
  "overall_evaluation": "一句话定性分析（毒舌面试官口吻）",
  "dimension_scores": {
    "hard_skills": "产品基本功得分及致命 Gap（一句话描述）",
    "ai_literacy": "AI 技术理解得分及致命 Gap（一句话描述）",
    "business_sense": "场景商业感得分及致命 Gap（一句话描述）"
  },
  "diagnosis_keywords": ["优势词1", "优势词2", "致命伤词1", "致命伤词2"],
  "resume_refinements": [
    {
      "original": "简历原文",
      "ability": "跨界能力提取说明",
      "star_rewrite": "大厂 AI PM 化重写 (STAR版)"
    }
  ],
  "action_plan": {
    "project_name": "推荐的实操项目名称",
    "execution": "实现路径与重点"
  }
}
```

#### 节点 4：代码

**输入变量：** 大模型节点的输出（变量名：`raw_text`）

**代码（直接复制）：**

```javascript
async function main({ params }) {
    let text = params.raw_text;
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let parsedData = {};
    try {
        parsedData = JSON.parse(text);
    } catch (e) {
        parsedData = {
            overall_score: "0",
            overall_evaluation: "JSON解析失败",
            dimension_scores: {},
            diagnosis_keywords: ["解析失败"],
            resume_refinements: [],
            action_plan: {}
        };
    }

    let dims = parsedData.dimension_scores || {};
    let dimensionStr = `【产品基本功】${dims.hard_skills || "无"}\n【AI技术理解】${dims.ai_literacy || "无"}\n【场景商业感】${dims.business_sense || "无"}`;

    let refinementsStr = "无修改建议";
    if (Array.isArray(parsedData.resume_refinements) && parsedData.resume_refinements.length > 0) {
        refinementsStr = parsedData.resume_refinements.map((item, index) => {
            return `修改建议 ${index + 1}:\n[原句] ${item.original}\n[能力提取] ${item.ability}\n[STAR重写] ${item.star_rewrite}\n---`;
        }).join("\n");
    }

    let plan = parsedData.action_plan || {};
    let planStr = `【项目建议】${plan.project_name || "无"}\n【执行路径】${plan.execution || "无"}`;

    return {
        overall_score: String(parsedData.overall_score || "0"),
        overall_evaluation: parsedData.overall_evaluation || "未提供",
        dimension_details: dimensionStr,
        keywords: Array.isArray(parsedData.diagnosis_keywords) ? parsedData.diagnosis_keywords.join("，") : "无",
        resume_refinements: refinementsStr,
        action_plan: planStr
    };
}
```

**输出变量（均为 String 类型）：**

| 变量名 | 类型 | 说明 |
|--------|------|------|
| `overall_score` | String | 综合匹配度总分 |
| `overall_evaluation` | String | 一句话定性分析 |
| `dimension_details` | String | 维度得分详情 |
| `keywords` | String | 诊断关键词 |
| `resume_refinements` | String | 简历精修建议 |
| `action_plan` | String | 行动计划 |

#### 节点 5：结束

接受代码节点输出的 6 个变量。

---

### 1.3 创建 JobHunter_Core_Engine 主工作流

#### 工作流结构：开始 → 并联执行 → 代码 → 结束

#### 节点 1：开始

| 配置项 | 值 |
|--------|-----|
| 输入变量名 1 | `raw_jd` |
| 类型 | String |
| 输入变量名 2 | `resume_file` |
| 类型 | File |

#### 节点 2：JD_Analyzer（子工作流节点）

**输入：** 开始节点的 `raw_jd`

#### 节点 3：Resume_Match（子工作流节点）

**输入：**
- 开始节点的 `raw_jd`
- 开始节点的 `resume_file`

#### 节点 4：代码（合并输出）

**输入变量：**
- JD_Analyzer 输出：`company`, `title`, `location`, `salary`, `core_keywords`, `radar_analysis`, `action_items`
- Resume_Match 输出：`overall_score`

**代码（直接复制）：**

```python
import json
from typing import Dict

async def main(args) -> Dict[str, str]:
    inputs = args.params
    
    final_result = {
        "岗位名称": inputs.get("title", ""),
        "公司名称": inputs.get("company", ""),
        "工作地点": inputs.get("location", ""),
        "薪资待遇": inputs.get("salary", ""),
        "核心关键词": inputs.get("core_keywords", ""),
        "能力雷达图解析": inputs.get("radar_analysis", ""),
        "备考行动清单": inputs.get("action_items", ""),
        "综合匹配度": inputs.get("overall_score", "")
    }
    
    return {
        "final_json": json.dumps(final_result, ensure_ascii=False)
    }
```

**输出变量：**

| 变量名 | 类型 | 说明 |
|--------|------|------|
| `final_json` | String | 最终合并的 JSON 结果 |

#### 节点 5：结束

接受代码节点的 `final_json` 输出。

---

### 1.4 发布并获取凭证

1. 先发布两个子工作流（JD_Analyzer、Resume_Match）
2. 再发布主工作流（JobHunter_Core_Engine）
3. 在主工作流详情页获取 **Workflow ID**
4. 在个人设置中获取 **API Token**

### 1.5 创建 .env 配置文件

在项目根目录创建 `.env` 文件：

```bash
# Coze API 配置（必填）
COZE_API_TOKEN=你的API_Token
COZE_WORKFLOW_ID=JobHunter_Core_Engine的Workflow_ID

# 飞书多维表格配置（--save 时必填）
BITABLE_APP_TOKEN=你的多维表格App_Token
TABLE_ID=你的数据表ID

# 可选配置
COZE_API_BASE=https://api.coze.cn
```

### 1.6 安装依赖并编译

```bash
cd f:\Vibe_Coding\lark-jobpilot-skill
npm install
npm run build
```

---

## Step 2：创建飞书多维表格

### 2.1 创建多维表格

```bash
lark-cli base +base-create --name "求职管理表"
```

记录返回的 `app_token`。

### 2.2 获取数据表 ID

```bash
lark-cli base +table-list --base-token "<app_token>"
```

记录返回的 `table_id`。

### 2.3 创建字段

**复制以下命令，替换 `<app_token>` 和 `<table_id>` 后执行：**

```bash
# 岗位名称（文本）
lark-cli base +field-create --base-token "<app_token>" --table-id "<table_id>" --json '{"field_name":"岗位名称","type":1}'

# 公司名称（文本）
lark-cli base +field-create --base-token "<app_token>" --table-id "<table_id>" --json '{"field_name":"公司名称","type":1}'

# 工作地点（文本）
lark-cli base +field-create --base-token "<app_token>" --table-id "<table_id>" --json '{"field_name":"工作地点","type":1}'

# 薪资待遇（文本）
lark-cli base +field-create --base-token "<app_token>" --table-id "<table_id>" --json '{"field_name":"薪资待遇","type":1}'

# 投递状态（单选）
lark-cli base +field-create --base-token "<app_token>" --table-id "<table_id>" --json '{"field_name":"投递状态","type":3,"property":{"options":[{"name":"未投递","color":0},{"name":"已投递","color":1},{"name":"面试中","color":2},{"name":"已offer","color":3},{"name":"已拒绝","color":4}]}}'

# 核心关键词（文本）
lark-cli base +field-create --base-token "<app_token>" --table-id "<table_id>" --json '{"field_name":"核心关键词","type":1}'

# 能力雷达图解析（多行文本）
lark-cli base +field-create --base-token "<app_token>" --table-id "<table_id>" --json '{"field_name":"能力雷达图解析","type":1}'

# 备考行动清单（多行文本）
lark-cli base +field-create --base-token "<app_token>" --table-id "<table_id>" --json '{"field_name":"备考行动清单","type":1}'

# 综合匹配度（文本）
lark-cli base +field-create --base-token "<app_token>" --table-id "<table_id>" --json '{"field_name":"综合匹配度","type":1}'

# JD 原文（多行文本）
lark-cli base +field-create --base-token "<app_token>" --table-id "<table_id>" --json '{"field_name":"JD 原文","type":1}'
```

---

## Step 3：解析 JD 并入库

### 3.1 仅解析 JD

```bash
node dist/coze-parser.js "这里是JD文本内容..."
```

**输出示例：**

```json
{
  "success": true,
  "data": {
    "岗位名称": "AI 产品经理",
    "公司名称": "字节跳动",
    "工作地点": "北京",
    "薪资待遇": "30-50K",
    "核心关键词": "大模型，产品经理，B端，需求分析，商业化",
    "能力雷达图解析": "【产品基本功】\n需求洞察与PRD撰写能力...\n\n【AI技术理解】\nLLM边界认知与Prompt Engineering...\n\n【场景商业感】\nAI+办公场景降本增效...",
    "备考行动清单": "1. 复习Transformer架构（对应AI技术理解）\n2. 准备AI产品案例（对应场景商业化）\n3. 了解字节业务线（对应产品基本功）",
    "综合匹配度": ""
  }
}
```

### 3.2 JD 解析 + 简历匹配

```bash
node dist/coze-parser.js "JD文本内容" "./resume.txt"
```

**输出示例：**

```json
{
  "success": true,
  "data": {
    "岗位名称": "AI 产品经理",
    "公司名称": "字节跳动",
    "工作地点": "北京",
    "薪资待遇": "30-50K",
    "核心关键词": "大模型，产品经理，B端，需求分析，商业化",
    "能力雷达图解析": "【产品基本功】\n需求洞察与PRD撰写能力...\n\n【AI技术理解】\nLLM边界认知与Prompt Engineering...\n\n【场景商业感】\nAI+办公场景降本增效...",
    "备考行动清单": "1. 复习Transformer架构（对应AI技术理解）\n2. 准备AI产品案例（对应场景商业化）\n3. 了解字节业务线（对应产品基本功）",
    "综合匹配度": "65"
  }
}
```

### 3.3 解析并自动写入多维表格（--save）

**添加 `--save` 参数，自动调用 lark-cli 写入飞书多维表格：**

```bash
# 仅解析 JD 并写入
node dist/coze-parser.js "JD文本内容" --save

# JD 解析 + 简历匹配并写入
node dist/coze-parser.js "JD文本内容" "./resume.txt" --save
```

**输出示例：**

```json
{
  "success": true,
  "data": {
    "岗位名称": "AI 产品经理",
    "公司名称": "字节跳动",
    ...
  },
  "record_id": "recXXXXXX"
}
```

> **注意：** 使用 `--save` 参数前，需要先配置 `BITABLE_APP_TOKEN` 和 `TABLE_ID` 环境变量。

---

## Step 4：管理求职进度

### 4.1 查看所有记录

```bash
lark-cli base +record-list --base-token "<app_token>" --table-id "<table_id>"
```

### 4.2 更新投递状态

```bash
lark-cli base +record-upsert \
  --base-token "<app_token>" \
  --table-id "<table_id>" \
  --record-id "<record_id>" \
  --json '{"投递状态": "已投递"}'
```

---

## 字段类型对照表

| 字段名 | 字段类型 | type 值 | 写入格式 |
|--------|----------|---------|----------|
| 岗位名称 | 文本 | 1 | `"字符串"` |
| 公司名称 | 文本 | 1 | `"字符串"` |
| 工作地点 | 文本 | 1 | `"字符串"` |
| 薪资待遇 | 文本 | 1 | `"字符串"` |
| 投递状态 | 单选 | 3 | `"选项名"` |
| 核心关键词 | 文本 | 1 | `"关键词1，关键词2"` |
| 能力雷达图解析 | 文本 | 1 | `"多行文本\n换行"` |
| 备考行动清单 | 文本 | 1 | `"1. 动作1\n2. 动作2"` |
| 综合匹配度 | 文本 | 1 | `"65"` |
| JD 原文 | 文本 | 1 | `"字符串"` |

---

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `COZE_API_TOKEN` | 是 | Coze API 访问令牌 |
| `COZE_WORKFLOW_ID` | 是 | JobHunter_Core_Engine 工作流 ID |
| `BITABLE_APP_TOKEN` | --save 时必填 | 飞书多维表格 App Token |
| `TABLE_ID` | --save 时必填 | 飞书多维表格数据表 ID |
| `COZE_API_BASE` | 否 | Coze API 基地址，默认 `https://api.coze.cn` |

---

## 权限要求

| 操作 | 所需 scope | 说明 |
|------|-----------|------|
| 创建多维表格 | `bitable:app` | 创建新的多维表格 |
| 读写记录 | `bitable:app:readonly` + `bitable:app` | 读写多维表格记录 |

---

## 错误处理

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `COZE_API_TOKEN 未设置` | 环境变量缺失 | 创建 `.env` 文件并配置 |
| `COZE_WORKFLOW_ID 未设置` | 环境变量缺失 | 在 Coze 平台创建 Workflow 后配置 |
| `BITABLE_APP_TOKEN 未设置` | 环境变量缺失 | 配置多维表格 Token（使用 --save 时必填） |
| `TABLE_ID 未设置` | 环境变量缺失 | 配置数据表 ID（使用 --save 时必填） |
| `Workflow 返回数据无法解析为 JSON` | Workflow 输出格式错误 | 检查代码节点配置 |
| `缺少必填字段` | 解析结果不完整 | 检查大模型节点 Prompt |
| `简历文件不存在` | 文件路径错误 | 检查简历文件路径 |
| `final_json 无法解析` | 主工作流代码节点错误 | 检查 Python 代码 |
| `lark-cli 执行失败` | lark-cli 未安装或未登录 | 运行 `npm install -g lark-cli` 并执行 `lark-cli auth login` |

---

## 安全规则

- `COZE_API_TOKEN` 属于敏感信息，禁止在终端明文输出
- `.env` 文件应添加到 `.gitignore`，禁止提交到代码仓库
- 写入多维表格前确认用户意图
