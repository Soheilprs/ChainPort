import { writeFileSync } from "node:fs";

writeFileSync("SCANNER_EXECUTED", "yes");

const config = {
  solidity: "0.8.24",
  networks: {
    base: {
      url: "https://base-mainnet.g.alchemy.com/v2/super-secret-key",
      chainId: 8453,
    },
  },
};

export default config;
