"use client";

import * as React from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  ComputerIcon,
  LockKeyIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PaperboatMark } from "@/components/dashboard/paperboat-mark";
import { normalizeUserCode } from "@/lib/auth-return";
import { ApiError } from "@/lib/api/client";
import { decideDeviceRequest, getDeviceRequest } from "@/lib/api/device-auth";
import type { DeviceRequest } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const PERMISSIONS: Record<string, string> = {
  "account:read": "Read your Paperboat account",
  "clients:revoke": "Manage authorized devices",
  "projects:read": "List your projects",
  "projects:connect": "Connect to project terminals",
  "session:refresh": "Stay signed in on this device",
};

export function DeviceAuthorization({ code }: { code: string | null }) {
  const router = useRouter();
  const [request, setRequest] = React.useState<DeviceRequest>();
  const [error, setError] = React.useState<ApiError>();
  const [loading, setLoading] = React.useState(Boolean(code));
  const [decision, setDecision] = React.useState<"approve" | "deny">();
  const [localOutcome, setLocalOutcome] = React.useState<"approve" | "deny">();
  const requestSequence = React.useRef(0);

  const load = React.useCallback(async () => {
    const sequence = ++requestSequence.current;
    setRequest(undefined);
    setError(undefined);
    setLocalOutcome(undefined);
    if (!code) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getDeviceRequest(code);
      if (requestSequence.current === sequence) setRequest(result);
    } catch (cause) {
      if (requestSequence.current === sequence) {
        setError(cause instanceof ApiError ? cause : new ApiError("internal_error", "Something went wrong.", 0));
      }
    } finally {
      if (requestSequence.current === sequence) setLoading(false);
    }
  }, [code]);

  React.useEffect(() => {
    // The request state intentionally resets when a different one-time code is loaded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function decide(nextDecision: "approve" | "deny") {
    if (!code || request?.user_code !== code || request.state !== "pending") return;
    const sequence = ++requestSequence.current;
    setDecision(nextDecision);
    setError(undefined);
    try {
      const result = await decideDeviceRequest(code, nextDecision);
      if (requestSequence.current === sequence) {
        setLocalOutcome(nextDecision);
        setRequest(result);
      }
    } catch (cause) {
      if (requestSequence.current === sequence) {
        if (cause instanceof ApiError && cause.status === 409) {
          setRequest(undefined);
          setError(cause);
          return;
        }
        if (cause instanceof ApiError && cause.status === 410) {
          setRequest(undefined);
          setDecision(undefined);
          await load();
          return;
        }
        setError(cause instanceof ApiError ? cause : new ApiError("internal_error", "Something went wrong.", 0));
      }
    } finally {
      if (requestSequence.current === sequence) setDecision(undefined);
    }
  }

  const unauthenticated = error?.status === 401;

  function submitManualCode(manualCode: string) {
    const normalized = normalizeUserCode(manualCode);
    if (normalized) router.replace(`/cli/authorize?code=${encodeURIComponent(normalized)}`);
    return Boolean(normalized);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div className="flex items-center justify-center gap-3" aria-label="Paperboat">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PaperboatMark className="size-5" />
          </span>
          <span className="font-heading text-xl font-semibold">Paperboat</span>
        </div>

        <Card>
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <HugeiconsIcon icon={ComputerIcon} />
            </div>
            <CardTitle className="font-heading text-xl font-semibold">
              Authorize Paperboat CLI
            </CardTitle>
            <CardDescription>
              Confirm that the device shown below is the one requesting access.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-6" aria-live="polite">
            {!code ? <ManualCodeForm onSubmit={submitManualCode} /> : null}
            {loading ? <LoadingState /> : null}
            {unauthenticated ? (
              <div className="flex flex-col gap-4">
                <Alert>
                  <HugeiconsIcon icon={LockKeyIcon} />
                  <AlertTitle>Sign in to continue</AlertTitle>
                  <AlertDescription>Use your Paperboat account to review this request. Payment is not required to authorize a device.</AlertDescription>
                </Alert>
                <a href={`/auth/sign-in?code=${encodeURIComponent(code ?? "")}`} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
                  Continue to sign in
                </a>
              </div>
            ) : null}
            {error && !unauthenticated ? (
              <div className="flex flex-col gap-4">
                <StateAlert
                  title={error.status === 404 ? "Request not found" : error.status === 410 ? "Request expired" : error.status === 403 ? "Wrong account" : error.status === 409 ? "Request already handled" : "Could not load request"}
                  description={error.status === 409 ? "This request was already approved or denied by another signed-in session or account. Return to your terminal and start sign-in again if needed." : error.status >= 500 || error.status === 0 ? "Paperboat could not load this request. Try again in a moment." : error.message}
                />
                {error.status >= 500 || error.status === 0 ? <Button variant="outline" onClick={load}><HugeiconsIcon icon={RefreshIcon} data-icon="inline-start" />Try again</Button> : null}
              </div>
            ) : null}
            {request ? <RequestDetails request={request} localOutcome={localOutcome} /> : null}
          </CardContent>

          {request?.state === "pending" ? (
            <CardFooter className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button variant="outline" size="lg" onClick={() => decide("deny")} disabled={Boolean(decision)}>
                Deny
              </Button>
              <Button size="lg" onClick={() => decide("approve")} disabled={Boolean(decision)}>
                Approve
              </Button>
            </CardFooter>
          ) : null}
        </Card>
        <p className="text-center text-xs text-muted-foreground">You can revoke this device later from Settings.</p>
      </div>
    </main>
  );
}

