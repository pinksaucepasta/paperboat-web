import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { buttonVariants } from "@/components/ui/button";
import { PaperboatMark } from "@/components/dashboard/paperboat-mark";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { getMeServer } from "@/lib/api/me-server";

export default async function LoginPage() {
  // Read-only session check against paperboat-server. Already signed in? Skip.
  const me = await getMeServer();
  if (me) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-float">
            <PaperboatMark className="size-6" />
          </span>
          <div className="space-y-1">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Paperboat Cloud
            </p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Welcome back
            </h1>
          </div>
        </div>

        <Card className="shadow-float">
          <CardHeader className="text-center">
            <CardTitle className="font-heading text-base font-semibold">
              Sign in to your console
            </CardTitle>
            <CardDescription>
              Run, deploy, and observe your agents in the cloud.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <a
              href="/auth/sign-in"
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              Continue to sign in
              <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
            </a>
            <p className="text-center text-xs text-muted-foreground">
              Use an email magic link, GitHub, or Google.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to the Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
