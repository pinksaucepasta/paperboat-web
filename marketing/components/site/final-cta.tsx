import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { container, item, viewportOnce, EASE } from "@/components/site/motion";

/**
 * Closing CTA: pure typography, no illustration. One oversized statement —
 * "Your agents keep working while you ___" — where the last word cycles
 * through what the user gets to do instead, set in the pixel-dots brand face
 * from the hero. Reduced-motion users see a single static word.
 */

const WORDS = ["sleep", "commute", "cook", "touch grass", "log off"];
const WORD_MS = 2200;

export function FinalCta() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % WORDS.length), WORD_MS);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <section id="get-started" className="border-t border-border bg-background px-6 py-[clamp(4rem,7vw,8rem)] lg:px-10">
      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
        className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 text-center"
      >
        <motion.h2 variants={item} className="text-h1 max-w-3xl text-balance text-foreground">
          Your agents keep working while you
          <span className="mt-2 block overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={WORDS[index]}
                initial={reduce ? false : { y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduce ? undefined : { y: "-100%", opacity: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="font-pixel-dots block whitespace-nowrap text-primary"
              >
                {WORDS[index]}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.h2>

        <motion.p variants={item} className="text-lead max-w-2xl text-pretty text-muted-foreground">
          A git URL is all it takes. Isolated machine, persistent volume, one tunnel
          to everywhere. Your agents, your credentials, no lock-in.
        </motion.p>

        <motion.div variants={item} className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" nativeButton={false} render={<a href="#get-started" />}>
            Get started
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
          </Button>
          <Button variant="outline" size="lg" nativeButton={false} render={<a href="#byoc" />}>
            Bring Your Own Compute
            <HugeiconsIcon icon={ArrowUpRight01Icon} data-icon="inline-end" />
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
