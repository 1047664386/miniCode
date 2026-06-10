/**
 * Server-side agent profile loader — thin re-export of @mini/core's agent-profiles.
 *
 * The core module (@mini/core) exports the pure logic;
 * this module just provides the convenience re-export for server imports.
 */
export {
  loadAgentProfiles,
  listAgentProfileNames,
  getProfile,
  type AgentProfile,
} from '@mini/core';