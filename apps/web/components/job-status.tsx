export function jobStatusLabel(status: string): string {
  switch (status) {
    case "QUEUED":
      return "Queued";
    case "INGESTING":
      return "Cloning repository";
    case "COMPLETED":
      return "Repository ready";
    case "FAILED":
      return "Failed";
    default:
      return status;
  }
}

export function jobStatusTone(
  status: string,
): "default" | "accent" | "pass" | "blocker" | "warning" {
  switch (status) {
    case "COMPLETED":
      return "pass";
    case "FAILED":
      return "blocker";
    case "INGESTING":
      return "accent";
    case "QUEUED":
      return "warning";
    default:
      return "default";
  }
}
