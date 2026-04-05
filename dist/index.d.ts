/**
 * Trend Monitor Plugin
 * 追踪关键词热度、监控竞争对手、发现行业机会
 */
declare const _default: {
    id: string;
    name: string;
    description: string;
    configSchema: import("openclaw/plugin-sdk/plugin-entry").OpenClawPluginConfigSchema;
    register: NonNullable<import("openclaw/plugin-sdk/plugin-entry").OpenClawPluginDefinition["register"]>;
} & Pick<import("openclaw/plugin-sdk/plugin-entry").OpenClawPluginDefinition, "kind">;
export default _default;
//# sourceMappingURL=index.d.ts.map