"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  CloudServerIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/dashboard/page-header";
import { BashScriptInput } from "@/components/dashboard/bash-script-input";
import { ApiError } from "@/lib/api/client";
import {
  listCatalogIdleTimeouts,
  listCatalogMachineTypes,
  listCatalogPresets,
  listCatalogRegions,
} from "@/lib/api/catalog";
import { getUsage } from "@/lib/api/billing";
import { listGitHubRepositories } from "@/lib/api/github";
import { useProjectActions, useProjects } from "@/lib/api/use-projects";
import type {
  CatalogIdleTimeout,
  CatalogMachineType,
  CatalogPreset,
  CatalogRegion,
  GitHubRepository,
  Usage,
} from "@/lib/api/types";

interface CatalogState {
  machineTypes: CatalogMachineType[];
  presets: CatalogPreset[];
  idleTimeouts: CatalogIdleTimeout[];
  regions: CatalogRegion[];
  repositories: GitHubRepository[];
  usage?: Usage;
}

const emptyCatalog: CatalogState = {
  machineTypes: [],
  presets: [],
  idleTimeouts: [],
  regions: [],
  repositories: [],
};

export default function NewProjectPage() {
  const router = useRouter();
  const projectActions = useProjectActions();
  const { projects } = useProjects();
  const [catalog, setCatalog] = React.useState<CatalogState>(emptyCatalog);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError>();
  const [submitting, setSubmitting] = React.useState(false);
  const [presetCodes, setPresetCodes] = React.useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] =
    React.useState<GitHubRepository | null>(null);

  React.useEffect(() => {
    let active = true;
    Promise.all([
      listCatalogMachineTypes(),
      listCatalogPresets(),
      listCatalogIdleTimeouts(),
      listCatalogRegions(),
      getUsage(),
      listGitHubRepositories(),
    ])
      .then(([machineTypes, presets, idleTimeouts, regions, usage, repositories]) => {
        if (!active) return;
        setCatalog({
          machineTypes: machineTypes.filter((item) => item.active),
          presets: presets.filter((item) => item.active),
          idleTimeouts: idleTimeouts.filter((item) => item.active),
          regions: regions.filter((item) => item.enabled),
          repositories,
          usage,
        });
        setSelectedRepo(repositories[0] ?? null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof ApiError
            ? err
            : new ApiError("internal_error", "Could not load project options.", 0),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const defaultMachine = catalog.machineTypes[0]?.code ?? "";
  const defaultRegion = catalog.regions[0]?.code ?? "";
  const defaultIdleTimeout = catalog.idleTimeouts[0]?.code ?? "";
  const availableStorageGB = catalog.usage?.available_storage_gb ?? 0;
  const totalStorageGB = catalog.usage
    ? catalog.usage.included_storage_gb + catalog.usage.purchased_storage_gb
    : 0;
  const defaultStorageGB = Math.max(1, Math.min(10, availableStorageGB));
  const deletingProjects = projects.filter((project) => project.state === "deleting");
  const hasStoragePendingRelease =
    availableStorageGB < 1 && deletingProjects.length > 0;
  const blockers = [
    catalog.repositories.length === 0 ? "no GitHub repositories" : undefined,
    catalog.machineTypes.length === 0 ? "no active machine types" : undefined,
    catalog.regions.length === 0 ? "no enabled regions" : undefined,
    catalog.idleTimeouts.length === 0 ? "no active idle timeout options" : undefined,
    availableStorageGB < 1
      ? hasStoragePendingRelease
        ? "storage release in progress"
        : "no available storage"
      : undefined,
  ].filter(Boolean);
  const blockerMessage = hasStoragePendingRelease
    ? "Project creation is temporarily blocked while storage from a deleted project is being released."
    : blockers.length > 0
      ? `Project creation is blocked by ${blockers.join(", ")}.`
      : undefined;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const project = await projectActions.createProject({
        name: String(form.get("name") ?? ""),
        repository_url: selectedRepo?.clone_url ?? "",
        default_branch: String(form.get("default_branch") ?? ""),
        storage_gb: Number(form.get("storage_gb") ?? defaultStorageGB),
        machine_type_code: String(form.get("machine_type_code") ?? defaultMachine),
        region_code: String(form.get("region_code") ?? defaultRegion),
        preset_codes: presetCodes,
        idle_timeout_code: String(form.get("idle_timeout_code") ?? defaultIdleTimeout),
        setup_script: String(form.get("setup_script") ?? ""),
      });
      toast.success("Project created.");
      router.push(`/dashboard/projects/${project.id}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      toast.error("Could not create project.", { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="New project"
        description="Clone a repo onto a cloud machine and run your agents there."
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/dashboard/projects" />}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} />
            Back to projects
          </Button>
        }
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      ) : error &&
        (error.code === "github_required" ||
          error.code === "github_scope_denied") ? (
        <div className="rounded-lg border p-6">
          <FieldGroup>
            <FieldTitle>Connect GitHub</FieldTitle>
            <FieldDescription>
              Link your GitHub account so Paperboat can list and clone your
              repositories.
            </FieldDescription>
            <div>
              <Button
                nativeButton={false}
                render={<Link href="/dashboard/settings" />}
              >
                Connect GitHub
              </Button>
            </div>
          </FieldGroup>
        </div>
      ) : error ? (
        <div className="rounded-lg border p-6">
          <FieldGroup>
            <FieldTitle>Couldn&apos;t load project options</FieldTitle>
            <FieldDescription>{error.message}</FieldDescription>
          </FieldGroup>
        </div>
      ) : (
        <form className="max-w-3xl space-y-8" onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="repository_url">GitHub repository</FieldLabel>
              <Combobox
                items={catalog.repositories}
                value={selectedRepo}
                onValueChange={(repo) => setSelectedRepo(repo)}
                itemToStringLabel={(repo: GitHubRepository) => repo.full_name}
              >
                <ComboboxInput
                  id="repository_url"
                  className="w-full"
                  placeholder="Search repositories…"
                  disabled={catalog.repositories.length === 0}
                />
                <ComboboxContent>
                  <ComboboxEmpty>No matching repositories.</ComboboxEmpty>
                  <ComboboxList>
                    {(repo: GitHubRepository) => (
                      <ComboboxItem key={repo.clone_url} value={repo}>
                        <span className="truncate">{repo.full_name}</span>
                        {repo.private ? (
                          <span className="ml-auto text-xs text-muted-foreground">
                            private
                          </span>
                        ) : null}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <FieldDescription>
                Pick the repository Paperboat should clone onto the machine.
              </FieldDescription>
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="name">Project name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  placeholder={selectedRepo?.name ?? "Generated from repo"}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="default_branch">Default branch</FieldLabel>
                <Input
                  id="default_branch"
                  name="default_branch"
                  placeholder={selectedRepo?.default_branch || "main"}
                />
                <FieldDescription>
                  Leave blank to use the repository&apos;s default branch.
                </FieldDescription>
              </Field>
            </div>
          </FieldGroup>

          <FieldSet>
            <FieldTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={CloudServerIcon} className="size-4" />
              Machine
            </FieldTitle>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="machine_type_code">Type</FieldLabel>
                <NativeSelect
                  id="machine_type_code"
                  name="machine_type_code"
                  className="w-full"
                  defaultValue={defaultMachine}
                  required
                >
                  {catalog.machineTypes.map((type) => (
                    <NativeSelectOption key={type.code} value={type.code}>
                      {type.name} / {type.vcpu} vCPU / {Math.round(type.memory_mb / 1024)} GB
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="region_code">Region</FieldLabel>
                <NativeSelect
                  id="region_code"
                  name="region_code"
                  className="w-full"
                  defaultValue={defaultRegion}
                  required
                >
                  {catalog.regions.map((region) => (
                    <NativeSelectOption key={region.code} value={region.code}>
                      {region.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="storage_gb">Storage</FieldLabel>
                <Input
                  id="storage_gb"
                  name="storage_gb"
                  type="number"
                  min={1}
                  max={availableStorageGB}
                  defaultValue={defaultStorageGB}
                  required
                  disabled={availableStorageGB < 1}
                />
                <FieldDescription>
                  {availableStorageGB} GB available out of {totalStorageGB} GB total.
                  {hasStoragePendingRelease
                    ? " Storage from a deleted project is still being released."
                    : ""}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="idle_timeout_code">Idle timeout</FieldLabel>
                <NativeSelect
                  id="idle_timeout_code"
                  name="idle_timeout_code"
                  className="w-full"
                  defaultValue={defaultIdleTimeout}
                  required
                >
                  {catalog.idleTimeouts.map((timeout) => (
                    <NativeSelectOption key={timeout.code} value={timeout.code}>
                      {Math.round(timeout.duration_seconds / 60)} minutes
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          </FieldSet>

          {catalog.presets.length > 0 ? (
            <FieldSet>
              <FieldTitle>Presets</FieldTitle>
              {catalog.presets.map((preset) => (
                <Field key={preset.code} orientation="horizontal">
                  <Checkbox
                    checked={presetCodes.includes(preset.code)}
                    onCheckedChange={(checked) => {
                      setPresetCodes((current) =>
                        checked
                          ? [...current, preset.code]
                          : current.filter((code) => code !== preset.code),
                      );
                    }}
                  />
                  <div className="space-y-0.5">
                    <FieldLabel>{preset.name}</FieldLabel>
                    {preset.description ? (
                      <FieldDescription>{preset.description}</FieldDescription>
                    ) : null}
                  </div>
                </Field>
              ))}
            </FieldSet>
          ) : null}

          <Field>
            <FieldLabel htmlFor="setup_script">Bash setup script</FieldLabel>
            <BashScriptInput
              id="setup_script"
              name="setup_script"
            />
            <FieldDescription>
              Optional Bash commands to run when the machine is prepared.
            </FieldDescription>
          </Field>

          {blockerMessage ? (
            <FieldError>{blockerMessage}</FieldError>
          ) : null}

          <div className="flex justify-end gap-3 border-t pt-6">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/dashboard/projects" />}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                blockers.length > 0
              }
            >
              {submitting ? <Spinner className="size-4" /> : <HugeiconsIcon icon={PlusSignIcon} />}
              Create project
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
