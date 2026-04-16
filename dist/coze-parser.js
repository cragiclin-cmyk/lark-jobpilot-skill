/**
 * Parse_JD Skill — JD 智能解析 + 简历匹配模块
 *
 * 功能：调用 JobHunter_Core_Engine 工作流，一次性完成 JD 解析和简历匹配
 * 输出：JSON 字符串（stdout），供 lark-cli Skill 后续编排使用。
 *
 * 环境变量（可通过 .env 文件配置）：
 *   COZE_API_TOKEN      — Coze API 访问令牌（必填）
 *   COZE_WORKFLOW_ID    — JobHunter_Core_Engine 工作流 ID（必填）
 *   COZE_API_BASE       — Coze API 基地址（可选，默认 https://api.coze.cn）
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";
config({ path: resolve(process.cwd(), ".env") });
// ============================================================
// 核心逻辑
// ============================================================
/**
 * 调用 JobHunter_Core_Engine 工作流
 */
async function runJobHunter(jdText, resumeFilePath) {
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
    const parameters = {
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, error: `读取简历文件失败: ${message}` };
        }
    }
    const url = `${apiBase}/v1/workflow/run`;
    const body = {
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
        const result = (await response.json());
        if (result.code !== 0) {
            return {
                success: false,
                error: `Coze Workflow 执行失败: code=${result.code}, msg=${result.msg}`,
                debug_url: result.debug_url,
            };
        }
        let parsed;
        try {
            parsed = JSON.parse(result.data);
        }
        catch {
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
        let finalResult;
        try {
            finalResult = JSON.parse(parsed.final_json);
        }
        catch {
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: `网络或未知错误: ${message}` };
    }
}
// ============================================================
// CLI 入口
// ============================================================
function printUsage() {
    console.log(JSON.stringify({
        success: false,
        error: `Parse_JD Skill 用法：

1. 仅解析 JD：
   node dist/coze-parser.js "JD文本内容"

2. JD 解析 + 简历匹配：
   node dist/coze-parser.js "JD文本内容" "简历文件路径"

示例：
   node dist/coze-parser.js "岗位职责：负责大模型产品..."
   node dist/coze-parser.js "岗位职责..." "./resume.txt"`,
    }, null, 2));
}
async function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        printUsage();
        process.exit(1);
    }
    const jdText = args[0];
    const resumeFilePath = args.length > 1 ? args[1] : undefined;
    const result = await runJobHunter(jdText, resumeFilePath);
    console.log(JSON.stringify(result, null, 2));
    if (!result.success) {
        process.exit(1);
    }
}
main();
