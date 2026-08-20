import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export interface DeploymentCredentialHandle {
  address: `0x${string}`;
  usePrivateKey<T>(fn: (key: `0x${string}`) => Promise<T>): Promise<T>;
  peekPrivateKey(): `0x${string}`;
  destroy(): void;
}

export interface DeploymentCredentialProvider {
  issue(): DeploymentCredentialHandle;
}

const live = new Map<string, DeploymentCredentialHandle>();

export class InMemoryDisposableCredentialProvider implements DeploymentCredentialProvider {
  public issue(): DeploymentCredentialHandle {
    let key: `0x${string}` | undefined = generatePrivateKey();
    const account = privateKeyToAccount(key);
    let destroyed = false;
    const handle: DeploymentCredentialHandle = {
      address: account.address,
      async usePrivateKey(fn) {
        if (destroyed || key === undefined) {
          throw new Error("disposable credential has been destroyed");
        }
        return fn(key);
      },
      peekPrivateKey() {
        if (destroyed || key === undefined) {
          throw new Error("disposable credential has been destroyed");
        }
        return key;
      },
      destroy() {
        destroyed = true;
        key = undefined;
      },
    };
    return handle;
  }
}

export function storeCredential(deploymentId: string, handle: DeploymentCredentialHandle): void {
  destroyCredential(deploymentId);
  live.set(deploymentId, handle);
}

export function getCredential(deploymentId: string): DeploymentCredentialHandle | undefined {
  return live.get(deploymentId);
}

export function destroyCredential(deploymentId: string): void {
  const existing = live.get(deploymentId);
  existing?.destroy();
  live.delete(deploymentId);
}
