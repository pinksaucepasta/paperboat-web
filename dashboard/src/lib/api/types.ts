/**
 * TypeScript mirrors of paperboat-server JSON payloads. Field names match the
 * server's snake_case contract (internal/auth, internal/billing, internal/github,
 * internal/projects). Keep in lockstep with the frozen HTTP contract.
 */

export interface Me {
  id: string;
  email: string;
  display_name: string;
  status: string;
  role: string;
  workos_subject: string;
}

export interface ConnectedMachine {
  id: string;
  environment_id: string;
  display_name: string;
  platform: string;
  architecture: string;
  workspace_root: string;
  state: "offline" | "online" | "disconnected" | "revoked" | "deleted" | "pending";
  seat_state: "reserved" | "occupied" | "released";
  online: boolean;
  runtime_versions: Record<string, string>;
  enrolled_at?: string;
  last_seen_at?: string;
}

export interface ConnectedMachineListResponse { items: ConnectedMachine[] }

export interface ConnectedMachineOverview {
  entitlement_state: string;
  product_code?: string;
  period_start?: string;
  period_end?: string;
  seat_quantity: number;
  occupied_seats: number;
  available_seats: number;
  included_bytes: number;
  consumed_included_bytes: number;
  consumed_topup_bytes: number;
  paid_topup_remaining_bytes: number;
  bootstrap_command?: string;
}

export type DeviceRequestState =
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "consumed";

export interface DeviceRequest {
  user_code: string;
  client_label: string;
  device_type: "desktop" | "server" | "container";
  os: string;
  scopes: string[];
  issued_at: string;
  expires_at: string;
  state: DeviceRequestState;
}

export interface AuthorizedClient {
  client_session_id: string;
  client_id: "paperboat-cli";
  client_label: string;
  device_type: "desktop" | "server" | "container";
  os: string;
  scopes: string[];
  state: "active" | "revoked";
  created_at: string;
  approved_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  current: boolean;
}

export interface AuthorizedClientList {
  items: AuthorizedClient[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    next_offset: number | null;
  };
}

export interface Entitlement {
  state: string;
  plan_code?: string;
  plan_name?: string;
  current_period_start?: string;
  current_period_end?: string;
  active: boolean;
  trial_eligible: boolean;
}

export interface Usage {
  credits_balance: string;
  included_storage_gb: number;
  purchased_storage_gb: number;
  allocated_storage_gb: number;
  available_storage_gb: number;
}

export interface StorageSubscription {
  current_gb: number;
  pending_gb?: number;
  unit_gb: number;
}

export interface StorageChangePreview {
  current_gb: number;
  requested_gb: number;
  effective: "immediate" | "next_period";
  estimated_charge_minor: number;
  next_renewal_total_minor: number;
  currency: string;
}

export interface AutoTopupPolicy {
  enabled: boolean;
  threshold: string;
  bundle_credits: string;
  last_attempt_state?: string;
  last_attempt_at?: string;
  last_error?: string;
}

export interface BillingPlanProduct {
  code: string;
  plan_code: string;
  plan_name: string;
  included_credits: string;
  included_storage_gb: number;
  metadata: Record<string, unknown> | null;
}

export interface GitHubStatus {
  connected: boolean;
  scopes: string[];
  missing_scopes: string[];
  last_validated_at?: string;
  config_repo_provisioned: boolean;
  config_repo_owner?: string;
  config_repo_name?: string;
  config_repo_branch?: string;
}

export interface GitHubRepository {
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  clone_url: string;
  html_url: string;
  private: boolean;
}

/** Project lifecycle states, from the HTTP contract "Project State Enums". */
export type ProjectState =
  | "creating"
  | "provisioning_storage"
  | "provisioning_machine"
  | "ready"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "restarting"
  | "deleting"
  | "deleted"
  | "failed"
  | "suspended";

export interface ProjectRepo {
  provider: string;
  source_url: string;
  default_branch: string;
}

export interface ProjectConfig {
  storage_gb: number;
  machine_type_code: string;
  region_code: string;
  preset_codes: string[];
  idle_timeout_code: string;
  setup_script_ref?: string;
  config_hash: string;
}

export interface Project {
  id: string;
  version: number;
  name: string;
  state: ProjectState;
  repository: ProjectRepo;
  current_config: ProjectConfig;
  desired_config: ProjectConfig;
  pending_restart_apply: boolean;
  restart_required: boolean;
  setup_script_revisions: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  items: Project[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    next_offset: number | null;
  };
  filters: {
    state: string;
  };
  sort: string;
}

export interface ProjectEvent {
  id: string;
  type: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type ConfigSyncState =
  | "restoring"
  | "watching"
  | "pending"
  | "syncing"
  | "healthy"
  | "warning"
  | "conflict"
  | "error"
  | "offline"
  | "idle";

export interface ConfigSyncPathSummary {
  path: string;
  bytes?: number;
  reason: string;
}

export interface ConfigSyncMachineStatus {
  project_id: string;
  project_name: string;
  project_state: ProjectState;
  machine_id: string;
  state: ConfigSyncState;
  last_result_state?: ConfigSyncState;
  last_attempt_at?: string;
  last_successful_sync_at?: string;
  remote_commit?: string;
  pending_path_count: number;
  classifier_pending?: ConfigSyncPathSummary[];
  skipped: ConfigSyncPathSummary[];
  conflicts: ConfigSyncPathSummary[];
  error_code?: string;
  error_message?: string;
  heartbeat_at?: string;
  status_updated_at?: string;
  max_file_bytes: number;
  max_batch_bytes: number;
  policy_revision: string;
  classifier_policy_revision?: string;
  classifier_model_revision?: string;
  classifier_health?: "healthy" | "degraded" | "unavailable" | "disabled";
  encryption_key_version?: number;
}

export interface ConfigSyncStatus {
  repository: { owner: string; name: string; branch: string; web_url: string };
  policy: { revision: string; max_file_bytes: number; max_batch_bytes: number; format: string; mandatory_exclusions: string[] };
  state: ConfigSyncState;
  projects: ConfigSyncMachineStatus[];
}

export type ConfigClassificationDecision = "portable" | "project_only" | "exclude";
export interface ConfigClassificationOverride { path: string; decision: ConfigClassificationDecision; mandatory: boolean; updated_at: string }
export interface ConfigRecoveryKey { identity: string; recipient: string; key_version: number }

export interface CheckoutSession {
  url: string;
}

export interface CatalogPlan {
  code: string;
  name: string;
  active: boolean;
  included_credits: string;
  included_storage_gb: number;
  metadata: Record<string, unknown> | null;
  version: number;
}

export interface CatalogMachineType {
  code: string;
  name: string;
  vcpu: number;
  memory_mb: number;
  credit_weight: string;
  custom_shape_allowed: boolean;
  active: boolean;
  version: number;
}

export interface CatalogPreset {
  code: string;
  name: string;
  description: string;
  active: boolean;
  version: number;
}

export interface CatalogIdleTimeout {
  code: string;
  duration_seconds: number;
  active: boolean;
  version: number;
}

export interface CatalogRegion {
  code: string;
  name: string;
  enabled: boolean;
  version: number;
}
