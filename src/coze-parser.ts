/**
 * Parse_JD Skill — JD 智能解析 + 简历匹配模块
 *
 * 功能：
 *   1. 调用 JobHunter_Core_Engine 工作流解析 JD
 *   2. 调用 lark-cli 写入飞书多维表格
 * 输出：JSON 字符串（stdout）
 *
 * 环境变量（可通过 .env 文件配置）：
 *   COZE_API_TOKEN      — Coze API 访问令牌（必填）
 *   COZE_WORKFLOW_ID    — JobHunter_Core_Engine 工作流 ID（必填）
 *   BITABLE_APP_TOKEN   — 飞书多维表格 App Token（--save 时必填）
 *   TABLE_ID            — 飞书多维表格数据表 ID（--save 时必填）
 *   COZE_API_BASE       — Coze API 基地址（可选，默认 https://api.coze.cn）
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";

config({ path: resolve(process.cwd(), ".env") });

// ============================================================
// 类型定义
// ============================================================

/** Coze Workflow 运行请求体 */
interface CozeWorkflowRequest {
  workflow_id: string;
  parameters: Record<string, string>;
}

/** Coze Workflow 同步运行响应 */
interface CozeWorkflowResponse {
  code: number;
  msg: string;
  data: string;
  debug_url?: string;
}

/** JobHunter_Core_Engine 工作流输出结果 */
interface JobHunterOutput {
  岗位名称: string;
  公司名称: string;
  工作地点: string;
  薪资待遇: string;
  核心关键词: string;
  能力雷达图解析: string;
  备考行动清单: string;
  综合匹配度: string;
}

/** Skill 最终输出格式 */
interface SkillOutput {
  success: boolean;
  data?: JobHunterOutput;
  raw_text?: string;
  record_id?: string;
  error?: string;
  debug_url?: string;
}

// ============================================================
// 核心逻辑
// ============================================================

/**
 * 调用 JobHunter_Core_Engine 工作流
 */
async function runJobHunter(jdText: string, resumeFilePath?: string): Promise<SkillOutput> {
  const apiToken = process.env.COZE_API_TOKEN;
  const workflowId = process.env.COZE_WORKFLOW_ID;
  const apiBase = process.env.COZE_API_BASE || "https://api.coze.cn";

  if (!apiToken) {
    return {
      success: false,
      error: "环境变量 COZE_API_TOKEN 未设置。\n请创建 .env 文件并配置：COZE_API_TOKEN=your_token_here",
    };
  }

  if (!workflowId) {
    return {
      success: false,
      error: "环境变量 COZE_WORKFLOW_ID 未设置。\n请在 Coze 平台创建 Workflow 后，将 Workflow ID 配置到 .env 文件：COZE_WORKFLOW_ID=your_workflow_id",
    };
  }

  const parameters: Record<string, string> = {
    raw_jd: jdText,
  };

  if (resumeFilePath) {
    if (!existsSync(resumeFilePath)) {
      return {
        success: false,
        error: `简历文件不存在: ${resumeFilePath}`,
      };
    }

    try {
      const resumeContent = readFileSync(resumeFilePath, "utf-8");
      parameters.resume_file = resumeContent;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `读取简历文件失败: ${message}` };
    }
  }

  const url = `${apiBase}/v1/workflow/run`;

  const body: CozeWorkflowRequest = {
    workflow_id: workflowId,
    parameters,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `Coze API HTTP 错误: ${response.status} ${response.statusText}\n${text}`,
      };
    }

    const result = (await response.json()) as CozeWorkflowResponse;

    if (result.code !== 0) {
      return {
        success: false,
        error: `Coze Workflow 执行失败: code=${result.code}, msg=${result.msg}`,
        debug_url: result.debug_url,
      };
    }

    let parsed: { final_json?: string };
    try {
      parsed = JSON.parse(result.data);
    } catch {
      return {
        success: false,
        error: `Workflow 返回数据无法解析为 JSON:\n${result.data}`,
        debug_url: result.debug_url,
      };
    }

    if (!parsed.final_json) {
      return {
        success: false,
        error: "Workflow 返回数据缺少 final_json 字段",
        debug_url: result.debug_url,
      };
    }

    let finalResult: JobHunterOutput;
    try {
      finalResult = JSON.parse(parsed.final_json) as JobHunterOutput;
    } catch {
      return {
        success: false,
        error: `final_json 无法解析为 JSON:\n${parsed.final_json}`,
        debug_url: result.debug_url,
      };
    }

    const requiredFields = [
      "岗位名称",
      "公司名称",
      "工作地点",
      "薪资待遇",
      "核心关键词",
      "能力雷达图解析",
      "备考行动清单",
      "综合匹配度",
    ];

    for (const field of requiredFields) {
      if (!(field in finalResult)) {
        return { success: false, error: `缺少必填字段: ${field}` };
      }
    }

    return {
      success: true,
      data: finalResult,
      raw_text: jdText,
      debug_url: result.debug_url,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `网络或未知错误: ${message}` };
  }
}

