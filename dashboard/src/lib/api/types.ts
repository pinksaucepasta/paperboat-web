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

export type ReleaseAuthorityAction = "promote" | "pause" | "quarantine" | "revoke";
export interface ReleaseAuthorityRequest {
  id: string; action: ReleaseAuthorityAction; release_id: string; version: string;
  platform: "darwin" | "linux" | "windows"; architecture: "amd64" | "arm64";
  policy_revision: number; rollout_percentage: number; status: "pending" | "fulfilled" | "cancelled";
  created_at: string; fulfilled_at?: string;
}
export interface ReleaseAuthorityBundle extends ReleaseAuthorityRequest {
  tuf_index_target: string; tuf_index_sha256: string; issued_at: string; expires_at: string;
}

export interface Machine {
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
  setup_roles: Array<"interactive" | "host">;
  setup_mode: "receive" | "session" | "host";
  capabilities: MachineCapabilities;
  machine_kind: "personal" | "hosted";
  public_identity_key: string;
  installation_generation: number;
  enrolled_at?: string;
  last_seen_at?: string;
	availability: AvailabilityPolicy;
}

export interface MachineCapabilityAvailability {
  configured: boolean;
  observed: boolean;
}

export interface MachineCapabilities {
  file_receive: MachineCapabilityAvailability;
  preview_launch: MachineCapabilityAvailability;
  terminal_host: MachineCapabilityAvailability;
  codex_host: MachineCapabilityAvailability;
  session_host: MachineCapabilityAvailability;
  keep_awake: MachineCapabilityAvailability;
}

export type AvailabilityMode = "allow_sleep" | "keep_awake";
export type AvailabilityStatus = "applied" | "pending" | "offline" | "unsupported" | "error";

export interface AvailabilityPolicy {
	schema: "paperboat.availability-policy/v1";
	desired_mode: AvailabilityMode;
	desired_version: number;
	observed_mode?: AvailabilityMode;
	observed_version: number;
	observed_at?: string;
	status: AvailabilityStatus;
	error_code?: string;
	host_service_version?: string;
	host_service_scope?: "system";
	update_rollbacks: number;
}

export interface MachineListResponse { items: Machine[] }

export type MachineUpdateState = "not_reporting" | "idle" | "checking" | "downloading" | "staged" | "activating" | "deferred" | "healthy" | "failed" | "rolled_back";

export interface UpdateObservation {
  schema: "paperboat.update-observation/v1";
  state: Exclude<MachineUpdateState, "not_reporting">;
  current_version: string;
  target_version?: string;
  channel: string;
  operation_id: string;
  installation_generation: number;
  worker_generation: number;
  rollback_count: number;
  error_code?: string;
  observed_at: string;
}

export interface FleetUpdateMachine {
  machine_id: string;
  display_name: string;
  online: boolean;
  state: MachineUpdateState;
  observation?: UpdateObservation;
}

export interface FleetUpdateSummary {
  items: FleetUpdateMachine[];
  counts: Partial<Record<MachineUpdateState, number>>;
}

