'use strict';

// On-demand, read-only projection. No server, credentials, telemetry cache or model calls.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const REPO = 'Sweedycat/ai-memory-app';
const MAX_AGE_MS = 120000;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const iso = value => integer(value) && value <= 8640000000000000 ? new Date(value).toISOString() : null;
const freshAt = (stamp, now) => integer(stamp) && integer(now) && stamp <= now && now - stamp <= MAX_AGE_MS;

function projectUsage(raw, observedAt, now = Date.now()) {
  const fresh = freshAt(observedAt, now);
  const result = { source: 'provided_codex_limits', observedAt: iso(observedAt), fresh,
    fiveHour: null, weekly: null, ordinaryUsageAllowed: null, safeguard: 'conservative' };
  if (!fresh || !object(raw)) return result;
  result.ordinaryUsageAllowed = typeof raw.ordinaryUsageAllowed === 'boolean' ? raw.ordinaryUsageAllowed : null;
  const bucket = raw.rateLimitsByLimitId == null ? raw.rateLimits
    : object(raw.rateLimitsByLimitId) ? raw.rateLimitsByLimitId.codex : null;
  if (object(bucket)) for (const key of ['primary', 'secondary']) {
    const w = bucket[key];
    if (!object(w) || !integer(w.usedPercent)) continue;
    const field = w.windowDurationMins === 300 ? 'fiveHour' : w.windowDurationMins === 10080 ? 'weekly' : null;
    if (!field) continue; // primary/secondary alone do not identify a window's duration.
    const reset = integer(w.resetsAt) && w.resetsAt > 0 ? iso(w.resetsAt * 1000) : null;
    const value = { remainingPercent: reset && w.resetsAt * 1000 <= now ? null : Math.max(0, 100 - w.usedPercent),
      resetsAtUTC: reset };
    // Reject ambiguous duplicate-duration windows instead of guessing a bucket.
    result[field] = result[field] === null ? value : { remainingPercent: null, resetsAtUTC: null };
  }
  const values = [result.fiveHour?.remainingPercent, result.weekly?.remainingPercent];
  const known = values.filter(value => value !== null && value !== undefined);
  const remaining = known.length ? Math.min(...known) : null;
  result.safeguard = result.ordinaryUsageAllowed === false || (remaining !== null && remaining <= 1) ? 'stop'
    : remaining !== null && remaining <= 5 ? 'checkpoint'
    : remaining !== null && remaining <= 10 ? 'small_tasks'
    : values.every(value => value != null) && result.ordinaryUsageAllowed === true ? 'normal' : 'conservative';
  return result;
}

function projectContext(event) {
  const usage = event?.tokenUsage;
  // Official last-turn counters are NOT an exact live context occupancy metric.
  return { source: 'provided_thread_token_usage', utilizationPercent: null,
    modelContextWindow: integer(usage?.modelContextWindow) && usage.modelContextWindow > 0 ? usage.modelContextWindow : null,
    lastInputTokens: integer(usage?.last?.inputTokens) ? usage.last.inputTokens : null,
    lastTotalTokens: integer(usage?.last?.totalTokens) ? usage.last.totalTokens : null };
}

function projectThread(status) {
  const known = ['notLoaded', 'idle', 'active', 'systemError'];
  return { state: known.includes(status?.type) ? status.type : 'unknown',
    waitingOnApproval: status?.type === 'active' && Array.isArray(status.activeFlags)
      ? status.activeFlags.includes('waitingOnApproval') : null };
}

function projectAgents(snapshot) {
  const items = snapshot?.agents;
  if (!Array.isArray(items) || items.length > 32) return { scope: 'current_collaboration_tree', counts: null };
  const counts = { running: 0, completed: 0, interrupted: 0, unknown: 0 };
  for (const item of items) {
    const s = item?.agent_status;
    const state = s === 'running' ? 'running' : s === 'interrupted' ? 'interrupted'
      : object(s) && Object.hasOwn(s, 'completed') ? 'completed' : 'unknown';
    counts[state]++;
  }
  return { scope: 'current_collaboration_tree_including_principal', counts };
}

