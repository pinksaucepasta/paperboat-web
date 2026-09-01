"use client";

import * as React from "react";
import {
  Add01Icon,
  Cancel01Icon,
  Delete02Icon,
  RefreshIcon,
  Shield01Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import {
  isPreviewTunnelError,
  makeIdempotencyKey,
  PreviewTunnelClient,
  type DNSInstructions,
  type DomainBinding,
  type Operation,
  type PreviewDomainCreateInput,
  type PreviewLease,
} from "@/lib/api/preview-tunnel-v1";

function message(error: unknown, fallback: string): string {
  return isPreviewTunnelError(error) ? error.message : fallback;
}

function operation(value: unknown): value is Operation {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "operation";
}

const DNS_PROVIDER_OPTIONS = [
  ["generic", "Generic DNS"],
  ["cloudflare", "Cloudflare"],
  ["route53", "Amazon Route 53"],
  ["google_cloud_dns", "Google Cloud DNS"],
  ["digitalocean", "DigitalOcean"],
  ["namecheap", "Namecheap"],
] as const;

async function awaitOperation(client: PreviewTunnelClient, value: Operation): Promise<Operation> {
  const watcher = client.watchOperation(value.id, { pollIntervalMs: 500, maxPollIntervalMs: 2_000 });
  try { return await watcher.done; } finally { watcher.stop(); }
}

function Instructions({ value }: { value: DNSInstructions }): React.ReactElement {
  return <div className="space-y-3 rounded-lg border bg-muted/28 p-3"><p className="text-sm font-medium">DNS instructions</p><div className="overflow-x-auto rounded-md border bg-background"><table className="w-full text-left text-xs"><thead className="border-b text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Name</th><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Value</th><th className="px-3 py-2 font-medium">TTL</th></tr></thead><tbody>{value.records.map((record) => <tr key={`${record.name}:${record.value}`} className="border-b last:border-0"><td className="px-3 py-2 font-mono">{record.name}</td><td className="px-3 py-2">{record.type}</td><td className="px-3 py-2 font-mono">{record.value}</td><td className="px-3 py-2">{record.ttl}s</td></tr>)}</tbody></table></div><p className="text-xs text-muted-foreground">{value.note}</p><p className="text-xs text-muted-foreground">Strategy: <span className="text-foreground">{value.certificate_strategy.replaceAll("_", " ")}</span> · verification: <span className="text-foreground">{value.verification_state.replaceAll("_", " ")}</span></p></div>;
}

export function PreviewDomainPanel({ preview, client, onRefresh }: { preview: PreviewLease; client: PreviewTunnelClient; onRefresh: () => Promise<void> }): React.ReactElement {
  const [domains, setDomains] = React.useState<DomainBinding[]>([]);
  const [hostname, setHostname] = React.useState("");
  const [provider, setProvider] = React.useState("generic");
  const [strategy, setStrategy] = React.useState<PreviewDomainCreateInput["certificate_strategy"]>("managed");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const [busy, setBusy] = React.useState<string>();
  const [instructions, setInstructions] = React.useState<Record<string, DNSInstructions>>({});

  const refresh = React.useCallback(async () => {
    setLoading(true); setError(undefined);
    try { setDomains((await client.listPreviewDomains(preview.id, { limit: 64 })).items); }
    catch (loadError) { setError(message(loadError, "Preview domains are temporarily unavailable.")); }
    finally { setLoading(false); }
  }, [client, preview.id]);
  React.useEffect(() => { void refresh(); }, [refresh]);

  async function add(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); const value = hostname.trim(); if (!value) return;
    if (strategy === "on_demand_leaf" && !value.startsWith("*.")) {
      toast.error("On-demand leaf certificates require a one-label wildcard.", { description: "Use *.example.com or choose Managed certificate for an exact hostname." });
      return;
    }
    setBusy("create");
    try {
      const result = await client.createPreviewDomain(preview.id, { hostname: value, provider: provider || undefined, certificate_strategy: strategy }, { idempotencyKey: makeIdempotencyKey("preview-domain-create") });
      if (operation(result)) { const completed = await awaitOperation(client, result); if (completed.state !== "succeeded") throw new Error(completed.error?.message || "Domain creation did not complete."); }
      setHostname(""); toast.success("Preview domain requested.", { description: "The managed preview URL remains available while DNS and TLS are reconciled." }); await refresh(); await onRefresh();
    } catch (addError) { toast.error("Could not add preview domain.", { description: message(addError, "Check the hostname and retry.") }); }
    finally { setBusy(undefined); }
  }

  async function showInstructions(domain: DomainBinding): Promise<void> {
    setBusy(`instructions:${domain.id}`);
    try {
      const value = await client.getPreviewDomainInstructions(preview.id, domain.id);
      setInstructions((current) => ({ ...current, [domain.id]: value }));
    }
    catch (instructionError) { toast.error("DNS instructions are unavailable.", { description: message(instructionError, "Retry when the control plane is available.") }); }
    finally { setBusy(undefined); }
  }

  async function verify(domain: DomainBinding): Promise<void> {
    setBusy(`verify:${domain.id}`);
    try { const current = await client.getPreviewDomain(preview.id, domain.id); const result = await client.verifyPreviewDomain(preview.id, domain.id, { ifMatch: current.etag, idempotencyKey: makeIdempotencyKey("preview-domain-verify") }); if (operation(result)) { const completed = await awaitOperation(client, result); if (completed.state !== "succeeded") throw new Error(completed.error?.message || "Verification did not complete."); } toast.success("Preview domain verification requested."); await refresh(); await onRefresh(); }
    catch (verifyError) { toast.error("Could not verify preview domain.", { description: message(verifyError, "Refresh the domain and retry.") }); }
    finally { setBusy(undefined); }
  }

  async function remove(domain: DomainBinding): Promise<void> {
    setBusy(`delete:${domain.id}`);
    try { const current = await client.getPreviewDomain(preview.id, domain.id); const result = await client.deletePreviewDomain(preview.id, domain.id, { ifMatch: current.etag, idempotencyKey: makeIdempotencyKey("preview-domain-delete") }); if (operation(result)) { const completed = await awaitOperation(client, result); if (completed.state !== "succeeded") throw new Error(completed.error?.message || "Removal did not complete."); } toast.success("Preview domain removed."); await refresh(); await onRefresh(); }
    catch (removeError) { toast.error("Could not remove preview domain.", { description: message(removeError, "Refresh the domain and retry.") }); }
    finally { setBusy(undefined); }
  }

  return <Card data-testid="preview-domains-panel"><CardHeader><CardTitle className="font-heading text-base">Custom domains</CardTitle><CardDescription>Attach up to eight verified aliases to this temporary lease. The managed preview URL stays the primary identity and does not wait for custom DNS or TLS.</CardDescription></CardHeader><CardContent className="space-y-4"><form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,auto)_minmax(10rem,auto)_auto] sm:items-end" onSubmit={(event) => void add(event)}><div className="space-y-2"><label htmlFor={`preview-domain-host-${preview.id}`} className="text-sm font-medium">Hostname</label><Input id={`preview-domain-host-${preview.id}`} value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="demo.example.com or *.example.com" autoComplete="off" spellCheck={false} disabled={Boolean(busy)} /></div><div className="space-y-2"><label htmlFor={`preview-domain-provider-${preview.id}`} className="text-sm font-medium">DNS provider</label><NativeSelect id={`preview-domain-provider-${preview.id}`} value={provider} onChange={(event) => setProvider(event.target.value)} disabled={Boolean(busy)}>{DNS_PROVIDER_OPTIONS.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect></div><div className="space-y-2"><label htmlFor={`preview-domain-strategy-${preview.id}`} className="text-sm font-medium">TLS strategy</label><NativeSelect id={`preview-domain-strategy-${preview.id}`} value={strategy} onChange={(event) => setStrategy(event.target.value as PreviewDomainCreateInput["certificate_strategy"])} disabled={Boolean(busy)}><NativeSelectOption value="managed">Managed certificate</NativeSelectOption><NativeSelectOption value="on_demand_leaf" disabled={!hostname.trim().startsWith("*.")}>On-demand wildcard leaf</NativeSelectOption></NativeSelect></div><Button type="submit" disabled={Boolean(busy) || !hostname.trim()}>{busy === "create" ? <Spinner /> : <HugeiconsIcon icon={Add01Icon} />}Add domain</Button></form><p className="text-xs text-muted-foreground">Coolify users should prefer a wildcard alias and preserve the public Host header. One DNS record covers previously unknown application subdomains without another Paperboat route.</p>{error ? <Alert variant="warning"><HugeiconsIcon icon={Cancel01Icon} /><div><AlertTitle>Preview domain state unavailable</AlertTitle><AlertDescription><p>{error}</p><Button variant="outline" size="sm" onClick={() => void refresh()}>Retry</Button></AlertDescription></div></Alert> : null}{loading && domains.length === 0 ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner />Loading custom domains…</div> : domains.length === 0 ? <Empty className="py-8"><EmptyHeader><EmptyMedia variant="icon"><HugeiconsIcon icon={Shield01Icon} /></EmptyMedia><EmptyTitle>No custom aliases</EmptyTitle><EmptyDescription>The managed endpoint is ready independently. Add a custom domain when DNS is available.</EmptyDescription></EmptyHeader></Empty> : <div className="space-y-3">{domains.map((domain) => <div key={domain.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-all text-sm font-medium">{domain.hostname}</p><p className="mt-1 text-xs text-muted-foreground">{domain.match_type === "one_label_wildcard" ? "One-label wildcard" : "Exact hostname"} · g{domain.generation}</p></div><Badge variant={domain.state === "ready" ? "success" : domain.state === "conflict" || domain.state === "dns_error" || domain.state === "tls_error" ? "error" : "warning"}>{domain.state.replaceAll("_", " ")}</Badge></div><div className="mt-3 grid gap-3 text-xs sm:grid-cols-3"><div><p className="text-muted-foreground">DNS</p><p className="mt-1 break-all font-mono">{domain.dns.target}</p>{domain.dns.observed_records?.length ? <p className="mt-1 text-muted-foreground">Observed: {domain.dns.observed_records.join(", ")}</p> : null}</div><div><p className="text-muted-foreground">Certificate</p><p className="mt-1 capitalize">{domain.certificate.state.replaceAll("_", " ")}</p>{domain.certificate.expires_at ? <p className="mt-1 text-muted-foreground">Expires {new Date(domain.certificate.expires_at).toLocaleDateString()}</p> : null}</div><div><p className="text-muted-foreground">Alias lifecycle</p><p className="mt-1">{domain.state === "ready" ? "Serving" : "Managed endpoint unaffected"}</p></div></div>{domain.certificate.failure ? <Alert variant="warning" className="mt-3"><HugeiconsIcon icon={Wrench01Icon} /><div><AlertTitle>Certificate needs attention</AlertTitle><AlertDescription>Paperboat kept the last known good certificate. Check DNS and CAA records, then verify again.</AlertDescription></div></Alert> : null}{instructions[domain.id] ? <div className="mt-3"><Instructions value={instructions[domain.id]} /></div> : null}<div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void showInstructions(domain)} disabled={Boolean(busy)}>{busy === `instructions:${domain.id}` ? <Spinner /> : null}{instructions[domain.id] ? "DNS instructions shown" : "Show DNS instructions"}</Button><Button variant="outline" size="sm" onClick={() => void verify(domain)} disabled={Boolean(busy) || domain.state === "ready"}>{busy === `verify:${domain.id}` ? <Spinner /> : <HugeiconsIcon icon={RefreshIcon} />}Verify</Button><Button variant="destructive-outline" size="sm" onClick={() => void remove(domain)} disabled={Boolean(busy)}>{busy === `delete:${domain.id}` ? <Spinner /> : <HugeiconsIcon icon={Delete02Icon} />}Remove</Button></div></div>)}</div>}</CardContent><CardFooter><p className="text-xs text-muted-foreground">Stopping or expiring this preview withdraws every alias. Paperboat never deletes customer-owned DNS records.</p></CardFooter></Card>;
}
