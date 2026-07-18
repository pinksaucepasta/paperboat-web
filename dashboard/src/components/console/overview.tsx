"use client";

import { motion } from "motion/react";
import { RefreshCw, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/console/page-shell";
import { StatCard } from "@/components/console/stat-card";
import { TrafficPanel } from "@/components/console/traffic-panel";
import { RegionsPanel } from "@/components/console/regions-panel";
import { IncidentsPanel } from "@/components/console/incidents-panel";
import { DeploymentsTable } from "@/components/console/deployments-table";
import { entranceContainer, entranceItem, container } from "@/lib/motion";
import { kpis } from "@/lib/data";

export function Overview() {
  return (
    <PageShell>
      {/* Above the fold: on-mount entrance, not a scroll reveal (§8.2 p5).
          Kept flat — nesting one stagger container inside another stops the
          variant propagating to the leaves, which silently pins them hidden. */}
      <motion.div variants={entranceContainer} initial="hidden" animate="show">
        <motion.div variants={entranceItem}>
          <PageHeader
            eyebrow="Production"
            title="Edge console"
            description="Traffic, deploys, and reliability across acme-labs — last 30 days."
            actions={
              <>
                <Button variant="outline" size="lg">
                  <RefreshCw />
                  Refresh
                </Button>
                <Button size="lg">
                  <Rocket />
                  New deployment
                </Button>
              </>
            }
          />
        </motion.div>
      </motion.div>

      <motion.div
        variants={entranceContainer}
        initial="hidden"
        animate="show"
        className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
      >
        {kpis.map((kpi) => (
          <StatCard key={kpi.key} kpi={kpi} variants={entranceItem} />
        ))}
      </motion.div>

      {/* Below the fold: reveal on scroll, once. */}
      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
        className="mt-6 grid gap-6 lg:grid-cols-3"
      >
        <div className="lg:col-span-2">
          <TrafficPanel />
        </div>
        <IncidentsPanel />
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
        className="mt-6 grid gap-6 lg:grid-cols-3"
      >
        <div className="lg:col-span-2">
          <DeploymentsTable compact limit={6} />
        </div>
        <RegionsPanel />
      </motion.div>
    </PageShell>
  );
}
