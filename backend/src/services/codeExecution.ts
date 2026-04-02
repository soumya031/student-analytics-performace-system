import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

export interface ExecutionResult {
  output: string;
  stderr: string;
  timedOut?: boolean;
  timeMs?: number;
  memoryKb?: number;
}

export interface CodeTestCase {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
}

interface LocalLanguageConfig {
  image: string;
  sourceFile: string;
  command: string;
}

const LOCAL_LANGUAGE_CONFIG: Record<string, LocalLanguageConfig> = {
  python: {
    image: 'python:3.12-alpine',
    sourceFile: 'main.py',
    command: 'python3 main.py < stdin.txt',
  },
  javascript: {
    image: 'node:20-alpine',
    sourceFile: 'main.js',
    command: 'node main.js < stdin.txt',
  },
  c: {
    image: 'gcc:13.2.0',
    sourceFile: 'main.c',
    command: 'gcc -O2 -std=c11 main.c -o program && ./program < stdin.txt',
  },
  'c++': {
    image: 'gcc:13.2.0',
    sourceFile: 'main.cpp',
    command: 'g++ -O2 -std=c++17 main.cpp -o program && ./program < stdin.txt',
  },
  java: {
    image: 'eclipse-temurin:21-jdk',
    sourceFile: 'Main.java',
    command: 'javac Main.java && java Main < stdin.txt',
  },
};

function normalizeLanguage(language: string) {
  const value = (language || '').trim().toLowerCase();
  switch (value) {
    case 'python3':
      return 'python';
    case 'cpp':
      return 'c++';
    case 'node':
      return 'javascript';
    default:
      return value;
  }
}

function mapLanguageToJudge0Id(lang: string): number {
  switch (normalizeLanguage(lang)) {
    case 'python':
      return 71;
    case 'java':
      return 62;
    case 'c++':
      return 54;
    case 'c':
      return 50;
    case 'javascript':
      return 63;
    default:
      return 71;
  }
}

function getExecutionProvider() {
  return (process.env.CODE_EXECUTION_PROVIDER || 'auto').trim().toLowerCase();
}

function getExecutionLimits() {
  const timeoutMs = Number(process.env.CODE_EXECUTION_TIMEOUT_MS || 10000);
  const memoryMb = Number(process.env.CODE_EXECUTION_MEMORY_MB || 256);
  const cpus = process.env.CODE_EXECUTION_CPUS || '1.0';

  return {
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 10000,
    memoryMb: Number.isFinite(memoryMb) && memoryMb > 0 ? memoryMb : 256,
    cpus,
  };
}

async function ensureDockerAvailable() {
  await runProcess('docker', ['version', '--format', '{{.Server.Version}}'], {
    timeoutMs: 10000,
  });
}

async function runProcess(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeoutMs?: number;
    stdin?: string;
  } = {}
) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: 'pipe',
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const finish = (error?: Error, result?: { stdout: string; stderr: string }) => {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (error) reject(error);
      else resolve(result || { stdout, stderr });
    };

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      finish(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        finish(undefined, { stdout, stderr });
        return;
      }

      finish(new Error(stderr.trim() || stdout.trim() || `${command} exited with code ${code}`));
    });

    if (typeof options.stdin === 'string') {
      child.stdin.write(options.stdin);
    }
    child.stdin.end();

    if (options.timeoutMs) {
      timeoutHandle = setTimeout(() => {
        child.kill('SIGKILL');
        finish(new Error('__EXECUTION_TIMEOUT__'));
      }, options.timeoutMs);
    }
  });
}

async function removeContainer(containerName: string) {
  try {
    await runProcess('docker', ['rm', '-f', containerName], { timeoutMs: 10000 });
  } catch (_error) {
    return;
  }
}

