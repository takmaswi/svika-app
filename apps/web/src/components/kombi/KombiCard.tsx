"use client";

// The kombi card (batch K1): a tap on a moving marker answers "which kombi
// is this, and can I trust it". Same native dialog carrier as the ETA basis
// card (section 8 card grammar over a char tinted scrim, recorded deviation):
// the top layer keeps it above the map chrome, Escape and a scrim tap close
// it. One primary action (section 5 anatomy): the board of all kombis.
import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import type { KombiProfile } from "@/lib/kombi/fleet";
import type { KombiStrings } from "@/lib/kombi/strings";
import type { VehicleEta } from "@/lib/kombi/vehicle-eta";
import { KombiFacts, type TerminusNames } from "./KombiFacts";

interface KombiCardProps {
  profile: KombiProfile;
  eta?: VehicleEta;
  stopName: string;
  terminus: TerminusNames;
  strings: KombiStrings;
  onClose: () => void;
}

export function KombiCard({
  profile,
  eta,
  stopName,
  terminus,
  strings,
  onClose,
}: KombiCardProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // mounting is opening: the parent renders this card only for a tapped kombi
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="eta-basis-dialog kombi-card-dialog"
      aria-label={strings.markerTap}
      data-testid="kombi-card"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <div className="eta-basis-card kombi-card">
        <KombiFacts
          profile={profile}
          eta={eta}
          stopName={stopName}
          terminus={terminus}
          strings={strings}
        />
        <Link
          className="cta touch-target kombi-card-cta"
          href="/app/kombis"
          data-testid="kombi-card-board-link"
        >
          {strings.boardCta}
          <span className="cta-chip" aria-hidden>
            <ArrowIcon />
          </span>
        </Link>
        <button
          type="button"
          className="text-btn touch-target eta-basis-close"
          onClick={() => dialogRef.current?.close()}
        >
          {strings.close}
        </button>
      </div>
    </dialog>
  );
}
