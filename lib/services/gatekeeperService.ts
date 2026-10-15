import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";

export interface PublicUserProfile {
  uid: string;
  memberId: string;
  fullName: string;
}

export interface GatekeeperGroup {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
}

export interface GatekeeperChat {
  id: string;
  chatType: "direct" | "group";
  participantIds: string[];
  groupId?: string;
  name?: string;
  createdAt?: unknown;
}

export interface GatekeeperMessage {
  id: string;
  senderId: string;
  text: string;
  kind: "text" | "q-query";
  createdAt?: unknown;
}

export interface GroupJoinRequest {
  id: string;
  userId: string;
  status: "pending" | "approved" | "rejected";
  requestedAt?: unknown;
}

const db = () => getFirebaseFirestore();

function asPublicUser(uid: string, value: Record<string, unknown>): PublicUserProfile | null {
  if (typeof value.memberId !== "string" || typeof value.fullName !== "string") return null;
  return { uid, memberId: value.memberId, fullName: value.fullName };
}

export async function savePublicUserProfile(uid: string, memberId: string, fullName: string): Promise<void> {
  await setDoc(doc(db(), "users", uid), { memberId, fullName });
}

export async function searchPublicUsers(searchText: string, currentUid: string): Promise<PublicUserProfile[]> {
  const search = searchText.trim();
  if (search.length < 2) return [];
  const users = collection(db(), "users");
  const searches = [
    getDocs(query(users, where("memberId", "==", search), limit(20))),
    getDocs(query(users, where("fullName", ">=", search), where("fullName", "<=", `${search}\uf8ff`), limit(20))),
  ];
  const snapshots = await Promise.all(searches);
  const results = new Map<string, PublicUserProfile>();
  snapshots.flatMap((snapshot) => snapshot.docs).forEach((entry) => {
    if (entry.id === currentUid) return;
    const profile = asPublicUser(entry.id, entry.data());
    if (profile) results.set(profile.uid, profile);
  });
  return [...results.values()];
}

export function watchGroups(
  onChange: (groups: GatekeeperGroup[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(collection(db(), "groups"), (snapshot) => {
    onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as GatekeeperGroup));
  }, onError);
}

export async function requestToJoinGroup(groupId: string, uid: string): Promise<void> {
  await setDoc(doc(db(), "groups", groupId, "joinRequests", uid), {
    userId: uid,
    status: "pending",
    requestedAt: serverTimestamp(),
  });
}

export async function createGroup(name: string, ownerId: string): Promise<GatekeeperGroup> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("Tên nhóm không được để trống.");

  const groupRef = doc(collection(db(), "groups"));
  const chatId = groupRef.id;
  const createdAt = serverTimestamp();
  const newGroup: GatekeeperGroup = { id: groupRef.id, name: normalizedName, ownerId, memberIds: [ownerId] };
  await runTransaction(db(), async (transaction) => {
    transaction.set(groupRef, { name: normalizedName, ownerId, memberIds: [ownerId] });
    transaction.set(doc(db(), "chats", chatId), {
      chatType: "group",
      participantIds: [ownerId],
      groupId: groupRef.id,
      name: normalizedName,
      createdAt,
    });
  });
  return newGroup;
}

export async function createDirectChat(currentUid: string, otherUid: string): Promise<string> {
  if (currentUid === otherUid) throw new Error("Không thể bắt đầu cuộc trò chuyện với chính mình.");
  const participantIds = [currentUid, otherUid].sort();
  const userChats = await getDocs(query(
    collection(db(), "chats"),
    where("participantIds", "array-contains", currentUid),
  ));
  const existingChat = userChats.docs.find((entry) => {
    const data = entry.data();
    return data.chatType === "direct"
      && Array.isArray(data.participantIds)
      && data.participantIds.length === 2
      && data.participantIds.includes(otherUid);
  });
  if (existingChat) return existingChat.id;

  const chatRef = doc(collection(db(), "chats"));
  await setDoc(chatRef, { chatType: "direct", participantIds, createdAt: serverTimestamp() });
  return chatRef.id;
}

export function watchUserChats(
  uid: string,
  onChange: (chats: GatekeeperChat[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db(), "chats"), where("participantIds", "array-contains", uid)),
    (snapshot) => onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as GatekeeperChat)),
    onError,
  );
}

