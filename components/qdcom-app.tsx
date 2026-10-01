"use client";

import {
  Activity, ArrowRight, BarChart3, Bot, Boxes, Check, CheckCircle2, ChevronRight,
  CircleAlert, ImagePlus, LayoutDashboard, MapPin, MessageCircle, Package,
  Paperclip, Pencil, Plus, Search, Send, Settings as SettingsIcon, ShieldCheck,
  SlidersHorizontal, Sparkles, Trash2, Upload, Video, Wifi, X,
} from "lucide-react";
import Image from "next/image";
import type { ChangeEvent, CSSProperties, FormEvent, ReactNode } from "react";
import { startTransition, useEffect, useRef, useState } from "react";
import { BackgroundVideo } from "@/components/background-video";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductImage } from "@/components/products/ProductImage";
import { SearchBar } from "@/components/search/SearchBar";
import { appConfig } from "@/config/app.config";
import { initialProducts } from "@/data/mockProducts";
import { parseQBotQuery } from "@/lib/bot/qBotParser";
import { copyDefaultVocabulary, type BotIntent, type BotVocabulary } from "@/lib/bot/vocabulary";
import { probeCloudflareTunnel } from "@/lib/services/cloudflareTunnel";
import { adjustProductQuantity, deleteProduct, listProducts, saveProduct, USE_LOCAL_SERVER, type ProductServiceConfig } from "@/lib/services/productService";
import type { Product, ProductStatus } from "@/types/product";

type PageKey = "inventory" | "bot" | "reports" | "settings";
type ChatMessage = { id: number; role: "user" | "assistant"; text: string; productIds?: string[] };
type Settings = { useLocalServer: boolean; serverUrl: string; videoEnabled: boolean; glassBlur: number; glassOpacity: number; videoTint: string };
type ProductDraft = Omit<Product, "remote_record_id" | "created_at" | "updated_at">;
const SETTINGS_KEY = "qdcom.settings.v1";
const VOCABULARY_KEY = "qdcom.bot-vocabulary.v1";
const CHAT_KEY = "qdcom.chat.v1";
const defaults: Settings = { useLocalServer: USE_LOCAL_SERVER, serverUrl: appConfig.integrations.pocketbase.baseUrl, videoEnabled: true, glassBlur: 18, glassOpacity: 74, videoTint: "#2563eb" };
const pages: { id: PageKey; label: string; icon: typeof Package }[] = [
  { id: "inventory", label: "Mẫu hàng & kho", icon: LayoutDashboard },
  { id: "bot", label: "Tra cứu @q", icon: MessageCircle },
  { id: "reports", label: "Tổng quan kho", icon: BarChart3 },
  { id: "settings", label: "Cài đặt", icon: SettingsIcon },
];
const pageNames: Record<PageKey, string> = { inventory: "Mẫu hàng & kho", bot: "Tra cứu @q", reports: "Tổng quan kho", settings: "Cài đặt chung" };
const statusNames: Record<ProductStatus, string> = { available: "Còn hàng", low_stock: "Sắp hết", out_of_stock: "Hết hàng", hidden: "Đang ẩn" };

