import { createConfig, http } from "wagmi";
import { getLogs } from "viem";

export const config = createConfig({
  chains: [{ id: 8453, name: "Base" }],
  transports: {
    8453: http("https://mainnet.base.org"),
  },
});

export async function readLogs() {
  return getLogs;
}
