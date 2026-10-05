import {
  collectionGroup,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AttendanceRecord } from "@/types";

export type GatheringType = "meetings" | "events";

export interface AttendedGathering {
  type: "meeting" | "event";
  id: string;
  title: string;
  date: string;
}

// Pulls a youth's attendance across both /meetings/*/attendance and
// /events/*/attendance via a collectionGroup query, then resolves each
// parent doc for its title/date. Fine for a church-sized dataset; if this
// ever gets slow, denormalize title/date onto the attendance doc itself.
export async function getYouthAttendance(youthId: string): Promise<AttendedGathering[]> {
  const q = query(collectionGroup(db, "attendance"), where("youthId", "==", youthId));
  const snap = await getDocs(q);

  const results = await Promise.all(
    snap.docs.map(async (attendanceDoc) => {
      const parent = attendanceDoc.ref.parent.parent; // the meeting or event doc
      if (!parent) return null;
      const parentSnap = await getDoc(parent);
      if (!parentSnap.exists()) return null;

      const type: "meeting" | "event" = parent.parent.id === "meetings" ? "meeting" : "event";
      const data = parentSnap.data() as { title: string; date: string };
      return { type, id: parent.id, title: data.title, date: data.date };
    })
  );

  return results
    .filter((r): r is AttendedGathering => r !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** All youthIds marked present for one meeting or event. */
export async function getAttendanceForGathering(
  gatheringType: GatheringType,
  gatheringId: string
): Promise<Set<string>> {
  const snap = await getDocs(collection(db, `${gatheringType}/${gatheringId}/attendance`));
  return new Set(snap.docs.map((d) => d.id));
}

export async function markPresent(
  gatheringType: GatheringType,
  gatheringId: string,
  youthId: string,
  markedBy: string
): Promise<void> {
  const record: AttendanceRecord = {
    youthId,
    present: true,
    markedBy,
    markedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, `${gatheringType}/${gatheringId}/attendance/${youthId}`), record);
}

export async function unmarkPresent(
  gatheringType: GatheringType,
  gatheringId: string,
  youthId: string
): Promise<void> {
  await deleteDoc(doc(db, `${gatheringType}/${gatheringId}/attendance/${youthId}`));
}
