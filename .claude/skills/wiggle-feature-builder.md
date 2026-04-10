# Wiggle Feature Builder

## Before Writing Anything — The Pre-Flight
1. Read WIGGLE_PROJECT.md
2. State the puzzle piece — what exactly are we placing?
3. Apply WWRS
4. Pick the right tool
5. Run the lazy-thinking check

## Tool Assignment
| What | Tool |
|---|---|
| Visual fix, drawer, swipe, card state | Antigravity |
| Architecture, multi-file refactor | Claude Code |
| Strategy, prompts, Supabase, planning | Claude Chat |

Never send visual/interactive work to Claude Code. It edits blind.

## Prompt Structure
CONTEXT: Read WIGGLE_PROJECT.md first.
JOB: [One sentence.]
WHY: [What problem for the walker?]
FILE(S) TO TOUCH: [Exact filenames]
DO NOT TOUCH: [Everything else]
RULES: Surgical edits only. Read full file before writing. State what you found first.
TEST: Exact steps at wiggle-app-dusky.vercel.app. Clean build is NOT proof.

## The SIMPLEST Test
"What is the smallest version that solves the real problem? Strip it to the bone."
Run this BEFORE opening Claude Code.

## Anti-Loop Rules
1. Scope creep — name exactly what to touch AND what not to touch
2. Untested confidence — only proof is tapped on device
3. Re-explaining context — rules live in files, not in chat
4. Wrong tool — visual work never goes to Claude Code
5. Dead end debugging — after 2 failed attempts, stop and re-read the file
