"use client";

import * as React from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { CloudServerIcon, RefreshIcon } from "@hugeicons/core-free-icons";

import { ApiError } from "@/lib/api/client";
import { getUsage } from "@/lib/api/billing";
import {
  listCatalogIdleTimeouts,
  listCatalogMachineTypes,
  listCatalogPresets,
  listCatalogRegions,
} from "@/lib/api/catalog";
import { useProjectActions, useProjectBusy } from "@/lib/api/use-projects";
import type {
  CatalogIdleTimeout,
  CatalogMachineType,
  CatalogPreset,
  CatalogRegion,
  Project,
} from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { BashScriptInput } from "@/components/dashboard/bash-script-input";

type Options = {
  machines: CatalogMachineType[];
  regions: CatalogRegion[];
  presets: CatalogPreset[];
  timeouts: CatalogIdleTimeout[];
  availableStorageGB: number;
};

export function ProjectSettingsForm({ project }: { project: Project }) {
  const actions = useProjectActions();
  const busy = useProjectBusy(project.id);
  const [options, setOptions] = React.useState<Options>();
  const [error, setError] = React.useState<ApiError>();
  const [presetCodes, setPresetCodes] = React.useState(project.desired_config.preset_codes);
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    setError(undefined);
    Promise.all([
      listCatalogMachineTypes(),
      listCatalogRegions(),
      listCatalogPresets(),
      listCatalogIdleTimeouts(),
      getUsage(),
    ])
      .then(([machines, regions, presets, timeouts, usage]) => {
        if (!active) return;
        setOptions({
          machines: machines.filter((item) => item.active),
          regions: regions.filter((item) => item.enabled),
          presets: presets.filter((item) => item.active),
          timeouts: timeouts.filter((item) => item.active),
          availableStorageGB: usage.available_storage_gb,
        });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof ApiError
            ? cause
            : new ApiError("internal_error", "Could not load project options.", 0),
        );
      });
    return () => {
      active = false;
    };
  }, [nonce]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!options) return;
    const form = new FormData(event.currentTarget);
    const setupScript = String(form.get("setup_script") ?? "").trim();
    try {
      await actions.updateProject(project.id, {
        version: project.version,
        storage_gb: Number(form.get("storage_gb")),
        machine_type_code: String(form.get("machine_type_code")),
        region_code: String(form.get("region_code")),
        idle_timeout_code: String(form.get("idle_timeout_code")),
        preset_codes: presetCodes,
        ...(setupScript ? { setup_script: setupScript } : {}),
      });
      toast.success("Project configuration saved.", {
        description: "The new settings will apply on the next restart.",
      });
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "Something went wrong.";
      toast.error("Could not save project configuration.", { description: message });
    }
  }

  const cfg = project.desired_config;
  const maximumStorage = cfg.storage_gb + (options?.availableStorageGB ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-base font-semibold">
          <HugeiconsIcon icon={CloudServerIcon} className="size-4" />
          Configuration
        </CardTitle>
        <CardDescription>
          Changes are saved now and applied when this project next restarts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!options && !error ? (
          <div className="space-y-4" aria-label="Loading project configuration">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
            <p className="text-sm text-muted-foreground">{error.message}</p>
            <Button variant="outline" size="sm" onClick={() => setNonce((value) => value + 1)}>
              <HugeiconsIcon icon={RefreshIcon} />
              Try again
            </Button>
          </div>
        ) : options ? (
          <form onSubmit={submit}>
            <FieldGroup>
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="machine_type_code">Machine type</FieldLabel>
                  <NativeSelect id="machine_type_code" name="machine_type_code" className="w-full" defaultValue={cfg.machine_type_code} required>
                    {options.machines.map((machine) => (
                      <NativeSelectOption key={machine.code} value={machine.code}>
                        {machine.name} / {machine.vcpu} vCPU / {Math.round(machine.memory_mb / 1024)} GB
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="region_code">Region</FieldLabel>
                  <NativeSelect id="region_code" name="region_code" className="w-full" defaultValue={cfg.region_code} required>
                    {options.regions.map((region) => (
                      <NativeSelectOption key={region.code} value={region.code}>{region.name}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="storage_gb">Storage</FieldLabel>
                  <Input id="storage_gb" name="storage_gb" type="number" min={1} max={maximumStorage} defaultValue={cfg.storage_gb} required />
                  <FieldDescription>
                    Up to {maximumStorage} GB, including this project&apos;s current allocation.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="idle_timeout_code">Idle timeout</FieldLabel>
                  <NativeSelect id="idle_timeout_code" name="idle_timeout_code" className="w-full" defaultValue={cfg.idle_timeout_code} required>
                    {options.timeouts.map((timeout) => (
                      <NativeSelectOption key={timeout.code} value={timeout.code}>
                        {Math.round(timeout.duration_seconds / 60)} minutes
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>

              {options.presets.length > 0 ? (
                <FieldSet>
                  <FieldLabel>Presets</FieldLabel>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {options.presets.map((preset) => (
                      <Field key={preset.code} orientation="horizontal">
                        <Checkbox
                          aria-label={preset.name}
                          checked={presetCodes.includes(preset.code)}
                          onCheckedChange={(checked) =>
                            setPresetCodes((current) =>
                              checked
                                ? [...new Set([...current, preset.code])]
                                : current.filter((code) => code !== preset.code),
                            )
                          }
                        />
                        <div>
                          <FieldLabel>{preset.name}</FieldLabel>
                          {preset.description ? <FieldDescription>{preset.description}</FieldDescription> : null}
                        </div>
                      </Field>
                    ))}
                  </div>
                </FieldSet>
              ) : null}

              <Field>
                <FieldLabel htmlFor="setup_script">Replace Bash setup script</FieldLabel>
                <BashScriptInput
                  id="setup_script"
                  name="setup_script"
                  placeholder={`#!/usr/bin/env bash\nset -euo pipefail\n\n# Leave blank to keep the existing script`}
                />
                <FieldDescription>
                  Bash scripts are write-only. A non-empty value creates a new encrypted revision.
                </FieldDescription>
              </Field>

              {options.machines.length === 0 || options.regions.length === 0 || options.timeouts.length === 0 ? (
                <FieldError>The catalog does not currently contain every option needed to update this project.</FieldError>
              ) : null}

              <div className="flex justify-end border-t pt-5">
                <Button type="submit" disabled={busy || options.machines.length === 0 || options.regions.length === 0 || options.timeouts.length === 0}>
                  {busy ? <Spinner className="size-4" /> : null}
                  Save changes
                </Button>
              </div>
            </FieldGroup>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
