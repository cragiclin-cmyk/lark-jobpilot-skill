/**
 * lark-jobpilot-skill — JD 智能解析 + 简历匹配模块
 *
 * 功能：
 *   1. 调用 JobHunter_Core_Engine 工作流解析 JD
 *   2. 调用 lark-cli 写入飞书多维表格
 * 输出：JSON 字符串（stdout）
 *
 * 配置方式：
 *   方式一（推荐）：创建 ~/.jobpilot/config.json 文件
 *   方式二：设置环境变量 COZE_API_TOKEN 和 COZE_WORKFLOW_ID
 */
import { resolve } from "path";
import { homedir } from "os";
import { readFileSync, existsSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { execSync } from "child_process";
// ============================================================
// 配置管理
// ============================================================
const CONFIG_DIR = resolve(homedir(), ".jobpilot");
const CONFIG_FILE = resolve(CONFIG_DIR, "config.json");
function loadConfig() {
    const config = {};
    if (existsSync(CONFIG_FILE)) {
        try {
            const content = readFileSync(CONFIG_FILE, "utf-8");
            const fileConfig = JSON.parse(content);
            Object.assign(config, fileConfig);
        }
        catch {
            // 忽略解析错误
        }
    }
    if (process.env.COZE_API_TOKEN) {
        config.coze_api_token = process.env.COZE_API_TOKEN;
    }
    if (process.env.COZE_WORKFLOW_ID) {
        config.coze_workflow_id = process.env.COZE_WORKFLOW_ID;
    }
    if (process.env.COZE_API_BASE) {
        config.coze_api_base = process.env.COZE_API_BASE;
    }
    return config;
}
function ensureConfigDir() {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }
}
function createConfigTemplate() {
    ensureConfigDir();
    const template = {
        coze_api_token: "你的Coze_API_Token",
        coze_workflow_id: "你的Workflow_ID",
        coze_api_base: "https://api.coze.cn"
    };
    writeFileSync(CONFIG_FILE, JSON.stringify(template, null, 2));
    console.log(JSON.stringify({
        success: true,
        message: `已创建配置文件模板: ${CONFIG_FILE}\n请编辑该文件，填入你的 Coze API Token 和 Workflow ID`
    }, null, 2));
}
// ============================================================
// 核心逻辑
// ============================================================
async function runJobHunter(jdText, resumeFilePath) {
    const config = loadConfig();
    const apiToken = config.coze_api_token;
    const workflowId = config.coze_workflow_id;
    const apiBase = config.coze_api_base || "https://api.coze.cn";
    if (!apiToken) {
        return {
            success: false,
            error: `Coze API Token 未配置。\n\n请执行以下步骤：\n1. 运行: node dist/coze-parser.js --init\n2. 编辑配置文件: ${CONFIG_FILE}\n3. 填入你的 Coze API Token 和 Workflow ID`,
        };
    }
    if (!workflowId) {
        return {
            success: false,
            error: `Coze Workflow ID 未配置。\n\n请在配置文件 ${CONFIG_FILE} 中填入 Workflow ID`,
        };
    }
    const parameters = {
        raw_jd: jdText,
        resume_file: "",
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
function saveToBitable(data, rawJd, baseToken, tableId) {
    const recordData = {
        岗位名称: data.岗位名称,
        公司名称: data.公司名称,
        工作地点: data.工作地点,
        薪资待遇: data.薪资待遇,
        核心关键词: data.核心关键词,
        能力雷达图解析: data.能力雷达图解析,
        备考行动清单: data.备考行动清单,
        综合匹配度: data.综合匹配度,
        "JD 原文": rawJd,
    };
    const tempFile = resolve(process.cwd(), ".temp_record.json");
    writeFileSync(tempFile, JSON.stringify(recordData, null, 2));
    const cmd = `lark-cli base +record-upsert --base-token "${baseToken}" --table-id "${tableId}" --json "@.temp_record.json"`;
    try {
        const result = execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
        try {
            unlinkSync(tempFile);
        }
        catch {
            // 忽略删除错误
        }
        let recordId = "";
        try {
            const parsed = JSON.parse(result);
            recordId = parsed.data?.record?.record_id || "";
        }
        catch {
            // 忽略解析错误
        }
        return {
            success: true,
            data,
            raw_text: rawJd,
            record_id: recordId,
            base_url: `https://feishu.cn/base/${baseToken}`,
        };
    }
    catch (err) {
        try {
            unlinkSync(tempFile);
        }
        catch {
            // 忽略删除错误
        }
        const message = err instanceof Error ? err.message : String(err);
        return {
            success: false,
            error: `lark-cli 执行失败: ${message}\n请确保已安装 lark-cli 并完成登录认证。\n安装: npm install -g @larksuite/cli\n登录: lark-cli auth login`,
        };
    }
}
function createBitable() {
    try {
        const result = execSync('lark-cli base +base-create --name "求职管理表"', {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"]
        });
        const parsed = JSON.parse(result);
        const appToken = parsed.data?.base?.base_token;
        if (!appToken) {
            return { success: false, error: "创建多维表格失败：未返回 base_token" };
        }
        const tableListResult = execSync(`lark-cli base +table-list --base-token "${appToken}"`, {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"]
        });
        const tableListParsed = JSON.parse(tableListResult);
        const tableId = tableListParsed.data?.items?.[0]?.table_id;
        if (!tableId) {
            return { success: false, error: "获取数据表ID失败" };
        }
        const fields = [
            { field_name: "岗位名称", type: "text" },
            { field_name: "公司名称", type: "text" },
            { field_name: "工作地点", type: "text" },
            { field_name: "薪资待遇", type: "text" },
            { field_name: "核心关键词", type: "text" },
            { field_name: "能力雷达图解析", type: "text" },
            { field_name: "备考行动清单", type: "text" },
            { field_name: "综合匹配度", type: "text" },
            { field_name: "JD 原文", type: "text" },
        ];
        for (const field of fields) {
            const fieldFile = resolve(process.cwd(), ".temp_field.json");
            writeFileSync(fieldFile, JSON.stringify(field, null, 2));
            try {
                execSync(`lark-cli base +field-create --base-token "${appToken}" --table-id "${tableId}" --json "@.temp_field.json"`, {
                    encoding: "utf-8",
                    stdio: ["pipe", "pipe", "pipe"]
                });
            }
            catch {
                // 忽略字段创建错误
            }
            try {
                unlinkSync(fieldFile);
            }
            catch {
                // 忽略删除错误
            }
        }
        return { success: true, app_token: appToken, table_id: tableId };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: `创建多维表格失败: ${message}` };
    }
}
// ============================================================
// CLI 入口
// ============================================================
function printUsage() {
    console.log(JSON.stringify({
        success: false,
        error: `JobPilot 用法：

【初始化配置】
  node dist/coze-parser.js --init
  创建配置文件模板，然后编辑填入你的 Coze API Token 和 Workflow ID

【解析 JD】
  node dist/coze-parser.js "JD文本内容"

【JD 解析 + 简历匹配】
  node dist/coze-parser.js "JD文本内容" "简历文件路径"

【保存到飞书多维表格】
  # 自动创建多维表格（推荐）
  node dist/coze-parser.js "JD文本内容" --save --create-base
  
  # 指定已有的多维表格
  node dist/coze-parser.js "JD文本内容" --save --base-token <Token> --table-id <TableID>

【示例】
  node dist/coze-parser.js "岗位职责：负责大模型产品..."
  node dist/coze-parser.js "岗位职责..." "./resume.txt"
  node dist/coze-parser.js "岗位职责..." --save --create-base

【配置文件位置】
  ${CONFIG_FILE}`,
    }, null, 2));
}
async function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        printUsage();
        process.exit(1);
    }
    if (args[0] === "--init") {
        createConfigTemplate();
        return;
    }
    const shouldSave = args.includes("--save");
    const shouldCreateBase = args.includes("--create-base");
    const filteredArgs = args.filter((arg) => !["--save", "--create-base"].includes(arg));
    let baseToken = "";
    let tableId = "";
    const baseTokenIndex = filteredArgs.indexOf("--base-token");
    if (baseTokenIndex !== -1 && filteredArgs[baseTokenIndex + 1]) {
        baseToken = filteredArgs[baseTokenIndex + 1];
        filteredArgs.splice(baseTokenIndex, 2);
    }
    const tableIdIndex = filteredArgs.indexOf("--table-id");
    if (tableIdIndex !== -1 && filteredArgs[tableIdIndex + 1]) {
        tableId = filteredArgs[tableIdIndex + 1];
        filteredArgs.splice(tableIdIndex, 2);
    }
    const jdText = filteredArgs[0];
    const resumeFilePath = filteredArgs.length > 1 ? filteredArgs[1] : undefined;
    if (!jdText) {
        printUsage();
        process.exit(1);
    }
    const result = await runJobHunter(jdText, resumeFilePath);
    if (!result.success) {
        console.log(JSON.stringify(result, null, 2));
        process.exit(1);
    }
    if (shouldSave && result.data) {
        if (!baseToken && shouldCreateBase) {
            console.log(JSON.stringify({ success: true, message: "正在创建飞书多维表格..." }, null, 2));
            const createResult = createBitable();
            if (!createResult.success) {
                console.log(JSON.stringify(createResult, null, 2));
                process.exit(1);
            }
            baseToken = createResult.app_token;
            tableId = createResult.table_id;
            console.log(JSON.stringify({
                success: true,
                message: `多维表格创建成功`,
                app_token: baseToken,
                table_id: tableId,
                url: `https://feishu.cn/base/${baseToken}`
            }, null, 2));
        }
        if (!baseToken || !tableId) {
            console.log(JSON.stringify({
                success: false,
                error: `请指定多维表格 Token 和数据表 ID，或使用 --create-base 自动创建\n\n用法：\n  node dist/coze-parser.js "JD内容" --save --base-token <Token> --table-id <TableID>\n  node dist/coze-parser.js "JD内容" --save --create-base`
            }, null, 2));
            process.exit(1);
        }
        const saveResult = saveToBitable(result.data, jdText, baseToken, tableId);
        console.log(JSON.stringify(saveResult, null, 2));
        if (!saveResult.success) {
            process.exit(1);
        }
    }
    else {
        console.log(JSON.stringify(result, null, 2));
    }
}
main();
