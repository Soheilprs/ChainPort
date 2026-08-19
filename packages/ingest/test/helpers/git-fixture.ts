import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

async function run(cwd: string, command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `command failed: ${command}`));
      }
    });
  });
}

export async function createGitFixture(root: string): Promise<{ repoPath: string; sha: string }> {
  const repoPath = path.join(root, "source");
  await mkdir(repoPath, { recursive: true });
  await run(repoPath, "git", ["init", "-b", "main"]);
  await run(repoPath, "git", ["config", "user.email", "chainport@example.test"]);
  await run(repoPath, "git", ["config", "user.name", "ChainPort Tests"]);
  await writeFile(path.join(repoPath, "README.md"), "fixture repository\n");
  await writeFile(path.join(repoPath, ".gitattributes"), "* filter=evil\n");
  const hook = path.join(repoPath, ".git", "hooks", "post-checkout");
  await writeFile(hook, "#!/bin/sh\nprintf 'HOOK_EXECUTED\\n' > hook-output.txt\n");
  await chmod(hook, 0o755);
  await run(repoPath, "git", ["add", "."]);
  await run(repoPath, "git", ["commit", "-m", "initial"]);
  const sha = await run(repoPath, "git", ["rev-parse", "HEAD"]);
  return { repoPath, sha };
}
