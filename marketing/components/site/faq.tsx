import { motion } from "motion/react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { container, item, viewportOnce } from "@/components/site/motion";
import { SectionIntro } from "@/components/site/section-intro";

/**
 * Honest questions with honest answers — every answer restates real platform
 * behavior from USERSTORY.md in plain words. No marketing filler; this section
 * exists because "wait, do I need my own Claude subscription?" is the first
 * thing every developer asks.
 */

const FAQS = [
  {
    q: "Do I need my own agent subscriptions?",
    a: "Yes. You bring Claude Code, Codex, Cursor, or any agent, with the credentials you already pay for. Paperboat runs them. It never resells tokens or sits between you and your provider.",
  },
  {
    q: "What happens when I stop working?",
    a: "When you and the agent both go quiet for longer than the idle timeout you set, the machine stops itself. Credits meter only while a machine is running, so a stopped project costs nothing. Connect again and it resumes where it stopped.",
  },
  {
    q: "Where does my code live?",
    a: "On a persistent volume dedicated to that project. One machine, one volume, no sharing. Stopping or restarting the machine doesn't touch it: the working tree, git state, and build caches survive.",
  },
  {
    q: "How do new machines get my dotfiles and settings?",
    a: "Paperboat keeps a private config repo in your own GitHub account. Before a machine is torn down, a system process diffs your tracked config and pushes it; every new machine clones the latest state on boot. No agent involvement, no manual step.",
  },
  {
    q: "Is my machine exposed to the internet?",
    a: "No. Nothing on a project VM is published as a public port. All traffic goes through the agentunnel relay after authorization. The only public surface is a preview URL, and only when you or your agent creates one.",
  },
  {
    q: "Can I use it without the app?",
    a: "Yes. Besides the desktop and mobile apps there's a CLI that attaches a project's terminal to your local one. It also bridges local image pastes into remote TUIs, so you can paste a screenshot straight to an agent.",
  },
  {
    q: "Can I run multiple projects at once?",
    a: "Yes. Each project has its own machine, and any number can run in parallel. Credits meter across all running machines; the ones asleep meter nothing.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="border-t border-border bg-background px-6 py-[clamp(4rem,7vw,8rem)] lg:px-10">
      <div className="mx-auto w-full max-w-3xl">
        <SectionIntro title="Frequently asked questions" />

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="mt-12 lg:mt-14"
        >
          <motion.div variants={item}>
            <Accordion className="rounded-none border-0 border-t border-border">
              {FAQS.map((f) => (
                <AccordionItem key={f.q} value={f.q} className="border-b border-border data-open:bg-transparent">
                  <AccordionTrigger className="text-body px-0 py-6 font-medium hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-body-sm -mx-2 pb-6 text-muted-foreground">
                    <p className="max-w-prose">{f.a}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