function readSaved<T>(key: string, fallback: T): T {
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
}
function stockStatus(quantity: number): ProductStatus { return quantity <= 0 ? "out_of_stock" : quantity <= 4 ? "low_stock" : "available"; }
function newId() { return `qd${Math.random().toString(36).slice(2, 8)}`; }
function emptyDraft(product?: Product): ProductDraft {
  if (product) {
    const { remote_record_id, created_at, updated_at, ...draft } = product;
    void remote_record_id;
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
  const [connectionText, setConnectionText] = useState("");
  const [connectionState, setConnectionState] = useState<"idle" | "ok" | "error">("idle");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const messageEnd = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const service: ProductServiceConfig = { useLocalServer: settings.useLocalServer, serverUrl: settings.serverUrl };

  useEffect(() => {
    const savedSettings = { ...defaults, ...readSaved<Partial<Settings>>(SETTINGS_KEY, {}) };
    const savedMessages = readSaved<ChatMessage[]>(CHAT_KEY, []);
    startTransition(() => {
      setSettings(savedSettings);
      setVocabulary(readSaved<BotVocabulary>(VOCABULARY_KEY, copyDefaultVocabulary()));
      setMessages(savedMessages.length ? savedMessages : [{ id: Date.now(), role: "assistant", text: "Chào bạn! Mình là Q-Dcom Bot. Nhập mã mẫu, tên hàng hoặc vị trí kệ để bắt đầu tra cứu." }]);
    });
    void listProducts(savedSettings).then(setProducts).catch((error: unknown) => {
        setProducts(savedSettings.useLocalServer ? [] : initialProducts); setConnectionState("error");
      setConnectionText(error instanceof Error ? error.message : "Không thể tải dữ liệu kho.");
    }).finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (messages.length) window.localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-80)));
    messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

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
    try { const updated = await adjustProductQuantity(product.id, delta, service); setProducts((items) => items.map((item) => item.id === updated.id ? updated : item)); }
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
      ...(previous?.remote_record_id ? { remote_record_id: previous.remote_record_id } : {}),
    };
    setBusy(true);
    try {
      const saved = await saveProduct(product, service, editingId ?? undefined);
      setProducts((items) => editingId ? items.map((item) => item.id === editingId ? saved : item) : [saved, ...items]);
      setEditorOpen(false); setSelectedId(null); notify(editingId ? "Đã cập nhật mẫu hàng." : "Đã thêm mẫu hàng vào kho.");
    } catch (error) { notify(error instanceof Error ? error.message : "Không thể lưu mẫu hàng."); }
    finally { setBusy(false); }
  }
  async function removeProduct(product: Product) {
    if (!window.confirm(`Xóa mẫu ${product.name} (${product.id}) khỏi kho?`)) return;
    try { await deleteProduct(product.id, service); setProducts((items) => items.filter((item) => item.id !== product.id)); setSelectedId(null); setEditorOpen(false); notify("Đã xóa mẫu hàng khỏi kho."); }
    catch (error) { notify(error instanceof Error ? error.message : "Không thể xóa mẫu hàng."); }
  }
  function appendMessage(role: ChatMessage["role"], text: string, productIds?: string[]) {
    setMessages((items) => [...items, { id: Date.now() + Math.random(), role, text, ...(productIds?.length ? { productIds } : {}) }]);
  }
  function askBot(text: string) {
    const clean = text.trim(); if (!clean) return;
    appendMessage("user", clean);
    const answer = parseQBotQuery(clean, products, vocabulary);
    appendMessage("assistant", answer.message, answer.products.map((product) => product.id));
    setBotInput(""); setPage("bot");
  }
  function storeVocabulary(next: BotVocabulary) { setVocabulary(next); window.localStorage.setItem(VOCABULARY_KEY, JSON.stringify(next)); }
  function addWord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const word = newWord.trim(); if (!word) return;
    const list = vocabulary.intents[newIntent];
    if (list.some((item) => item.toLowerCase() === word.toLowerCase())) { notify("Từ này đã có trong từ điển."); return; }
    storeVocabulary({ ...vocabulary, intents: { ...vocabulary.intents, [newIntent]: [...list, word] } }); setNewWord(""); notify("Bot đã học thêm từ khóa mới.");
  }
  function removeWord(intent: Exclude<BotIntent, "SEARCH">, word: string) {
    storeVocabulary({ ...vocabulary, intents: { ...vocabulary.intents, [intent]: vocabulary.intents[intent].filter((item) => item !== word) } });
  }
  async function testConnection() {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (!settings.useLocalServer) { setConnectionState("ok"); setConnectionText("Đang lưu dữ liệu trên trình duyệt này."); notify("Đã lưu cài đặt kho nội bộ."); return; }
    if (!settings.serverUrl.trim()) { setConnectionState("error"); setConnectionText("Nhập địa chỉ máy chủ trước khi kiểm tra."); return; }
    setBusy(true); setConnectionState("idle"); setConnectionText("");
    try {
      await probeCloudflareTunnel(settings.serverUrl);
      setProducts(await listProducts(service)); setConnectionState("ok"); setConnectionText("Máy chủ phản hồi và danh sách kho đã tải."); notify("Đã lưu và kết nối máy chủ.");
    } catch (error) { setConnectionState("error"); setConnectionText(error instanceof Error ? error.message : "Không thể kết nối máy chủ."); }
    finally { setBusy(false); }
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

  return <main className="app-frame" style={appStyle}>
    <BackgroundVideo enabled={settings.videoEnabled} tint={settings.videoTint} />
    <div className="app-layout">
      <aside className="sidebar glass"><div className="brand"><div className="brand-mark"><Boxes /></div><div><div className="brand-word">Q-<span>Dcom</span></div><div className="brand-caption">Quản lý kho & mẫu hàng</div></div></div><div className="nav-label">Không gian làm việc</div>
        <nav className="nav-stack" aria-label="Điều hướng chính">{pages.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-link ${page === id ? "active" : ""}`} onClick={() => setPage(id)}><Icon /><span>{label}</span>{id === "inventory" && <span className="nav-count">{activeProducts.length}</span>}</button>)}</nav>
        <div className="sidebar-spacer" /><div className="warehouse-switch"><div className="warehouse-icon"><MapPin /></div><div><small>Kho đang hoạt động</small><strong>Kho trung tâm · HCM</strong></div></div><div className="profile-row"><div className="avatar">TN</div><div className="profile-copy"><strong>Trần Ngọc</strong><span>Quản lý kho</span></div></div>
      </aside>
      <section className="main-panel"><header className="topbar glass"><div className="mobile-wordmark">Q-<b>Dcom</b></div><div className="breadcrumb">Không gian kho <ChevronRight size={13} /><strong>{pageNames[page]}</strong></div><div className="topbar-actions"><span className="connection-pill"><i />{settings.useLocalServer ? "Máy chủ kho" : "Kho nội bộ"}</span><span className="topbar-divider" /><div className="avatar">TN</div></div></header>
        <div className="main-content">
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

          {page === "reports" && <>
            <div className="page-heading"><div><div className="eyebrow"><BarChart3 /> Theo dõi vận hành</div><h1>Tổng quan kho</h1><p>Số liệu được tính trực tiếp từ các mẫu hàng đang quản lý.</p></div></div>
            <div className="stat-grid"><StatCard label="Tổng mẫu hàng" value={String(activeProducts.length)} foot="Không tính mẫu đang ẩn" icon={<Package />} /><StatCard label="Đơn vị tồn kho" value={String(quantityTotal)} foot="Tổng số lượng từng mẫu" icon={<Boxes />} /><StatCard label="Cần kiểm tra" value={String(lowStock.length + activeProducts.filter((product) => product.quantity === 0).length)} foot="Mẫu sắp hết hoặc đã hết" icon={<CircleAlert />} /><StatCard label="Kệ đang dùng" value={String(locationCount)} foot="Vị trí có hàng lưu trữ" icon={<MapPin />} /></div>
            <div className="report-grid"><section className="report-card glass"><h2>Phân bổ theo danh mục</h2><p>Số mẫu hàng đang lưu trữ</p><div className="category-list">{Array.from(new Set(activeProducts.map((product) => product.category || "Khác"))).map((category) => { const count = activeProducts.filter((product) => (product.category || "Khác") === category).length; return <div className="category-row" key={category}><span>{category}</span><div className="category-track"><span style={{ width: `${activeProducts.length ? count / activeProducts.length * 100 : 0}%` }} /></div><strong>{count}</strong></div>; })}{!activeProducts.length && <p className="aside-note">Chưa có dữ liệu để tổng hợp.</p>}</div></section><section className="report-card glass"><h2>Mẫu cần lưu ý</h2><p>Tồn kho từ 0 đến 4 sản phẩm</p><div className="low-stock-list">{activeProducts.filter((product) => product.quantity <= 4).sort((a,b) => a.quantity-b.quantity).map((product) => <button className="low-stock-item" key={product.id} onClick={() => setSelectedId(product.id)}><ProductImage product={product} className="low-thumb" /><span className="low-stock-copy"><strong>{product.name}</strong><small>{product.id} · {product.location}</small></span><span className="low-stock-number">{product.quantity} còn</span></button>)}{!activeProducts.some((product) => product.quantity <= 4) && <p className="aside-note">Không có mẫu nào dưới ngưỡng tồn kho.</p>}</div></section></div>
          </>}

          {page === "settings" && <>
            <div className="page-heading"><div><div className="eyebrow"><SlidersHorizontal /> Tùy chỉnh không gian</div><h1>Cài đặt chung</h1><p>Điều chỉnh giao diện, từ vựng trợ lý và nguồn dữ liệu kho.</p></div></div>
            <div className="settings-grid">
              <section className="settings-card glass"><SettingsHead icon={<Video />} title="Giao diện & video nền" description="Tệp tùy chọn: public/videos/bg-video.mp4." /><div className="settings-card-body"><SettingSwitch title="Bật video nền" description="Nền tĩnh vẫn hiển thị khi chưa có tệp video." checked={settings.videoEnabled} onClick={() => saveSettings({ ...settings, videoEnabled: !settings.videoEnabled })} /><SettingRange title="Độ mờ kính" value={settings.glassBlur} min={0} max={32} suffix="px" onChange={(value) => saveSettings({ ...settings, glassBlur: value })} /><SettingRange title="Độ trong suốt" value={settings.glassOpacity} min={45} max={95} suffix="%" onChange={(value) => saveSettings({ ...settings, glassOpacity: value })} /><div className="setting-row"><div className="setting-copy"><strong>Màu phủ video</strong><small>Chọn sắc độ phủ nhẹ lên nền.</small></div><input className="tint-input" type="color" value={settings.videoTint} aria-label="Màu phủ video" onChange={(event) => saveSettings({ ...settings, videoTint: event.target.value })} /></div></div></section>
              <section className="settings-card glass"><SettingsHead icon={<Wifi />} title="Kết nối máy chủ kho" description="PocketBase REST API · máy chủ nội bộ hoặc Termux." /><div className="settings-card-body"><SettingSwitch title="Dùng máy chủ từ xa" description="Tắt để lưu riêng trên trình duyệt này." checked={settings.useLocalServer} onClick={() => saveSettings({ ...settings, useLocalServer: !settings.useLocalServer })} /><div><label className="field-label" htmlFor="server-url">Địa chỉ máy chủ</label><input id="server-url" className="text-field" value={settings.serverUrl} onChange={(event) => saveSettings({ ...settings, serverUrl: event.target.value })} placeholder="http://192.168.1.150:8090" /></div><div className="setting-row"><span className={`connection-status ${connectionState}`}>{connectionState === "ok" ? <CheckCircle2 size={13} /> : connectionState === "error" ? <CircleAlert size={13} /> : <Wifi size={13} />}{connectionText || (settings.useLocalServer ? "Chưa kiểm tra kết nối" : "Đang lưu trên thiết bị")}</span><button className="primary-btn" disabled={busy} onClick={() => void testConnection()}>{busy ? "Đang kiểm tra…" : "Lưu & kiểm tra"}</button></div></div></section>
              <section className="settings-card glass wide"><SettingsHead icon={<Bot />} title="Kho từ vựng Bot @q" description="Thêm từ đồng nghĩa, từ lóng hoặc cách nói tự nhiên để bot nhận diện đúng ý định." /><div className="settings-card-body"><form className="vocabulary-form" onSubmit={addWord}><input className="text-field" value={newWord} onChange={(event) => setNewWord(event.target.value)} placeholder="Nhập từ hoặc cụm từ mới…" aria-label="Từ mới" /><select className="select-field" value={newIntent} onChange={(event) => setNewIntent(event.target.value as Exclude<BotIntent,"SEARCH">)} aria-label="Nhóm ý định"><option value="CHECK_QUANTITY">Hỏi số lượng</option><option value="CHECK_LOCATION">Hỏi vị trí</option><option value="GREETING">Chào hỏi</option></select><button className="primary-btn"><Plus /> Thêm từ</button></form>
                <div className="vocabulary-groups">{(["CHECK_QUANTITY","CHECK_LOCATION","GREETING"] as const).map((intent) => <div key={intent}><div className="field-label">{{CHECK_QUANTITY:"Tra cứu số lượng",CHECK_LOCATION:"Tra cứu vị trí",GREETING:"Lời chào"}[intent]}</div><div className="vocabulary-chips">{vocabulary.intents[intent].map((word) => <span className="vocabulary-chip" key={word}>{word}<button type="button" aria-label={`Xóa ${word}`} onClick={() => removeWord(intent,word)}><X /></button></span>)}</div></div>)}</div>
                <ResponseEditor label="Câu chào của bot" values={vocabulary.responses.GREETING} onChange={(values) => storeVocabulary({ ...vocabulary, responses: { ...vocabulary.responses, GREETING: values } })} /><ResponseEditor label="Khi không tìm thấy" values={vocabulary.responses.NOT_FOUND} onChange={(values) => storeVocabulary({ ...vocabulary, responses: { ...vocabulary.responses, NOT_FOUND: values } })} />
              </div></section>
            </div>
          </>}
        </div>
      </section>
    </div>

    <nav className="bottom-nav" aria-label="Điều hướng di động">{pages.map(({ id, icon: Icon }) => <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}><Icon />{id === "inventory" ? "Kho" : id === "bot" ? "@q" : id === "reports" ? "Tổng quan" : "Cài đặt"}</button>)}</nav>

    {selected && !editorOpen && <div className="detail-backdrop" onClick={(event) => event.target === event.currentTarget && setSelectedId(null)}><section className="detail-modal glass" role="dialog" aria-modal="true" aria-label={`Chi tiết ${selected.name}`}><div className="modal-head"><h2>Hồ sơ mẫu hàng</h2><button className="modal-close" aria-label="Đóng" onClick={() => setSelectedId(null)}><X /></button></div><div className="detail-body"><div className="detail-visual"><ProductImage product={selected} className="detail-image" /><span className="image-count">Ảnh {selected.image_urls.length ? "01" : "0"} / {String(selected.image_urls.length).padStart(2,"0")}</span></div><div className="detail-info"><div className="eyebrow"><Package /> {selected.category}</div><h2>{selected.name}</h2><div className="detail-id">Mã định danh: {selected.id}</div><div className="detail-status-row"><Badge status={selected.status} /><span className="spec-value">Cập nhật {new Date(selected.updated_at).toLocaleDateString("vi-VN")}</span></div><div className="detail-specs"><Spec label="Thương hiệu" value={selected.brand} /><Spec label="Màu sắc" value={selected.color} /><div className="all-columns"><div className="spec-label">Kích cỡ có sẵn</div><div className="size-tags">{selected.size.length ? selected.size.map((size) => <span className="size-tag" key={size}>{size}</span>) : <span className="aside-note">Chưa khai báo</span>}</div></div><Spec label="Tồn kho tổng" value={`${selected.quantity} sản phẩm`} /><Spec label="Vị trí lưu trữ" value={selected.location || "Chưa xếp kệ"} /></div><div className="detail-description"><h3>Mô tả mẫu hàng</h3><p>{selected.description || "Chưa có mô tả."}</p>{selected.image_notes && <div className="image-note"><ImagePlus size={12} />Ghi chú ảnh: {selected.image_notes}</div>}</div><div className="detail-actions"><button className="secondary-btn" onClick={() => openEditor(selected)}><Pencil /> Chỉnh sửa</button><button className="primary-btn" onClick={() => { setStockDelta("0"); setStockOpen(true); }}><Boxes /> Cập nhật tồn kho</button></div></div></div></section></div>}

    {stockOpen && selected && <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setStockOpen(false)}><section className="stock-modal glass" role="dialog" aria-modal="true" aria-label="Cập nhật tồn kho"><div className="modal-head"><h2>Cập nhật tồn kho</h2><button className="modal-close" aria-label="Đóng" onClick={() => setStockOpen(false)}><X /></button></div><div className="stock-form"><div className="spec-value">{selected.name} · {selected.id}</div><label className="field-label" htmlFor="quantity-delta">Số lượng điều chỉnh · hiện có {selected.quantity}</label><input id="quantity-delta" className="text-field" type="number" value={stockDelta} onChange={(event) => setStockDelta(event.target.value)} /><p className="form-help">Nhập số dương để tăng tồn, số âm để giảm tồn.</p><div className="modal-footer-end"><button className="secondary-btn" onClick={() => setStockOpen(false)}>Hủy</button><button className="primary-btn" onClick={() => { void adjust(selected, Number(stockDelta)).then(() => setStockOpen(false)); }}>Cập nhật số lượng</button></div></div></section></div>}

    {editorOpen && <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setEditorOpen(false)}><section className="form-modal glass" role="dialog" aria-modal="true" aria-label={editingId ? "Chỉnh sửa mẫu hàng" : "Thêm mẫu hàng"}><div className="modal-head"><h2>{editingId ? "Chỉnh sửa mẫu hàng" : "Thêm mẫu hàng mới"}</h2><button className="modal-close" aria-label="Đóng" onClick={() => setEditorOpen(false)}><X /></button></div><form className="form-body" onSubmit={(event) => void saveDraft(event)}>
      <TextInput label="Tên mẫu hàng *" value={draft.name} setValue={(value) => setDraft({ ...draft, name:value })} required placeholder="Air Force 1 '07" />
      <div className="form-grid"><TextInput label="Mã ID *" value={draft.id} setValue={(value) => setDraft({ ...draft, id:value })} required disabled={Boolean(editingId)} /><TextInput label="Thương hiệu *" value={draft.brand} setValue={(value) => setDraft({ ...draft, brand:value })} required placeholder="Nike" /></div>
      <div className="form-grid"><TextInput label="Màu sắc" value={draft.color} setValue={(value) => setDraft({ ...draft, color:value })} placeholder="Đen / Trắng" /><div><label className="field-label" htmlFor="product-category">Danh mục</label><select id="product-category" className="select-field" value={draft.category} onChange={(event) => setDraft({ ...draft, category:event.target.value })}>{["Giày","Áo","Quần","Phụ kiện","Túi","Khác"].map((item) => <option key={item}>{item}</option>)}</select></div></div>
      <div className="form-grid"><div><label className="field-label" htmlFor="product-quantity">Số lượng tồn</label><input id="product-quantity" className="text-field" type="number" min="0" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity:Math.max(0,Number(event.target.value)) })} /></div><TextInput label="Vị trí kệ" value={draft.location} setValue={(value) => setDraft({ ...draft, location:value })} placeholder="Kệ A-03" /></div>
      <TextInput label="Kích cỡ · phân cách bằng dấu phẩy" value={draft.size.join(", ")} setValue={(value) => setDraft({ ...draft, size:value.split(",") })} placeholder="40, 41, 42" />
      <div><label className="field-label" htmlFor="product-images">Đường dẫn ảnh · mỗi dòng một ảnh</label><textarea id="product-images" className="textarea-field" value={draft.image_urls.filter((url) => !url.startsWith("data:")).join("\n")} onChange={(event) => setDraft({ ...draft, image_urls:[...draft.image_urls.filter((url) => url.startsWith("data:")),...event.target.value.split("\n").map((url) => url.trim()).filter(Boolean)] })} placeholder="https://…" /><label className="quiet-btn upload-label"><Upload /> Tải ảnh từ thiết bị<input type="file" accept="image/*" multiple hidden onChange={(event) => void addImages(event)} /></label><div className="form-help">Tối đa 5 ảnh, mỗi tệp 700 KB khi lưu trên trình duyệt.</div><div className="image-preview-list">{draft.image_urls.map((url,index) => <Image key={`${index}-${url.slice(0,12)}`} src={url} alt={`Ảnh mẫu ${index+1}`} width={80} height={80} unoptimized />)}</div></div>
      <TextArea label="Ghi chú ảnh đính kèm" value={draft.image_notes} setValue={(value) => setDraft({ ...draft, image_notes:value })} placeholder="Tình trạng, màu sắc, chi tiết cần đối chiếu…" />
      <TextArea label="Mô tả chi tiết" value={draft.description} setValue={(value) => setDraft({ ...draft, description:value })} placeholder="Thông tin nhận diện và kiểm kê mẫu hàng…" />
      <TextInput label="Từ khóa bot có thể học" value={draft.search_keywords.join(", ")} setValue={(value) => setDraft({ ...draft, search_keywords:value.split(",") })} placeholder="tên gọi khác, từ lóng, mã lô…" />
      <div className="modal-footer">{editingId && <button type="button" className="quiet-btn delete-btn" onClick={() => { const product = products.find((item) => item.id === editingId); if (product) void removeProduct(product); }}><Trash2 /> Xóa mẫu</button>}<div className="modal-footer-end"><button type="button" className="secondary-btn" onClick={() => setEditorOpen(false)}>Hủy</button><button className="primary-btn" disabled={busy}>{busy ? "Đang lưu…" : <><Check /> Lưu mẫu hàng</>}</button></div></div>
    </form></section></div>}
    {toast && <div className="toast" role="status"><CheckCircle2 />{toast}</div>}
  </main>;
}

function StatCard({ label,value,foot,icon }: { label:string; value:string; foot:string; icon:ReactNode }) { return <div className="stat-card glass"><div className="stat-top">{label}<span className="stat-icon">{icon}</span></div><div className="stat-value">{value}</div><div className="stat-foot">{foot}</div></div>; }
function SettingsHead({ icon,title,description }: { icon:ReactNode; title:string; description:string }) { return <div className="settings-card-head"><span className="settings-card-icon">{icon}</span><div><h2>{title}</h2><p>{description}</p></div></div>; }
function SettingSwitch({ title,description,checked,onClick }: { title:string; description:string; checked:boolean; onClick:()=>void }) { return <div className="setting-row"><div className="setting-copy"><strong>{title}</strong><small>{description}</small></div><button type="button" className={`switch ${checked?"on":""}`} role="switch" aria-checked={checked} aria-label={title} onClick={onClick} /></div>; }
function SettingRange({ title,value,min,max,suffix,onChange }: { title:string; value:number; min:number; max:number; suffix:string; onChange:(value:number)=>void }) { return <div><div className="setting-row"><div className="setting-copy"><strong>{title}</strong></div><span className="range-value">{value}{suffix}</span></div><div className="range-row"><input type="range" min={min} max={max} value={value} aria-label={title} onChange={(event) => onChange(Number(event.target.value))} /></div></div>; }
function ResponseEditor({ label,values,onChange }: { label:string; values:string[]; onChange:(values:string[])=>void }) { return <div><label className="field-label">{label} · mỗi câu một dòng</label><textarea className="textarea-field" value={values.join("\n")} onChange={(event) => onChange(event.target.value.split("\n").map((line) => line.trim()).filter(Boolean))} /></div>; }
function TextInput({ label,value,setValue,required,disabled,placeholder }: { label:string; value:string; setValue:(value:string)=>void; required?:boolean; disabled?:boolean; placeholder?:string }) { const id=`field-${label.replace(/[^a-z0-9]/gi,"-")}`; return <div><label className="field-label" htmlFor={id}>{label}</label><input id={id} className="text-field" value={value} onChange={(event)=>setValue(event.target.value)} required={required} disabled={disabled} placeholder={placeholder} /></div>; }
function TextArea({ label,value,setValue,placeholder }: { label:string; value:string; setValue:(value:string)=>void; placeholder:string }) { const id=`field-${label.replace(/[^a-z0-9]/gi,"-")}`; return <div><label className="field-label" htmlFor={id}>{label}</label><textarea id={id} className="textarea-field" value={value} onChange={(event)=>setValue(event.target.value)} placeholder={placeholder} /></div>; }
function Spec({ label,value }: { label:string; value:string }) { return <div><div className="spec-label">{label}</div><div className="spec-value">{value}</div></div>; }