async function executeLocally(code: string, language: string, stdin: string) {
  const normalizedLanguage = normalizeLanguage(language);
  const config = LOCAL_LANGUAGE_CONFIG[normalizedLanguage];

  if (!config) {
    return {
      output: '',
      stderr: `Unsupported language for local execution: ${language}`,
    };
  }

  await ensureDockerAvailable();

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'local-code-runner-'));
  const containerName = `local-code-runner-${crypto.randomUUID()}`;
  const { timeoutMs, memoryMb, cpus } = getExecutionLimits();

  try {
    await fs.writeFile(path.join(tempDir, config.sourceFile), code, 'utf8');
    await fs.writeFile(path.join(tempDir, 'stdin.txt'), stdin || '', 'utf8');

    const args = [
      'run',
      '--rm',
      '--name',
      containerName,
      '--network',
      'none',
      '--memory',
      `${memoryMb}m`,
      '--cpus',
      cpus,
      '--pids-limit',
      '128',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--mount',
      `type=bind,source=${tempDir},target=/workspace`,
      '--workdir',
      '/workspace',
      config.image,
      'sh',
      '-lc',
      config.command,
    ];

    try {
      const startedAt = process.hrtime.bigint();
      const { stdout, stderr } = await runProcess('docker', args, { timeoutMs });
      const finishedAt = process.hrtime.bigint();
      const elapsedMs = Number(finishedAt - startedAt) / 1_000_000;

      return {
        output: stdout,
        stderr,
        timeMs: Number.isFinite(elapsedMs) ? Math.round(elapsedMs) : undefined,
      };
    } catch (error: any) {
      if (error.message === '__EXECUTION_TIMEOUT__') {
        await removeContainer(containerName);
        return {
          output: '',
          stderr: `Execution timed out after ${timeoutMs}ms`,
          timedOut: true,
          timeMs: timeoutMs,
        };
      }

      return { output: '', stderr: error.message || 'Local execution failed' };
    }
  } finally {
    await removeContainer(containerName);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function executeWithJudge0(code: string, language: string, stdin: string) {
  if (!process.env.JUDGE0_URL) {
    return {
      output: '',
      stderr: 'Judge0 is not configured',
    };
  }

  try {
    const response = await axios.post(
      process.env.JUDGE0_URL,
      {
        source_code: code,
        language_id: mapLanguageToJudge0Id(language),
        stdin: stdin ?? '',
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const data = response.data;

    if (data.status?.id !== 3) {
      return {
        output: '',
        stderr: (data.stderr || data.compile_output || data.status?.description || '').toString(),
        timeMs: Number.isFinite(Number(data.time)) ? Math.round(Number(data.time) * 1000) : undefined,
        memoryKb: Number.isFinite(Number(data.memory)) ? Number(data.memory) : undefined,
      };
    }

    return {
      output: data.stdout?.toString() || '',
      stderr: '',
      timeMs: Number.isFinite(Number(data.time)) ? Math.round(Number(data.time) * 1000) : undefined,
      memoryKb: Number.isFinite(Number(data.memory)) ? Number(data.memory) : undefined,
    };
  } catch (error: any) {
    return { output: '', stderr: error.message || 'Judge0 execution failed' };
  }
}

export async function executeCode(code: string, language: string, stdin: string): Promise<ExecutionResult> {
  const provider = getExecutionProvider();

  if (provider === 'local') {
    return executeLocally(code, language, stdin);
  }

  if (provider === 'judge0') {
    return executeWithJudge0(code, language, stdin);
  }

  try {
    return await executeLocally(code, language, stdin);
  } catch (localError: any) {
    if (!process.env.JUDGE0_URL) {
      return {
        output: '',
        stderr: localError.message || 'Local execution is unavailable',
      };
    }

    const fallback = await executeWithJudge0(code, language, stdin);
    if (!fallback.stderr) {
      return fallback;
    }

    return {
      ...fallback,
      stderr: `${fallback.stderr}\n\nLocal execution fallback reason: ${localError.message || 'unknown error'}`.trim(),
    };
  }
}

export async function runCodeAgainstTestCases(
  code: string,
  language: string,
  testCases: CodeTestCase[]
) {
  let passedCount = 0;
  const outputs: Array<{
    input: string;
    output: string;
    expectedOutput: string;
    passed: boolean;
    stderr?: string;
    executionTimeMs?: number;
    memoryKb?: number;
  }> = [];
  let totalExecutionTimeMs = 0;
  let executionSamples = 0;
  let maxMemoryKb = 0;

  for (const testCase of testCases) {
    const result = await executeCode(code, language, testCase.input);
    const actual = (result.output || '').trim();
    const expected = (testCase.expectedOutput || '').trim();
    const passed = !result.stderr && actual === expected;

    if (passed) passedCount++;

    outputs.push({
      input: testCase.input,
      output: actual,
      expectedOutput: expected,
      passed,
      ...(result.stderr ? { stderr: result.stderr } : {}),
      ...(typeof result.timeMs === 'number' ? { executionTimeMs: result.timeMs } : {}),
      ...(typeof result.memoryKb === 'number' ? { memoryKb: result.memoryKb } : {}),
    });

    if (typeof result.timeMs === 'number' && Number.isFinite(result.timeMs)) {
      totalExecutionTimeMs += result.timeMs;
      executionSamples += 1;
    }

    if (typeof result.memoryKb === 'number' && Number.isFinite(result.memoryKb)) {
      maxMemoryKb = Math.max(maxMemoryKb, result.memoryKb);
    }
  }

  return {
    passedCount,
    totalCount: testCases.length,
    outputs,
    averageExecutionTimeMs: executionSamples ? Math.round(totalExecutionTimeMs / executionSamples) : undefined,
    maxMemoryKb: maxMemoryKb > 0 ? maxMemoryKb : undefined,
  };
}
