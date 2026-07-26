// M3 places layer: the bilingual wordlist screen a place name passes BEFORE
// even a personal save. This is the client twin of the authoritative server
// screen (private.place_name_is_clean, migration 0038); the two lists are
// kept identical by hand and the server always has the last word, so a
// bypassed client changes nothing. Matching is deliberately simple rules:
// a word boundary hit on the normalised name, plus a squashed spaces check
// for the longer words so "m b o r o" does not walk through.
//
// The list is a working draft in both languages and needs Mhofu's and the
// translator's ratification before submission (same law as every Shona
// string in the app).

const BANNED: readonly string[] = [
  // english
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "nigger",
  "nigga",
  "kaffir",
  "whore",
  "slut",
  "dick",
  "pussy",
  "asshole",
  "bastard",
  "wanker",
  // shona (draft list, translator pass owed)
  "mboro",
  "beche",
  "mhata",
  "hure",
  "svira",
  "ngochani",
];

export function isPlaceNameClean(name: string): boolean {
  const norm = name
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
  const squished = norm.replace(/ /g, "");
  const words = new Set(norm.split(" "));
  for (const banned of BANNED) {
    if (words.has(banned)) return false;
    if (banned.length >= 5 && squished.includes(banned)) return false;
  }
  return true;
}
