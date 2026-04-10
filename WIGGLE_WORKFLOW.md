# WIGGLE WORKFLOW GUIDE
## How Claude Chat + Antigravity + Claude Code work together.
## Last updated: April 3, 2026 — V2 clean slate

---

## THE THREE TOOLS

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  CLAUDE CHAT    │    │  ANTIGRAVITY    │    │  CLAUDE CODE    │
│  (claude.ai)    │    │  (antigravity   │    │  (terminal)     │
│                 │    │   .google)      │    │                 │
│  STRATEGIST     │    │  BUILDER        │    │  ARCHITECT      │
│                 │    │                 │    │                 │
│  • Plan         │    │  • Edit code    │    │  • Big refactors│
│  • Query data   │    │  • See browser  │    │  • Multi-file   │
│  • Write specs  │    │  • Visual verify│    │  • Tower Control│
│  • Check deploys│    │  • Iterate fast │    │  • Migrations   │
│  • Update docs  │    │  • Match designs│    │  • Git ops      │
│  • Supabase MCP │    │  • Test on phone│    │  • 5000+ line   │
│  • Vercel MCP   │    │  • Fix bugs     │    │    files        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                      │                      │
         └──────────────────────┴──────────────────────┘
                                │
                       ┌────────┴────────┐
                       │   SUPABASE      │
                       │  (shared brain) │
                       │  95 dogs        │
                       │  14 profiles    │
                       └─────────────────┘
```

---

## TOOL RULE — NON-NEGOTIABLE

Any fix involving user interaction (tapping, swiping, state changes,
drawer behaviour, card updates) goes to **Antigravity**.
Claude Code edits blind. Vercel logs only show server errors —
a clean build does NOT mean the feature works on device.
Never claim something works without device verification.

---

## DAILY DECISION GUIDE

| What you need to do                          | Tool          |
|----------------------------------------------|---------------|
| Change how something looks or behaves        | Antigravity   |
| Fix a bug that involves tapping or swiping   | Antigravity   |
| Check live data or plan something            | Claude Chat   |
| Write a spec or a prompt file                | Claude Chat   |
| Check Vercel deployments or logs             | Claude Chat   |
| Refactor a big file or change architecture   | Claude Code   |
| Tower Control work (Code.js)                 | Claude Code   |
| Multi-file structural changes                | Claude Code   |
| Git operations                               | Claude Code   |

---

## HOW SESSIONS WORK

### Starting a session
1. Claude Chat: read WIGGLE_PROJECT.md, check Supabase state,
   check latest Vercel deployment, identify what's next
2. Agree on the ONE thing being built this session
3. Write a prompt file (.txt) if going to Claude Code
4. Go to Antigravity or Claude Code with clear scope

### During a session
- One change at a time
- Build after each change
- Test on phone between each
- If stuck: exhaust Supabase MCP, Vercel logs, git history
  before asking Rod to do anything manually

### Ending a session
- Update WIGGLE_PROJECT.md with what changed
- Note any new bugs found
- Note what's next

---

## ANTIGRAVITY SETUP

- App: antigravity.google (download for Mac)
- Model: Claude Sonnet 4.6 (or Gemini 3 Pro as backup)
- Test URL: https://wiggle-app-dusky.vercel.app
- Login: test@wiggledogwalks.com / WiggleTest2026!
- NEVER test against localhost — always the live Vercel URL
- Open folder: ~/Documents/wiggle-v4/
- CLAUDE.md in project root — Antigravity reads it for context

### Manager View vs Editor View
- **Manager View** — dispatch agents for full tasks. They work autonomously,
  show screenshots and artifacts before applying changes.
- **Editor View** — targeted edits. Code left, AI chat right.
  Use for quick surgical fixes.

---

## CLAUDE CODE SETUP

- Launch: `claude` from ~/Documents/wiggle-v4/
- CLAUDE.md auto-loads on every session
- Tower Control: ~/Documents/wiggle-v4/apps-script/Code.js (5,030 lines)
- Clasp push: `npx @google/clasp push` from regular Terminal — NOT Claude Code terminal
  (credentials are sandboxed in regular Terminal only)

---

## HOW THE TOOLS SHARE CONTEXT

They don't talk to each other directly. Rod is the connection.
They share:
1. The codebase — ~/Documents/wiggle-v4/ — all three can read it
2. CLAUDE.md — design constitution, auto-loaded by Claude Code
3. WIGGLE_PROJECT.md — master context, Rod drops it into any session
4. Supabase — Claude Chat queries via MCP, app reads via API
5. GitHub → Vercel — push to main = auto deploy

---

## SESSION TRIGGER

When Rod says **"Wiggle. Check."**:
1. Read WIGGLE_PROJECT.md from project files
2. Search recent chats for session context
3. Check latest Vercel deployment
4. THEN respond — no questions before doing these three things

---

## TROUBLESHOOTING

**Antigravity not seeing changes**
→ Make sure you saved the file. Antigravity reads from disk.

**Antigravity rate limited**
→ Switch model (Claude ↔ Gemini). If both limited, use Editor View.

**Deploy didn't trigger**
→ Claude Chat: check Vercel MCP for latest deployment status
→ Or manually: `git push origin main`

**Data looks wrong in the app**
→ Claude Chat: query Supabase directly. Never assume — always check.

**New fix broke something else**
→ After every Antigravity session, verify the full live app end to end.
   New fixes can introduce new bugs.

---

## OPERATING RULES

- When Rod asks "can we do X" — verify with available tools BEFORE saying yes.
  A yes means it is done or confirmed. Check Supabase, Vercel, git state first.
- Never fall into lazy patterns. Exhaust the tools before asking Rod to do anything manually.
- One change at a time. Build after each. Test on phone between each.
- No game plan = no prompt. Always agree on approach before writing.
- All Claude Code prompts as .txt files — never chat explanations.
- No prompts over 200 lines without asking first.
- Antigravity prompts must NOT mention localhost at all.
