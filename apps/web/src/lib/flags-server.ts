import { cookies } from "next/headers";
import { flagsFrom, type LaunchFlag, type ResolvedFlags } from "./flags";

/** The current request's launch flags, for server components and actions. */
export async function getFlags(): Promise<ResolvedFlags> {
  const store = await cookies();
  return flagsFrom((name) => store.get(name)?.value);
}

export async function flagOn(flag: LaunchFlag): Promise<boolean> {
  return (await getFlags()).flags.has(flag);
}
