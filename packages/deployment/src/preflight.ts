export interface ParsedPreflight {
  transactionCount: number | null;
  estimatedGas: bigint | null;
  estimatedCost: string | null;
  warnings: string[];
}

const GAS_USED = /Estimated total gas used for script:\s*([\d_]+)/i;
const AMOUNT = /Estimated amount required:\s*([0-9.]+)\s*ETH/i;
const SIM_COMPLETE = /SIMULATION COMPLETE|Script ran successfully/i;
const CREATE_TX = /^\s*(CREATE|CREATE2)\b/gim;

export function parseForgePreflight(output: string): ParsedPreflight {
  const warnings: string[] = [];
  const gasMatch = GAS_USED.exec(output);
  const costMatch = AMOUNT.exec(output);
  const creates = output.match(CREATE_TX)?.length ?? 0;
  const gasRaw = gasMatch?.[1];
  const estimatedGas = gasRaw === undefined ? null : BigInt(gasRaw.replaceAll("_", ""));
  let transactionCount: number | null = creates > 0 ? creates : null;
  if (transactionCount === null && (SIM_COMPLETE.test(output) || estimatedGas !== null)) {
    transactionCount = 1;
    warnings.push("forge did not emit a transaction count; defaulting to 1");
  }
  if (!SIM_COMPLETE.test(output) && estimatedGas === null) {
    warnings.push("forge did not emit a recognizable simulation summary");
  }
  return {
    transactionCount,
    estimatedGas,
    estimatedCost: costMatch?.[1] ?? null,
    warnings,
  };
}