export function watchChatMessages(
  chatId: string,
  onChange: (messages: GatekeeperMessage[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db(), "chats", chatId, "messages"), orderBy("createdAt", "asc"), limitToLast(100)),
    (snapshot) => {
      const messages = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }) as GatekeeperMessage)
        .sort((left, right) => {
          const leftTime = typeof left.createdAt === "object" && left.createdAt !== null && "toMillis" in left.createdAt
            ? Number((left.createdAt as { toMillis: () => number }).toMillis())
            : 0;
          const rightTime = typeof right.createdAt === "object" && right.createdAt !== null && "toMillis" in right.createdAt
            ? Number((right.createdAt as { toMillis: () => number }).toMillis())
            : 0;
          return leftTime - rightTime;
        });
      onChange(messages);
    },
    onError,
  );
}

export async function sendChatMessage(
  chatId: string,
  senderId: string,
  text: string,
  kind: GatekeeperMessage["kind"] = "text",
): Promise<void> {
  const normalizedText = text.trim();
  if (!normalizedText) throw new Error("Tin nhắn không được để trống.");
  if (normalizedText.length > 4000) throw new Error("Tin nhắn vượt quá 4.000 ký tự.");
  const messages = collection(db(), "chats", chatId, "messages");
  await setDoc(doc(messages), {
    senderId,
    text: normalizedText,
    kind,
    createdAt: serverTimestamp(),
  });
}

export function watchPendingJoinRequests(
  groupId: string,
  onChange: (requests: GroupJoinRequest[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db(), "groups", groupId, "joinRequests"), where("status", "==", "pending")),
    (snapshot) => onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as GroupJoinRequest)),
    onError,
  );
}

export async function resolveGroupJoinRequest(
  groupId: string,
  userId: string,
  approve: boolean,
): Promise<void> {
  const groupRef = doc(db(), "groups", groupId);
  const chatRef = doc(db(), "chats", groupId);
  const requestRef = doc(db(), "groups", groupId, "joinRequests", userId);
  await runTransaction(db(), async (transaction) => {
    const [groupSnapshot, requestSnapshot, chatSnapshot] = await Promise.all([
      transaction.get(groupRef),
      transaction.get(requestRef),
      transaction.get(chatRef),
    ]);
    if (!groupSnapshot.exists() || !requestSnapshot.exists() || !chatSnapshot.exists()) {
      throw new Error("Không tìm thấy nhóm, phòng chat hoặc yêu cầu tham gia.");
    }

    const group = groupSnapshot.data() as Omit<GatekeeperGroup, "id">;
    const request = requestSnapshot.data() as GroupJoinRequest;
    if (request.status !== "pending") throw new Error("Yêu cầu này đã được xử lý.");
    if (approve) {
      const memberIds = [...new Set([...group.memberIds, userId])];
      if (memberIds.length > 200) throw new Error("Nhóm đã đạt giới hạn 200 thành viên.");
      transaction.update(groupRef, { memberIds });
      transaction.update(chatRef, { participantIds: memberIds });
    }
    transaction.update(requestRef, { status: approve ? "approved" : "rejected" });
  });
}

export async function removeGroupMember(groupId: string, ownerId: string, memberId: string): Promise<void> {
  if (ownerId === memberId) throw new Error("Trưởng nhóm không thể tự xóa mình khỏi nhóm.");
  const groupRef = doc(db(), "groups", groupId);
  const chatRef = doc(db(), "chats", groupId);
  await runTransaction(db(), async (transaction) => {
    const [groupSnapshot, chatSnapshot] = await Promise.all([
      transaction.get(groupRef),
      transaction.get(chatRef),
    ]);
    if (!groupSnapshot.exists() || !chatSnapshot.exists()) {
      throw new Error("Không tìm thấy nhóm hoặc phòng chat.");
    }
    const group = groupSnapshot.data() as Omit<GatekeeperGroup, "id">;
    if (group.ownerId !== ownerId) throw new Error("Chỉ trưởng nhóm mới có thể xóa thành viên.");
    if (!group.memberIds.includes(memberId)) throw new Error("Thành viên này không còn trong nhóm.");
    const memberIds = group.memberIds.filter((id) => id !== memberId);
    transaction.update(groupRef, { memberIds });
    transaction.update(chatRef, { participantIds: memberIds });
  });
}

export async function getPublicUser(uid: string): Promise<PublicUserProfile | null> {
  const snapshot = await getDoc(doc(db(), "users", uid));
  return snapshot.exists() ? asPublicUser(snapshot.id, snapshot.data()) : null;
}
