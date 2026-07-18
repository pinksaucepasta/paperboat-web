import { HugeiconsIcon } from "@hugeicons/react";
import { TerminalIcon } from "@hugeicons/core-free-icons";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const BASH_PLACEHOLDER = `#!/usr/bin/env bash
set -euo pipefail

# Install or configure project tools here`;

export function BashScriptInput({
  className,
  placeholder = BASH_PLACEHOLDER,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <div className="overflow-hidden rounded-md border border-input bg-input/20 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 dark:bg-input/30">
      <div className="flex h-8 items-center justify-between border-b border-border bg-muted/60 px-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium">
          <HugeiconsIcon icon={TerminalIcon} className="size-3.5" />
          Bash
        </span>
        <span className="font-mono">setup.sh</span>
      </div>
      <Textarea
        data-language="bash"
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        wrap="off"
        placeholder={placeholder}
        className={cn(
          "min-h-40 resize-y rounded-none border-0 bg-transparent px-3 py-3 font-mono text-xs leading-5 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent",
          className,
        )}
        {...props}
      />
    </div>
  );
}
