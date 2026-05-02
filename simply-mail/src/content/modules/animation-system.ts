/**
 * Shared animation infrastructure for Simply Mail content modules.
 *
 * Provides:
 * - CSS custom properties (design tokens) for spring curves, durations, and stagger delays
 * - Reusable @keyframes with the `simply-mail-` prefix
 * - A stagger utility that applies simply-mail-slide-up to child elements with increasing delay
 *
 * This is NOT an SimplyMailModule — it's a shared utility that injects CSS once
 * and exports helpers for other modules to consume.
 */

import { ensureStyle } from './dom-utils';

const STYLE_ID = 'simply-mail-animation-system';

/** CSS custom-property token values exposed on :root. */
export const ANIM_TOKENS = {
  /** Spring overshoot curve for entrance / reveal animations. */
  springCurve: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  /** Ease-out curve for exit / dismiss animations. */
  easeOutCurve: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  /** Default duration for entrance animations (ms). */
  durationNormal: 200,
  /** Fast duration for micro-interactions (ms). */
  durationFast: 120,
  /** Stagger delay between successive children (ms). */
  staggerDelay: 50,
} as const;

/**
 * Inject the shared animation CSS once.  Safe to call multiple times —
 * subsequent calls are a no-op.
 */
export function injectAnimationCSS(): void {
  ensureStyle(STYLE_ID, buildAnimationCSS());
}

/** Remove the shared animation style element. */
export function removeAnimationCSS(): void {
  const el = document.getElementById(STYLE_ID);
  el?.remove();
}

/**
 * Apply staggered entrance animation to children of `parent` matching
 * `selector`.  Each child receives `simply-mail-slide-up` with an increasing
 * `animation-delay` based on `staggerMs`.
 *
 * @returns The list of matched elements that were animated.
 */
export function applyStaggeredEntrance(
  parent: Element,
  selector: string,
  staggerMs: number = ANIM_TOKENS.staggerDelay,
): Element[] {
  injectAnimationCSS();

  const children = Array.from(parent.querySelectorAll(selector));
  children.forEach((child, i) => {
    (child as HTMLElement).style.animation = `simply-mail-slide-up ${ANIM_TOKENS.durationNormal}ms ${ANIM_TOKENS.springCurve} both`;
    (child as HTMLElement).style.animationDelay = `${i * staggerMs}ms`;
  });
  return children;
}

// ---------------------------------------------------------------------------
// Internal CSS builder
// ---------------------------------------------------------------------------

function buildAnimationCSS(): string {
  return /* css */ `
    :root {
      --simply-mail-spring-curve: ${ANIM_TOKENS.springCurve};
      --simply-mail-ease-out-curve: ${ANIM_TOKENS.easeOutCurve};
      --simply-mail-duration-normal: ${ANIM_TOKENS.durationNormal}ms;
      --simply-mail-duration-fast: ${ANIM_TOKENS.durationFast}ms;
      --simply-mail-stagger-delay: ${ANIM_TOKENS.staggerDelay}ms;
    }

    /* --- Reusable @keyframes --- */

    @keyframes simply-mail-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    @keyframes simply-mail-slide-up {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes simply-mail-slide-right {
      from { opacity: 0; transform: translateX(-12px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    @keyframes simply-mail-scale-in {
      from { opacity: 0; transform: scale(0.92); }
      to   { opacity: 1; transform: scale(1); }
    }

    @keyframes simply-mail-shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    /* Prefers-reduced-motion: disable all custom animations */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;
}
