import { redirect } from "next/navigation";
import { ArrowRight, TerminalSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PaperboatMark } from "@/components/paperboat-mark";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getMeServer } from "@/lib/api/me-server";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Read-only session check against paperboat-server. Already signed in? Skip.
  const me = await getMeServer();
  if (me) redirect("/dashboard");

  const devLogin = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true";

  return (
    <div className="flex min-h-svh flex-1 items-center justify-center bg-sidebar px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-float">
            <PaperboatMark className="size-6" />
          </span>
          <div className="space-y-1">
            <p className="text-eyebrow text-muted-foreground">Paperboat Cloud</p>
            <h1 className="text-h4">Welcome back</h1>
          </div>
        </div>

        <Card className="shadow-float">
          <CardHeader className="text-center">
            <CardTitle>Sign in to your console</CardTitle>
            <CardDescription>
              Run, deploy, and observe your agents in the cloud.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button size="lg" className="w-full" render={<a href="/auth/sign-in" />}>
              Continue to sign in
              <ArrowRight className="size-4" />
            </Button>
            <p className="text-center text-caption text-muted-foreground">
              Use an email magic link, GitHub, or Google.
            </p>

            {devLogin && (
              <>
                <div className="relative py-1 text-center">
                  <span className="relative z-10 bg-card px-2 text-caption text-muted-foreground">
                    local development
                  </span>
                  <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
                </div>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  render={<a href="/auth/dev-login" />}
                >
                  <TerminalSquare className="size-4" />
                  Dev sign-in (fake WorkOS)
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-caption text-muted-foreground">
          By continuing you agree to the Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
