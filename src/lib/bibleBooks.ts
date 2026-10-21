// The 66 books of the Bible, in order. Numbered books (1 John) are separate
// entries from the books they are named after (John).

export interface BibleBook {
  name: string;
  testament: "Old" | "New";
  group: string;
  aliases?: string[];
}

function books(testament: "Old" | "New", group: string, names: (string | [string, ...string[]])[]): BibleBook[] {
  return names.map((n) => (typeof n === "string" ? { name: n, testament, group } : { name: n[0], testament, group, aliases: n.slice(1) }));
}

export const BIBLE_BOOKS: BibleBook[] = [
  ...books("Old", "Law", ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"]),
  ...books("Old", "History", [
    "Joshua",
    "Judges",
    "Ruth",
    "1 Samuel",
    "2 Samuel",
    "1 Kings",
    "2 Kings",
    "1 Chronicles",
    "2 Chronicles",
    "Ezra",
    "Nehemiah",
    "Esther",
  ]),
  ...books("Old", "Poetry and wisdom", ["Job", ["Psalms", "Psalm"], "Proverbs", "Ecclesiastes", ["Song of Solomon", "Song of Songs", "Canticles"]]),
  ...books("Old", "Major prophets", ["Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel"]),
  ...books("Old", "Minor prophets", [
    "Hosea",
    "Joel",
    "Amos",
    "Obadiah",
    "Jonah",
    "Micah",
    "Nahum",
    "Habakkuk",
    "Zephaniah",
    "Haggai",
    "Zechariah",
    "Malachi",
  ]),
  ...books("New", "Gospels", ["Matthew", "Mark", "Luke", "John"]),
  ...books("New", "History", [["Acts", "Acts of the Apostles"]]),
  ...books("New", "Paul's letters", [
    "Romans",
    "1 Corinthians",
    "2 Corinthians",
    "Galatians",
    "Ephesians",
    "Philippians",
    "Colossians",
    "1 Thessalonians",
    "2 Thessalonians",
    "1 Timothy",
    "2 Timothy",
    "Titus",
    "Philemon",
  ]),
  // Hebrews is listed with the general letters because who wrote it is not certain.
  ...books("New", "General letters", ["Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude"]),
  ...books("New", "Prophecy", [["Revelation", "Revelations"]]),
];

export function booksWhere(test: (b: BibleBook) => boolean): string[] {
  return BIBLE_BOOKS.filter(test).map((b) => b.name);
}
