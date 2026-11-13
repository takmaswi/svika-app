"use client";

// Whether the launch-v2 visual system is on for this request (the ui_v2
// launch flag, resolved once in the root layout). Client components read it
// here so server and client render the same markup; CSS reads the matching
// :root[data-ui="v2"] attribute.
import { createContext, useContext, type ReactNode } from "react";

const UiV2Context = createContext(false);

export function UiV2Provider({ on, children }: { on: boolean; children: ReactNode }) {
  return <UiV2Context.Provider value={on}>{children}</UiV2Context.Provider>;
}

export function useUiV2(): boolean {
  return useContext(UiV2Context);
}
