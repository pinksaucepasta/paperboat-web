import { motion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowUpRight01Icon,
  GithubIcon,
  NewTwitterIcon,
  DiscordIcon,
  RssIcon,
} from "@hugeicons/core-free-icons";

import { EASE, container, item, viewportOnce } from "@/components/site/motion";

function PaperboatMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 335.156 335.156"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M333.352,138.278c-1.882-2.198-4.859-3.117-7.652-2.362l-94.603,25.558l-57.274-86.133c-0.002-0.003-0.005-0.006-0.007-0.009c-2.965-4.438-9.51-4.442-12.477,0c-0.002,0.003-0.005,0.006-0.007,0.009l-57.274,86.134L9.456,135.916c-2.794-0.758-5.771,0.164-7.652,2.362c-1.882,2.197-2.332,5.281-1.157,7.925l50,112.495c1.166,2.646,3.862,4.455,6.86,4.455c0.005,0,0.01-0.001,0.014-0.001c1.074,0,219.237,0.003,220.208-0.005c2.937-0.031,5.585-1.767,6.781-4.448l50-112.495C335.684,143.559,335.234,140.475,333.352,138.278z M175.078,104.318l40.749,61.282l-40.749,11.008V104.318z M160.078,104.318v72.291L119.329,165.6L160.078,104.318z M20.752,154.506l128.331,34.671l-88.246,55.515L20.752,154.506z M83.506,248.151l84.069-52.887l84.074,52.887H83.506z M274.32,244.692l-88.252-55.515l17.086-4.616l111.251-30.055L274.32,244.692z" />
    </svg>
  );
}

const COLUMNS = [
  {
    heading: "Products",
    links: [
      { label: "Cloud Agents", href: "#cloud-agents" },
      { label: "Remote Agents", href: "#remote-agents" },
      { label: "Hosted Hermes", href: "#hermes" },
      { label: "AgenTunnel", href: "#agentunnel" },
    ],
  },
  {
    heading: "Developers",
    links: [
      { label: "Docs", href: "#docs" },
      { label: "API Reference", href: "#api" },
      { label: "Changelog", href: "#changelog" },
      { label: "Status", href: "#status" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Pricing", href: "#pricing" },
      { label: "Blog", href: "#blog" },
      { label: "Careers", href: "#careers" },
      { label: "Contact", href: "#contact" },
    ],
  },
] as const;

const SOCIALS = [
  { label: "GitHub", href: "#github", icon: GithubIcon },
  { label: "X", href: "#x", icon: NewTwitterIcon },
  { label: "Discord", href: "#discord", icon: DiscordIcon },
  { label: "RSS", href: "#rss", icon: RssIcon },
] as const;

/**
 * Status read-out — keeps the footer feeling like a running system
 * rather than a static slab.
 */
function StatusIndicator() {
  return (
    <span className="text-eyebrow inline-flex items-center gap-2 leading-none text-primary-foreground/60">
      <span className="relative flex size-2 shrink-0 -translate-y-[0.08em]">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
      </span>
      All systems afloat
    </span>
  );
}

const WORDMARK = "PAPERBOAT".split("");

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-primary text-primary-foreground">
      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
        className="relative z-[2] px-6 pt-16 lg:px-10 lg:pt-20"
      >
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <motion.div variants={item} className="flex flex-col gap-5">
            <a
              href="/"
              className="flex items-center gap-2.5 text-primary-foreground"
            >
              <PaperboatMark className="size-7" />
              <span className="font-mono text-base font-bold tracking-tight">
                PAPERBOAT
              </span>
            </a>
            <p className="text-body-sm max-w-xs text-pretty text-primary-foreground/70">
              Persistent workspaces for AI agents. Your compute, your
              credentials, no lock-in.
            </p>
            <div className="flex items-center gap-2 pt-1">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="flex size-9 items-center justify-center rounded-md border border-primary-foreground/15 text-primary-foreground/70 transition-colors hover:border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                >
                  <HugeiconsIcon icon={s.icon} className="size-4" />
                </a>
              ))}
            </div>
          </motion.div>

          {COLUMNS.map((col) => (
            <motion.div
              key={col.heading}
              variants={item}
              className="flex flex-col gap-4"
            >
              <span className="text-eyebrow text-primary-foreground/45">
                {col.heading}
              </span>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-nav group inline-flex items-center gap-1 text-primary-foreground/80 transition-colors hover:text-primary-foreground"
                    >
                      {link.label}
                      <HugeiconsIcon
                        icon={ArrowUpRight01Icon}
                        className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <motion.div
          variants={item}
          className="mt-14 flex flex-col gap-3 border-t border-primary-foreground/15 py-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <StatusIndicator />
          <div className="text-caption flex flex-wrap items-center gap-x-5 gap-y-1 text-primary-foreground/55">
            <span>© {year} Paperboat</span>
            <a href="#privacy" className="hover:text-primary-foreground/90">
              Privacy
            </a>
            <a href="#terms" className="hover:text-primary-foreground/90">
              Terms
            </a>
            <a href="#security" className="hover:text-primary-foreground/90">
              Security
            </a>
          </div>
        </motion.div>
      </motion.div>

      {/* Oversized bold wordmark — rises letter by letter as it scrolls in,
          clipped at the baseline so it reads as a watermark. */}
      <div
        className="relative z-[1] mt-6 flex justify-center overflow-hidden select-none"
        aria-hidden="true"
      >
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.6 }}
          transition={{ staggerChildren: 0.05 }}
          className="flex translate-y-[20%] gap-[0.06em]"
        >
          {WORDMARK.map((ch, i) => (
            <span key={i} className="overflow-hidden">
              <motion.span
                variants={{
                  hidden: { y: "110%" },
                  show: {
                    y: "0%",
                    transition: { duration: 0.7, ease: EASE },
                  },
                }}
                className="font-heading block text-[clamp(3.5rem,17vw,14rem)] font-bold leading-none tracking-normal text-primary-foreground/[0.08]"
              >
                {ch}
              </motion.span>
            </span>
          ))}
        </motion.div>
      </div>
    </footer>
  );
}
