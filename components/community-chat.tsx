"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Check, MessageCircle, Plus, QrCode, Search, Send, ShieldCheck, UserRound, UsersRound, X } from "lucide-react";
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

function displayError(reason: unknown, fallback: string): string {
  if (!(reason instanceof Error)) return fallback;
  const code = "code" in reason ? reason.code : undefined;
  if (code === "permission-denied" || reason.message.includes("Missing or insufficient permissions")) {
    return "Firestore từ chối thao tác. Hãy đăng nhập lại bằng Google và xác nhận firestore.rules mới nhất đã được deploy.";
  }
  return reason.message || fallback;
}

function MemberAvatar({ name, isGroup = false }: { name: string; isGroup?: boolean }) {
  return <span className={`community-avatar${isGroup ? " group" : ""}`} aria-hidden="true">
    {isGroup ? <UsersRound /> : name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("").toLocaleUpperCase("vi") || <UserRound />}
  </span>;
}

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
  const [mobileRoomOpen, setMobileRoomOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => watchUserChats(uid, (nextChats) => {
    setChats(nextChats);
    setError("");
  }, (reason) => setError(displayError(reason, "Không thể tải danh sách phòng chat."))), [uid]);
  useEffect(() => watchGroups((nextGroups) => {
    setGroups(nextGroups);
    setError("");
  }, (reason) => setError(displayError(reason, "Không thể tải danh sách nhóm."))), []);

  const selectedChatId = chats.some(({ id }) => id === activeChatId) ? activeChatId : chats[0]?.id ?? "";
  const messages = useMemo(
    () => messageState.chatId === selectedChatId ? messageState.messages : [],
    [messageState, selectedChatId],
  );
  useEffect(() => {
    if (!selectedChatId) return;
    return watchChatMessages(
      selectedChatId,
      (nextMessages) => {
        setMessageState({ chatId: selectedChatId, messages: nextMessages });
        setError("");
      },
      (reason) => setError(displayError(reason, "Không thể tải tin nhắn của phòng này.")),
    );
  }, [selectedChatId]);

  useEffect(() => {
    const chatUids = chats.flatMap((chat) => chat.participantIds);
    const requesterUids = Object.values(joinRequests).flatMap((requests) => requests.map((request) => request.userId));
    const otherUids = [...new Set([...chatUids, ...requesterUids].filter((id) => id !== uid))];
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
      .catch((reason: unknown) => setError(displayError(reason, "Không thể tải hồ sơ thành viên.")));
    return () => { cancelled = true; };
  }, [chats, joinRequests, uid]);

  useEffect(() => {
    const ownedGroups = groups.filter((group) => group.ownerId === uid);
    const subscriptions = ownedGroups.map((group) => watchPendingJoinRequests(
      group.id,
      (requests) => setJoinRequests((current) => ({ ...current, [group.id]: requests })),
      (reason) => setError(displayError(reason, "Không thể tải yêu cầu tham gia nhóm.")),
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
      setError(displayError(reason, "Không thể tìm thành viên."));
    } finally {
      setBusy(false);
    }
  }

  async function startDirectChat(profile: PublicUserProfile) {
    setBusy(true);
    setError("");
    try {
      setActiveChatId(await createDirectChat(uid, profile.uid));
      setMobileRoomOpen(true);
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
      setMobileRoomOpen(true);
    } catch (reason) {
      setError(displayError(reason, "Không thể tạo nhóm."));
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
      setError(displayError(reason, "Không thể gửi yêu cầu tham gia nhóm."));
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
      setError(displayError(reason, "Không thể gửi tin nhắn."));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinRequest(groupId: string, memberId: string, approve: boolean) {
    setError("");
    try {
      await resolveGroupJoinRequest(groupId, memberId, approve);
    } catch (reason) {
      setError(displayError(reason, "Không thể xử lý yêu cầu vào nhóm."));
    }
  }

  async function removeMember(groupId: string, memberId: string) {
    if (!window.confirm(`Xóa ${profiles[memberId]?.fullName ?? memberId} khỏi nhóm?`)) return;
    setError("");
    try {
      await removeGroupMember(groupId, uid, memberId);
    } catch (reason) {
      setError(displayError(reason, "Không thể xóa thành viên khỏi nhóm."));
    }
  }

  const activeChat = chats.find(({ id }) => id === selectedChatId);
  const activeGroup = activeChat?.groupId ? groups.find(({ id }) => id === activeChat.groupId) : undefined;
  const displayChatName = (chat: GatekeeperChat) => chat.name
    ?? chat.participantIds.filter((id) => id !== uid).map((id) => profiles[id]?.fullName ?? "Thành viên").join(", ");

  return <section className={`community-layout${mobileRoomOpen ? " mobile-room-active" : ""}`} aria-label="Cộng đồng chat">
    <aside className="community-sidebar glass">
      <header className="community-sidebar-heading">
        <div><span className="community-eyebrow">Q-DCOM COMMUNITY</span><h2>Tin nhắn</h2></div>
        <span className="community-online-indicator" aria-label="Đã kết nối Firebase"><i /> Trực tuyến</span>
      </header>

      <section className="community-tool-card">
        <form className="community-form" onSubmit={searchPeople}>
          <label htmlFor="community-search"><Search /> Tìm thành viên</label>
          <div className="community-search-row">
            <input id="community-search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Nhập ID hoặc dán mã QR…" />
            <button className="community-icon-button" type="submit" disabled={busy || searchText.trim().length < 2} aria-label="Tìm thành viên"><Search /></button>
          </div>
          <small>Tìm theo ID thành viên hoặc quét/dán liên kết qdcom://user/…</small>
        </form>
        {searchResults.map((profile) => <div className="community-result" key={profile.uid}>
          <MemberAvatar name={profile.fullName} />
          <span><strong>{profile.fullName}</strong><small>ID thành viên · {profile.memberId}</small></span>
          <button className="community-action-button" disabled={busy} onClick={() => void startDirectChat(profile)}><MessageCircle /> Nhắn tin</button>
        </div>)}
      </section>

      <form className="community-create-card" onSubmit={(event) => void makeGroup(event)}>
        <span className="community-create-icon"><Plus /></span>
        <label htmlFor="group-name"><strong>Tạo nhóm mới</strong><small>Mời mọi người cùng trò chuyện</small></label>
        <input id="group-name" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Tên nhóm" maxLength={100} />
        <button className="community-create-button" type="submit" disabled={busy || !groupName.trim()}><Plus /> Tạo nhóm</button>
      </form>

      <div className="community-list-section">
        <div className="community-list-heading"><span>Cuộc trò chuyện</span><span>{chats.length}</span></div>
        <div className="community-chat-list">
          {chats.map((chat) => {
            const chatName = displayChatName(chat);
            const unreadRequests = chat.groupId ? joinRequests[chat.groupId]?.length ?? 0 : 0;
            return <button
              type="button"
              key={chat.id}
              className={`community-chat-item ${chat.id === selectedChatId ? "active" : ""}`}
              aria-current={chat.id === selectedChatId ? "true" : undefined}
              onClick={() => { setActiveChatId(chat.id); setMobileRoomOpen(true); }}
            >
              <MemberAvatar name={chatName} isGroup={chat.chatType === "group"} />
              <span className="community-chat-copy">
                <strong>{chatName}</strong>
                <small>{chat.chatType === "group" ? `${chat.participantIds.length} thành viên` : "Chat riêng tư"}</small>
              </span>
              {unreadRequests > 0 && <span className="community-count-badge" aria-label={`${unreadRequests} yêu cầu mới`}>{unreadRequests}</span>}
            </button>;
          })}
          {!chats.length && <p className="community-empty">Chưa có cuộc trò chuyện. Tìm thành viên hoặc tạo nhóm để bắt đầu.</p>}
        </div>
      </div>

      <div className="community-list-section community-discover-section">
        <div className="community-list-heading"><span>Khám phá nhóm</span><span>{groups.filter((group) => !group.memberIds.includes(uid)).length}</span></div>
        <div className="community-group-list">
          {groups.filter((group) => !group.memberIds.includes(uid)).map((group) => <div className="community-group-row" key={group.id}>
            <MemberAvatar name={group.name} isGroup />
            <span><strong>{group.name}</strong><small>{group.memberIds.length} thành viên</small></span>
            <button className="community-join-button" disabled={busy} onClick={() => void joinGroup(group.id)}>Xin vào</button>
          </div>)}
          {!groups.some((group) => !group.memberIds.includes(uid)) && <p className="community-empty">Không có nhóm công khai nào khác.</p>}
        </div>
      </div>

      <div className="community-profile-card">
        <div className="community-qr-frame"><QRCodeSVG value={`${invitePrefix}user/${uid}`} size={52} aria-label={`Mã QR hồ sơ của ${displayName}`} /></div>
        <div><strong>Hồ sơ của bạn</strong><small>Chia sẻ mã để kết nối</small></div>
        <QrCode aria-hidden="true" />
      </div>
    </aside>

    <section className="community-room glass">
      {activeChat ? <>
        <header className="community-room-header">
          <button type="button" className="community-mobile-back" onClick={() => setMobileRoomOpen(false)} aria-label="Quay lại danh sách chat"><ArrowLeft /></button>
          <MemberAvatar name={displayChatName(activeChat)} isGroup={activeChat.chatType === "group"} />
          <div className="community-room-title">
            <h2>{displayChatName(activeChat)}</h2>
            <small>{activeGroup ? <><span className="community-secure-label"><ShieldCheck /> Nhóm riêng tư</span><span> · {activeGroup.memberIds.length} thành viên</span></> : <><span className="community-secure-label"><ShieldCheck /> Chat riêng tư</span></>}</small>
          </div>
          {activeGroup && <details className="community-invite">
            <summary aria-label="Hiển thị mã mời nhóm"><QrCode /><span>Mời</span></summary>
            <div><QRCodeSVG value={`${invitePrefix}group/${activeGroup.id}`} size={112} aria-label={`Mã QR mời vào nhóm ${activeGroup.name}`} /><strong>{activeGroup.name}</strong><code>{activeGroup.id}</code></div>
          </details>}
        </header>
        {activeGroup?.ownerId === uid && (joinRequests[activeGroup.id] ?? []).length > 0 && <div className="community-requests">
          <div className="community-admin-heading"><strong>Yêu cầu tham gia</strong><span>{joinRequests[activeGroup.id].length} đang chờ</span></div>
          {(joinRequests[activeGroup.id] ?? []).map((request) => {
            const requestName = profiles[request.userId]?.fullName ?? request.userId;
            return <div className="community-admin-row" key={request.id}>
              <MemberAvatar name={requestName} />
              <span><strong>{requestName}</strong><small>Đang xin tham gia nhóm</small></span>
              <button className="community-approve-button" onClick={() => void handleJoinRequest(activeGroup.id, request.userId, true)} aria-label={`Duyệt ${requestName}`}><Check /></button>
              <button className="community-decline-button" onClick={() => void handleJoinRequest(activeGroup.id, request.userId, false)} aria-label={`Từ chối ${requestName}`}><X /></button>
            </div>;
          })}
        </div>}
        {activeGroup?.ownerId === uid && <details className="community-managed-members">
          <summary><UsersRound /><span>Quản lý thành viên</span><span className="community-member-count">{activeGroup.memberIds.length}</span></summary>
          <div className="community-managed-list">
            {activeGroup.memberIds.map((memberId) => {
              const memberName = profiles[memberId]?.fullName ?? (memberId === uid ? displayName : memberId);
              return <div className="community-admin-row" key={memberId}>
                <MemberAvatar name={memberName} />
                <span><strong>{memberName}</strong><small>{memberId === activeGroup.ownerId ? "Trưởng nhóm" : "Thành viên"}</small></span>
                {memberId !== uid && <button className="community-remove-button" onClick={() => void removeMember(activeGroup.id, memberId)} aria-label={`Xóa ${memberName} khỏi nhóm`}><X /></button>}
              </div>;
            })}
          </div>
        </details>}
        <div className="community-messages" aria-live="polite" aria-label="Tin nhắn">
          {messages.map((message) => {
            const isOwnMessage = message.senderId === uid;
            const senderName = isOwnMessage ? displayName : profiles[message.senderId]?.fullName ?? "Thành viên";
            const isQuery = message.kind === "q-query" || /^@q\b/i.test(message.text);
            const localAnswer = isQuery ? parseQBotQuery(message.text, products) : null;
            return <article className={`community-message${isOwnMessage ? " mine" : ""}`} key={message.id}>
              {!isOwnMessage && <MemberAvatar name={senderName} />}
              <div className="community-message-content">
                {!isOwnMessage && <strong className="community-sender-name">{senderName}</strong>}
                <div className="community-bubble">
                  <p>{message.text}</p>
                  {localAnswer && <div className="community-local-answer">
                    <div className="community-answer-heading"><span className="community-bot-mark">@q</span><strong>Kết quả tra cứu</strong></div>
                    <span>{localAnswer.message}</span>
                    {localAnswer.products.map((product) => <div className="community-product-result" key={product.id}>
                      <strong>{product.name}</strong><small>ID {product.id} · Còn {product.quantity} · {product.location}</small>
                    </div>)}
                    <small>Tra cứu từ IndexedDB trên thiết bị này; thông tin kho không được gửi lên Firestore.</small>
                  </div>}
                </div>
                {isOwnMessage && <small className="community-message-status">Bạn</small>}
              </div>
            </article>;
          })}
          {!messages.length && <div className="community-empty-state"><span><MessageCircle /></span><strong>Bắt đầu cuộc trò chuyện</strong><p>Gửi tin nhắn đầu tiên hoặc hỏi @q để tra cứu kho cục bộ.</p></div>}
          <div ref={messagesEndRef} />
        </div>
        {error && <div className="community-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Đóng thông báo"><X /></button></div>}
        <form className="community-compose" onSubmit={(event) => void handleMessage(event)}>
          <input value={messageText} onChange={(event) => setMessageText(event.target.value)} maxLength={4000} placeholder="Viết tin nhắn…  (dùng @q để tra cứu kho)" aria-label="Soạn tin nhắn" />
          <button className="community-send-button" disabled={busy || !messageText.trim()} aria-label="Gửi tin nhắn"><Send /><span>Gửi</span></button>
        </form>
        <small className="community-compose-hint">Enter để gửi · @q &lt;câu hỏi&gt; tra cứu dữ liệu cục bộ</small>
      </> : <>
        <div className="community-welcome">
          <span className="community-welcome-icon"><MessageCircle /></span>
          <span className="community-eyebrow">Q-DCOM COMMUNITY</span>
          <h2>Kết nối cùng cộng đồng</h2>
          <p>Chọn một cuộc trò chuyện, tìm thành viên theo ID hoặc tạo nhóm để bắt đầu.</p>
          <div className="community-welcome-note"><ShieldCheck /> Tin nhắn được bảo vệ bởi quyền thành viên Firebase.</div>
        </div>
        {error && <div className="community-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Đóng thông báo"><X /></button></div>}
      </>}
    </section>
  </section>;
}
