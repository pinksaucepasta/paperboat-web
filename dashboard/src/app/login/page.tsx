import { redirect } from "next/navigation";
import { ArrowRight, TerminalSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PaperboatMark } from "@/components/paperboat-mark";
import { LoginDither } from "@/components/dashboard/login-dither";
import { getMeServer } from "@/lib/api/me-server";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Read-only session check against paperboat-server. Already signed in? Skip.
  const me = await getMeServer();
  if (me) redirect("/dashboard");

  const devLogin = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true";

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Brand column — a deep indigo-ink field carrying one typographic thesis,
          with the product's own Bayer dither as its signature (LoginDither).
          Electric indigo stays an accent, never the whole surface (DESIGN.md §1).
          Fixed tone in both themes; it's the dark anchor beside the form. Hidden
          below lg. */}
      <aside
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-14 xl:p-16"
        style={{ backgroundColor: "oklch(0.23 0.078 264.4)" }}
      >
        {/* Signature: a rising dithered area, the console's live-metric motif. */}
        <LoginDither />

        {/* Blue bloom in the dense corner — the glow comes from the dither's own
            colour, echoing the chart bloom (dither-paint.ts). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 mix-blend-screen"
          style={{
            background:
              "radial-gradient(50% 45% at 82% 100%, rgba(53,143,243,0.35), transparent 70%)",
          }}
        />
        {/* Legibility scrim — sink the ink back in on the text side so the copy
            never fights the dither, letting the field bloom to the right. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(100deg, oklch(0.23 0.078 264.4) 0%, oklch(0.23 0.078 264.4 / 0.86) 34%, transparent 66%)",
          }}
        />
        {/* Soft top-left light source — tonal depth on a flat field. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.08), transparent 52%)",
          }}
        />

        <span className="relative font-mono text-xs uppercase tracking-[0.22em] text-white/60">
          Persistent workspaces
        </span>

        <div className="relative max-w-md">
          <h2 className="text-balance font-heading text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-white xl:text-[2.75rem]">
            Right where you left it.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Your workspace resumes against the same repo — cloned, configured,
            and ready for the next run.
          </p>

          <div className="mt-10 h-px w-full bg-white/10" />
          <p className="mt-4 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-white/45">
            Isolated compute
            <span className="mx-2 text-white/25">·</span>
            Durable storage
            <span className="mx-2 text-white/25">·</span>
            Extensible tunnels
          </p>
        </div>
      </aside>

      {/* Sign-in column */}
      <div className="flex flex-col px-6 py-8 lg:px-12">
        <header className="flex items-center gap-2">
          <PaperboatMark className="h-7 w-auto shrink-0 text-primary" />
          <span className="font-heading text-base font-semibold tracking-tight">
            Paperboat
          </span>
        </header>

        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-2">
              <p className="text-eyebrow text-muted-foreground">Paperboat Cloud</p>
              <h1 className="text-h3">Sign in to your console</h1>
              <p className="text-body-sm text-muted-foreground">
                Run, deploy, and observe your agents in the cloud.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                size="lg"
                className="w-full"
                render={<a href="/auth/sign-in" />}
              >
                Continue to sign in
                <ArrowRight className="size-4" />
              </Button>
              <p className="text-caption text-muted-foreground">
                Continue with an email magic link, GitHub, or Google.
              </p>

              {devLogin && (
                <>
                  <div className="relative py-2 text-center">
                    <span className="relative z-10 bg-background px-2 text-caption text-muted-foreground">
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
            </div>
          </div>
        </main>

        <footer className="text-caption text-muted-foreground">
          By continuing you agree to the Terms and Privacy Policy.
        </footer>
      </div>
    </div>
  );
}
