export enum TaskStatus {
  PENDING = "pending",
  CLAIMING_VM = "claiming_vm",
  RUNNING = "running",
  TESTING = "testing",
  CREATING_PR = "creating_pr",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum GitProvider {
  GITHUB = "github",
  BITBUCKET = "bitbucket",
}

export enum TaskSource {
  SLACK = "slack",
  WEB_UI = "web_ui",
  CLI = "cli",
  API = "api",
}

export enum TaskMode {
  CODE = "code",
  REVIEW = "review",
  PEER_REVIEW = "peer_review",
}

export enum VMState {
  CREATING = "creating",
  WARMING = "warming",
  READY = "ready",
  CLAIMED = "claimed",
  RUNNING = "running",
  CLEANING = "cleaning",
  DESTROYED = "destroyed",
  ERROR = "error",
}

export enum VMBackend {
  FIRECRACKER = "firecracker",
  DOCKER = "docker",
}
