"use client";

import { useState } from "react";
import Image from "next/image";
import { ResearchWorkspace } from "@/components/research-workspace";
import { CodingWorkspace } from "@/components/coding-workspace";

type AppMode = "sentiment" | "coding";

const modeCopy: Record<AppMode, { eyebrow: string; heading: string }> = {
  sentiment: { eyebrow: "Research Analysis", heading: "Evaluate stories and documents with evidence." },
  coding: { eyebrow: "أستمارة تحليل المضمون", heading: "ترميز مواد جائزة البحرين الكبرى وفق استمارة الدراسة" },
};

// Sentiment Monitoring tab is temporarily hidden at the user's request — only the coding
// form is shown for now. Flip this back to true (and restore the switcher below) to bring
// the tab back; ResearchWorkspace itself is untouched.
const SHOW_MODE_SWITCH = false;

export function AppShell() {
  const [appMode, setAppMode] = useState<AppMode>("coding");
  const copy = modeCopy[appMode];

  return (
    <main className="shell">
      <section className="topbar">
        <div className="brandHeader">
          <Image className="brandLogo" src="/logo.png" alt="Research Analysis logo" width={2816} height={1536} priority />
          <div dir={appMode === "coding" ? "rtl" : undefined} className="brandText">
            {appMode !== "coding" && <p className="eyebrow">{copy.eyebrow}</p>}
            <h1 className={appMode === "coding" ? "codingTitle" : undefined}>{copy.heading}</h1>
          </div>
        </div>
        {SHOW_MODE_SWITCH && (
          <div className="segmented appModeSwitch" aria-label="App mode">
            <button type="button" className={appMode === "sentiment" ? "active" : ""} onClick={() => setAppMode("sentiment")}>
              <span>Sentiment Monitoring</span>
            </button>
            <button type="button" className={appMode === "coding" ? "active" : ""} onClick={() => setAppMode("coding")}>
              <span>أستمارة تحليل المضمون</span>
            </button>
          </div>
        )}
      </section>

      {appMode === "sentiment" ? <ResearchWorkspace /> : <CodingWorkspace />}
    </main>
  );
}
