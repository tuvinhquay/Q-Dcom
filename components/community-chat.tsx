"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { parseQBotQuery } from "@/lib/bot/qBotParser";
import {
  createDirectChat,
  createGroup,
  getPublicUser,
  removeGroupMember,
  requestToJoinGroup,
  resolveGroupJoinRequest,
  searchPublicUsers,
  sendChatMessage,
  watchChatMessages,
  watchGroups,
  watchPendingJoinRequests,
  watchUserChats,
  type GatekeeperChat,
  type GatekeeperGroup,
  type GatekeeperMessage,
  type GroupJoinRequest,
  type PublicUserProfile,
} from "@/lib/services/gatekeeperService";
import type { Product } from "@/types/product";

type CommunityChatProps = {
  uid: string;
  displayName: string;
  products: Product[];
};

const invitePrefix = "qdcom://";

export function CommunityChat({ uid, displayName, products }: CommunityChatProps) {
  const [chats, setChats] = useState<GatekeeperChat[]>([]);
  const [groups, setGroups] = useState<GatekeeperGroup[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [messageState, setMessageState] = useState<{ chatId: string; messages: GatekeeperMessage[] }>({ chatId: "", messages: [] });
  const [profiles, setProfiles] = useState<Record<string, PublicUserProfile>>({});
  const [joinRequests, setJoinRequests] = useState<Record<string, GroupJoinRequest[]>>({});
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<PublicUserProfile[]>([]);
  const [groupName, setGroupName] = useState("");
  const [messageText, setMessageText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => watchUserChats(uid, setChats, (reason) => setError(reason.message)), [uid]);
  useEffect(() => watchGroups(setGroups, (reason) => setError(reason.message)), []);

  const selectedChatId = chats.some(({ id }) => id === activeChatId) ? activeChatId : chats[0]?.id ?? "";
  const messages = useMemo(
    () => messageState.chatId === selectedChatId ? messageState.messages : [],
    [messageState, selectedChatId],
  );
  useEffect(() => {
    if (!selectedChatId) return;
    return watchChatMessages(
      selectedChatId,
      (nextMessages) => setMessageState({ chatId: selectedChatId, messages: nextMessages }),
      (reason) => setError(reason.message),
    );
  }, [selectedChatId]);

  useEffect(() => {
    const otherUids = [...new Set(chats.flatMap((chat) => chat.participantIds).filter((id) => id !== uid))];
    if (!otherUids.length) return;
    let cancelled = false;
    void Promise.all(otherUids.map((id) => getPublicUser(id)))
      .then((results) => {
        if (cancelled) return;
        setProfiles((current) => ({
          ...current,
          ...Object.fromEntries(results.filter((profile): profile is PublicUserProfile => profile !== null).map((profile) => [profile.uid, profile])),
        }));
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không thể tải hồ sơ thành viên."));
    return () => { cancelled = true; };
  }, [chats, uid]);

  useEffect(() => {
    const ownedGroups = groups.filter((group) => group.ownerId === uid);
    const subscriptions = ownedGroups.map((group) => watchPendingJoinRequests(
      group.id,
      (requests) => setJoinRequests((current) => ({ ...current, [group.id]: requests })),
      (reason) => setError(reason.message),
    ));
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [groups, uid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function searchPeople(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = searchText.trim();
    if (search.length < 2) return;
    setBusy(true);
    setError("");
    try {
      let results: PublicUserProfile[];
      if (search.startsWith(`${invitePrefix}group/`)) {
        const groupId = search.slice(`${invitePrefix}group/`.length);
        if (!groups.some((group) => group.id === groupId)) throw new Error("Không tìm thấy nhóm theo mã QR này.");
        await joinGroup(groupId);
        results = [];
      } else if (search.startsWith(`${invitePrefix}user/`)) {
        const profile = await getPublicUser(search.slice(`${invitePrefix}user/`.length));
        results = profile && profile.uid !== uid ? [profile] : [];
      } else {
        results = await searchPublicUsers(search, uid);
      }
      setSearchResults(results);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tìm thành viên.");
    } finally {
      setBusy(false);
    }
  }

  async function startDirectChat(profile: PublicUserProfile) {
    setBusy(true);
    setError("");
    try {
      setActiveChatId(await createDirectChat(uid, profile.uid));
      setProfiles((current) => ({ ...current, [profile.uid]: profile }));
      setSearchResults([]);
      setSearchText("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể mở cuộc trò chuyện.");
    } finally {
      setBusy(false);
    }
  }

  async function makeGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const group = await createGroup(groupName, uid);
      setGroupName("");
      setActiveChatId(group.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo nhóm.");
    } finally {
      setBusy(false);
    }
  }

  async function joinGroup(groupId: string) {
    setBusy(true);
    setError("");
    try {
      await requestToJoinGroup(groupId, uid);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể gửi yêu cầu tham gia nhóm.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeChatId || !messageText.trim()) return;
    const text = messageText.trim();
    setBusy(true);
    setError("");
    try {
      await sendChatMessage(activeChatId, uid, text, /^@q\b/i.test(text) ? "q-query" : "text");
      setMessageText("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể gửi tin nhắn.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinRequest(groupId: string, memberId: string, approve: boolean) {
    setError("");
    try {
      await resolveGroupJoinRequest(groupId, memberId, approve);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xử lý yêu cầu vào nhóm.");
    }
  }

  async function removeMember(groupId: string, memberId: string) {
    if (!window.confirm(`Xóa ${profiles[memberId]?.fullName ?? memberId} khỏi nhóm?`)) return;
    setError("");
    try {
      await removeGroupMember(groupId, uid, memberId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xóa thành viên khỏi nhóm.");
    }
  }

  const activeChat = chats.find(({ id }) => id === selectedChatId);
  const activeGroup = activeChat?.groupId ? groups.find(({ id }) => id === activeChat.groupId) : undefined;
  const displayChatName = (chat: GatekeeperChat) => chat.name
    ?? chat.participantIds.filter((id) => id !== uid).map((id) => profiles[id]?.fullName ?? "Thành viên").join(", ");

  return <section className="community-layout">
    <aside className="community-sidebar glass">
      <h2>Trò chuyện</h2>
      <form className="community-form" onSubmit={searchPeople}>
        <label htmlFor="community-search">Tìm ID thành viên / mã QR</label>
        <div className="community-search-row">
          <input id="community-search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Mã ID hoặc qdcom://user/…" />
          <button className="secondary-btn" disabled={busy}>Tìm</button>
        </div>
      </form>
      {searchResults.map((profile) => <div className="community-result" key={profile.uid}>
        <span><strong>{profile.fullName}</strong><small>ID: {profile.memberId}</small></span>
        <button className="quiet-btn" disabled={busy} onClick={() => void startDirectChat(profile)}>Nhắn tin</button>
      </div>)}
      <form className="community-form" onSubmit={(event) => void makeGroup(event)}>
        <label htmlFor="group-name">Tạo nhóm chat</label>
        <div className="community-search-row">
          <input id="group-name" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Tên nhóm mới" maxLength={100} />
          <button className="secondary-btn" disabled={busy || !groupName.trim()}>Tạo</button>
        </div>
      </form>
      <div className="community-list-heading">Phòng chat</div>
      <div className="community-chat-list">
        {chats.map((chat) => <button
          type="button"
          key={chat.id}
          className={`community-chat-item ${chat.id === selectedChatId ? "active" : ""}`}
          onClick={() => setActiveChatId(chat.id)}
        >
          <strong>{displayChatName(chat)}</strong>
          <small>{chat.chatType === "group"
            ? `${chat.participantIds.length} thành viên${chat.groupId && joinRequests[chat.groupId]?.length ? ` · ${joinRequests[chat.groupId].length} yêu cầu mới` : ""}`
            : "Chat riêng"}</small>
        </button>)}
        {!chats.length && <p className="community-empty">Tìm thành viên hoặc tạo nhóm để bắt đầu.</p>}
      </div>
      <div className="community-list-heading">Nhóm có thể tham gia</div>
      <div className="community-group-list">
        {groups.filter((group) => !group.memberIds.includes(uid)).map((group) => <div className="community-group-row" key={group.id}>
          <span><strong>{group.name}</strong><small>Mã mời: {group.id}</small></span>
          <button className="quiet-btn" disabled={busy} onClick={() => void joinGroup(group.id)}>Xin vào</button>
        </div>)}
      </div>
      <div className="community-profile-qr">
        <QRCodeSVG value={`${invitePrefix}user/${uid}`} size={76} aria-label={`Mã QR hồ sơ của ${displayName}`} />
        <small>Mã QR kết nối · {displayName}</small>
      </div>
    </aside>

    <section className="community-room glass">
      {activeChat ? <>
        <header className="community-room-header">
          <div><h2>{displayChatName(activeChat)}</h2><small>{activeGroup ? `${activeGroup.memberIds.length} thành viên · mã mời ${activeGroup.id}` : "Chat riêng tư được bảo vệ bởi Firebase"}</small></div>
          {activeGroup && <details className="community-invite">
            <summary>Mã mời / QR</summary>
            <div><QRCodeSVG value={`${invitePrefix}group/${activeGroup.id}`} size={96} aria-label={`Mã QR mời vào nhóm ${activeGroup.name}`} /><code>{activeGroup.id}</code></div>
          </details>}
        </header>
        {activeGroup?.ownerId === uid && (joinRequests[activeGroup.id] ?? []).length > 0 && <div className="community-requests">
          <strong>Yêu cầu tham gia ({joinRequests[activeGroup.id].length})</strong>
          {(joinRequests[activeGroup.id] ?? []).map((request) => <div className="community-result" key={request.id}>
            <span>{profiles[request.userId]?.fullName ?? request.userId}</span>
            <button className="quiet-btn" onClick={() => void handleJoinRequest(activeGroup.id, request.userId, true)}>Duyệt</button>
            <button className="quiet-btn" onClick={() => void handleJoinRequest(activeGroup.id, request.userId, false)}>Từ chối</button>
          </div>)}
        </div>}
        {activeGroup?.ownerId === uid && <div className="community-managed-members">
          <strong>Thành viên nhóm</strong>
          {activeGroup.memberIds.map((memberId) => <div className="community-result" key={memberId}>
            <span>{profiles[memberId]?.fullName ?? (memberId === uid ? displayName : memberId)}</span>
            {memberId !== uid && <button className="quiet-btn" onClick={() => void removeMember(activeGroup.id, memberId)}>Xóa</button>}
          </div>)}
        </div>}
        <div className="community-messages" aria-live="polite">
          {messages.map((message) => {
            const isQuery = message.kind === "q-query" || /^@q\b/i.test(message.text);
            const localAnswer = isQuery ? parseQBotQuery(message.text, products) : null;
            return <article className={`community-message ${message.senderId === uid ? "mine" : ""}`} key={message.id}>
              <strong>{message.senderId === uid ? "Bạn" : profiles[message.senderId]?.fullName ?? "Thành viên"}</strong>
              <p>{message.text}</p>
              {localAnswer && <div className="community-local-answer">
                <strong>@q · Kết quả cục bộ</strong>
                <span>{localAnswer.message}</span>
                {localAnswer.products.map((product) => <span key={product.id}>{product.name} · ID {product.id} · còn {product.quantity} · {product.location}</span>)}
                <small>Được tra cứu trên IndexedDB của thiết bị này; chi tiết kho không gửi lên Firestore.</small>
              </div>}
            </article>;
          })}
          {!messages.length && <p className="community-empty">Chưa có tin nhắn. Gửi @q kèm câu hỏi để tra cứu kho cục bộ.</p>}
          <div ref={messagesEndRef} />
        </div>
        <form className="community-compose" onSubmit={(event) => void handleMessage(event)}>
          <input value={messageText} onChange={(event) => setMessageText(event.target.value)} maxLength={4000} placeholder="Tin nhắn hoặc @q <từ khóa/câu hỏi>…" aria-label="Soạn tin nhắn" />
          <button className="primary-btn" disabled={busy || !messageText.trim()}>Gửi</button>
        </form>
      </> : <div className="community-empty community-no-chat">Chọn một phòng chat hoặc tạo cuộc trò chuyện mới.</div>}
      {error && <p className="community-error" role="alert">{error}</p>}
    </section>
  </section>;
}
