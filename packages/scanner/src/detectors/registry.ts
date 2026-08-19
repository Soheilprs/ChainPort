import type { Detector } from "../types.js";

import { addressesDetector } from "./addresses.js";
import { chainIdDetector } from "./chain-id.js";
import { envDetector } from "./env.js";
import { frameworkDetector } from "./framework.js";
import { frontendDetector } from "./frontend.js";
import { packagesDetector } from "./packages.js";
import { protocolsDetector } from "./protocols.js";
import { rpcDetector } from "./rpc.js";
import { solidityDetector } from "./solidity.js";

export const DETECTORS: readonly Detector[] = [
  frameworkDetector,
  packagesDetector,
  frontendDetector,
  solidityDetector,
  chainIdDetector,
  addressesDetector,
  protocolsDetector,
  rpcDetector,
  envDetector,
];
