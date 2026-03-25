// @ts-nocheck — CLI tests shell out to Node; Node types are not in the Expo module tsconfig
import { execFileSync } from 'child_process';
import path from 'path';

const CLI_PATH = path.resolve(__dirname, '../../../bin/upload-symbols.js');

function runCli(args: string, env: Record<string, string> = {}): { stdout: string; stderr: string; exitCode: number } {
  const argv = args.split(/\s+/).filter(Boolean);
  try {
    const stdout = execFileSync(process.execPath, [CLI_PATH, ...argv], {
      encoding: 'utf-8',
      env: { ...process.env, ...env },
      timeout: 10000,
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.status || 1,
    };
  }
}

describe('upload-symbols CLI', () => {
  it('shows help with --help flag', () => {
    const result = runCli('--help');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('--platform');
    expect(result.stdout).toContain('--database');
    expect(result.stdout).toContain('--client-id');
    expect(result.stdout).toContain('--client-secret');
  });

  it('shows help with -h flag', () => {
    const result = runCli('-h');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage:');
  });

  it('exits with error when database is missing', () => {
    const result = runCli('upload-symbols', {
      BUGSPLAT_DATABASE: '',
      BUGSPLAT_CLIENT_ID: 'id',
      BUGSPLAT_CLIENT_SECRET: 'secret',
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('database is required');
  });

  it('exits with error when credentials are missing', () => {
    const result = runCli('upload-symbols --database test-db', {
      BUGSPLAT_CLIENT_ID: '',
      BUGSPLAT_CLIENT_SECRET: '',
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('client ID and secret are required');
  });

  it('exits with error for unknown option', () => {
    const result = runCli('--unknown-flag');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown option');
  });
});
