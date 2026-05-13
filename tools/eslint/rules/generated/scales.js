// @ts-check
'use strict';

/**
 * AUTO-GENERATED — do not edit by hand.
 * Source: src/app/app.preset.ts (PROJECT_TOKENS export) + 
 * the SCALES table in tools/design-tokens/codegen.mjs.
 * Regenerate: `npm run design-tokens:codegen`.
 *
 * Consumed by:
   - tools/eslint/rules/no-forbidden-spacing.js
   - tools/eslint/rules/no-forbidden-rounded.js
   - tools/eslint/rules/no-forbidden-typography.js
   - tools/eslint/rules/no-arbitrary-duration.js
 *
 * Adding a new scale: edit SCALES in codegen.mjs, run the script.
 * ESLint rules import named exports from this file.
 */

module.exports = Object.freeze({
  "spacing": {
    "gap": {
      "allowed": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        8
      ]
    },
    "padding": {
      "allowed": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7
      ]
    },
    "margin": {
      "allowed": [
        0,
        1,
        2,
        4,
        6
      ]
    },
    "exceptions": [
      "p-5",
      "gap-7",
      "gap-8",
      "py-8",
      "px-12",
      "p-[1px]",
      "mt-3",
      "mb-5",
      "mt-5",
      "mt-10"
    ]
  },
  "rounded": {
    "allowed": [
      "lg",
      "xl",
      "2xl",
      "3xl",
      "full",
      "border"
    ]
  },
  "typography": {
    "size": [
      "xs",
      "sm",
      "base",
      "lg",
      "xl",
      "2xl",
      "3xl",
      "4xl"
    ],
    "weight": [
      "normal",
      "medium",
      "semibold",
      "bold"
    ],
    "leading": [
      "none",
      "tight",
      "normal",
      "4",
      "5",
      "6",
      "7",
      "8"
    ]
  },
  "motion": {
    "allowedDurationKeys": [
      "instant",
      "fast",
      "base",
      "slow"
    ],
    "allowedEasingKeys": [
      "standard",
      "decelerate",
      "accelerate"
    ]
  }
});
