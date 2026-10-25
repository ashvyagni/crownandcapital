# Motion System

## Purpose
Motion should explain state change: selection, confirmation, resolution, and attention. It must not simulate a feature that does not exist.

## Tokens
- **Micro feedback:** 120–180ms, ease-out.
- **Panel/map transition:** 220–320ms, ease-in-out.
- **Resolution reveal:** 350–600ms, staged only when it improves comprehension.
- **Reduced motion:** remove transforms and nonessential sequencing; preserve instant state and text feedback.

## Patterns
Use a restrained highlight for selected regions, a clear delta transition for resource changes, and a single attention pulse for new warnings. Avoid looping decorative motion, parallax that impairs reading, and animation that delays controls.

## Status
These are design tokens and acceptance guidance. Actual coverage depends on the current frontend implementation and must be checked in visual QA.