function LoadingState() {
  return <div className="flex flex-col gap-3" aria-label="Loading authorization request"><Skeleton className="h-16 w-full" /><Skeleton className="h-32 w-full" /></div>;
}

function StateAlert({ title, description }: { title: string; description: string }) {
  return <Alert><AlertTitle>{title}</AlertTitle><AlertDescription>{description}</AlertDescription></Alert>;
}

function ManualCodeForm({ onSubmit }: { onSubmit: (code: string) => boolean }) {
  const [value, setValue] = React.useState("");
  const [invalid, setInvalid] = React.useState(false);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInvalid(!onSubmit(value));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor="user-code">Authorization code</FieldLabel>
        <Input
          id="user-code"
          name="user-code"
          value={value}
          onChange={(event) => {
            setValue(event.target.value.toUpperCase());
            setInvalid(false);
          }}
          placeholder="ABCD-EFGH"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={invalid}
          aria-describedby="user-code-description"
        />
        <FieldDescription id="user-code-description">
          {invalid ? "Enter the eight-character code shown in your terminal." : "Enter the code shown by Paperboat CLI."}
        </FieldDescription>
      </Field>
      <Button type="submit" size="lg">Continue</Button>
    </form>
  );
}

function RequestDetails({
  request,
  localOutcome,
}: {
  request: DeviceRequest;
  localOutcome: "approve" | "deny" | undefined;
}) {
  if (request.state !== "pending") {
    if (request.state === "approved" && localOutcome === "approve") {
      return <Alert><HugeiconsIcon icon={CheckmarkCircle02Icon} /><AlertTitle>Device approved</AlertTitle><AlertDescription>Return to your terminal. The CLI will finish signing in shortly.</AlertDescription></Alert>;
    }
    if (request.state === "denied" && localOutcome === "deny") {
      return <StateAlert title="Request denied" description="This device was not authorized. You can close this window." />;
    }
    const content = {
      approved: ["Request already approved", "This request was approved by another signed-in session or account."],
      denied: ["Request already denied", "This request was denied by another signed-in session or account."],
      expired: ["Request expired", "Return to your terminal and start sign-in again."],
      consumed: ["Request already used", "This one-time request has already completed. You can close this window."],
    }[request.state];
    return <StateAlert title={content[0]} description={content[1]} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-medium">{request.client_label}</p>
          <p className="text-sm text-muted-foreground">{request.os} · {request.device_type}</p>
        </div>
        <Badge variant="secondary">{request.user_code}</Badge>
      </div>
      <Separator />
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">This device will be able to</p>
        <ul className="flex flex-col gap-2">
          {request.scopes.map((scope) => <li key={scope} className="flex items-center gap-2 text-sm text-muted-foreground"><HugeiconsIcon icon={CheckmarkCircle02Icon} />{PERMISSIONS[scope] ?? scope}</li>)}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">Requested {format(new Date(request.issued_at), "PPp")} · Expires {format(new Date(request.expires_at), "PPp")}</p>
    </div>
  );
}
