# Game sessions: what changed

Copy these files over the same paths in your project (merge, do not replace the whole folder).
This zip includes everything from the first game-sessions version plus this update,
so you can copy all of it over in one go.

NEW
- src/types/games.ts
- src/lib/games.ts
- src/lib/gameStarterBank.ts
- src/lib/useRoundTimer.ts
- src/components/GameSetupForm.tsx
- src/components/GameBoard.tsx
- src/app/games/page.tsx
- src/app/games/[id]/page.tsx
- src/app/games/[id]/present/page.tsx
- src/app/games/questions/page.tsx
- src/app/overlay/[key]/page.tsx   (the OBS overlay; needs no sign-in)

MODIFIED (small edits, safe to diff)
- src/components/icons.tsx      (adds GamesIcon at the end)
- src/components/AppChrome.tsx  (imports GamesIcon, adds the Games nav link)
- firestore.rules               (adds gameQuestions and gameSessions rules; deploy them)
- README.md                     (adds a "Game sessions" section at the end)

This update (OBS overlay)
- A private overlay link per session for OBS Browser Sources (transparent, no sign-in). Links and set-up steps are on the run screen under "Record or stream with OBS".
- The overlay only ever holds what is on screen: unrevealed answers, hints and clues are never sent to it.
- IMPORTANT: deploy the updated firestore.rules (new gameOverlays rule), or the overlay stays blank.
- Sessions made earlier get a "Create overlay link" button.

Previous update (Who Am I? and the Quiz board)
- Who Am I?: clues revealed one at a time, automatic points that fall with each clue (21 starter people).
- Quiz board (Jeopardy-style): pick 2 to 6 categories, tiles by point level, turns, penalties for wrong answers, board shown on the big screen (30 starter clues in 6 categories).
- Hints stay available for scrambled words, emoji trivia and fill in the missing word only.

Previous update (two new games)
- Emoji Bible Trivia (37 starter clues) and Fill in the missing word (36 starter verses). Both use the same timer, hints, scoring and player modes.
- Hints now work for every game except Scripture or Cap.

Earlier in this update
- Scripture or Cap now uses real quotes: Scripture (with the verse) or Cap (with where it really comes from).
- New starter set: 25 Scripture and 21 Cap quotes. Scrambled words are unchanged.
- Question bank: "Clear questions" for everything or chosen games.
- Hints can be hidden (chosen at set-up, toggled live). The admin still sees them privately.
- Round timer: seconds set at set-up, shown in the corner, controlled by the admin. It starts automatically when moving to the next round; round 1 waits for Start.

After copying the files, open Games > Question bank > Load starter questions to add the new games' questions (existing ones are not duplicated).

To switch to the new Scripture or Cap questions if you loaded the older ones:
Games > Question bank > Clear questions > tick "Scripture or Cap" > Delete, then "Load starter questions".

No new packages. Type-checks cleanly with `tsc --noEmit`.
