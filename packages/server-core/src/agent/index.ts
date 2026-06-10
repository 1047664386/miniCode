export { SubagentManager, type SubagentSpec, type SubagentRun, type SubagentManagerOpts } from './subagent-manager.js';
export { loadAgentProfiles, listAgentProfileNames, getProfile, type AgentProfile } from './agent-profile-loader.js';
export { SlashCommandRegistry, type SlashCommand } from './slash-commands.js';
export { createSystemHookBus, HookMetrics, type HookMetrics as HookMetricsType, type SystemHooksDeps, type ToolMetric } from './system-hooks.js';
export { ProfileWatcher } from './profile-watcher.js';
export { TypedEmitter, type ManagerEvents } from './subagent-types.js';
