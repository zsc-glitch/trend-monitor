/**
 * Trend Monitor Plugin
 * 追踪关键词热度、监控竞争对手、发现行业机会
 */

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "@sinclair/typebox";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

interface MonitorConfig {
  dataDir?: string;
  refreshInterval?: number; // 分钟
}

interface Alert {
  id: string;
  keyword: string;
  title: string;
  url: string;
  source: string;
  timestamp: string;
  snippet: string;
}

interface TrendData {
  keyword: string;
  mentions: number;
  lastChecked: string;
  sources: string[];
}

// 数据目录
function getDataDir(config?: MonitorConfig): string {
  const dir = config?.dataDir || process.env.TREND_MONITOR_DIR || "~/.trend-monitor";
  return dir.replace("~", os.homedir());
}

// 确保目录存在
async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch { /* 已存在 */ }
}

// 生成 ID
function generateId(): string {
  return `alert-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// 获取文件路径
function getAlertsPath(dataDir: string): string {
  return path.join(dataDir, "alerts.json");
}

function getKeywordsPath(dataDir: string): string {
  return path.join(dataDir, "keywords.json");
}

// 读取 JSON
async function readJson<T>(filepath: string, defaultValue: T): Promise<T> {
  try {
    const content = await fs.readFile(filepath, "utf-8");
    return JSON.parse(content);
  } catch {
    return defaultValue;
  }
}

// 保存 JSON（原子写入：先写临时文件再 rename，防止崩溃损坏数据）
async function writeJson(filepath: string, data: unknown): Promise<void> {
  const tmp = filepath + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, filepath);
}

// 搜索关键词（GitHub API，支持限速重试）
async function searchKeyword(keyword: string): Promise<Alert[]> {
  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(keyword)}&sort=stars&per_page=3`;
      const response = await fetch(url, {
        headers: { "User-Agent": "trend-monitor-plugin/1.0" },
      });
      if (response.status === 403 || response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : (attempt + 1) * 3000;
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
        }
        return []; // 超过重试次数，降级到空结果
      }
      if (response.ok) {
        const data = await response.json() as { items: Array<{ full_name: string; stargazers_count: number; description: string; html_url: string }> };
        if (data.items && data.items.length > 0) {
          return data.items.map(repo => ({
            id: generateId(),
            keyword,
            title: `${repo.full_name} (⭐ ${repo.stargazers_count})`,
            url: repo.html_url,
            source: "GitHub",
            timestamp: new Date().toISOString(),
            snippet: repo.description || "无描述",
          }));
        }
      }
      break; // 其他状态码不再重试
    } catch {
      if (attempt === MAX_RETRIES) break;
    }
  }
  return [];
}

// 关键词 Schema
const KeywordSchema = Type.Object({
  keyword: Type.String(),
  sources: Type.Optional(Type.Array(Type.String())),
});

