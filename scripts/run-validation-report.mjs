import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const reportDir = path.join(rootDir, 'test-report');

const checks = [
  {
    name: 'Root dependency integrity',
    command: 'npm',
    args: ['ci'],
    cwd: rootDir,
  },
  {
    name: 'Backend dependency integrity',
    command: 'npm',
    args: ['ci'],
    cwd: path.join(rootDir, 'backend'),
  },
  {
    name: 'Frontend dependency integrity',
    command: 'npm',
    args: ['ci'],
    cwd: path.join(rootDir, 'frontend'),
  },
  {
    name: 'Frontend production build',
    command: 'npm',
    args: ['run', 'build'],
    cwd: path.join(rootDir, 'frontend'),
  },
];

const runCheck = (check) =>
  new Promise((resolve) => {
    const startedAt = new Date();
    const child = spawn(check.command, check.args, {
      cwd: check.cwd,
      shell: process.platform === 'win32',
      env: process.env,
    });

    let output = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });

    child.on('error', (error) => {
      const completedAt = new Date();
      resolve({
        ...check,
        status: 'failed',
        exitCode: null,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        output: error.stack ?? error.message,
      });
    });

    child.on('close', (exitCode) => {
      const completedAt = new Date();
      resolve({
        ...check,
        status: exitCode === 0 ? 'passed' : 'failed',
        exitCode,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        output: output.trim(),
      });
    });
  });

const formatDuration = (durationMs) => `${(durationMs / 1000).toFixed(1)}s`;

const formatOutput = (output) => {
  if (!output) {
    return '_No output._';
  }

  return `\`\`\`text\n${output.slice(-6000)}\n\`\`\``;
};

const results = [];

for (const check of checks) {
  console.log(`\n==> ${check.name}`);
  results.push(await runCheck(check));
}

const generatedAt = new Date().toISOString();
const passed = results.filter((result) => result.status === 'passed').length;
const failed = results.length - passed;
const overallStatus = failed === 0 ? 'passed' : 'failed';

await mkdir(reportDir, { recursive: true });

const jsonReport = {
  generatedAt,
  overallStatus,
  summary: {
    total: results.length,
    passed,
    failed,
  },
  checks: results.map(({ command, args, cwd, ...result }) => ({
    ...result,
    command: [command, ...args].join(' '),
    cwd: path.relative(rootDir, cwd) || '.',
  })),
};

const markdownReport = [
  '# Hourly Validation Test Report',
  '',
  `Generated at: ${generatedAt}`,
  `Overall status: **${overallStatus.toUpperCase()}**`,
  '',
  '## Summary',
  '',
  `- Total checks: ${results.length}`,
  `- Passed: ${passed}`,
  `- Failed: ${failed}`,
  '',
  '## Checks',
  '',
  ...jsonReport.checks.flatMap((result) => [
    `### ${result.status === 'passed' ? 'PASS' : 'FAIL'} - ${result.name}`,
    '',
    `- Command: \`${result.command}\``,
    `- Directory: \`${result.cwd}\``,
    `- Exit code: ${result.exitCode ?? 'n/a'}`,
    `- Duration: ${formatDuration(result.durationMs)}`,
    '',
    formatOutput(result.output),
    '',
  ]),
].join('\n');

await Promise.all([
  writeFile(path.join(reportDir, 'validation-report.json'), `${JSON.stringify(jsonReport, null, 2)}\n`),
  writeFile(path.join(reportDir, 'validation-report.md'), `${markdownReport}\n`),
]);

if (failed > 0) {
  process.exitCode = 1;
}
