"use client";

// Sends the live trip link through the phone's own share sheet (Web Share
// API): no SMS vendor, no WhatsApp API, the rider's own apps carry it.
// Browsers without navigator.share fall back to copying the link.
import { useState } from "react";

interface ShareSheetButtonProps {
  url: string;
  text: string;
  sendLabel: string;
  copyLabel: string;
  copiedLabel: string;
}

export function ShareSheetButton({
  url,
  text,
  sendLabel,
  copyLabel,
  copiedLabel,
}: ShareSheetButtonProps) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  const send = async () => {
    if (canShare) {
      try {
        await navigator.share({ text: `${text} ${url}` });
        return;
      } catch {
        // dismissed or unsupported target: fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // clipboard blocked: the link is already visible on screen
    }
  };

  return (
    <button
      className="auth-submit touch-target"
      type="button"
      onClick={() => void send()}
      data-testid="guardian-send"
    >
      {copied ? copiedLabel : canShare ? sendLabel : copyLabel}
    </button>
  );
}
