"use client";

// Hands a gifted ride to whoever it is for, through the phone's own share
// sheet (Web Share API). The payload is TEXT, not a link: the recipient needs
// no account, no wallet and no app, only the four digit code, so the message
// that travels must be readable on its own in whatever they already use.
// No WhatsApp Business API, no SMS vendor, no Svika server in the middle.
// Browsers without navigator.share copy the same text to the clipboard.
import { useState } from "react";

interface GiftShareButtonProps {
  /** The whole message: trip, code and how long it lasts. */
  message: string;
  sendLabel: string;
  copyLabel: string;
  copiedLabel: string;
}

export function GiftShareButton({
  message,
  sendLabel,
  copyLabel,
  copiedLabel,
}: GiftShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  const send = async () => {
    if (canShare) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        // dismissed or unsupported target: fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      // clipboard blocked: the code is already big on screen to read out
    }
  };

  return (
    <button
      className="auth-submit touch-target"
      type="button"
      onClick={() => void send()}
      data-testid="gift-share"
    >
      {copied ? copiedLabel : canShare ? sendLabel : copyLabel}
    </button>
  );
}
