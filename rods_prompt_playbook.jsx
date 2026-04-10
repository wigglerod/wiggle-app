import { useState, useCallback } from "react";

const PHASES = [
  {
    id: "red-flags",
    icon: "🚨",
    label: "Red Flags",
    color: "#DC2626",
    prompts: [
      {
        id: "red-flags-table",
        title: "BS Detector",
        description: "If Claude says any of these, stop immediately",
        prompt: null,
        table: [
          ['"It should work"', "UNTESTED"],
          ['"It will work"', "UNTESTED"],
          ['"This fixes it"', "UNTESTED"],
          ['"Here\'s a preview"', "Picture of a car, not a car"],
          ["Builds 6 things at once", "Scope creep — freelancing"],
          ["Can't write a test plan", "Doesn't understand what it built"],
          ["No gaps listed", "Not being honest"],
        ],
      },
    ],
  },
  {
    id: "session-starter",
    icon: "⭐",
    label: "Session Starter",
    color: "#F59E0B",
    prompts: [
      {
        id: "session-starter-1",
        title: "Paste This Every Time",
        description: "Opens every session with clarity",
        prompt: `Before we start building anything today:
1. Read the project context and confirm you understand where we left off
2. Give me the honest status: What WORKS (tested), what's UNTESTED, what's BROKEN
3. What's the #1 thing that matters today? Don't give me options — tell me your recommendation
4. Don't show me any previews or designs until the data connections are proven working
5. Every prompt you give me for Claude Code must be a downloadable .txt file
6. If you can't do something or aren't sure, SAY SO before I promise anyone`,
      },
    ],
  },
  {
    id: "power",
    icon: "🔥",
    label: "Power Prompts",
    color: "#EF4444",
    prompts: [
      {
        id: "power-1",
        title: "The Reality Check",
        description: "Instant honest status",
        prompt: "Stop. What works RIGHT NOW with real data? What's a mockup? What's untested? Give me three columns: Works, Untested, Broken.",
      },
      {
        id: "power-2",
        title: "The Hat Switch",
        description: "Critical outside review",
        prompt: "Switch to a critical outside consultant. Review everything we just built. Be brutally honest. What would embarrass me?",
      },
      {
        id: "power-3",
        title: "The Gen Test",
        description: "First-time user perspective",
        prompt: "Pretend you're Gen. You just opened this for the first time. Click everything. What confuses you? What breaks? What's missing?",
      },
      {
        id: "power-4",
        title: "The Accountability Prompt",
        description: "Call the bluff",
        prompt: "You told me [X] works. I'm about to test it. Are you confident, or do you want to check something first?",
      },
      {
        id: "power-5",
        title: "The Root Cause",
        description: "Stop patching, start understanding",
        prompt: "We've tried to fix this [N] times. Stop patching. What is the ACTUAL root cause? Explain it to me like I'm not a developer.",
      },
    ],
  },
  {
    id: "phase-1",
    icon: "🧭",
    label: "Phase 1: Scope",
    color: "#8B5CF6",
    prompts: [
      {
        id: "why",
        title: "WHY — Why Are We Building This?",
        tag: "NEW",
        description: "Kill phantom features before they waste a week",
        prompt: "Before anything — what's the actual business problem this solves? Who needs it and when? If we didn't build this, what happens?",
      },
      {
        id: "simplest",
        title: "SIMPLEST — Occam's Razor",
        tag: "NEW",
        description: "The simplest truth is the strongest foundation",
        prompt: "What is the simplest version of this that solves the real problem? Strip it to the bone. If we could only build ONE thing, what is it?",
      },
      {
        id: "q",
        title: "Q — Question the Architecture",
        description: "Map the data flow before writing code",
        prompt: "Before you write code — walk me through how the data flows. Where does it come from? Where does it go? What transforms it? Draw me a simple diagram.",
      },
      {
        id: "r",
        title: "R — Restate My Request",
        description: "Catch misunderstandings before they become bugs",
        prompt: "Read what I said, correct my grammar, and restate it as a clean prompt before you do anything.",
      },
      {
        id: "c",
        title: "C — Check Data Connectors",
        description: "Data first. Design second. Always.",
        prompt: "Before we design anything — prove the data flows. Show me Supabase returns dogs. Show me Acuity returns appointments. Show me the API actually connects.",
      },
      {
        id: "reuse",
        title: "REUSE — What Already Exists?",
        tag: "NEW",
        description: "The fastest code is code you don't write",
        prompt: "Have we solved something like this before? Is there existing code, a pattern, or a function we can build on instead of starting from scratch?",
      },
      {
        id: "j",
        title: "J — Just Tell Me What You Can't Do",
        description: "Don't fight the tool",
        prompt: "Is this something this tool can actually do? Or are we fighting the platform?",
      },
      {
        id: "y",
        title: "Y — Your Call, Not a Menu",
        description: "Partner with an opinion, not a waiter",
        prompt: "Don't give me 4 options. Tell me what YOU would do and why. If I disagree, I'll say so.",
      },
      {
        id: "scope",
        title: "SCOPE — Scope Creep Guard",
        tag: "NEW",
        description: "Stop Claude from freelancing",
        prompt: "Touch ONLY what I asked for. If you see other things you want to fix, LIST them separately and ASK before touching. Do not freelance.",
      },
    ],
  },
  {
    id: "phase-2",
    icon: "🔨",
    label: "Phase 2: Build",
    color: "#3B82F6",
    prompts: [
      {
        id: "eighty-twenty",
        title: "80/20 — Build the Core First",
        tag: "NEW",
        description: "The 20% that delivers 80% of value",
        prompt: "What's the 20% of this feature that delivers 80% of the value? Build that first. We'll decide if the rest is even worth it after.",
      },
      {
        id: "g",
        title: "G — Boring Stuff First",
        description: "Ugly and functional beats pretty and broken",
        prompt: "Don't show me colors or fonts. Show me data in cells. Make it ugly and functional first. We'll make it pretty after it works.",
      },
      {
        id: "u",
        title: "U — Ugly First, Pretty Later",
        description: "The car salesman antidote",
        prompt: "Build me the ugliest version that works. Plain text, no colors, no formatting. Just prove the data shows up. We'll style it in the next pass.",
      },
      {
        id: "o",
        title: "O — One Prompt, One Purpose",
        description: "Each prompt = one task",
        prompt: "This prompt fixes ONLY [the specific thing]. Nothing else. Don't touch any other function.",
      },
      {
        id: "i",
        title: "I — Incremental Delivery",
        description: "One piece at a time",
        prompt: "Don't build 6 tabs at once. Build tab 1, test it, prove it works. Then tab 2.",
      },
      {
        id: "l",
        title: "L — Log Errors, Don't Hide Them",
        description: "Silent failures are the enemy",
        prompt: "Add error logging to every function. If something fails, I need to see WHY — not a silent failure.",
      },
      {
        id: "m",
        title: "M — Make Me a Prompt File",
        description: "Downloadable .txt, not chat explanation",
        prompt: "Give me this as a downloadable .txt file I can paste into Claude Code. Don't explain it to me in chat — I can't copy from chat.",
      },
      {
        id: "s",
        title: "S — Separate Sessions",
        description: "Design vs Build vs Test — pick one",
        prompt: "This session is ONLY for testing what we already built. No new features. No design changes. Just verify everything works.",
      },
      {
        id: "reload",
        title: "RELOAD — Context Reload",
        tag: "NEW",
        description: "Get Claude back up to speed without guessing",
        prompt: "Here's where we left off: [paste context]. Before you touch anything, restate what exists, what's working, and what we're doing next. Don't assume — confirm.",
      },
    ],
  },
  {
    id: "phase-3",
    icon: "✅",
    label: "Phase 3: Verify",
    color: "#10B981",
    prompts: [
      {
        id: "n",
        title: 'N — Never Trust "It Should Work"',
        description: "The only proof is proof",
        prompt: "Don't tell me it should work. Tell me you tested it. If you can't test it, say so.",
      },
      {
        id: "e",
        title: "E — Smoke Test Every Function",
        description: "The node --check moment",
        prompt: "Before pushing — did you verify every function actually exists in the code? Did you check syntax? Show me the verification.",
      },
      {
        id: "t",
        title: "T — Test With Real Data",
        description: "No hypotheticals. Real dogs, real data.",
        prompt: "Don't tell me what the output 'would look like.' Run it against my actual Acuity account, my actual Supabase, my actual dogs. Show me real results.",
      },
      {
        id: "d",
        title: "D — Demand a Test Plan",
        description: "If Claude can't test it, Claude doesn't understand it",
        prompt: "Give me a test checklist. Every button, every menu item, every data connection. What should I click and what should I see?",
      },
      {
        id: "a",
        title: "A — Is This Real or a Mockup?",
        description: "Picture of a car vs actual car",
        prompt: "Is this connected to real data or is this a visual mockup? Does this actually work right now, or is this what it WILL look like?",
      },
      {
        id: "v",
        title: "V — Menu Matches Code?",
        description: "Every button must point to a real function",
        prompt: "List every menu item and confirm the function it calls exists. If any menu item points to a function that doesn't exist, that's a crash waiting to happen.",
      },
      {
        id: "k",
        title: 'K — "What Works" List',
        description: "Three columns, no gray area",
        prompt: "Give me the honest status. What works RIGHT NOW with real data? What's untested? What's broken? Three columns: Works, Untested, Broken.",
      },
      {
        id: "p",
        title: "P — Preview ≠ Product",
        description: "What % is real vs decoration?",
        prompt: "This is beautiful. Now — what percentage of this is actually built in the real code? What's decoration and what's functional?",
      },
      {
        id: "teach-me",
        title: "TEACH ME — Explain It Simply",
        tag: "NEW",
        description: "If you can't simplify it, you overcomplicated it",
        prompt: "Explain what you just built so simply that I could explain it to one of my walkers in 30 seconds. If you can't simplify it, you overcomplicated it.",
      },
    ],
  },
  {
    id: "phase-4",
    icon: "🚀",
    label: "Phase 4: Ship",
    color: "#F97316",
    prompts: [
      {
        id: "z",
        title: "Z — Zero Broken Buttons",
        description: "The final gate. Nothing ships until this passes.",
        prompt: "Click every button. Open every tab. Type in every input. Try to break it. If anything fails, it's not done.",
      },
      {
        id: "h",
        title: "H — Hat Switch: Critical Review",
        description: "$500/hour consultant mode",
        prompt: "Now switch hats. You're a demanding client paying $500/hour. Review what you just built and tell me every flaw, every missing piece, every thing that would embarrass me.",
      },
      {
        id: "b",
        title: "B — Before You Promise Anyone",
        description: "Force the gaps list",
        prompt: "Before I show this to anyone — give me an honest list of what does NOT work yet. What will break if someone clicks every button right now?",
      },
      {
        id: "w",
        title: "W — What Changed? (Changelog)",
        description: "No mysterious side effects",
        prompt: "What exactly changed? List every function that was modified. What was the old behavior? What's the new behavior?",
      },
      {
        id: "rollback",
        title: "ROLLBACK — Have an Undo Plan",
        tag: "NEW",
        description: "Know the exit before you walk through the door",
        prompt: "If this push breaks something, what's the rollback? What do I revert to? Give me the exact steps to undo this.",
      },
      {
        id: "document",
        title: "DOCUMENT — Capture What Was Built",
        tag: "NEW",
        description: "If it's not written down, it doesn't exist next session",
        prompt: "Write me a short summary of what exists now, how it works, and why it was built this way. Future me (or a future Claude session) needs to understand this without asking.",
      },
      {
        id: "exit",
        title: "EXIT — End-of-Session Debrief",
        tag: "NEW",
        description: "Every session makes the next one smarter",
        prompt: "Before we close: What did we learn today that changes how we should work tomorrow? What patterns are emerging? What should I do differently next session?",
      },
    ],
  },
  {
    id: "phase-5",
    icon: "🔧",
    label: "Phase 5: Debug",
    color: "#6B7280",
    prompts: [
      {
        id: "f",
        title: "F — Fail Fast, Not Late",
        description: "Two failed attempts = wrong diagnosis",
        prompt: "We've tried this twice. Stop. What's the root cause? Don't patch — explain WHY it's failing.",
      },
      {
        id: "x",
        title: "X — X-Ray Dependencies",
        description: "Every external dependency is a point of failure",
        prompt: "What does this function depend on? If Acuity is down, does the whole app crash? If Supabase times out, does the user see an error or a blank screen?",
      },
    ],
  },
];

