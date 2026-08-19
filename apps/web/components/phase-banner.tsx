import { CURRENT_PHASE, CURRENT_PHASE_NAME } from "@chainport/shared";

export function PhaseBanner() {
  return (
    <p className="text-xs uppercase tracking-[0.16em] text-accent">
      Phase {CURRENT_PHASE} — {CURRENT_PHASE_NAME}
    </p>
  );
}
