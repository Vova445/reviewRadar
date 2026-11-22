import { AsyncLocalStorage } from "node:async_hooks";

const requestIds = new AsyncLocalStorage<string>();

export function withRequestId<T>(requestId: string, callback: () => T): T {
  return requestIds.run(requestId, callback);
}

export function currentRequestId() {
  return requestIds.getStore() ?? crypto.randomUUID();
}
