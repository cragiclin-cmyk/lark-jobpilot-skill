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
export {};
