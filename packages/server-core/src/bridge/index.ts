export {
  McpManager,
  McpClient,
  type McpServerConfig,
  type McpConfig,
  type McpAllowlist,
  type McpToolDef,
  DEFAULT_ALLOWLIST,
  validateServerAgainstAllowlist,
} from './mcp-client.js';
export { attachLspBridge } from './lsp-bridge.js';
export { attachTerminalBridge } from './terminal-bridge.js';
