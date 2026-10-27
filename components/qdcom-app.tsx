"use client";

import {
  Activity, ArrowRight, BadgeCheck, BarChart3, Bot, Boxes, Check, CheckCircle2, ChevronRight,
  Camera, CircleAlert, Download, ImagePlus, LayoutDashboard, LockKeyhole, LogOut,
  MapPin, MessageCircle, Package, Paperclip, Pencil, Plus, QrCode, Rocket, Search, Send,
  Settings as SettingsIcon, ShieldCheck, SlidersHorizontal, Sparkles, Trash2,
  TrendingUp, Utensils, Upload, Users, Video, X, IdCard, UserRound, BriefcaseBusiness,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ChangeEvent, CSSProperties, FormEvent, ReactNode } from "react";
import { startTransition, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { BackgroundVideo } from "@/components/background-video";
import { CommunityChat } from "@/components/community-chat";
import { WorkshopDashboard } from "@/components/workshop-dashboard";
import { GlassmorphismAnimationBackground } from "@/components/glassmorphism-animation-background";
import { GoogleDriveLoginButton } from "@/components/google-drive-login-button";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductImage } from "@/components/products/ProductImage";
import { QrCameraScanner } from "@/components/qr-camera-scanner";
import { SearchBar } from "@/components/search/SearchBar";
import { parseQBotQuery } from "@/lib/bot/qBotParser";
import { copyDefaultVocabulary, type BotIntent, type BotVocabulary } from "@/lib/bot/vocabulary";
import { qdcomDB, type QDcomMember } from "@/lib/db/qdcomDB";
import { isFirebaseConfigured, signOutFirebaseUser, type GoogleAuthSession } from "@/lib/firebase";
import { parseBackup, parseSharePayload, serializeBackup, createSharePayload } from "@/lib/sync/qdcomSync";
import { getGoogleDriveStorageQuota, syncBackupToGoogleDrive, type GoogleDriveStorageQuota } from "@/lib/sync/googleDriveBackup";
import { savePublicUserProfile } from "@/lib/services/gatekeeperService";
import { adjustProductQuantity, deleteProduct, listProducts, saveProduct } from "@/lib/services/productService";
import { getActiveTenantId, subscribeActiveTenantChange } from "@/lib/tenancy/activeTenant";
import type { Product, ProductStatus } from "@/types/product";

type PageKey = "inventory" | "bot" | "community" | "reports" | "workshop" | "about" | "privacy" | "settings";
type MenuItem =
  | { id: PageKey; label: string; icon: typeof Package; preview?: false }
  | { id: "food" | "productivity"; label: string; icon: typeof Package; preview: true };
type ChatMessage = { id: number; role: "user" | "assistant"; text: string; productIds?: string[] };
type Settings = { videoEnabled: boolean; glassBlur: number; glassOpacity: number; videoTint: string };
type UserProfile = { peerId: string; googleSub?: string; firebaseUid?: string; displayName: string; email: string; avatar: string; memberId?: string; specialty?: string };
type ProductDraft = Omit<Product, "created_at" | "updated_at">;
const SETTINGS_KEY = "qdcom.settings.v1";
const VOCABULARY_KEY = "qdcom.bot-vocabulary.v1";
const CHAT_KEY = "qdcom.chat.v1";
const PROFILE_KEY = "qdcom.user_profile.v1";
const LOCAL_MEMBERS_KEY = "qdcom.local_members.v1";
const PEER_KEY = "qdcom.peer_id.v1";
const defaults: Settings = { videoEnabled: true, glassBlur: 18, glassOpacity: 74, videoTint: "#2563eb" };
const navGroups: { label: string; items: MenuItem[] }[] = [
  {
    label: "📱 Quản lý chính",
    items: [
      { id: "inventory", label: "Mẫu hàng & Kho", icon: LayoutDashboard },
      { id: "bot", label: "Tra cứu @q", icon: MessageCircle },
      { id: "community", label: "Cộng đồng chat", icon: Users },
      { id: "reports", label: "Tổng quan kho", icon: BarChart3 },
      { id: "workshop", label: "Sản lượng xưởng", icon: TrendingUp },
    ],
  },
  {
    label: "💡 Giới thiệu & phát triển dự án",
    items: [
      { id: "about", label: "Giới thiệu Q-Dcom", icon: Rocket },
      { id: "privacy", label: "Chính sách bảo mật dữ liệu", icon: ShieldCheck },
    ],
  },
  { label: "⚙️ Hệ thống", items: [{ id: "settings", label: "Cài đặt", icon: SettingsIcon }] },
  {
    label: "⏳ Tính năng đang phát triển",
    items: [
      { id: "food", label: "Đặt đồ ăn nhanh", icon: Utensils, preview: true },
      { id: "productivity", label: "Tính sản lượng & Năng suất", icon: TrendingUp, preview: true },
    ],
  },
];
const pageNames: Record<PageKey, string> = {
  inventory: "Mẫu hàng & Kho",
  bot: "Tra cứu @q",
  community: "Cộng đồng chat",
  reports: "Tổng quan kho",
  workshop: "Quản lý sản lượng xưởng",
  about: "Giới thiệu Q-Dcom",
  privacy: "Chính sách bảo mật dữ liệu",
  settings: "Cài đặt chung",
};
const previewMessage = "Tính năng đang trong quá trình hoàn thiện và sẽ ra mắt ở phiên bản tiếp theo!";
const statusNames: Record<ProductStatus, string> = { available: "Còn hàng", low_stock: "Sắp hết", out_of_stock: "Hết hàng", hidden: "Đang ẩn" };

function readSaved<T>(key: string, fallback: T): T {
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
}
function readUserProfile(): UserProfile | null {
  const profile = readSaved<Partial<UserProfile> | null>(PROFILE_KEY, null);
  return profile && typeof profile.peerId === "string" &&
    typeof profile.displayName === "string" && typeof profile.email === "string" && typeof profile.avatar === "string"
    ? profile as UserProfile
    : null;
}
function readLocalMembers(): UserProfile[] {
  const members = readSaved<Partial<UserProfile>[]>(LOCAL_MEMBERS_KEY, []);
  return Array.isArray(members) ? members.filter((profile): profile is UserProfile =>
    typeof profile.peerId === "string" && typeof profile.memberId === "string" &&
    typeof profile.displayName === "string" && typeof profile.specialty === "string" &&
    typeof profile.email === "string" && typeof profile.avatar === "string") : [];
}
function formatBytes(value: number) {
  const gigabytes = value / (1024 ** 3);
  return `${gigabytes.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} GB`;
}
function stockStatus(quantity: number): ProductStatus { return quantity <= 0 ? "out_of_stock" : quantity <= 4 ? "low_stock" : "available"; }
function newId() { return `qd${Math.random().toString(36).slice(2, 8)}`; }
function emptyDraft(product?: Product): ProductDraft {
  if (product) {
    const { created_at, updated_at, ...draft } = product;
    void created_at;
    void updated_at;
    return draft;
  }
  return { id: newId(), name: "", brand: "", color: "", size: [], quantity: 0, image_urls: [], image_notes: "", description: "", category: "Giày", status: "out_of_stock", location: "", created_by: "Trần Ngọc", search_keywords: [] };
}

function Badge({ status }: { status: ProductStatus }) {
  const tone = status === "low_stock" ? "low" : status === "out_of_stock" ? "out" : status === "hidden" ? "hidden" : "";
  return <span className={`status-badge ${tone}`}><i />{statusNames[status]}</span>;
}

