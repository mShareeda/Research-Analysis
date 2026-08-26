"use client";

import { useState } from "react";
import Image from "next/image";
import { ResearchWorkspace } from "@/components/research-workspace";
import { CodingWorkspace } from "@/components/coding-workspace";

type AppMode = "sentiment" | "coding";

const modeCopy: Record<AppMode, { eyebrow: string; heading: string }> = {
  sentiment: { eyebrow: "Research Analysis", heading: "Evaluate stories and documents with evidence." },
  coding: { eyebrow: "استمارة تحليل المضمون", heading: "رمّز مواد جائزة البحرين الكبرى وفق استمارة الدراسة." },
};

export function AppShell() {
  const [appMode, setAppMode] = useState<AppMode>("sentiment");
  const copy = modeCopy[appMode];

  return (
    <main className="shell">
      <section className="topbar">
        <div className="brandHeader">
          <Image className="brandLogo" src="/logo.png" alt="Research Analysis logo" width={2816} height={1536} priority />
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{copy.heading}</h1>
          </div>
        </div>
        <div className="segmented appModeSwitch" aria-label="App mode">
          <button type="button" className={appMode === "sentiment" ? "active" : ""} onClick={() => setAppMode("sentiment")}>
            <span>Sentiment Monitoring</span>
          </button>
          <button type="button" className={appMode === "coding" ? "active" : ""} onClick={() => setAppMode("coding")}>
            <span>استمارة تحليل المضمون</span>
          </button>
        </div>
      </section>

      {appMode === "sentiment" ? <ResearchWorkspace /> : <CodingWorkspace />}
    </main>
  );
}