function PromptCard({ prompt, onCopy, copied }) {
  if (prompt.table) {
    return (
      <div style={{
        background: "rgba(220,38,38,0.04)",
        border: "1px solid rgba(220,38,38,0.15)",
        borderRadius: 14,
        padding: "18px 20px",
        marginBottom: 12,
      }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#DC2626", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{prompt.title}</div>
        <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 14 }}>{prompt.description}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {prompt.table.map(([says, means], i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "9px 14px",
              background: "rgba(220,38,38,0.07)",
              borderRadius: 9,
              fontSize: 13,
            }}>
              <span style={{ color: "#374151", fontFamily: "'DM Mono', monospace" }}>{says}</span>
              <span style={{ color: "#DC2626", fontWeight: 700, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase" }}>{means}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #F3F4F6",
      borderRadius: 14,
      padding: "15px 18px",
      marginBottom: 10,
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: "#111827", fontFamily: "'DM Sans', sans-serif" }}>{prompt.title}</span>
            {prompt.tag && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#F97316",
                background: "rgba(249,115,22,0.1)",
                padding: "2px 7px",
                borderRadius: 5,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}>{prompt.tag}</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 11 }}>{prompt.description}</div>
          <div style={{
            fontFamily: "'DM Mono', 'SF Mono', monospace",
            fontSize: 12.5,
            lineHeight: 1.65,
            color: "#374151",
            background: "#F9FAFB",
            padding: "11px 14px",
            borderRadius: 9,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            border: "1px solid #F3F4F6",
          }}>
            {prompt.prompt}
          </div>
        </div>
        <button
          onClick={() => onCopy(prompt.id, prompt.prompt)}
          style={{
            flexShrink: 0,
            width: 38,
            height: 38,
            borderRadius: 10,
            border: "1px solid #E5E7EB",
            background: copied === prompt.id ? "#10B981" : "#fff",
            color: copied === prompt.id ? "#fff" : "#9CA3AF",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            transition: "all 0.18s",
            marginTop: 2,
          }}
          title="Copy to clipboard"
        >
          {copied === prompt.id ? "✓" : "⎘"}
        </button>
      </div>
    </div>
  );
}