export function QDcomApp() {
  const [page, setPage] = useState<PageKey>("inventory");
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTenantId, setActiveTenantId] = useState("local-default");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [registrationDraft, setRegistrationDraft] = useState({ memberId: "", fullName: "", specialty: "", avatar: "" });
  const [localLoginId, setLocalLoginId] = useState("");
  const [members, setMembers] = useState<QDcomMember[]>([]);
  const [settings, setSettings] = useState<Settings>(defaults);
  const [vocabulary, setVocabulary] = useState<BotVocabulary>(copyDefaultVocabulary());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stockOpen, setStockOpen] = useState(false);
  const [stockDelta, setStockDelta] = useState("0");
  const [draft, setDraft] = useState<ProductDraft>(() => emptyDraft());
  const [botInput, setBotInput] = useState("");
  const [newWord, setNewWord] = useState("");
  const [newIntent, setNewIntent] = useState<Exclude<BotIntent, "SEARCH">>("CHECK_QUANTITY");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareValue, setShareValue] = useState("");
  const [shareSelection, setShareSelection] = useState<string[]>([]);
  const [omitBackupImages, setOmitBackupImages] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveSyncStatus, setDriveSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [driveSyncMessage, setDriveSyncMessage] = useState("");
  const [driveQuota, setDriveQuota] = useState<GoogleDriveStorageQuota | null>(null);
  const [driveQuotaError, setDriveQuotaError] = useState("");
  const messageEnd = useRef<HTMLDivElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const driveAccessToken = useRef<string | null>(null);
  const driveSyncQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const storedSettings = readSaved<Partial<Settings>>(SETTINGS_KEY, {});
    const savedSettings = { ...defaults, ...storedSettings };
    const savedMessages = readSaved<ChatMessage[]>(CHAT_KEY, []);
    startTransition(() => {
      setSettings(savedSettings);
      setUserProfile(readUserProfile());
      setMessages(savedMessages.length ? savedMessages : [{ id: Date.now(), role: "assistant", text: "Chào bạn! Mình là Q-Dcom Bot. Nhập mã mẫu, tên hàng hoặc vị trí kệ để bắt đầu tra cứu." }]);
    });
    const initialTenantId = getActiveTenantId();
    setActiveTenantId(initialTenantId);
    const unsubscribeTenant = subscribeActiveTenantChange((tenantId) => {
      setActiveTenantId(tenantId);
      setSelectedId(null);
      void listProducts(tenantId).then(setProducts).catch((error: unknown) => notify(error instanceof Error ? error.message : "Không thể đổi dữ liệu sang xưởng đã chọn."));
    });
    void Promise.all([listProducts(initialTenantId), qdcomDB.botVocabulary.get("main"), qdcomDB.members.toArray()])
      .then(([loadedProducts, storedVocabulary, storedMembers]) => {
        setProducts(loadedProducts);
        setMembers(storedMembers);
        const savedVocabulary = storedVocabulary?.value ?? readSaved<BotVocabulary>(VOCABULARY_KEY, copyDefaultVocabulary());
        setVocabulary(savedVocabulary);
        if (!storedVocabulary) void qdcomDB.botVocabulary.put({ id: "main", value: savedVocabulary });
      })
      .catch((error: unknown) => notify(error instanceof Error ? error.message : "Không thể mở cơ sở dữ liệu ngoại tuyến."))
      .finally(() => setReady(true));
    return unsubscribeTenant;
  }, []);
  useEffect(() => {
    if (messages.length) window.localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-80)));
    messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  useEffect(() => {
    if (!ready || !userProfile || !driveAccessToken.current) return;
    const accessToken = driveAccessToken.current;
    const contents = serializeBackup(products, vocabulary, members);
    const timeout = window.setTimeout(() => {
      setDriveSyncStatus("syncing");
      const sync = driveSyncQueue.current.then(
        () => syncBackupToGoogleDrive(accessToken, contents),
        () => syncBackupToGoogleDrive(accessToken, contents),
      );
      driveSyncQueue.current = sync;
      void sync.then(() => {
        if (driveAccessToken.current !== accessToken) return;
        setDriveSyncStatus("synced");
        setDriveSyncMessage("");
        void refreshDriveQuota(accessToken);
      }).catch((error: unknown) => {
        if (driveAccessToken.current !== accessToken) return;
        setDriveSyncStatus("error");
        setDriveSyncMessage(error instanceof Error ? error.message : "Không thể đồng bộ backup lên Google Drive.");
      });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [members, products, ready, userProfile, vocabulary]);
  useEffect(() => {
    if (!userProfile || userProfile.firebaseUid || userProfile.googleSub) return;
    const warnBeforeExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "Hãy nhấn Lưu trữ / Tải về bản sao dữ liệu trước khi thoát.";
    };
    window.addEventListener("beforeunload", warnBeforeExit);
    return () => window.removeEventListener("beforeunload", warnBeforeExit);
  }, [userProfile]);
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);

  const activeProducts = products.filter((product) => product.status !== "hidden");
  const shownProducts = activeProducts.filter((product) => {
    const text = query.trim().toLocaleLowerCase("vi");
    const fields = [product.name, product.id, product.brand, product.color, product.location, ...product.search_keywords];
    const textMatches = !text || fields.some((field) => field.toLocaleLowerCase("vi").includes(text));
    const statusMatches = filter === "all" || (filter === "available" && product.quantity > 4) || (filter === "low_stock" && product.quantity > 0 && product.quantity <= 4) || (filter === "out_of_stock" && product.quantity === 0);
    return textMatches && statusMatches;
  });
  const quantityTotal = activeProducts.reduce((sum, product) => sum + product.quantity, 0);
  const lowStock = activeProducts.filter((product) => product.quantity > 0 && product.quantity <= 4);
  const locationCount = new Set(activeProducts.map((product) => product.location).filter(Boolean)).size;
  const selected = products.find((product) => product.id === selectedId) ?? null;
  const appStyle = { "--glass-opacity": settings.glassOpacity / 100, "--glass-blur": `${settings.glassBlur}px` } as CSSProperties;

  function notify(text: string) { setToast(text); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(""), 2800); }
  function saveSettings(next: Settings) { setSettings(next); window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); }
  function openEditor(product?: Product) { setEditingId(product?.id ?? null); setDraft(emptyDraft(product)); setEditorOpen(true); }
  async function adjust(product: Product, delta: number) {
    try { const updated = await adjustProductQuantity(product.id, delta); setProducts((items) => items.map((item) => item.id === updated.id ? updated : item)); }
    catch (error) { notify(error instanceof Error ? error.message : "Không thể cập nhật tồn kho."); }
  }
  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.id.trim() || !draft.name.trim() || !draft.brand.trim()) return;
    if (!editingId && products.some((product) => product.id.toLowerCase() === draft.id.trim().toLowerCase())) { notify("Mã ID này đã tồn tại trong kho."); return; }
    const previous = products.find((product) => product.id === editingId);
    const now = new Date().toISOString();
    const product: Product = {
      ...draft, id: draft.id.trim(), name: draft.name.trim(), brand: draft.brand.trim(), color: draft.color.trim(),
      size: draft.size.map((size) => size.trim()).filter(Boolean), quantity: Math.max(0, Number(draft.quantity) || 0),
      image_urls: draft.image_urls.filter(Boolean), search_keywords: draft.search_keywords.map((word) => word.trim()).filter(Boolean),
      status: previous?.status === "hidden" ? "hidden" : stockStatus(Math.max(0, Number(draft.quantity) || 0)),
      created_at: previous?.created_at ?? now, updated_at: now,
    };
    setBusy(true);
    try {
      const saved = await saveProduct(product, editingId ?? undefined);
      setProducts((items) => editingId ? items.map((item) => item.id === editingId ? saved : item) : [saved, ...items]);
      setEditorOpen(false); setSelectedId(null); notify(editingId ? "Đã cập nhật mẫu hàng." : "Đã thêm mẫu hàng vào kho.");
    } catch (error) { notify(error instanceof Error ? error.message : "Không thể lưu mẫu hàng."); }
    finally { setBusy(false); }
  }
  async function removeProduct(product: Product) {
    if (!window.confirm(`Xóa mẫu ${product.name} (${product.id}) khỏi kho?`)) return;
    try { await deleteProduct(product.id); setProducts((items) => items.filter((item) => item.id !== product.id)); setSelectedId(null); setEditorOpen(false); notify("Đã xóa mẫu hàng khỏi kho."); }
    catch (error) { notify(error instanceof Error ? error.message : "Không thể xóa mẫu hàng."); }
  }
  function appendMessage(role: ChatMessage["role"], text: string, productIds?: string[]) {
    setMessages((items) => [...items, { id: Date.now() + Math.random(), role, text, ...(productIds?.length ? { productIds } : {}) }]);
  }
  function askBot(text: string) {
    const clean = text.trim(); if (!clean) return;
    appendMessage("user", clean);
    const answer = parseQBotQuery(clean, products, vocabulary, { tenantId: activeTenantId, role: "worker", uid: userProfile?.firebaseUid ?? userProfile?.peerId });
    appendMessage("assistant", answer.message, answer.products.map((product) => product.id));
    setBotInput(""); setPage("bot");
  }
  function storeVocabulary(next: BotVocabulary) {
    setVocabulary(next);
    void qdcomDB.botVocabulary.put({ id: "main", value: next }).catch(() => notify("Không lưu được từ vựng vào cơ sở dữ liệu ngoại tuyến."));
  }
  function addWord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const word = newWord.trim(); if (!word) return;
    const list = vocabulary.intents[newIntent];
    if (list.some((item) => item.toLowerCase() === word.toLowerCase())) { notify("Từ này đã có trong từ điển."); return; }
    storeVocabulary({ ...vocabulary, intents: { ...vocabulary.intents, [newIntent]: [...list, word] } }); setNewWord(""); notify("Bot đã học thêm từ khóa mới.");
  }
  function removeWord(intent: Exclude<BotIntent, "SEARCH">, word: string) {
    storeVocabulary({ ...vocabulary, intents: { ...vocabulary.intents, [intent]: vocabulary.intents[intent].filter((item) => item !== word) } });
  }
  async function handleGoogleAuthorization(session: GoogleAuthSession) {
    const { user, accessToken } = session;
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error(`Không thể lấy hồ sơ Google (HTTP ${response.status}).`);
    const claims = await response.json() as { sub?: unknown; name?: unknown; email?: unknown; picture?: unknown; email_verified?: unknown };
    if (typeof claims.sub !== "string" || typeof claims.email !== "string" || claims.email_verified !== true) {
      throw new Error("Hồ sơ Google chưa xác minh email.");
    }
    if (user.isAnonymous || !user.providerData.some(({ providerId }) => providerId === "google.com")) {
      throw new Error("Q-Dcom chỉ cho phép tài khoản Google thực đã xác thực.");
    }
    if (userProfile?.googleSub && userProfile.googleSub !== claims.sub) {
      await signOutFirebaseUser();
      throw new Error("Tài khoản Google này khác với tài khoản đang đăng nhập. Hãy chọn đúng tài khoản để đồng bộ dữ liệu.");
    }
    const memberId = userProfile?.memberId?.trim();
    const publicMemberId = memberId && memberId.length <= 64 ? memberId : user.uid.slice(0, 16);
    const profileName = typeof claims.name === "string" ? claims.name : claims.email;
    const profile: UserProfile = {
      peerId: user.uid,
      firebaseUid: user.uid,
      googleSub: claims.sub,
      displayName: profileName,
      email: claims.email,
      avatar: typeof claims.picture === "string" && claims.picture.startsWith("https://") ? claims.picture : "",
      memberId: publicMemberId,
      specialty: userProfile?.specialty,
    };
    try {
      await savePublicUserProfile(profile.peerId, publicMemberId, profileName.slice(0, 120));
    } catch (error) {
      await signOutFirebaseUser();
      throw error;
    }
    window.localStorage.setItem(PEER_KEY, profile.peerId);
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    driveAccessToken.current = accessToken;
    setDriveConnected(true);
    setDriveSyncStatus("syncing");
    setDriveQuota(null);
    void refreshDriveQuota(accessToken);
    setUserProfile(profile);
    setPage("inventory");
    notify(`Đã đăng nhập Google: ${profile.displayName}. Đang sao lưu dữ liệu lên Google Drive.`);
  }
  async function refreshDriveQuota(accessToken: string) {
    try {
      setDriveQuota(await getGoogleDriveStorageQuota(accessToken));
      setDriveQuotaError("");
    } catch (error) {
      setDriveQuotaError(error instanceof Error ? error.message : "Không thể tải dung lượng Google Drive.");
    }
  }
  async function syncCurrentDriveBackup(accessToken: string) {
    const contents = await qdcomDB.transaction("r", qdcomDB.products, qdcomDB.botVocabulary, qdcomDB.members, async () => {
      const [allProducts, storedVocabulary, allMembers] = await Promise.all([
        qdcomDB.products.toArray(),
        qdcomDB.botVocabulary.get("main"),
        qdcomDB.members.toArray(),
      ]);
      return serializeBackup(allProducts, storedVocabulary?.value ?? vocabulary, allMembers);
    });
    const sync = driveSyncQueue.current.then(
      () => syncBackupToGoogleDrive(accessToken, contents),
      () => syncBackupToGoogleDrive(accessToken, contents),
    );
    driveSyncQueue.current = sync;
    await sync;
    await refreshDriveQuota(accessToken);
  }
  function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!registrationDraft.memberId.trim() || !registrationDraft.fullName.trim() || !registrationDraft.specialty.trim()) {
      notify("Vui lòng nhập đầy đủ ID thành viên, họ tên và chuyên ngành.");
      return;
    }
    const memberId = registrationDraft.memberId.trim();
    const members = readLocalMembers();
    if (members.some((member) => member.memberId?.toLocaleLowerCase("vi") === memberId.toLocaleLowerCase("vi"))) {
      notify("Mã ID này đã đăng ký trên thiết bị. Hãy đăng nhập bằng ID hoặc dùng mã khác.");
      return;
    }
    try {
      const peerId = readSaved<string>(PEER_KEY, "") || (window.crypto.randomUUID?.() ?? `qd-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const profile: UserProfile = {
        peerId,
        displayName: registrationDraft.fullName.trim(),
        email: "",
        avatar: registrationDraft.avatar,
        memberId,
        specialty: registrationDraft.specialty.trim(),
      };
      window.localStorage.setItem(PEER_KEY, peerId);
      window.localStorage.setItem(LOCAL_MEMBERS_KEY, JSON.stringify([...members, profile]));
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      setUserProfile(profile);
      notify(`Đã đăng ký và đăng nhập: ${profile.displayName}.`);
    } catch (error) {
      notify(error instanceof Error ? `Không thể lưu hồ sơ trên thiết bị: ${error.message}` : "Không thể lưu hồ sơ trên thiết bị.");
    }
  }
  function updateRegistrationDraft(field: keyof typeof registrationDraft, value: string) {
    setRegistrationDraft((draft) => ({ ...draft, [field]: value }));
  }
  function submitLocalLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const memberId = localLoginId.trim().toLocaleLowerCase("vi");
    const profile = readLocalMembers().find((member) => member.memberId?.toLocaleLowerCase("vi") === memberId);
    if (!profile) {
      notify("Không tìm thấy ID đã đăng ký trên thiết bị này. Hãy đăng ký hoặc đăng nhập bằng Google.");
      return;
    }
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      setUserProfile(profile);
      setLocalLoginId("");
      notify(`Chào mừng ${profile.displayName} quay lại.`);
    } catch (error) {
      notify(error instanceof Error ? `Không thể mở hồ sơ trên thiết bị: ${error.message}` : "Không thể mở hồ sơ trên thiết bị.");
    }
  }
  async function selectRegistrationAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { notify("Vui lòng chọn tệp ảnh."); return; }
    if (file.size > 700_000) { notify("Ảnh đại diện phải nhỏ hơn 700 KB để lưu trên thiết bị."); return; }
    try {
      const avatar = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Không đọc được dữ liệu ảnh."));
        reader.onerror = () => reject(new Error("Không đọc được tệp ảnh này."));
        reader.readAsDataURL(file);
      });
      setRegistrationDraft((draft) => ({ ...draft, avatar }));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Không đọc được tệp ảnh này.");
    }
  }
  async function logoutProfile() {
    if (userProfile && !userProfile.firebaseUid && !userProfile.googleSub &&
      !window.confirm("Hãy nhấn Lưu trữ / Tải về bản sao dữ liệu trước khi thoát. Bạn đã lưu bản sao dữ liệu chưa?")) {
      return;
    }
    if (userProfile?.googleSub) {
      const accessToken = driveAccessToken.current;
      if (!accessToken) {
        notify("Phiên Google Drive đã hết hạn. Hãy kết nối lại Google Drive trong Cài đặt trước khi đăng xuất để sao lưu dữ liệu mới nhất.");
        return;
      }
      try {
        setDriveSyncStatus("syncing");
        await syncCurrentDriveBackup(accessToken);
        setDriveSyncStatus("synced");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Không thể sao lưu dữ liệu lên Google Drive.";
        setDriveSyncStatus("error");
        setDriveSyncMessage(message);
        notify(`Chưa đăng xuất vì backup Drive thất bại: ${message}`);
        return;
      }
    }
    try {
      await signOutFirebaseUser();
    } catch (error) {
      notify(error instanceof Error ? `Không thể đăng xuất Firebase: ${error.message}` : "Không thể đăng xuất Firebase.");
      return;
    }
    driveAccessToken.current = null;
    setDriveConnected(false);
    setDriveSyncStatus("idle");
    setDriveSyncMessage("");
    setDriveQuota(null);
    setDriveQuotaError("");
    window.localStorage.removeItem(PROFILE_KEY);
    setUserProfile(null);
    notify("Đã đăng xuất khỏi thiết bị này.");
  }
  function openShareDialog() {
    setShareSelection([]);
    setShareValue("");
    setSyncError("");
    setShareOpen(true);
  }
  function createShareQr() {
    try {
      const peerId = userProfile?.peerId ?? (readSaved<string>(PEER_KEY, "") || window.crypto.randomUUID());
      window.localStorage.setItem(PEER_KEY, peerId);
      const selectedProducts = products.filter((product) => shareSelection.includes(product.id));
      setShareValue(createSharePayload({
        peerId,
        displayName: userProfile?.displayName ?? "Thành viên Q-Dcom",
        email: userProfile?.email ?? "",
      }, selectedProducts));
      setSyncError("");
    } catch (error) { setSyncError(error instanceof Error ? error.message : "Không thể tạo mã QR."); }
  }
  async function acceptScannedQr(raw: string) {
    try {
      const payload = parseSharePayload(raw);
      const ownPeerId = userProfile?.peerId ?? readSaved<string>(PEER_KEY, "");
      if (payload.peer.peerId === ownPeerId && !payload.products.length) throw new Error("Đây là mã QR của thiết bị hiện tại.");
      const member: QDcomMember = {
        peerId: payload.peer.peerId,
        displayName: payload.peer.displayName,
        email: payload.peer.email,
        avatar: "",
        addedAt: new Date().toISOString(),
      };
      await qdcomDB.transaction("rw", qdcomDB.members, qdcomDB.products, async () => {
        if (payload.peer.peerId !== ownPeerId) await qdcomDB.members.put(member);
        if (payload.products.length) {
          const existingProducts = await qdcomDB.products.bulkGet(payload.products.map((product) => product.id));
          const importedProducts = payload.products.map((shared, index): Product => {
            const existing = existingProducts[index];
            const now = new Date().toISOString();
            if (existing) {
              return {
                ...existing,
                id: shared.id,
                name: shared.name,
                quantity: shared.quantity,
                status: existing.status === "hidden" ? "hidden" : stockStatus(shared.quantity),
                updated_at: now,
                ...(shared.price === null ? {} : { price: shared.price }),
              };
            }
            return {
              id: shared.id,
              name: shared.name,
              brand: "",
              color: "",
              size: [],
              quantity: shared.quantity,
              image_urls: [],
              image_notes: "",
              description: "",
              category: "Khác",
              status: stockStatus(shared.quantity),
              location: "",
              created_by: member.displayName,
              created_at: now,
              updated_at: now,
              search_keywords: [],
              ...(shared.price === null ? {} : { price: shared.price }),
            };
          });
          await qdcomDB.products.bulkPut(importedProducts);
        }
      });
      setProducts(await listProducts());
      setMembers(await qdcomDB.members.toArray());
      setScannerOpen(false);
      notify(payload.peer.peerId === ownPeerId
        ? `Đã nhập ${payload.products.length} mẫu hàng từ mã QR.`
        : payload.products.length
          ? `Đã kết bạn với ${member.displayName} và tự động đồng bộ dữ liệu mẫu hàng!`
          : `Đã kết bạn với ${member.displayName}.`);
    } catch (error) {
      setScannerOpen(false);
      notify(error instanceof Error ? error.message : "Không thể xử lý mã QR.");
    }
  }
  async function exportBackup() {
    try {
      const [allProducts, storedVocabulary, allMembers] = await Promise.all([qdcomDB.products.toArray(), qdcomDB.botVocabulary.get("main"), qdcomDB.members.toArray()]);
      const contents = serializeBackup(allProducts, storedVocabulary?.value ?? vocabulary, allMembers, {
        omitBase64Images: omitBackupImages,
      });
      const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `Q-Dcom_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify(omitBackupImages
        ? "Đã xuất file backup Q-Dcom không kèm ảnh Base64."
        : "Đã xuất file backup Q-Dcom.");
    } catch (error) { notify(error instanceof Error ? error.message : "Không thể xuất file backup."); }
  }
  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 25_000_000) { notify("File backup vượt giới hạn 25 MB."); return; }
    try {
      const backup = parseBackup(await file.text());
      await qdcomDB.transaction("rw", qdcomDB.products, qdcomDB.botVocabulary, qdcomDB.members, async () => {
        await qdcomDB.products.bulkPut(backup.products);
        await qdcomDB.botVocabulary.put({ id: "main", value: backup.botVocabulary });
        await qdcomDB.members.bulkPut(backup.members);
      });
      setProducts(await listProducts());
      setVocabulary(backup.botVocabulary);
      setMembers(await qdcomDB.members.toArray());
      notify(`Đã nhập ${backup.products.length} mẫu hàng và dữ liệu nhóm Q-Dcom.`);
    } catch (error) { notify(error instanceof Error ? error.message : "File backup không hợp lệ."); }
  }
  async function addImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const accepted = files.filter((file) => file.type.startsWith("image/") && file.size <= 700_000);
    if (accepted.length !== files.length) notify("Ảnh phải nhỏ hơn 700 KB mỗi tệp để lưu trên thiết bị.");
    const read = (file: File) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error()); reader.onerror = () => reject(new Error()); reader.readAsDataURL(file);
    });
    try { const images = await Promise.all(accepted.map(read)); setDraft((current) => ({ ...current, image_urls: [...current.image_urls, ...images].slice(0, 5) })); }
    catch { notify("Không đọc được tệp ảnh này."); }
    event.target.value = "";
  }

  if (!ready) return <main className="app-frame" style={appStyle}><BackgroundVideo enabled={settings.videoEnabled} tint={settings.videoTint} /><div className="loading-state"><div className="loading-mark"><Boxes /></div>Đang tải dữ liệu kho Q-Dcom…</div></main>;

  if (!userProfile) return <main className={`app-frame login-frame ${authMode === "register" ? "register-mode" : "sign-in-mode"}`} style={appStyle}>
    <BackgroundVideo enabled={settings.videoEnabled} tint={settings.videoTint} variant="login" />
    <GlassmorphismAnimationBackground />
    <div className="login-overlay" />
    <header className="login-header"><div className="brand"><div className="brand-mark"><Boxes /></div><div><div className="brand-word">Q-<span>Dcom</span></div><div className="brand-caption">Cộng đồng Kết nối</div></div></div><span className="login-secure"><LockKeyhole /> KẾT NỐI AN TOÀN</span></header>
    <div className="login-shell">
      <section className="login-card glass" aria-labelledby="login-title">
        <div className="member-card-badge"><BadgeCheck /><span>THẺ ĐĂNG KÝ THÀNH VIÊN</span></div>
        <div className="login-card-kicker">Q-DCOM · CỘNG ĐỒNG KẾT NỐI</div>
        <h1 id="login-title">{authMode === "register" ? "ĐĂNG KÝ TÀI KHOẢN" : "ĐĂNG NHẬP TÀI KHOẢN"}</h1>
        <p className="login-card-copy">{authMode === "register" ? "Hoàn thiện hồ sơ thành viên để kết nối với cộng đồng Q-Dcom." : "Đăng nhập bằng ID đã đăng ký trên thiết bị hoặc tiếp tục với Google."}</p>
        {authMode === "register" && <form className="registration-form" onSubmit={submitRegistration}>
          <label className="auth-field"><span><IdCard /> MÃ ID THÀNH VIÊN</span><input required value={registrationDraft.memberId} onChange={(event) => updateRegistrationDraft("memberId", event.target.value)} placeholder="Nhập mã ID được cấp" autoComplete="off" /></label>
          <label className="auth-field"><span><UserRound /> HỌ VÀ TÊN</span><input required value={registrationDraft.fullName} onChange={(event) => updateRegistrationDraft("fullName", event.target.value)} placeholder="Nhập họ tên" autoComplete="name" /></label>
          <label className="auth-field"><span><BriefcaseBusiness /> CHUYÊN NGÀNH</span><input required value={registrationDraft.specialty} onChange={(event) => updateRegistrationDraft("specialty", event.target.value)} placeholder="Nhập chuyên ngành" autoComplete="organization-title" /></label>
          <label className="auth-avatar-upload"><span className="auth-avatar-preview">{registrationDraft.avatar ? <Image src={registrationDraft.avatar} alt="Ảnh đại diện xem trước" fill unoptimized sizes="54px" /> : <UserRound />}</span><span className="auth-avatar-copy"><strong>ẢNH ĐẠI DIỆN <small>(TÙY CHỌN)</small></strong><small>Chọn ảnh cá nhân, tối đa 700 KB.</small></span><span className="auth-avatar-action"><ImagePlus />{registrationDraft.avatar ? "Đổi ảnh" : "Tải ảnh lên"}</span><input type="file" accept="image/*" onChange={(event) => void selectRegistrationAvatar(event)} /></label>
          <button className="auth-submit" type="submit">ĐĂNG KÝ NGAY <ArrowRight /></button>
        </form>}
        {authMode === "login" && <form className="registration-form local-login-form" onSubmit={submitLocalLogin}>
          <label className="auth-field"><span><IdCard /> MÃ ID THÀNH VIÊN</span><input required value={localLoginId} onChange={(event) => setLocalLoginId(event.target.value)} placeholder="Nhập ID đã đăng ký trên thiết bị này" autoComplete="username" /></label>
          <button className="auth-submit" type="submit">XÁC NHẬN <ArrowRight /></button>
          <p className="local-login-note"><LockKeyhole /> Hồ sơ ID và kho được lưu trên thiết bị này. Cộng đồng chat cần đăng nhập Google.</p>
        </form>}
        <div className="login-divider"><span>{authMode === "register" ? "HOẶC ĐĂNG KÝ NHANH BẰNG" : "HOẶC ĐĂNG NHẬP NHANH BẰNG"}</span></div>
        {isFirebaseConfigured ? <div className="google-login-wrap"><span className="google-login-label">Đăng nhập và sao lưu an toàn với Google</span><GoogleDriveLoginButton label="Đăng ký / Đăng nhập bằng Google" onAuthorized={handleGoogleAuthorization} onError={notify} /><span className="google-login-caption">Firebase chỉ xác thực Google; dữ liệu kho được giữ trong IndexedDB và backup riêng trên Drive.</span></div> : <div className="oauth-unavailable"><CircleAlert /><div><strong>Đăng nhập chưa được cấu hình</strong><p>Quản trị viên cần thiết lập Firebase Auth và bật nhà cung cấp đăng nhập Google.</p></div></div>}
        <button className="auth-mode-toggle" type="button" onClick={() => { setAuthMode(authMode === "register" ? "login" : "register"); }}>
          {authMode === "register" ? "Đã có tài khoản? Đăng nhập" : "Chưa là thành viên? Đăng ký ngay"}
        </button>
      </section>
    </div>
    <footer className="login-footer"><span>Q-DCOM · CỘNG ĐỒNG KẾT NỐI</span><span>ID CÁ NHÂN HOẶC GOOGLE · HỒ SƠ LƯU CỤC BỘ</span></footer>
    {toast && <div className="toast" role="status"><CheckCircle2 />{toast}</div>}
  </main>;

  return <main className="app-frame" style={appStyle}>
    <BackgroundVideo enabled={settings.videoEnabled} tint={settings.videoTint} />
    <div className="app-layout">
      <aside className="sidebar glass">
        <div className="brand"><div className="brand-mark"><Boxes /></div><div><div className="brand-word">Q-<span>Dcom</span></div><div className="brand-caption">Quản lý kho & mẫu hàng</div></div></div>
        <nav className="nav-stack" aria-label="Điều hướng chính">
          {navGroups.map((group) => <section className="nav-group" key={group.label} aria-label={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.items.map(({ id, label, icon: Icon, preview }, index) => {
              const isActive = !preview && page === id;
              return <button
                key={id}
                type="button"
                className={`nav-link ${isActive ? "active" : ""} ${preview ? "preview" : ""}`}
                style={{ animationDelay: `${index * 45}ms` }}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  if (preview) notify(previewMessage);
                  else setPage(id);
                }}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
                {id === "inventory" && <span className="nav-count">{activeProducts.length}</span>}
                {preview && <span className="nav-badge">Đang phát triển</span>}
              </button>;
            })}
          </section>)}
        </nav>
        <div className="sidebar-spacer" />
        <div className="warehouse-switch"><div className="warehouse-icon"><MapPin /></div><div><small>Kho đang hoạt động</small><strong>Kho trung tâm · HCM</strong></div></div>
        <div className="profile-row"><ProfileAvatar profile={userProfile} /><div className="profile-copy"><strong>{userProfile?.displayName ?? "Trần Ngọc"}</strong><span>{userProfile?.memberId ? `ID: ${userProfile.memberId}` : userProfile?.email || (userProfile ? "Khách" : "Quản lý kho")}</span></div></div>
      </aside>
      <section className="main-panel"><header className="topbar glass"><div className="mobile-wordmark">Q-<b>Dcom</b></div><div className="breadcrumb">Không gian kho <ChevronRight size={13} /><strong>{pageNames[page]}</strong></div><div className="topbar-actions"><span className={`connection-pill drive-connection ${driveSyncStatus}`} title={driveSyncMessage || undefined}><i />{driveSyncStatus === "syncing" ? "Đang đồng bộ Drive" : driveSyncStatus === "synced" ? "Đã lưu trên Drive" : driveSyncStatus === "error" ? "Lỗi đồng bộ Drive" : driveConnected ? "Drive đã kết nối" : "Drive chưa kết nối"}</span><span className="topbar-divider" /><ProfileAvatar profile={userProfile} /></div></header>
        <div className="main-content">
          {page === "workshop" && <WorkshopDashboard initialUid={userProfile.firebaseUid} displayName={userProfile.displayName} />}

          {page === "inventory" && <>
            <div className="page-heading"><div><div className="eyebrow"><Activity /> Trung tâm vận hành · Hôm nay</div><h1>Mẫu hàng & kho</h1><p>Theo dõi số lượng, tình trạng và vị trí lưu trữ.</p></div><button className="primary-btn" onClick={() => openEditor()}><Plus /> Thêm mẫu hàng</button></div>
            <div className="stat-grid"><StatCard label="Mẫu đang quản lý" value={String(activeProducts.length).padStart(2,"0")} foot="Mẫu hàng trong danh mục kho" icon={<Package />} /><StatCard label="Tổng tồn kho" value={String(quantityTotal)} foot="Đơn vị đang lưu tại kho" icon={<Boxes />} /><StatCard label="Sắp hết hàng" value={String(lowStock.length).padStart(2,"0")} foot="Mẫu còn từ 1 đến 4 sản phẩm" icon={<CircleAlert />} /><StatCard label="Vị trí lưu trữ" value={String(locationCount).padStart(2,"0")} foot="Kệ có mẫu đang lưu" icon={<MapPin />} /></div>
            <section className="panel glass"><div className="panel-toolbar"><div className="panel-title">Danh sách mẫu hàng <small>{shownProducts.length} kết quả</small></div><div className="toolbar-controls"><SearchBar value={query} onChange={setQuery} placeholder="Tên, mã ID, vị trí…" /><select className="filter-select" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Lọc tình trạng"><option value="all">Tất cả</option><option value="available">Còn hàng</option><option value="low_stock">Sắp hết</option><option value="out_of_stock">Hết hàng</option></select></div></div>
              <div className="product-list"><div className="list-head"><span>Ảnh</span><span>Tên mẫu hàng</span><span>Thương hiệu</span><span>Màu sắc</span><span>Tồn kho & vị trí</span><span /></div>
                {shownProducts.length ? shownProducts.map((product) => <ProductCard key={product.id} product={product} onSelect={() => setSelectedId(product.id)} onAdjustQuantity={(delta) => void adjust(product, delta)} />) : <div className="empty-state"><Search /><strong>Không tìm thấy mẫu hàng</strong><span>Thử đổi từ khóa hoặc bộ lọc. Dữ liệu kho hiện tại vẫn được giữ nguyên.</span></div>}
              </div><div className="panel-footer"><span>Hiển thị {shownProducts.length} trên {activeProducts.length} mẫu hàng</span><span>Cập nhật theo dữ liệu hiện tại</span></div>
            </section>
          </>}

          {page === "bot" && <>
            <div className="page-heading"><div><div className="eyebrow"><Sparkles /> Trợ lý tra cứu nội bộ</div><h1>Hỏi Q-Dcom</h1><p>Tìm theo mã mẫu, tên, thương hiệu, tồn kho hoặc vị trí kệ.</p></div><span className="connection-pill"><i />Trợ lý sẵn sàng</span></div>
            <div className="chat-layout"><section className="chat-window glass"><div className="chat-header"><div className="bot-mark"><Bot /></div><div className="chat-heading"><strong>Q-Dcom Bot <span>@q</span></strong><small><i /> Đang tra cứu dữ liệu kho hiện tại</small></div><button className="quiet-btn" onClick={() => setMessages([{ id: Date.now(), role: "assistant", text: "Cuộc trò chuyện mới. Bạn muốn tra cứu mẫu hàng nào?" }])}>Làm mới</button></div>
              <div className="chat-messages"><div className="chat-date">HÔM NAY</div>{messages.map((message) => <div className={`message ${message.role}`} key={message.id}>{message.role === "assistant" && <div className="message-bot-icon"><Bot /></div>}<div><div className="message-bubble">{message.text}{message.role === "assistant" && message.productIds?.map((id) => { const product = products.find((item) => item.id === id); return product ? <div className="rich-result" key={id}><div className="rich-result-main"><ProductImage product={product} className="rich-result-image" /><div><div className="rich-result-title">{product.name}</div><div className="rich-result-id">ID: {product.id} · {product.brand}</div><div className="rich-result-meta"><span>{product.color}</span><span>{product.quantity} sản phẩm</span><span>{product.location}</span></div></div></div><button className="primary-btn" onClick={() => setSelectedId(product.id)}>Xem chi tiết <ArrowRight /></button></div> : null; })}</div><div className="message-time">{message.role === "user" ? "Bạn" : "Q-Dcom"} · vừa xong</div></div></div>)}<div ref={messageEnd} /></div>
              <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); askBot(botInput); }}><div className="compose-box"><button type="button" className="compose-attach" title="Ảnh tham chiếu được lưu trong hồ sơ mẫu" onClick={() => notify("Thêm ảnh tham chiếu trong hồ sơ mẫu hàng để lưu vào kho.")}><Paperclip /></button><input value={botInput} onChange={(event) => setBotInput(event.target.value)} placeholder="Ví dụ: @q nike màu đen còn mấy đôi…" aria-label="Nhập câu hỏi" /></div><button className="send-btn" aria-label="Gửi câu hỏi"><Send /></button></form>
            </section><aside className="chat-aside"><section className="aside-panel glass"><h3>Truy vấn nhanh</h3><div className="query-list">{["@q nike màu đen id 183t1o4","@q 183t1o4 còn mấy đôi","@q 184y99 ở đâu","@q mẫu sắp hết hàng"].map((item) => <button className="query-chip" key={item} onClick={() => askBot(item)}>{item}<ArrowRight /></button>)}</div></section><section className="aside-panel glass"><h3>Q-Dcom hiểu gì?</h3><p className="aside-note">Bot đối chiếu mã hàng, thương hiệu, màu sắc và từ khóa trong danh mục. Câu hỏi về số lượng hoặc vị trí sẽ có câu trả lời ngắn gọn.</p></section><section className="aside-panel glass"><div className="aside-status"><ShieldCheck size={14} /> Tra cứu theo dữ liệu kho hiện tại</div></section></aside></div>
          </>}

          {page === "community" && <>
            <div className="page-heading"><div><div className="eyebrow"><Users /> Kết nối thành viên</div><h1>Cộng đồng chat</h1><p>Tìm kiếm ID/QR, tạo nhóm và trao đổi tin nhắn. @q chỉ tra cứu dữ liệu IndexedDB cục bộ.</p></div></div>
            {userProfile.firebaseUid
              ? <CommunityChat uid={userProfile.firebaseUid} displayName={userProfile.displayName} products={products} tenantId={activeTenantId} role="worker" />
              : <section className="community-login-required glass"><LockKeyhole /><div><strong>Cần đăng nhập bằng Google</strong><p>Tài khoản ID cá nhân chỉ hoạt động trên thiết bị này. Đăng nhập Google để sử dụng danh bạ, nhóm và chat Firebase.</p>{isFirebaseConfigured && <GoogleDriveLoginButton label="Đăng nhập Google để kết nối" onAuthorized={handleGoogleAuthorization} onError={notify} />}</div></section>}
          </>}

          {page === "reports" && <>
            <div className="page-heading"><div><div className="eyebrow"><BarChart3 /> Theo dõi vận hành</div><h1>Tổng quan kho</h1><p>Số liệu được tính trực tiếp từ các mẫu hàng đang quản lý.</p></div></div>
            <div className="stat-grid"><StatCard label="Tổng mẫu hàng" value={String(activeProducts.length)} foot="Không tính mẫu đang ẩn" icon={<Package />} /><StatCard label="Đơn vị tồn kho" value={String(quantityTotal)} foot="Tổng số lượng từng mẫu" icon={<Boxes />} /><StatCard label="Cần kiểm tra" value={String(lowStock.length + activeProducts.filter((product) => product.quantity === 0).length)} foot="Mẫu sắp hết hoặc đã hết" icon={<CircleAlert />} /><StatCard label="Kệ đang dùng" value={String(locationCount)} foot="Vị trí có hàng lưu trữ" icon={<MapPin />} /></div>
            <div className="report-grid"><section className="report-card glass"><h2>Phân bổ theo danh mục</h2><p>Số mẫu hàng đang lưu trữ</p><div className="category-list">{Array.from(new Set(activeProducts.map((product) => product.category || "Khác"))).map((category) => { const count = activeProducts.filter((product) => (product.category || "Khác") === category).length; return <div className="category-row" key={category}><span>{category}</span><div className="category-track"><span style={{ width: `${activeProducts.length ? count / activeProducts.length * 100 : 0}%` }} /></div><strong>{count}</strong></div>; })}{!activeProducts.length && <p className="aside-note">Chưa có dữ liệu để tổng hợp.</p>}</div></section><section className="report-card glass"><h2>Mẫu cần lưu ý</h2><p>Tồn kho từ 0 đến 4 sản phẩm</p><div className="low-stock-list">{activeProducts.filter((product) => product.quantity <= 4).sort((a,b) => a.quantity-b.quantity).map((product) => <button className="low-stock-item" key={product.id} onClick={() => setSelectedId(product.id)}><ProductImage product={product} className="low-thumb" /><span className="low-stock-copy"><strong>{product.name}</strong><small>{product.id} · {product.location}</small></span><span className="low-stock-number">{product.quantity} còn</span></button>)}{!activeProducts.some((product) => product.quantity <= 4) && <p className="aside-note">Không có mẫu nào dưới ngưỡng tồn kho.</p>}</div></section></div>
          </>}

          {page === "settings" && <>
            <div className="page-heading"><div><div className="eyebrow"><SlidersHorizontal /> Tùy chỉnh không gian</div><h1>Cài đặt chung</h1><p>Hồ sơ nhóm, đồng bộ dữ liệu và giao diện kho.</p></div></div>
            <div className="settings-grid">
              <section className="settings-card glass wide">
                <SettingsHead icon={<Upload />} title="Google Drive & bản sao lưu" description="Kho hàng luôn nằm trong IndexedDB. Google Drive chỉ nhận bản sao JSON nén Gzip trong vùng dữ liệu riêng." />
                <div className="settings-card-body">
                  {driveQuota ? driveQuota.totalBytes !== null ? <>
                    <div className="drive-quota-label"><strong>Dung lượng Google Drive</strong><span>{formatBytes(driveQuota.usedBytes)} / {formatBytes(driveQuota.totalBytes)}</span></div>
                    <progress className="drive-quota-progress" value={Math.min(100, driveQuota.usedBytes / driveQuota.totalBytes * 100)} max={100} aria-label="Dung lượng đã dùng trên Google Drive" />
                  </> : <p className="aside-note">Đã sử dụng {formatBytes(driveQuota.usedBytes)}. Google không báo giới hạn tổng dung lượng của tài khoản này.</p> : <p className="aside-note">{driveConnected ? driveQuotaError || "Đang tải dung lượng Google Drive…" : "Đăng nhập Google để xem dung lượng Drive và bật sao lưu tự động."}</p>}
                  {userProfile && !userProfile.firebaseUid && !userProfile.googleSub && <p className="local-backup-warning" role="status">Hãy nhấn Lưu trữ / Tải về bản sao dữ liệu trước khi thoát. Dữ liệu ID cá nhân chỉ tồn tại trên thiết bị này.</p>}
                  {driveQuotaError && driveConnected && <p className="drive-sync-error" role="alert">{driveQuotaError}</p>}
                </div>
              </section>
              <section className="settings-card glass"><SettingsHead icon={<Video />} title="Giao diện & video nền" description="Đăng nhập: public/videos/login-bg-video.mp4 · Ứng dụng: public/videos/app-bg-video.mp4." /><div className="settings-card-body"><SettingSwitch title="Bật video nền" description="Nền tĩnh vẫn hiển thị khi chưa có tệp video." checked={settings.videoEnabled} onClick={() => saveSettings({ ...settings, videoEnabled: !settings.videoEnabled })} /><SettingRange title="Độ mờ kính" value={settings.glassBlur} min={0} max={32} suffix="px" onChange={(value) => saveSettings({ ...settings, glassBlur: value })} /><SettingRange title="Độ trong suốt" value={settings.glassOpacity} min={45} max={95} suffix="%" onChange={(value) => saveSettings({ ...settings, glassOpacity: value })} /><div className="setting-row"><div className="setting-copy"><strong>Màu phủ video</strong><small>Chọn sắc độ phủ nhẹ lên nền.</small></div><input className="tint-input" type="color" value={settings.videoTint} aria-label="Màu phủ video" onChange={(event) => saveSettings({ ...settings, videoTint: event.target.value })} /></div></div></section>
              <section className="settings-card glass"><SettingsHead icon={<Users />} title="Tài khoản & hồ sơ" description="Hồ sơ được lưu trên thiết bị và chia sẻ qua mã QR." /><div className="settings-card-body">{userProfile ? <><div className="google-profile"><ProfileAvatar profile={userProfile} /><div className="profile-copy"><strong>{userProfile.displayName}</strong><span>{userProfile.memberId ? `ID: ${userProfile.memberId}` : userProfile.email || "Khách"}</span></div></div>{userProfile.googleSub && (!driveConnected || driveSyncStatus === "error") && isFirebaseConfigured && <GoogleDriveLoginButton label="Kết nối lại Google Drive" onAuthorized={handleGoogleAuthorization} onError={notify} />}{driveSyncStatus === "error" && <p className="drive-sync-error" role="alert">{driveSyncMessage}</p>}<button type="button" className="secondary-btn" onClick={() => void logoutProfile()}><LogOut /> Đăng xuất</button></> : <p className="aside-note">Đăng nhập để quản lý hồ sơ và bật đồng bộ dữ liệu.</p>}</div></section>
              <section className="settings-card glass wide"><SettingsHead icon={<QrCode />} title="Trung tâm Đồng bộ & Thành viên Q-Dcom" description="Kết bạn và chuyển mẫu hàng trực tiếp bằng QR; backup đầy đủ bằng file JSON." /><div className="settings-card-body"><div className="sync-actions"><button type="button" className="primary-btn" onClick={openShareDialog}><QrCode /> Tạo mã QR chia sẻ</button><button type="button" className="secondary-btn" onClick={() => { setSyncError(""); setScannerOpen(true); }}><Camera /> Mở Camera Quét QR</button><button type="button" className="secondary-btn" onClick={() => void exportBackup()}><Download /> Xuất File Backup</button><button type="button" className="secondary-btn" onClick={() => backupInput.current?.click()}><Upload /> Nhập File Backup</button><input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={(event) => void importBackup(event)} /></div><label className="backup-option"><input type="checkbox" checked={omitBackupImages} onChange={(event) => setOmitBackupImages(event.target.checked)} /><span><strong>Nén nhẹ (bỏ dữ liệu ảnh Base64)</strong><small>Áp dụng cho file backup JSON tải xuống; ảnh liên kết ngoài vẫn được giữ.</small></span></label><div><div className="field-label">Thành viên nhóm Q-Dcom · {members.length}</div>{members.length ? <div className="members-list">{members.map((member) => <div className="member-row" key={member.peerId}><MemberAvatar member={member} /><span className="member-copy"><strong>{member.displayName}</strong><small>{member.email || "Thành viên Q-Dcom"}</small></span><small className="member-date">{new Date(member.addedAt).toLocaleDateString("vi-VN")}</small></div>)}</div> : <p className="aside-note">Chưa có thành viên. Quét mã QR của một thành viên để thêm vào danh sách.</p>}</div></div></section>
              <section className="settings-card glass wide"><SettingsHead icon={<Bot />} title="Kho từ vựng Bot @q" description="Nạp từ mới: nhập từ/cụm từ, chọn nhóm ý định rồi nhấn Thêm từ." /><div className="settings-card-body"><form className="vocabulary-form" onSubmit={addWord}><input className="text-field" value={newWord} onChange={(event) => setNewWord(event.target.value)} placeholder="Nhập từ hoặc cụm từ mới…" aria-label="Từ mới" /><select className="select-field" value={newIntent} onChange={(event) => setNewIntent(event.target.value as Exclude<BotIntent,"SEARCH">)} aria-label="Nhóm ý định"><option value="CHECK_QUANTITY">Hỏi số lượng</option><option value="CHECK_LOCATION">Hỏi vị trí</option><option value="GREETING">Chào hỏi</option></select><button className="primary-btn"><Plus /> Thêm từ</button></form>
                <div className="vocabulary-groups">{(["CHECK_QUANTITY","CHECK_LOCATION","GREETING"] as const).map((intent) => <div key={intent}><div className="field-label">{{CHECK_QUANTITY:"Tra cứu số lượng",CHECK_LOCATION:"Tra cứu vị trí",GREETING:"Lời chào"}[intent]}</div><div className="vocabulary-chips">{vocabulary.intents[intent].map((word) => <span className="vocabulary-chip" key={word}>{word}<button type="button" aria-label={`Xóa ${word}`} onClick={() => removeWord(intent,word)}><X /></button></span>)}</div></div>)}</div>
                <ResponseEditor label="Câu chào của bot" values={vocabulary.responses.GREETING} onChange={(values) => storeVocabulary({ ...vocabulary, responses: { ...vocabulary.responses, GREETING: values } })} /><ResponseEditor label="Khi không tìm thấy" values={vocabulary.responses.NOT_FOUND} onChange={(values) => storeVocabulary({ ...vocabulary, responses: { ...vocabulary.responses, NOT_FOUND: values } })} />
              </div></section>
            </div>
          </>}

          {page === "about" && <section className="app-info-page">
            <div className="page-heading"><div><div className="eyebrow"><Rocket /> Tầm nhìn & sứ mệnh</div><h1>Giới thiệu Q-Dcom</h1><p>Quản lý kho hàng cá nhân và hộ kinh doanh theo cách tối giản.</p></div></div>
            <article className="app-info-card glass">
              <span className="app-info-icon"><Boxes aria-hidden="true" /></span>
              <div className="app-info-copy">
                <div className="app-info-kicker">Q-DCOM · QUẢN LÝ KHO THÔNG MINH</div>
                <h2>Để việc quản lý kho trở nên gọn nhẹ hơn</h2>
                <p>Q-Dcom giúp cá nhân và chủ hộ kinh doanh quản lý mẫu hàng, số lượng tồn và vị trí lưu trữ trong một không gian trực quan. Chúng tôi hướng đến việc tối giản thao tác thủ công để bạn dành nhiều thời gian hơn cho công việc kinh doanh.</p>
                <div className="app-info-points">
                  <div><Package aria-hidden="true" /><span>Theo dõi mẫu hàng, tồn kho và vị trí lưu trữ.</span></div>
                  <div><MessageCircle aria-hidden="true" /><span>Tra cứu nhanh dữ liệu kho với trợ lý @q.</span></div>
                  <div><ShieldCheck aria-hidden="true" /><span>Chủ động quản lý và sao lưu dữ liệu của bạn.</span></div>
                </div>
              </div>
            </article>
          </section>}

          {page === "privacy" && <section className="app-info-page">
            <div className="page-heading"><div><div className="eyebrow"><ShieldCheck /> Minh bạch & an toàn</div><h1>Chính sách bảo mật dữ liệu</h1><p>Quyền riêng tư và dữ liệu của bạn luôn được ưu tiên.</p></div></div>
            <article className="app-info-card glass">
              <span className="app-info-icon privacy"><LockKeyhole aria-hidden="true" /></span>
              <div className="app-info-copy">
                <div className="app-info-kicker">GOOGLE API USER DATA POLICY · LIMITED USE</div>
                <h2>Dữ liệu của bạn luôn trong quyền kiểm soát của bạn</h2>
                <p>Q-Dcom cam kết tuân thủ Google API User Data Policy, bao gồm yêu cầu Limited Use. Dữ liệu sao lưu Google Drive được lưu trong vùng dữ liệu ứng dụng riêng tư của bạn; Q-Dcom không sử dụng dữ liệu đó ngoài mục đích cung cấp tính năng đã yêu cầu.</p>
                <Link className="privacy-back-link app-info-link" href="/privacy"><ShieldCheck aria-hidden="true" /> Đọc chính sách bảo mật đầy đủ <ArrowRight aria-hidden="true" /></Link>
              </div>
            </article>
          </section>}
        </div>
      </section>
    </div>

    <nav className="bottom-nav" aria-label="Điều hướng di động">{navGroups.flatMap(({ items }) => items).map(({ id, label, icon: Icon, preview }) => {
      const isActive = !preview && page === id;
      return <button key={id} type="button" className={`${isActive ? "active" : ""} ${preview ? "preview" : ""}`} aria-current={isActive ? "page" : undefined} onClick={() => {
        if (preview) notify(previewMessage);
        else setPage(id);
      }}><Icon aria-hidden="true" /><span>{label}</span></button>;
    })}</nav>

    {selected && !editorOpen && <div className="detail-backdrop" onClick={(event) => event.target === event.currentTarget && setSelectedId(null)}><section className="detail-modal glass" role="dialog" aria-modal="true" aria-label={`Chi tiết ${selected.name}`}><div className="modal-head"><h2>Hồ sơ mẫu hàng</h2><button className="modal-close" aria-label="Đóng" onClick={() => setSelectedId(null)}><X /></button></div><div className="detail-body"><div className="detail-visual"><ProductImage product={selected} className="detail-image" /><span className="image-count">Ảnh {selected.image_urls.length ? "01" : "0"} / {String(selected.image_urls.length).padStart(2,"0")}</span></div><div className="detail-info"><div className="eyebrow"><Package /> {selected.category}</div><h2>{selected.name}</h2><div className="detail-id">Mã định danh: {selected.id}</div><div className="detail-status-row"><Badge status={selected.status} /><span className="spec-value">Cập nhật {new Date(selected.updated_at).toLocaleDateString("vi-VN")}</span></div><div className="detail-specs"><Spec label="Thương hiệu" value={selected.brand} /><Spec label="Màu sắc" value={selected.color} /><div className="all-columns"><div className="spec-label">Kích cỡ có sẵn</div><div className="size-tags">{selected.size.length ? selected.size.map((size) => <span className="size-tag" key={size}>{size}</span>) : <span className="aside-note">Chưa khai báo</span>}</div></div><Spec label="Tồn kho tổng" value={`${selected.quantity} sản phẩm`} /><Spec label="Vị trí lưu trữ" value={selected.location || "Chưa xếp kệ"} /></div><div className="detail-description"><h3>Mô tả mẫu hàng</h3><p>{selected.description || "Chưa có mô tả."}</p>{selected.image_notes && <div className="image-note"><ImagePlus size={12} />Ghi chú ảnh: {selected.image_notes}</div>}</div><div className="detail-actions"><button className="secondary-btn" onClick={() => openEditor(selected)}><Pencil /> Chỉnh sửa</button><button className="primary-btn" onClick={() => { setStockDelta("0"); setStockOpen(true); }}><Boxes /> Cập nhật tồn kho</button></div></div></div></section></div>}

    {stockOpen && selected && <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setStockOpen(false)}><section className="stock-modal glass" role="dialog" aria-modal="true" aria-label="Cập nhật tồn kho"><div className="modal-head"><h2>Cập nhật tồn kho</h2><button className="modal-close" aria-label="Đóng" onClick={() => setStockOpen(false)}><X /></button></div><div className="stock-form"><div className="spec-value">{selected.name} · {selected.id}</div><label className="field-label" htmlFor="quantity-delta">Số lượng điều chỉnh · hiện có {selected.quantity}</label><input id="quantity-delta" className="text-field" type="number" value={stockDelta} onChange={(event) => setStockDelta(event.target.value)} /><p className="form-help">Nhập số dương để tăng tồn, số âm để giảm tồn.</p><div className="modal-footer-end"><button className="secondary-btn" onClick={() => setStockOpen(false)}>Hủy</button><button className="primary-btn" onClick={() => { void adjust(selected, Number(stockDelta)).then(() => setStockOpen(false)); }}>Cập nhật số lượng</button></div></div></section></div>}

    {editorOpen && <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setEditorOpen(false)}><section className="form-modal glass" role="dialog" aria-modal="true" aria-label={editingId ? "Chỉnh sửa mẫu hàng" : "Thêm mẫu hàng"}><div className="modal-head"><h2>{editingId ? "Chỉnh sửa mẫu hàng" : "Thêm mẫu hàng mới"}</h2><button className="modal-close" aria-label="Đóng" onClick={() => setEditorOpen(false)}><X /></button></div><form className="form-body" onSubmit={(event) => void saveDraft(event)}>
      <TextInput label="Tên mẫu hàng *" value={draft.name} setValue={(value) => setDraft({ ...draft, name:value })} required placeholder="Air Force 1 '07" />
      <div className="form-grid"><TextInput label="Mã ID *" value={draft.id} setValue={(value) => setDraft({ ...draft, id:value })} required disabled={Boolean(editingId)} /><TextInput label="Thương hiệu *" value={draft.brand} setValue={(value) => setDraft({ ...draft, brand:value })} required placeholder="Nike" /></div>
      <div className="form-grid"><TextInput label="Màu sắc" value={draft.color} setValue={(value) => setDraft({ ...draft, color:value })} placeholder="Đen / Trắng" /><div><label className="field-label" htmlFor="product-category">Danh mục</label><select id="product-category" className="select-field" value={draft.category} onChange={(event) => setDraft({ ...draft, category:event.target.value })}>{["Giày","Áo","Quần","Phụ kiện","Túi","Khác"].map((item) => <option key={item}>{item}</option>)}</select></div></div>
      <div className="form-grid"><div><label className="field-label" htmlFor="product-quantity">Số lượng tồn</label><input id="product-quantity" className="text-field" type="number" min="0" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity:Math.max(0,Number(event.target.value)) })} /></div><div><label className="field-label" htmlFor="product-price">Giá (tùy chọn)</label><input id="product-price" className="text-field" type="number" min="0" step="any" value={draft.price ?? ""} onChange={(event) => setDraft({ ...draft, price:event.target.value === "" ? undefined : Math.max(0,Number(event.target.value)) })} /></div></div>
      <TextInput label="Vị trí kệ" value={draft.location} setValue={(value) => setDraft({ ...draft, location:value })} placeholder="Kệ A-03" />
      <TextInput label="Kích cỡ · phân cách bằng dấu phẩy" value={draft.size.join(", ")} setValue={(value) => setDraft({ ...draft, size:value.split(",") })} placeholder="40, 41, 42" />
      <div><label className="field-label" htmlFor="product-images">Đường dẫn ảnh · mỗi dòng một ảnh</label><textarea id="product-images" className="textarea-field" value={draft.image_urls.filter((url) => !url.startsWith("data:")).join("\n")} onChange={(event) => setDraft({ ...draft, image_urls:[...draft.image_urls.filter((url) => url.startsWith("data:")),...event.target.value.split("\n").map((url) => url.trim()).filter(Boolean)] })} placeholder="https://…" /><label className="quiet-btn upload-label"><Upload /> Tải ảnh từ thiết bị<input type="file" accept="image/*" multiple hidden onChange={(event) => void addImages(event)} /></label><div className="form-help">Tối đa 5 ảnh, mỗi tệp 700 KB khi lưu trên trình duyệt.</div><div className="image-preview-list">{draft.image_urls.map((url,index) => <Image key={`${index}-${url.slice(0,12)}`} src={url} alt={`Ảnh mẫu ${index+1}`} width={80} height={80} unoptimized />)}</div></div>
      <TextArea label="Ghi chú ảnh đính kèm" value={draft.image_notes} setValue={(value) => setDraft({ ...draft, image_notes:value })} placeholder="Tình trạng, màu sắc, chi tiết cần đối chiếu…" />
      <TextArea label="Mô tả chi tiết" value={draft.description} setValue={(value) => setDraft({ ...draft, description:value })} placeholder="Thông tin nhận diện và kiểm kê mẫu hàng…" />
      <TextInput label="Từ khóa bot có thể học" value={draft.search_keywords.join(", ")} setValue={(value) => setDraft({ ...draft, search_keywords:value.split(",") })} placeholder="tên gọi khác, từ lóng, mã lô…" />
      <div className="modal-footer">{editingId && <button type="button" className="quiet-btn delete-btn" onClick={() => { const product = products.find((item) => item.id === editingId); if (product) void removeProduct(product); }}><Trash2 /> Xóa mẫu</button>}<div className="modal-footer-end"><button type="button" className="secondary-btn" onClick={() => setEditorOpen(false)}>Hủy</button><button className="primary-btn" disabled={busy}>{busy ? "Đang lưu…" : <><Check /> Lưu mẫu hàng</>}</button></div></div>
    </form></section></div>}
    {shareOpen && <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setShareOpen(false)}><section className="sync-modal glass" role="dialog" aria-modal="true" aria-label="Tạo mã QR chia sẻ"><div className="modal-head"><h2>Tạo mã QR chia sẻ Q-Dcom</h2><button className="modal-close" aria-label="Đóng" onClick={() => setShareOpen(false)}><X /></button></div><div className="sync-modal-body">{shareValue ? <div className="share-result"><QRCodeSVG value={shareValue} size={256} level="L" includeMargin /><p>{JSON.parse(shareValue).products.length} mẫu hàng · hồ sơ {userProfile?.displayName ?? "Thành viên Q-Dcom"}</p><button type="button" className="secondary-btn" onClick={() => setShareValue("")}>Chọn lại dữ liệu</button></div> : <><p className="aside-note">Mã QR luôn chứa Peer ID và hồ sơ; đánh dấu mẫu hàng muốn chuyển cùng mã. Nội dung có giới hạn dung lượng để máy ảnh đọc ổn định.</p><div className="share-product-list">{products.map((product) => <label className="share-product" key={product.id}><input type="checkbox" checked={shareSelection.includes(product.id)} onChange={(event) => { setShareSelection((items) => event.target.checked ? [...items, product.id] : items.filter((id) => id !== product.id)); setShareValue(""); setSyncError(""); }} /><span><strong>{product.name}</strong><small>{product.id} · {product.brand} · {product.quantity} còn</small></span></label>)}</div><div className="form-help">Chia sẻ {shareSelection.length} / {products.length} mẫu. Ảnh tải lên trực tiếp được bỏ khỏi QR để tránh vượt dung lượng.</div><div className="modal-footer-end"><button type="button" className="primary-btn" onClick={createShareQr}><QrCode /> Tạo mã QR</button></div></>}{syncError && <p className="connection-status error">{syncError}</p>}</div></section></div>}
    {scannerOpen && <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setScannerOpen(false)}><section className="sync-modal scanner-modal glass" role="dialog" aria-modal="true" aria-label="Quét mã QR"><div className="modal-head"><h2>Kết bạn & nhận mẫu hàng</h2><button className="modal-close" aria-label="Đóng camera" onClick={() => setScannerOpen(false)}><X /></button></div><div className="sync-modal-body"><p className="aside-note">Cho phép truy cập camera để quét mã QR của thành viên Q-Dcom.</p><QrCameraScanner onScan={(value) => void acceptScannedQr(value)} onError={(message) => setSyncError(message)} />{syncError && <p className="connection-status error">{syncError}</p>}</div></section></div>}
    {toast && <div className="toast" role="status"><CheckCircle2 />{toast}</div>}
  </main>;
}

