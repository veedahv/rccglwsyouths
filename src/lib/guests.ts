import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getYouthAttendance, markPresent, type GatheringType } from "./attendance";
import { createYouth, deleteYouth } from "./youths";
import { todayISO } from "./format";
import type { Guest, Youth } from "@/types";
import type { GamePlayer } from "@/types/games";

// Guests: people who came to an event or meeting but aren't youths. They are kept on the gathering itself
// (/events/{id}/guests/{guestId}, /meetings/{id}/guests/{guestId}), so they never end up on the youth list.

const guestsPath = (type: GatheringType, gatheringId: string) => `${type}/${gatheringId}/guests`;

/**
 * The guests of an event as players for its games. The id comes from the guest's own, so the same guest is
 * the same player every time the page loads (games they were put into keep pointing at them).
 */
export function guestsAsPlayers(guests: Guest[]): GamePlayer[] {
  return guests.map((g) => ({ id: `guest-${g.id}`, name: `${g.name} (guest)`, guest: true }));
}

/** Everyone listed as a guest at one event or meeting, in the order they were added. */
export async function listGuests(type: GatheringType, gatheringId: string): Promise<Guest[]> {
  const snap = await getDocs(collection(db, guestsPath(type, gatheringId)));
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<Guest, "id">), id: d.id }))
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

export async function addGuest(type: GatheringType, gatheringId: string, name: string, addedBy: string): Promise<Guest> {
  const ref = doc(collection(db, guestsPath(type, gatheringId)));
  const data: Omit<Guest, "id"> = { name: name.trim(), addedBy, addedAt: new Date().toISOString() };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
}

export async function removeGuest(type: GatheringType, gatheringId: string, guestId: string): Promise<void> {
  await deleteDoc(doc(db, guestsPath(type, gatheringId), guestId));
}

/**
 * Turns a guest into a youth on the roster (they've decided to join, or were added as a guest by mistake):
 * creates the youth, marks them present at this gathering, and removes the guest entry.
 */
export async function makeGuestAYouth(type: GatheringType, gatheringId: string, guest: Guest, markedBy: string): Promise<Youth> {
  const id = await createYouth({ name: guest.name });
  await markPresent(type, gatheringId, id, markedBy);
  await removeGuest(type, gatheringId, guest.id);
  return { id, name: guest.name, active: true, joinedAt: todayISO() };
}

/**
 * Takes someone off the youth list and keeps them as a guest at every event and meeting they were marked
 * present at (for anyone added as a youth who was really a guest). Callers should check
 * getYouthDeleteBlocker first: someone with dues or a pledge can't be removed. The guest entries are written
 * first, with ids made from the youth's, so running it again after a failure doesn't double them up.
 * Returns how many gatherings they were kept on.
 */
export async function moveYouthToGuests(youth: Pick<Youth, "id" | "name">, addedBy: string): Promise<number> {
  const attended = await getYouthAttendance(youth.id);
  await Promise.all(
    attended.map((a) => {
      const type: GatheringType = a.type === "meeting" ? "meetings" : "events";
      const data: Omit<Guest, "id"> = { name: youth.name, addedBy, addedAt: new Date().toISOString() };
      return setDoc(doc(db, guestsPath(type, a.id), `from-youth-${youth.id}`), data);
    })
  );
  await deleteYouth(youth.id); // also clears their attendance marks
  return attended.length;
}
