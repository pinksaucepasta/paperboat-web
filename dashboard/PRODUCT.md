# Product

## Register

product

## Users

Paperboat users are developers who run coding agents in cloud project machines and need a reliable control panel for project creation, lifecycle, billing, storage, GitHub connection, and access status.

## Product Purpose

The dashboard is the authenticated control panel for Paperboat. It should make cloud agent infrastructure feel understandable and controllable: users create projects from GitHub repositories, allocate storage, choose machine settings, monitor lifecycle state, and connect to their remote agents without needing to reason about backend orchestration details.

## Brand Personality

Calm, capable, direct. The interface should feel operational and trustworthy, with clear feedback during async provisioning and lifecycle changes.

## Anti-references

Avoid marketing-style dashboard screens, decorative UI that hides system state, ambiguous loading spinners, and interactions that require manual refreshes to understand whether a project is still provisioning, ready, failed, or stopped.

## Design Principles

- Make system state visible immediately and continuously.
- Prefer direct operational controls over explanatory decoration.
- Keep async work calm: optimistic feedback first, reconciliation in the background.
- Preserve user context during mutations; do not bounce the screen unless navigation is intentional.
- Let catalog, billing, and lifecycle data come from the backend contract rather than hardcoded assumptions.

## Accessibility & Inclusion

Use accessible form controls, visible focus states, semantic status text, sufficient contrast, and reduced-motion-safe state indicators. Loading and lifecycle changes should be understandable without relying only on color or animation.