function ProfileAvatar({ profile }: { profile: UserProfile | null }) {
  return <div className="avatar">{profile?.avatar ? <Image src={profile.avatar} alt="" fill unoptimized sizes="31px" /> : profile?.displayName.slice(0, 2).toUpperCase() ?? "TN"}</div>;
}
function MemberAvatar({ member }: { member: QDcomMember }) {
  return <div className="avatar">{member.avatar ? <Image src={member.avatar} alt="" fill unoptimized sizes="31px" /> : member.displayName.slice(0, 2).toUpperCase()}</div>;
}
function StatCard({ label,value,foot,icon }: { label:string; value:string; foot:string; icon:ReactNode }) { return <div className="stat-card glass"><div className="stat-top">{label}<span className="stat-icon">{icon}</span></div><div className="stat-value">{value}</div><div className="stat-foot">{foot}</div></div>; }
function SettingsHead({ icon,title,description }: { icon:ReactNode; title:string; description:string }) { return <div className="settings-card-head"><span className="settings-card-icon">{icon}</span><div><h2>{title}</h2><p>{description}</p></div></div>; }
function SettingSwitch({ title,description,checked,onClick }: { title:string; description:string; checked:boolean; onClick:()=>void }) { return <div className="setting-row"><div className="setting-copy"><strong>{title}</strong><small>{description}</small></div><button type="button" className={`switch ${checked?"on":""}`} role="switch" aria-checked={checked} aria-label={title} onClick={onClick} /></div>; }
function SettingRange({ title,value,min,max,suffix,onChange }: { title:string; value:number; min:number; max:number; suffix:string; onChange:(value:number)=>void }) { return <div><div className="setting-row"><div className="setting-copy"><strong>{title}</strong></div><span className="range-value">{value}{suffix}</span></div><div className="range-row"><input type="range" min={min} max={max} value={value} aria-label={title} onChange={(event) => onChange(Number(event.target.value))} /></div></div>; }
function ResponseEditor({ label,values,onChange }: { label:string; values:string[]; onChange:(values:string[])=>void }) { return <div><label className="field-label">{label} · mỗi câu một dòng</label><textarea className="textarea-field" value={values.join("\n")} onChange={(event) => onChange(event.target.value.split("\n").map((line) => line.trim()).filter(Boolean))} /></div>; }
function TextInput({ label,value,setValue,required,disabled,placeholder }: { label:string; value:string; setValue:(value:string)=>void; required?:boolean; disabled?:boolean; placeholder?:string }) { const id=`field-${label.replace(/[^a-z0-9]/gi,"-")}`; return <div><label className="field-label" htmlFor={id}>{label}</label><input id={id} className="text-field" value={value} onChange={(event)=>setValue(event.target.value)} required={required} disabled={disabled} placeholder={placeholder} /></div>; }
function TextArea({ label,value,setValue,placeholder }: { label:string; value:string; setValue:(value:string)=>void; placeholder:string }) { const id=`field-${label.replace(/[^a-z0-9]/gi,"-")}`; return <div><label className="field-label" htmlFor={id}>{label}</label><textarea id={id} className="textarea-field" value={value} onChange={(event)=>setValue(event.target.value)} placeholder={placeholder} /></div>; }
function Spec({ label,value }: { label:string; value:string }) { return <div><div className="spec-label">{label}</div><div className="spec-value">{value}</div></div>; }