const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const monitor = require('../tools/omega-control-center.cjs');
const now = Date.UTC(2026, 10, 18, 12), observed = now - 1000;
const window = (duration, used = 20) => ({ windowDurationMins: duration, usedPercent: used, resetsAt: now / 1000 + 3600 });
const limits = (used = 20) => ({ ordinaryUsageAllowed: true, rateLimitsByLimitId: { codex: { primary: window(300, used), secondary: window(10080, used) } } });

test('official windows use duration, prefer codex multi-bucket and never echo account fields', () => {
  const raw = limits(); raw.accountId = 'PRIVATE-CANARY'; raw.rateLimits = { primary: window(300, 99) };
  [raw.rateLimitsByLimitId.codex.primary, raw.rateLimitsByLimitId.codex.secondary] = [window(10080, 40), window(300, 10)];
  const result = monitor.projectUsage(raw, observed, now);
  assert.equal(result.fiveHour.remainingPercent, 90); assert.equal(result.weekly.remainingPercent, 60);
  assert.equal(result.safeguard, 'normal'); assert.equal(JSON.stringify(result).includes('PRIVATE-CANARY'), false);
  assert.equal(result.fiveHour.resetsAtUTC, new Date(now + 3600000).toISOString());
});
test('missing, malformed and stale readings remain unknown rather than unused quota', () => {
  for (const raw of [null, {}, { rateLimitsByLimitId: {} }, { rateLimitsByLimitId: [] }]) {
    const result = monitor.projectUsage(raw, observed, now); assert.equal(result.fiveHour, null); assert.equal(result.safeguard, 'conservative');
  }
  for (const stamp of [undefined, null, NaN, now + 1, now - 120001]) {
    const result = monitor.projectUsage(limits(), stamp, now); assert.equal(result.fresh, false); assert.equal(result.fiveHour, null);
  }
});
test('legacy fallback does not override an available map; null values are not zero', () => {
  const raw = { ordinaryUsageAllowed: true, rateLimits: { primary: window(300), secondary: window(10080) } };
  assert.equal(monitor.projectUsage(raw, observed, now).fiveHour.remainingPercent, 80);
  raw.rateLimitsByLimitId = {}; assert.equal(monitor.projectUsage(raw, observed, now).fiveHour, null);
  for (const used of [null, undefined, -1, '20', NaN, Infinity]) {
    const invalid = limits(); invalid.rateLimitsByLimitId.codex.primary.usedPercent = used;
    assert.equal(monitor.projectUsage(invalid, observed, now).fiveHour, null);
  }
});
test('reserve thresholds and backend refusal win over reset clocks and optimistic percentages', () => {
  for (const [used, mode] of [[90, 'small_tasks'], [95, 'checkpoint'], [99, 'stop'], [110, 'stop']]) {
    const raw = limits(used); raw.rateLimitsByLimitId.codex.secondary = window(10080, 20);
    assert.equal(monitor.projectUsage(raw, observed, now).safeguard, mode);
  }
  const raw = limits(0); raw.ordinaryUsageAllowed = false;
  assert.equal(monitor.projectUsage(raw, observed, now).safeguard, 'stop');
  raw.ordinaryUsageAllowed = null; assert.equal(monitor.projectUsage(raw, observed, now).safeguard, 'conservative');
  raw.rateLimitsByLimitId.codex.primary.resetsAt = now / 1000;
  assert.equal(monitor.projectUsage(raw, observed, now).fiveHour.remainingPercent, null);
});
test('weekly emergency reserve is preserved without inventing separate cloud or local balances', () => {
  const raw = limits(20); raw.rateLimitsByLimitId.codex.secondary = window(10080, 90);
  const result = monitor.projectUsage(raw, observed, now);
  assert.equal(result.safeguard, 'weekly_reserve'); assert.equal(result.weeklyReservePercent, 10);
  assert.equal(result.scope, 'account_bucket_not_environment');
  raw.rateLimitsByLimitId.codex.secondary = window(10080, 85);
  assert.equal(monitor.projectUsage(raw, observed, now).safeguard, 'weekly_checkpoint');
  raw.ordinaryUsageAllowed = false; assert.equal(monitor.projectUsage(raw, observed, now).safeguard, 'stop');
});
test('unsupported or duplicate duration cannot invent a five-hour/weekly allowance', () => {
  const raw = limits(); raw.rateLimitsByLimitId.codex.primary = window(15);
  assert.equal(monitor.projectUsage(raw, observed, now).fiveHour, null);
  raw.rateLimitsByLimitId.codex.primary = window(10080);
  assert.equal(monitor.projectUsage(raw, observed, now).weekly.remainingPercent, null);
});
test('cumulative and last-turn token counters are never labelled exact live context utilization', () => {
  const result = monitor.projectContext({ threadId: 'PRIVATE-CANARY', tokenUsage: {
    total: { totalTokens: 999999 }, last: { inputTokens: 250, totalTokens: 300 }, modelContextWindow: 1000 } });
  assert.equal(result.utilizationPercent, null); assert.equal(result.lastTotalTokens, 300);
  assert.equal(result.modelContextWindow, 1000); assert.equal(JSON.stringify(result).includes('PRIVATE-CANARY'), false);
  assert.equal(monitor.projectContext().modelContextWindow, null);
});
test('task/agent projections expose observed states, never titles, IDs, activities or raw errors', () => {
  assert.equal(monitor.projectThread({ type: 'active', activeFlags: ['waitingOnApproval'] }).waitingOnApproval, true);
  assert.equal(monitor.projectThread({ type: 'invented', error: 'PRIVATE-CANARY' }).state, 'unknown');
  const result = monitor.projectAgents({ agents: [{ agent_status: 'running' }, { agent_status: { completed: 'PRIVATE-CANARY' } }] });
  assert.deepEqual(result.counts, { running: 1, completed: 1, interrupted: 0, unknown: 0 });
  assert.equal(JSON.stringify(result).includes('PRIVATE-CANARY'), false);
  assert.equal(monitor.projectAgents().counts, null);
  assert.equal(monitor.projectAgents({ agents: new Array(33) }).counts, null);
});
test('CI must match the exact repository and SHA, with a validated public run URL', () => {
  const head = 'a'.repeat(40), raw = { head_sha: head, repository: { full_name: 'Sweedycat/ai-memory-app' },
    status: 'completed', conclusion: 'success', html_url: 'https://github.com/Sweedycat/ai-memory-app/actions/runs/123' };
  assert.equal(monitor.projectCI(raw, head).conclusion, 'success');
  assert.equal(monitor.projectCI(raw, 'b'.repeat(40)).state, 'unknown');
  assert.equal(monitor.projectCI({ ...raw, repository: { full_name: 'other/repo' } }, head).state, 'unknown');
  assert.equal(monitor.projectCI({ ...raw, html_url: raw.html_url + '?token=PRIVATE-CANARY' }, head).url, null);
  assert.equal(monitor.projectCI({ ...raw, status: 'in_progress' }, head).conclusion, null);
});
test('default on-demand CLI reports only this repository and keeps unobserved native fields unknown', () => {
  const result = monitor.createSnapshot({}, now);
  assert.equal(result.repository.state, 'available'); assert.match(result.repository.head, /^[a-f0-9]{40}$/);
  assert.equal(result.usage.fiveHour, null); assert.equal(result.thread.state, 'unknown');
  assert.equal(result.agents.counts, null); assert.equal(result.android.readiness, 'not_accepted');
  assert.equal(result.repository.recentCommits.length <= 5, true);
});
test('old native activity evidence cannot be relabelled live by generating a fresh snapshot', () => {
  const evidence = { nativeObservedAt: now - 120001, threadStatus: { type: 'active' },
    agents: { agents: [{ agent_status: 'running' }] } };
  const stale = monitor.createSnapshot(evidence, now);
  assert.equal(stale.nativeEvidenceFresh, false); assert.equal(stale.thread.state, 'unknown'); assert.equal(stale.agents.counts, null);
  const fresh = monitor.createSnapshot({ ...evidence, nativeObservedAt: observed }, now);
  assert.equal(fresh.nativeEvidenceFresh, true); assert.equal(fresh.thread.state, 'active'); assert.equal(fresh.agents.counts.running, 1);
});
const script = path.join(__dirname, '../tools/omega-control-center.cjs');
test('CLI rejects command injection, malformed and oversized evidence without echoing input', () => {
  for (const [args, input] of [[['--command', 'PRIVATE-CANARY'], ''], [['--telemetry-stdin'], '{PRIVATE-CANARY'],
    [['--telemetry-stdin'], 'PRIVATE-CANARY'.repeat(6000)]]) {
    const r = spawnSync(process.execPath, [script, ...args], { input, encoding: 'utf8', timeout: 10000 });
    assert.equal(r.status, 2); assert.equal(r.stdout.includes('PRIVATE-CANARY'), false); assert.equal(r.stderr, '');
  }
});
test('CLI sanitizes an official input envelope and retains no private source fields in output', () => {
  const expired = limits(); expired.rateLimitsByLimitId.codex.primary.resetsAt = Math.floor(Date.now() / 1000) - 60;
  const r = spawnSync(process.execPath, [script, '--telemetry-stdin'], { encoding: 'utf8', timeout: 15000,
    input: JSON.stringify({ secret: 'PRIVATE-CANARY', usage: { data: { ...expired, accountId: 'PRIVATE-CANARY' }, observedAt: Date.now() } }) });
  assert.equal(r.status, 0); const result = JSON.parse(r.stdout);
  assert.equal(result.usage.fiveHour.remainingPercent, null); // synthetic reset is now in the past, never renewed locally
  assert.equal(r.stdout.includes('PRIVATE-CANARY'), false); assert.equal(r.stderr, '');
});
