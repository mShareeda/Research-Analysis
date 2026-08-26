"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" className="printButton noPrint" onClick={() => window.print()}>
      <Printer size={16} />
      <span>حفظ كـ PDF / طباعة</span>
    </button>
  );
}