export default function PromptPlaybook() {
  const [activePhase, setActivePhase] = useState("session-starter");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(null);

  const handleCopy = useCallback((id, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  const activeData = PHASES.find((p) => p.id === activePhase);

  const filteredPrompts = search.trim()
    ? PHASES.flatMap((phase) =>
        phase.prompts
          .filter((p) =>
            p.title.toLowerCase().includes(search.toLowerCase()) ||
            p.description.toLowerCase().includes(search.toLowerCase()) ||
            (p.prompt && p.prompt.toLowerCase().includes(search.toLowerCase()))
          )
          .map((p) => ({ ...p, phaseLabel: phase.label, phaseIcon: phase.icon }))
      )
    : null;

  const totalPrompts = PHASES.reduce((acc, p) => acc + p.prompts.length, 0);

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      maxWidth: 540,
      margin: "0 auto",
      padding: "24px 16px 80px",
      color: "#111827",
      minHeight: "100vh",
      background: "#FAFAFA",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 32, marginBottom: 4 }}>🐕</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.02em", color: "#111827" }}>
          Rod's Prompt Playbook
        </h1>
        <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0, fontStyle: "italic" }}>
          Work smart, play always. · {totalPrompts} prompts
        </p>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 18 }}>
        <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 15, color: "#9CA3AF", pointerEvents: "none" }}>🔍</span>
        <input
          type="text"
          placeholder="Search prompts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "11px 16px 11px 38px",
            fontSize: 14,
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            background: "#fff",
            outline: "none",
            fontFamily: "'DM Sans', sans-serif",
            color: "#111827",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        />
      </div>

      {/* Phase Nav */}
      {!search.trim() && (
        <div style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          marginBottom: 20,
          paddingBottom: 4,
          scrollbarWidth: "none",
        }}>
          {PHASES.map((phase) => (
            <button
              key={phase.id}
              onClick={() => setActivePhase(phase.id)}
              style={{
                padding: "7px 13px",
                borderRadius: 20,
                border: activePhase === phase.id ? `2px solid ${phase.color}` : "1px solid #E5E7EB",
                background: activePhase === phase.id ? phase.color : "#fff",
                color: activePhase === phase.id ? "#fff" : "#6B7280",
                fontWeight: activePhase === phase.id ? 700 : 500,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                boxShadow: activePhase === phase.id ? `0 2px 8px ${phase.color}40` : "none",
              }}
            >
              {phase.icon} {phase.label}
            </button>
          ))}
        </div>
      )}

      {/* Search Results */}
      {filteredPrompts && (
        <div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14, fontWeight: 600 }}>
            {filteredPrompts.length} result{filteredPrompts.length !== 1 ? "s" : ""}
          </div>
          {filteredPrompts.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "#9CA3AF", fontSize: 14 }}>
              No prompts match that search
            </div>
          ) : (
            filteredPrompts.map((p) => (
              <div key={p.id}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5, marginLeft: 4 }}>
                  {p.phaseIcon} {p.phaseLabel}
                </div>
                <PromptCard prompt={p} onCopy={handleCopy} copied={copied} />
              </div>
            ))
          )}
        </div>
      )}

      {/* Phase Content */}
      {!filteredPrompts && activeData && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 22 }}>{activeData.icon}</span>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: activeData.color, letterSpacing: "-0.01em" }}>
                {activeData.label}
              </h2>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                {activeData.prompts.length} prompt{activeData.prompts.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          {activeData.prompts.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} onCopy={handleCopy} copied={copied} />
          ))}
        </div>
      )}
    </div>
  );
}
