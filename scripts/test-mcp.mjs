import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const serverPath = resolve(root, 'dist/mcp.js');
const live = process.argv.includes('--live');
const expectedTools = new Set([
  'search_homes',
  'get_home',
  'get_home_calendar',
  'get_recommendations',
  'list_my_homes',
  'list_favorites',
  'add_favorite',
  'remove_favorite',
  'list_saved_searches',
  'list_conversations',
  'get_conversation',
  'send_message',
  'get_exchange_request',
  'get_messages',
  'pre_approve_exchange',
  'archive_conversation',
  'start_conversation',
  'get_user_profile',
  'get_user_achievements',
  'get_user_ratings',
]);

if (!existsSync(serverPath)) {
  throw new Error('Missing dist/mcp.js. Run npm run build first.');
}
if (live && !existsSync(resolve(root, 'session.json'))) {
  throw new Error('A local session.json is required for the --live check. Run npm run login first.');
}

const server = spawn(process.execPath, [serverPath], {
  cwd: root,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let nextId = 1;
let buffer = '';
const pending = new Map();
let stderr = '';

function stop(exitCode) {
  server.kill();
  process.exitCode = exitCode;
}

function request(method, params) {
  const id = nextId++;
  const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params });
  server.stdin.write(`${payload}\n`);
  return new Promise((resolveRequest, rejectRequest) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      rejectRequest(new Error(`Timed out waiting for ${method}.`));
    }, 10_000);
    pending.set(id, { resolve: resolveRequest, reject: rejectRequest, timeout });
  });
}

server.stdout.setEncoding('utf8');
server.stdout.on('data', (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      stopWithError('The server returned an invalid MCP message.');
      return;
    }
    const waiting = pending.get(message.id);
    if (!waiting) continue;
    clearTimeout(waiting.timeout);
    pending.delete(message.id);
    if (message.error) {
      waiting.reject(new Error(`MCP request failed: ${message.error.message ?? 'unknown error'}`));
    } else {
      waiting.resolve(message.result);
    }
  }
});

server.stderr.setEncoding('utf8');
server.stderr.on('data', (chunk) => {
  stderr += chunk;
});

server.on('error', (error) => stopWithError(`Could not start the MCP server: ${error.message}`));
server.on('exit', (code) => {
  if (code !== null && pending.size > 0) {
    stopWithError(`The MCP server exited unexpectedly.${stderr ? ' Check its local configuration.' : ''}`);
  }
});

function stopWithError(message) {
  for (const waiting of pending.values()) {
    clearTimeout(waiting.timeout);
    waiting.reject(new Error(message));
  }
  pending.clear();
  server.kill();
  console.error(`MCP smoke test failed: ${message}`);
  process.exitCode = 1;
}

try {
  await request('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'homeexchange-local-smoke-test', version: '1.0.0' },
  });
  server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);

  const tools = await request('tools/list', {});
  const names = new Set((tools.tools ?? []).map((tool) => tool.name));
  const missing = [...expectedTools].filter((name) => !names.has(name));
  if (missing.length > 0 || names.size !== expectedTools.size) {
    throw new Error('The server tool list does not match the expected local MCP interface.');
  }

  if (live) {
    const result = await request('tools/call', { name: 'list_my_homes', arguments: {} });
    if (result.isError) throw new Error('The read-only account check was rejected.');
    console.log('Local MCP protocol check and read-only account check passed.');
  } else {
    console.log('Local MCP protocol check passed. All 20 tools are available.');
  }
  stop(0);
} catch (error) {
  stopWithError(error instanceof Error ? error.message : String(error));
}
