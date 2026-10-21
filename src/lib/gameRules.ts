import { GAME_LABEL } from "@/types/games";
import type { GameSession } from "@/types/games";

/** Plain-language rules for a game, shown to the players before it starts. */
export interface HowToPlay {
  summary: string;
  steps: string[];
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * The rules of a game as this session will play them: it follows whether the
 * game is turn by turn or first to answer, and mentions the timer and the
 * number of rounds that were set up.
 */
export function howToPlay(session: Pick<GameSession, "game" | "playMode" | "timerSeconds" | "rounds" | "sides">): HowToPlay {
  const turns = session.playMode === "turns";
  const seconds = session.timerSeconds ?? 0;
  const timer = seconds > 0 ? `You have ${plural(seconds, "second")} for each ${session.game === "board" ? "clue" : "round"}.` : null;
  const sides = session.sides.map((s) => s.name);
  const sideList = sides.length <= 4 ? sides.join(", ") : `${sides.length} sides`;

  // How the points are won, which depends on the way the game is played.
  const answering = turns
    ? [
        "It is one side's turn at a time. Only the side whose turn it is may answer.",
        "A right answer wins the points. A miss can be passed to the next side for half points, or to no one.",
      ]
    : ["Whoever answers first and gets it right wins the points for their side."];

  switch (session.game) {
    case "scramble":
      return {
        summary: "The letters of a word are mixed up. Work out the word.",
        steps: [
          "The scrambled letters appear on the screen.",
          "Unscramble them to find the word. A hint may help.",
          ...answering,
          ...(timer ? [timer] : []),
          `There are ${plural(session.rounds.length, "round")}. The side with the most points wins.`,
        ],
      };
    case "bibleOrCap":
      return {
        summary: "A saying is shown. Is it Scripture, or is it cap?",
        steps: [
          "A quote appears on the screen.",
          "Decide: is it really in the Bible (Scripture), or is it cap, a saying that is not in the Bible?",
          ...answering,
          "The answer is revealed with the verse, or with where the saying really comes from.",
          ...(timer ? [timer] : []),
          `There are ${plural(session.rounds.length, "round")}. The side with the most points wins.`,
        ],
      };
    case "emoji":
      return {
        summary: "A few emojis stand for a Bible story, person or miracle. Guess it.",
        steps: [
          "The emojis appear on the screen.",
          "Work out which Bible story, character or miracle they stand for.",
          ...answering,
          ...(timer ? [timer] : []),
          `There are ${plural(session.rounds.length, "round")}. The side with the most points wins.`,
        ],
      };
    case "spouseQuiz":
      return {
        summary: "A Bible person is named. Who was their husband or wife?",
        steps: [
          "A name appears on the screen.",
          "Name their husband or wife. Some people had more than one, and any correct answer counts.",
          ...answering,
          ...(timer ? [timer] : []),
          `There are ${plural(session.rounds.length, "round")}. The side with the most points wins.`,
        ],
      };
    case "relay":
      return {
        summary: "A race to find the verse in the Bible.",
        steps: [
          "Each team pairs up: a front player who can see the Bible, and a back player who opens it with their hands, guided by the one in front.",
          "The host calls out a book, chapter and verse. The clock starts the moment it is called.",
          "The first team to find the verse wins the points. Harder verses are worth more.",
          ...(timer ? [timer] : []),
          `There are ${plural(session.rounds.length, "verse")} to find, starting easy and getting harder. The team with the most points wins.`,
        ],
      };
    case "spouses":
      return {
        summary: "A memory game. Find the Bible couples hidden under the cards.",
        steps: [
          "Every card hides the name of someone in the Bible. Each name has a husband or wife hidden somewhere else.",
          `Sides take turns, one after another${sideList ? `: ${sideList}` : ""}. On your turn, call out two cards to flip.`,
          "If the two names are a couple, you win a point and the pair stays face up.",
          "If not, everyone sees both cards, then they are turned back over. Remember where they are.",
          `There are ${plural(session.rounds.length, "couple")} to find. The side with the most points wins.`,
        ],
      };
    case "bookGuess":
      return {
        summary: "A picture clue points to a book of the Bible. Which book is it?",
        steps: [
          "A few emojis appear. They show one scene from one book of the Bible.",
          "Work out the scene, then name the book it comes from.",
          ...answering,
          "The book is revealed with the scene it shows.",
          ...(timer ? [timer] : []),
          `There are ${plural(session.rounds.length, "book")} to guess. The side with the most points wins.`,
        ],
      };
    case "fillBlank":
      return {
        summary: "A verse is shown with words missing. Fill them in.",
        steps: [
          "A verse appears with one or more words left blank.",
          "Say the missing word or words, in order.",
          ...answering,
          ...(timer ? [timer] : []),
          `There are ${plural(session.rounds.length, "round")}. The side with the most points wins.`,
        ],
      };
    case "whoAmI":
      return {
        summary: "Clues about a Bible person are revealed one at a time. Who am I?",
        steps: [
          "The clues come one at a time, hardest first and easiest last.",
          "The fewer clues you needed, the more points you win, so guess as early as you dare.",
          ...answering,
          ...(timer ? [timer] : []),
          `There are ${plural(session.rounds.length, "person", )} to guess. The side with the most points wins.`,
        ],
      };
    case "board":
      return {
        summary: "A grid of categories and points, like a quiz show.",
        steps: [
          `Sides take turns to pick a tile from the board: ${sideList}.`,
          "A harder tile is worth more points. The clue appears when it is opened.",
          ...answering,
          "Once a tile is used, it is gone from the board.",
          ...(timer ? [timer] : []),
          "When the board is finished, the side with the most points wins.",
        ],
      };
    default:
      return { summary: GAME_LABEL[session.game], steps: [] };
  }
}
