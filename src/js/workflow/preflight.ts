import { nodeRegistry } from './nodes/registry';
import type { SerializedWorkflow } from './types';
import { WORKFLOW_VERSION } from './types';

export interface PreflightIssue {
  level: 'error' | 'warning';
  message: string;
}

const PASSWORD_KEYS = /password|passwd|secret|privatekey|private_key|p12|pfx/i;

export function migrateWorkflow(data: SerializedWorkflow): SerializedWorkflow {
  const version = data.version ?? 1;
  if (version === WORKFLOW_VERSION) return data;
  return { ...data, version: WORKFLOW_VERSION };
}

export function summarizeWorkflow(data: SerializedWorkflow): string {
  const labels = data.nodes.map((node) => nodeRegistry[node.type]?.label || node.type);
  return labels.join(' → ');
}

export function preflightWorkflow(data: SerializedWorkflow): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.connections)) {
    return [{ level: 'error', message: 'Workflow file is not a valid Sumi recipe.' }];
  }
  if (data.version !== WORKFLOW_VERSION) {
    issues.push({
      level: 'warning',
      message: `Recipe version ${data.version} will be migrated to ${WORKFLOW_VERSION}. Review settings before running.`,
    });
  }

  const ids = new Set(data.nodes.map((node) => node.id));
  if (ids.size !== data.nodes.length) {
    issues.push({ level: 'error', message: 'Duplicate node ids in this recipe.' });
  }

  let hasInput = false;
  let hasOutput = false;
  for (const node of data.nodes) {
    const meta = nodeRegistry[node.type];
    if (!meta) {
      issues.push({ level: 'error', message: `Unknown step type: ${node.type}` });
      continue;
    }
    if (meta.category === 'Input') hasInput = true;
    if (meta.category === 'Output') hasOutput = true;
    for (const [key, value] of Object.entries(node.controls || {})) {
      if (PASSWORD_KEYS.test(key) && value) {
        issues.push({
          level: 'error',
          message: 'Passwords and private keys must not be stored in workflow JSON.',
        });
      }
    }
  }

  if (!hasInput) issues.push({ level: 'error', message: 'Add at least one input step.' });
  if (!hasOutput) issues.push({ level: 'error', message: 'Add at least one output/download step.' });

  for (const conn of data.connections) {
    if (!ids.has(conn.source) || !ids.has(conn.target)) {
      issues.push({ level: 'error', message: 'A connection points at a missing step.' });
    }
  }

  const json = JSON.stringify(data);
  if (json.includes('%PDF') || json.includes('-----BEGIN')) {
    issues.push({
      level: 'error',
      message: 'Recipe appears to contain document or key material. Export was blocked.',
    });
  }

  return issues;
}

export function preflightErrors(data: SerializedWorkflow): string[] {
  return preflightWorkflow(data)
    .filter((issue) => issue.level === 'error')
    .map((issue) => issue.message);
}