export interface MaintenanceApproval {
  schema: "paperboat.maintenance-approval/v1";
  id: string;
  machine_id: string;
  action: "update" | "restart" | "migration";
  target_version: string;
  reason?: string;
  status: "pending" | "approved" | "rejected" | "expired" | "consumed";
  expires_at: string;
  decided_at?: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Preview {
  id: string;
  environment_id: string;
  project_id?: string;
  resource_id?: string;
  user_id?: string;
  logical_name: string;
  preview_key: string;
  url: string;
  target_port: number;
  state: string;
  environment_name: string;
  environment_kind: "hosted" | "byod" | string;
  owner_email: string;
  expires_at?: string;
  source_kind: "application" | "file" | "directory";
  owner_mode: "runtime" | "foreground" | "detached";
}

export interface MachineOverview {
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

export type MachineEnrollmentState =
  | "awaiting_bootstrap"
  | "awaiting_approval"
  | "approved"
  | "material_issued"
  | "installing"
  | "connecting"
  | "ready"
  | "cancelled"
  | "expired"
  | "denied"
  | "failed_retryable"
  | "revoked"
  | "disconnected"
  | "deleted";

export interface MachineEnrollment {
  id: string;
  operation_id: string;
  state: MachineEnrollmentState;
  generation: number;
  pairing_id?: string;
  user_code?: string;
  machine_id?: string;
  requested_display_name?: string;
  platform?: string;
  architecture?: string;
  workspace_root?: string;
  expires_at: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MachineEnrollmentStart extends MachineEnrollment {
  bootstrap_token: string;
  bootstrap_command: string;
  token_download_path: string;
  server_url: string;
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
  issuer: string;
  account: {
    id: string;
    email: string;
    display_name: string;
  };
}

export interface CLIClientSession {
  cli_client_session_id: string;
  client_id: "paperboat";
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

export interface CLIClientSessionList {
  items: CLIClientSession[];
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
  | "disabled"
  | "consent_required"
  | "restoring"
  | "watching"
  | "pending"
  | "syncing"
  | "healthy"
  | "warning"
  | "conflict"
  | "error"
  | "offline"
  | "revoked"
  | "sync_uncertain";

export interface ConfigSyncPathSummary {
  path: string;
  bytes?: number;
  reason: string;
  revision?: string;
}

export interface ConfigSyncEnvironmentStatus {
  machine_id: string;
  environment_id: string;
  display_name: string;
  profile: "hosted" | "byod";
  environment_state: string;
  state: ConfigSyncState;
  assignment_id?: string;
  assignment_version?: number;
  repository_id?: string;
  repository_name?: string;
	mode?: "pull_only" | "push_only" | "bidirectional";
  consent_state?: "not_required" | "pending" | "accepted" | "stale" | "revoked";
  warning_revision?: string;
  helper_id?: string;
  helper_generation?: number;
  last_attempt_at?: string;
  last_successful_sync_at?: string;
  updated_at?: string;
  remote_revision?: string;
  manifest_health?: "healthy" | "empty" | "missing" | "invalid";
  manifest_revision?: string;
  managed_path_count: number;
  pending_clean_path_count: number;
  last_applied_revision?: string;
  last_published_revision?: string;
  skipped: ConfigSyncPathSummary[];
  conflicts: ConfigSyncPathSummary[];
  error_code?: string;
  recovery_actions: string[];
  policy_revision?: string;
  sync_revision?: number;
}

export interface ConfigSyncStatus {
  policy: { mode: "disabled" | "read_only" | "leased_writes"; byod_enabled: boolean; revision: string; max_file_bytes: number; max_batch_bytes: number; format: string; manifest_contract: string; manifest_max_bytes: number; manifest_max_lines: number; manifest_max_pattern_bytes: number };
  state: ConfigSyncState;
  environments: ConfigSyncEnvironmentStatus[];
}

export interface ConfigRepository {
  id: string;
  provider: "github";
  external_ref: string;
  display_name: string;
  state: "active" | "disconnected" | "inaccessible" | "quarantined";
}

export interface ConfigAssignment {
  id: string;
  machine_id: string;
  environment_id: string;
  repository_id?: string;
	mode: "pull_only" | "push_only" | "bidirectional";
  consent_state: "not_required" | "pending" | "accepted" | "stale" | "revoked";
  warning_revision?: string;
  version: number;
}

export interface ConfigWarningFacts {
  revision: string;
  machine_name: string;
  repository_name: string;
  canonical_scope: string;
	mode: "pull_only" | "push_only" | "bidirectional";
	manifest_scope: string;
	repository_visibility: string;
	history_retention: string;
  conflict_behavior: string;
	force_behavior: string;
  disable_action: string;
  offline_behavior: string;
	access_consequence: string;
}

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

export interface CatalogRegion {
  code: string;
  name: string;
  enabled: boolean;
  version: number;
}
