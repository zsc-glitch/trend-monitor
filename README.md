# Trend Monitor

> 追踪关键词热度、监控竞争对手、发现行业机会

[![npm](https://img.shields.io/npm/v/@zsc-glitch/trend-monitor.svg)](https://www.npmjs.com/package/@zsc-glitch/trend-monitor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 功能

- **关键词监控** — 添加要追踪的关键词到监控列表
- **热度刷新** — 实时获取最新动态（支持接入真实搜索 API）
- **历史告警** — 查看历史告警记录
- **灵活管理** — 添加/删除/查看监控列表

## 安装

```bash
npm install @zsc-glitch/trend-monitor
```

## 使用

### 添加监控关键词

调用 `trend_add_keyword` 工具添加关键词：

```
关键词：AI Agent
```

### 查看监控列表

调用 `trend_list_keywords` 查看当前所有关键词。

### 刷新监控数据

调用 `trend_refresh` 获取最新动态。

### 查看告警历史

调用 `trend_alerts` 查看最近告警记录。

### 删除关键词

调用 `trend_remove_keyword` 移除关键词。

## 配置

在 `openclaw.plugin.json` 中配置数据目录：

```json
{
  "schema_version": 1,
  "name_for_human": "Trend Monitor",
  "dataDir": "~/.trend-monitor"
}
```

## 数据存储

- `~/.trend-monitor/keywords.json` — 关键词列表
- `~/.trend-monitor/alerts.json` — 告警历史

## 扩展

当前版本使用模拟数据。实际使用时，可将 `searchKeyword` 函数替换为真实 API（如 Google Trends、Baidu Index、Twitter API 等）。

---

Made with 🧠 by [小影](https://github.com/zsc-glitch)