// 插件入口
export default definePluginEntry({
  id: "trend-monitor",
  name: "Trend Monitor",
  description: "追踪关键词热度、监控竞争对手、发现行业机会",

  register(api) {
    const config = api.pluginConfig as MonitorConfig | undefined;

    // 添加监控关键词
    api.registerTool({
      name: "trend_add_keyword",
      label: "添加监控关键词",
      description: "添加一个关键词到监控列表",
      parameters: Type.Object({
        keyword: Type.String(),
        sources: Type.Optional(Type.Array(Type.String())),
      }),
      async execute(toolCallId, params) {
        try {
          const dataDir = getDataDir(config);
          await ensureDir(dataDir);

          const keywords = await readJson<string[]>(getKeywordsPath(dataDir), []);

          if (keywords.includes(params.keyword)) {
            return {
              content: [{ type: "text", text: `⚠️ 「${params.keyword}」已在监控列表中` }],
              details: { exists: true },
            };
          }

          keywords.push(params.keyword);
          await writeJson(getKeywordsPath(dataDir), keywords);

          return {
            content: [
              {
                type: "text",
                text: `✅ 已添加监控关键词\n\n🔍 「${params.keyword}」\n数据目录: ${dataDir}`,
              },
            ],
            details: { keyword: params.keyword, count: keywords.length },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ 添加失败: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: true },
          };
        }
      },
    }, { optional: true });

    // 查看监控列表
    api.registerTool({
      name: "trend_list_keywords",
      label: "查看监控列表",
      description: "查看当前所有监控的关键词",
      parameters: Type.Object({}),
      async execute(toolCallId) {
        try {
          const dataDir = getDataDir(config);
          await ensureDir(dataDir);

          const keywords = await readJson<string[]>(getKeywordsPath(dataDir), []);

          if (keywords.length === 0) {
            return {
              content: [{ type: "text", text: "📋 监控列表为空\n\n使用「添加监控关键词」开始追踪" }],
              details: { count: 0 },
            };
          }

          const list = keywords.map((k, i) => `${i + 1}. ${k}`).join("\n");

          return {
            content: [
              {
                type: "text",
                text: `📋 当前监控 ${keywords.length} 个关键词\n\n${list}`,
              },
            ],
            details: { count: keywords.length, keywords },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ 获取列表失败: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: true },
          };
        }
      },
    }, { optional: true });

    // 刷新监控数据
    api.registerTool({
      name: "trend_refresh",
      label: "刷新监控数据",
      description: "对所有关键词执行搜索，收集最新动态",
      parameters: Type.Object({
        keyword: Type.Optional(Type.String()),
      }),
      async execute(toolCallId, params) {
        try {
          const dataDir = getDataDir(config);
          await ensureDir(dataDir);

          const keywords = await readJson<string[]>(getKeywordsPath(dataDir), []);
          const targetKeywords = params.keyword ? [params.keyword] : keywords;

          if (targetKeywords.length === 0) {
            return {
              content: [{ type: "text", text: "⚠️ 没有要监控的关键词" }],
              details: { count: 0 },
            };
          }

          const allAlerts: Alert[] = [];

          for (const kw of targetKeywords) {
            const alerts = await searchKeyword(kw);
            allAlerts.push(...alerts);
          }

          // 追加到历史（按 url 去重）
          const existingAlerts = await readJson<Alert[]>(getAlertsPath(dataDir), []);
          const seenUrls = new Set(existingAlerts.map(a => a.url));
          const uniqueNew = allAlerts.filter(a => !seenUrls.has(a.url));
          const newAlerts = [...uniqueNew, ...existingAlerts].slice(0, 500); // 最多保留500条
          await writeJson(getAlertsPath(dataDir), newAlerts);

          const summary = allAlerts
            .map(a => `• **${a.title}**\n  来源: ${a.source} | ${a.keyword}`)
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: `🔄 刷新完成\n\n本次获取 ${allAlerts.length} 条新动态\n\n最新动态:\n${summary || "（暂无）"}`,
              },
            ],
            details: { count: allAlerts.length, alerts: allAlerts },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ 刷新失败: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: true },
          };
        }
      },
    }, { optional: true });

    // 查看告警历史
    api.registerTool({
      name: "trend_alerts",
      label: "查看告警历史",
      description: "查看最近的趋势告警记录",
      parameters: Type.Object({
        keyword: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number()),
      }),
      async execute(toolCallId, params) {
        try {
          const dataDir = getDataDir(config);
          await ensureDir(dataDir);

          let alerts = await readJson<Alert[]>(getAlertsPath(dataDir), []);

          if (params.keyword) {
            alerts = alerts.filter(a => a.keyword.includes(params.keyword!));
          }

          alerts = alerts.slice(0, params.limit || 20);

          if (alerts.length === 0) {
            return {
              content: [{ type: "text", text: "📭 暂无告警记录\n\n先用「刷新监控数据」获取最新动态" }],
              details: { count: 0 },
            };
          }

          const list = alerts
            .map((a, i) => `${i + 1}. **${a.keyword}**: ${a.title}\n   ${a.url}`)
            .join("\n\n");

          return {
            content: [
              {
                type: "text",
                text: `📊 最近 ${alerts.length} 条告警\n\n${list}`,
              },
            ],
            details: { count: alerts.length, alerts },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ 获取告警失败: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: true },
          };
        }
      },
    }, { optional: true });

    // 删除关键词
    api.registerTool({
      name: "trend_remove_keyword",
      label: "删除监控关键词",
      description: "从监控列表中移除关键词",
      parameters: Type.Object({
        keyword: Type.String(),
      }),
      async execute(toolCallId, params) {
        try {
          const dataDir = getDataDir(config);
          await ensureDir(dataDir);

          const keywords = await readJson<string[]>(getKeywordsPath(dataDir), []);
          const filtered = keywords.filter(k => k !== params.keyword);

          if (filtered.length === keywords.length) {
            return {
              content: [{ type: "text", text: `❌ 「${params.keyword}」不在监控列表中` }],
              details: { notFound: true },
            };
          }

          await writeJson(getKeywordsPath(dataDir), filtered);

          return {
            content: [
              {
                type: "text",
                text: `✅ 已删除「${params.keyword}」\n\n剩余 ${filtered.length} 个关键词`,
              },
            ],
            details: { keyword: params.keyword, remaining: filtered.length },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ 删除失败: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: true },
          };
        }
      },
    }, { optional: true });
  },
});