/**
 * 调用 lark-cli 写入飞书多维表格
 */
function saveToBitable(data: JobHunterOutput, rawJd: string): SkillOutput {
  const appToken = process.env.BITABLE_APP_TOKEN;
  const tableId = process.env.TABLE_ID;

  if (!appToken) {
    return {
      success: false,
      error: "环境变量 BITABLE_APP_TOKEN 未设置。\n请在 .env 文件中配置：BITABLE_APP_TOKEN=your_app_token",
    };
  }

  if (!tableId) {
    return {
      success: false,
      error: "环境变量 TABLE_ID 未设置。\n请在 .env 文件中配置：TABLE_ID=your_table_id",
    };
  }

  const recordData = {
    岗位名称: data.岗位名称,
    公司名称: data.公司名称,
    工作地点: data.工作地点,
    薪资待遇: data.薪资待遇,
    投递状态: "未投递",
    核心关键词: data.核心关键词,
    能力雷达图解析: data.能力雷达图解析,
    备考行动清单: data.备考行动清单,
    综合匹配度: data.综合匹配度,
    "JD 原文": rawJd,
  };

  const jsonStr = JSON.stringify(recordData).replace(/"/g, '\\"');

  const cmd = `lark-cli base +record-upsert --base-token "${appToken}" --table-id "${tableId}" --json "${jsonStr}"`;

  try {
    const result = execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    
    let recordId = "";
    try {
      const parsed = JSON.parse(result);
      recordId = parsed.data?.record?.record_id || "";
    } catch {
      // 忽略解析错误
    }

    return {
      success: true,
      data,
      raw_text: rawJd,
      record_id: recordId,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `lark-cli 执行失败: ${message}\n请确保已安装 lark-cli 并完成登录认证。`,
    };
  }
}

// ============================================================
// CLI 入口
// ============================================================

function printUsage(): void {
  console.log(JSON.stringify({
    success: false,
    error: `Parse_JD Skill 用法：

1. 仅解析 JD：
   node dist/coze-parser.js "JD文本内容"

2. JD 解析 + 简历匹配：
   node dist/coze-parser.js "JD文本内容" "简历文件路径"

3. 解析并保存到飞书多维表格：
   node dist/coze-parser.js "JD文本内容" --save
   node dist/coze-parser.js "JD文本内容" "简历文件路径" --save

示例：
   node dist/coze-parser.js "岗位职责：负责大模型产品..."
   node dist/coze-parser.js "岗位职责..." "./resume.txt" --save

环境变量：
   COZE_API_TOKEN      — Coze API Token（必填）
   COZE_WORKFLOW_ID    — 工作流 ID（必填）
   BITABLE_APP_TOKEN   — 多维表格 Token（--save 时必填）
   TABLE_ID            — 数据表 ID（--save 时必填）`,
  }, null, 2));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    printUsage();
    process.exit(1);
  }

  const shouldSave = args.includes("--save");
  const filteredArgs = args.filter((arg) => arg !== "--save");

  const jdText = filteredArgs[0];
  const resumeFilePath = filteredArgs.length > 1 ? filteredArgs[1] : undefined;

  const result = await runJobHunter(jdText, resumeFilePath);

  if (!result.success) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  if (shouldSave && result.data) {
    const saveResult = saveToBitable(result.data, jdText);
    console.log(JSON.stringify(saveResult, null, 2));
    
    if (!saveResult.success) {
      process.exit(1);
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

main();
