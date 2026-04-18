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
export {};
