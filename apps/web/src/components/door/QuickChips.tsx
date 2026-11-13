"use client";

// Home-Final quick chips: one tap plans from where the rider is to a well
// known place. If location is refused, the planner opens with the place
// filled in and From ready to type.
import { useRouter } from "next/navigation";
import { whereAmI } from "@/lib/door/locate";

export function QuickChips({ places, label }: { places: string[]; label: string }) {
  const router = useRouter();
  return (
    <nav className="v2-chips v2-rise v2-d2" aria-label={label}>
      {places.map((name) => (
        <button
          type="button"
          key={name}
          className="v2-chip"
          data-testid="quick-chip"
          onClick={async () => {
            try {
              const from = await whereAmI();
              router.push(
                `/app/plan?from=${encodeURIComponent(from)}&to=${encodeURIComponent(name)}`,
              );
            } catch {
              router.push(`/app/where?q=${encodeURIComponent(name)}`);
            }
          }}
        >
          {name}
        </button>
      ))}
    </nav>
  );
}
