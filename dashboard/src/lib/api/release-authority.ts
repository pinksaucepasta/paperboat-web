import { pbFetch } from "./client";
import type { ReleaseAuthorityBundle, ReleaseAuthorityRequest } from "./types";

export function listReleaseAuthorityRequests(): Promise<{ requests: ReleaseAuthorityRequest[] }> { return pbFetch("/v1/admin/release-authority/requests"); }
export function listReleaseAuthorityBundles(): Promise<{ bundles: ReleaseAuthorityBundle[] }> { return pbFetch("/v1/admin/release-authority/bundles"); }
export function createReleaseAuthorityRequest(input: Omit<ReleaseAuthorityRequest, "id" | "status" | "created_at" | "fulfilled_at">): Promise<ReleaseAuthorityRequest> { return pbFetch("/v1/admin/release-authority/requests", { method: "POST", body: input }); }
export function importReleaseAuthorityBundle(bundle: string): Promise<ReleaseAuthorityBundle> { return pbFetch("/v1/admin/release-authority/bundles", { method: "POST", body: JSON.parse(bundle) }); }
