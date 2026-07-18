"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider as NextThemeProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* reducedMotion="user" drops transform animations but keeps the opacity
          fade, so reduced-motion users land on the final state rather than a
          blank slab (§8.2). The CSS media query can't reach these — motion
          drives them in JS. */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </NextThemeProvider>
  );
}