function projectCI(run, head) {
  if (!/^[0-9a-f]{40}$/.test(head ?? '') || run?.head_sha !== head || run?.repository?.full_name !== REPO)
    return { state: 'unknown', reason: 'missing_or_mismatched_evidence', url: null };
  const state = ['queued', 'in_progress', 'completed', 'waiting', 'pending', 'requested'].includes(run.status) ? run.status : 'unknown';
  const conclusion = ['success', 'failure', 'cancelled', 'timed_out', 'action_required', 'neutral', 'skipped', 'stale'].includes(run.conclusion)
    && state === 'completed' ? run.conclusion : null;
  const url = typeof run.html_url === 'string' && /^https:\/\/github\.com\/Sweedycat\/ai-memory-app\/actions\/runs\/\d+$/.test(run.html_url)
    ? run.html_url : null;
  return { state, conclusion, url };
}

function collectRepository() {
  const read = args => execFileSync('git', ['--no-pager', '--no-optional-locks', '-c', 'core.fsmonitor=false', '-C', ROOT, ...args],
    { encoding: 'utf8', timeout: 5000, maxBuffer: 65536, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const remote = read(['config', '--get', 'remote.origin.url']).trim();
    if (!['https://github.com/' + REPO, 'https://github.com/' + REPO + '.git', 'git@github.com:' + REPO + '.git'].includes(remote)) throw Error('Wrong repository');
    const head = read(['rev-parse', '--verify', 'HEAD']).trim();
    if (!/^[0-9a-f]{40}$/.test(head)) throw Error('Invalid HEAD');
    const branch = read(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    return { state: 'available', branch: branch === 'development/omega-commercial-mvp' ? branch : 'outside_approved_development_branch',
      head, dirty: read(['status', '--porcelain=v1', '-z']).length > 0,
      recentCommits: read(['log', '-5', '--format=%H']).trim().split('\n').filter(s => /^[0-9a-f]{40}$/.test(s)),
      milestoneRecord: 'docs/omega/TASK-QUEUE.md' };
  } catch { return { state: 'unknown', reason: 'repository_read_failed' }; }
}

function createSnapshot(evidence = {}, now = Date.now()) {
  const repository = collectRepository();
  const nativeFresh = freshAt(evidence?.nativeObservedAt, now);
  return { generatedAt: iso(now), mode: 'on_demand_read_only', repository,
    usage: projectUsage(evidence?.usage?.data, evidence?.usage?.observedAt, now),
    nativeEvidenceFresh: nativeFresh,
    thread: projectThread(nativeFresh ? evidence?.threadStatus : null), agents: projectAgents(nativeFresh ? evidence?.agents : null),
    context: projectContext(nativeFresh ? evidence?.context : null), ci: projectCI(nativeFresh ? evidence?.ci : null, repository.head),
    android: { readiness: 'not_accepted', emulator: 'not_observed', source: 'docs/omega/APK-STATUS.md' } };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 1 && args[0] === '--telemetry-stdin')) {
    process.stdout.write('{"error":"unsupported_arguments"}\n'); process.exitCode = 2; return;
  }
  let evidence = {};
  if (args.length) {
    try {
      const chunks = []; let size = 0;
      for await (const chunk of process.stdin) {
        size += chunk.length;
        if (size > 65536) throw Error('Input limit');
        chunks.push(chunk);
      }
      evidence = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!object(evidence)) throw Error('Invalid envelope');
    } catch { process.stdout.write('{"error":"invalid_or_oversized_evidence"}\n'); process.exitCode = 2; return; }
  }
  process.stdout.write(JSON.stringify(createSnapshot(evidence), null, 2) + '\n');
}

module.exports = { projectUsage, projectContext, projectThread, projectAgents, projectCI, collectRepository, createSnapshot };
if (require.main === module) main().catch(() => { process.stdout.write('{"error":"monitor_unavailable"}\n'); process.exitCode = 2; });
