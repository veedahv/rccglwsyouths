import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Attendee, ExcoMember, Meeting, MeetingAudience } from "@/types";

export async function listMeetings(): Promise<Meeting[]> {
  const q = query(collection(db, "meetings"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Meeting, "id">) }));
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const snap = await getDoc(doc(db, "meetings", id));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Meeting, "id">) } : null;
}

export const AUDIENCE_LABEL: Record<MeetingAudience, string> = {
  excos: "Excos",
  youths: "All youths",
  selected: "Selected group",
};

/** A meeting's audience, defaulting older meetings (which have none stored) to all youths. */
export function audienceOf(meeting: Pick<Meeting, "audience">): MeetingAudience {
  return meeting.audience ?? "youths";
}

/** "Selected group (12)" for a picked group, otherwise just the audience name. */
export function audienceSummary(meeting: Meeting): string {
  const audience = audienceOf(meeting);
  return audience === "selected"
    ? `${AUDIENCE_LABEL.selected} (${meeting.attendeeIds?.length ?? 0})`
    : AUDIENCE_LABEL[audience];
}

/**
 * The attendance list for an exco meeting. An exco who is also a youth is
 * keyed by their youth ID, so the attendance shows up on their youth
 * profile too; an external admin (no youth record) is keyed by exco ID.
 */
export function excoAttendees(excos: ExcoMember[]): Attendee[] {
  return excos.map((e) => ({ id: e.youthId ?? e.id, name: e.name, gender: e.gender }));
}

export async function createMeeting(data: {
  title: string;
  date: string;
  createdBy: string;
  audience: MeetingAudience;
  attendeeIds?: string[]; // only used when audience is "selected"
}): Promise<string> {
  const { attendeeIds, ...rest } = data;
  const ref = await addDoc(collection(db, "meetings"), {
    ...rest,
    attendeeIds: data.audience === "selected" ? attendeeIds ?? [] : [],
    minutesContent: "",
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

/** Changes who a meeting is for. Attendance already marked is left as it is. */
export async function updateMeetingAudience(
  id: string,
  audience: MeetingAudience,
  attendeeIds: string[]
): Promise<void> {
  await updateDoc(doc(db, "meetings", id), {
    audience,
    attendeeIds: audience === "selected" ? attendeeIds : [],
  });
}

export async function updateMeetingMinutes(id: string, minutesContent: string): Promise<void> {
  await updateDoc(doc(db, "meetings", id), { minutesContent });
}
