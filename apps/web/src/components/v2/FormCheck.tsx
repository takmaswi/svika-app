"use client";

// Inline validation in Svika copy (plan Step 1.4), never the browser's
// native bubble. Drop it inside a <form>: under launch-v2 it switches the
// native bubble off, and on a submit with a missing or wrong field it marks
// each one (aria-invalid, an ink ring), moves focus to the first,
// and says what is wrong in one live line. A field's own message comes from
// its data-error attribute; otherwise `fallback` is used. Without launch-v2
// it renders nothing and the form keeps its native behaviour.
import { useEffect, useId, useRef, useState } from "react";
import { useUiV2 } from "@/lib/ui-v2";
import { InfoV2 } from "./icons";

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isField(el: Element): el is Field {
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
}

export function FormCheck({ fallback }: { fallback: string }) {
  const v2 = useUiV2();
  const anchor = useRef<HTMLParagraphElement>(null);
  const [message, setMessage] = useState("");
  const errorId = `formcheck${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!v2 || !form) return;
    form.noValidate = true;

    const onSubmit = (event: SubmitEvent) => {
      const fields = [...form.elements].filter(isField);
      const bad = fields.filter((f) => !f.checkValidity());
      for (const f of fields) {
        const invalid = bad.includes(f);
        if (invalid) {
          f.setAttribute("aria-invalid", "true");
          f.setAttribute("aria-describedby", errorId);
        } else {
          f.removeAttribute("aria-invalid");
        }
      }
      if (bad.length === 0) {
        setMessage("");
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const first = bad[0]!;
      setMessage(first.dataset.error || fallback);
      first.focus();
    };
    const onInput = (event: Event) => {
      const f = event.target;
      if (f instanceof Element && isField(f) && f.checkValidity()) {
        f.removeAttribute("aria-invalid");
        if (![...form.elements].some((el) => el.hasAttribute("aria-invalid"))) setMessage("");
      }
    };
    // capture, so the check runs before any other submit handler
    form.addEventListener("submit", onSubmit, true);
    form.addEventListener("input", onInput);
    return () => {
      form.removeEventListener("submit", onSubmit, true);
      form.removeEventListener("input", onInput);
    };
  }, [v2, fallback, errorId]);

  if (!v2) return null;
  return (
    // the Sign-Up notice pattern: an icon tile plus the words, never colour
    // alone (DESIGN-GAPS G2)
    <p ref={anchor} id={errorId} className="v2-notice v2-form-error" role="alert" data-testid="form-error">
      {message ? (
        <>
          <span className="v2-notice-icon">
            <InfoV2 />
          </span>
          <span>{message}</span>
        </>
      ) : null}
    </p>
  );
}

