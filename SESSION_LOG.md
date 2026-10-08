# Nhật ký phát triển Q-Dcom

## Phiên 2026-09-30

### Phạm vi

- Viết lại repo thành ứng dụng quản lý kho nội bộ bằng Next.js App Router, TypeScript, Tailwind CSS và Lucide.
- Không tạo bất kỳ luồng bán hàng, giỏ hàng, đặt hàng hay thanh toán nào.
- Hoàn thiện quản lý sản phẩm, tra cứu @q, tùy biến giao diện, local/PocketBase service và tài liệu bàn giao.

### Quá trình

1. Đọc `index.html`, `README.md` và skill setup Next.js. Repo ban đầu là trang HTML/JavaScript đơn tệp, chưa có `package.json`.
2. Xóa `index.html` và README cũ theo yêu cầu viết lại toàn bộ. Xác nhận Node `v24.21.0`, npm `11.19.0`; tiện ích `rg` không được cài trong container.
3. `npx create-next-app@latest . ...` không chạy vì npm không chấp nhận chữ hoa trong tên thư mục `Q-Dcom`. Thử `--name` cũng không thay tên mà CLI suy ra; tạo trong thư mục con `q-dcom`, sau đó chuyển scaffold về root.
4. Scaffold cài Next `16.3.8`, React `19.2.8`, TypeScript, Tailwind 4, ESLint và App Router. Cài thêm `lucide-react`.
5. Đọc hướng dẫn Next cục bộ về Server/Client Components, CSS/Tailwind, project structure và route handlers. Route giữ Server Component; phần thao tác/browser storage nằm trong Client Component.
6. Thêm `types/product.ts`, `data/mockProducts.ts`, vocabulary/parser trong `lib/bot/`, service local/PocketBase trong `lib/services/`, component nền video và ứng dụng Q-Dcom.
7. Thay layout, metadata, trang chính và stylesheet scaffold bằng UI responsive cho kho, bot, báo cáo, cài đặt, chi tiết/CRUD sản phẩm và tồn kho.
8. Viết README, hướng dẫn collection PocketBase, `.env.example`, hướng dẫn thư mục video và nhật ký này.

### Cấu trúc tạo/thay

- `app/page.tsx`: route gốc kết xuất ứng dụng.
- `app/layout.tsx`: metadata và ngôn ngữ tiếng Việt.
- `app/globals.css`: màu xanh #2563EB, glassmorphism, ảnh/chi tiết, dashboard, chat, cài đặt và responsive mobile.
- `components/qdcom-app.tsx`: CRUD, tìm kiếm, lọc, chỉnh tồn, chat, rich results, báo cáo, cài đặt, tải ảnh và local persistence.
- `components/background-video.tsx`: video tùy chọn `/videos/bg-video.mp4` và lớp màu phủ.
- `types/product.ts`: model Product, trạng thái và ID bản ghi PocketBase riêng.
- `data/mockProducts.ts`: dữ liệu khởi tạo Nike/Adidas/New Balance để app chạy ngay ở chế độ local.
- `lib/bot/vocabulary.ts`: intent và câu phản hồi mặc định có thể chỉnh/lưu.
- `lib/bot/qBotParser.ts`: chuẩn hóa truy vấn tiếng Việt, nhận mã ID, tìm thuộc tính/keyword, nhận intent số lượng/vị trí.
- `lib/services/productService.ts`: đọc/ghi localStorage hoặc REST PocketBase; cập nhật và xóa sản phẩm.
- `public/videos/README.md`: cách đặt video; không có file video nhị phân mặc định.
- `README.md`: cách cài/chạy/cấu hình máy chủ và cấu trúc repo.
- `.env.example`: cờ cấu hình nguồn server mặc định.
- `package.json` và lockfile: script dev/build/start/lint cùng dependencies.

### Lưu trữ và hợp đồng API

- Dữ liệu local được khởi tạo một lần và lưu tại `qdcom.products.v1` trong localStorage.
- Cài đặt dùng `qdcom.settings.v1`; từ vựng bot dùng `qdcom.bot-vocabulary.v1`; chat giữ tối đa 80 tin nhắn trong `qdcom.chat.v1`.
- PocketBase cần collection `products`, dùng `product_id` cho ID mẫu và ID record hệ thống cho thao tác cập nhật/xóa. Cần cấp quyền truy cập REST và cấu hình CORS.
- Ảnh tải lên bị giới hạn 700 KB mỗi tệp, tối đa 5 ảnh trong form để tránh tăng quá mức quota trình duyệt.
- Parser tra cứu trực tiếp `name`, `brand`, `color`, `category`, `location` và `search_keywords`, nên từ khóa điền trong hồ sơ sản phẩm có hiệu lực ngay.

### Kết quả xác minh

- `npx tsc --noEmit`: thành công sau các lần cập nhật cuối.
- `npm run lint`: thành công; không còn warning/error.
- `npm run build`: thành công với route `/` prerender tĩnh.
- Server `npm run dev` đã trả HTTP `200`; HTML có title `Q-Dcom | Quản lý kho & mẫu hàng`.
- Một lệnh smoke test riêng cho chuỗi câu bot đã bị người dùng bỏ qua; các kịch bản đó chưa được thực thi trong runtime.
- Luồng thao tác trình duyệt, viewport mobile và tích hợp PocketBase thực chưa được kiểm tra bằng máy chủ thật.
- Kết nối PocketBase cần URL, collection, quyền REST và CORS hợp lệ.
- Ảnh khởi tạo dùng URL Unsplash; cần mạng để tải ảnh. Nếu ảnh lỗi, giao diện hiển thị fallback.

## Phiên 2026-10-01 · Nâng cấp parser @q

### Thay đổi

- Cập nhật `lib/bot/qBotParser.ts` để chuẩn hóa truy vấn và các trường sản phẩm về không dấu, không phân biệt hoa/thường.
- Bổ sung stop words cho `hàng`, `đôi`, `cái`, `mẫu` cùng các từ nối/lệnh thường gặp.
- Tìm một phần trên ID và tên; ID được so sánh dạng compact bỏ dấu phân cách, đồng thời phần chữ số khớp được khi tiền tố gõ sai (ví dụ `bb5301` vẫn tìm `nb-5301`).
- Giữ các token số ngắn như `530`; tìm thêm trong kích cỡ và từ khóa sản phẩm.
- Nhận intent số lượng từ `con`/`còn`, `tồn`, `bao nhiêu`; intent vị trí từ `ở đâu` và `kệ`. Các câu hỏi xem mẫu trả `SHOW_CARD`.

### Xác minh

- Chạy 8 assertion runtime cho `530`, `5301`, `nb5301`, `bb5301`, câu hỏi số lượng không dấu, và vị trí bằng `ở đâu`/`kệ`; tất cả đều qua.
- `npm run lint` và `npx tsc --noEmit` hoàn tất không lỗi/cảnh báo.

## Phiên 2026-10-01 · Kiến trúc module và đồng bộ GitHub

### Thay đổi

- Thêm `config/app.config.ts` gom URL công khai, chế độ dữ liệu, PocketBase collection/health path/page size; validate HTTP/HTTPS URL trước khi dùng.
- Tách UI tái sử dụng thành `components/products/ProductCard.tsx`, `components/products/ProductImage.tsx` và `components/search/SearchBar.tsx`; dashboard hiện gọi ProductCard/SearchBar.
- Thêm `lib/services/cloudflareTunnel.ts` để probe `/api/health` qua URL PocketBase công khai; luồng Cài đặt sử dụng connector này.
- Bổ sung model `Inventory`, `InventorySummary`, `BotQuery`, `BotQueryIntent`, `UserRole`, `UserProfile` trong `types/`.
- Cập nhật product service dùng config tập trung thay vì URL/collection hard-code.
- Whitelist `.env.example` khỏi `.gitignore`, thêm biến URL app, PocketBase và collection.
- Viết lại README scaffold thành hướng dẫn Q-Dcom, cấu hình local/Vercel/PocketBase/Tunnel và luồng module.

### Kiểm tra và phát hành

- Xác nhận `origin` là `https://github.com/tuvinhquay/Q-Dcom`, nhánh `main` đang theo dõi origin; ban đầu chỉ có commit `Initial commit`, không có thay đổi staged hay commit người dùng nào cần giữ.
- Tiếp theo chạy lint, typecheck, production build và `git diff --check`; sau đó stage toàn bộ, commit đúng thông điệp người dùng yêu cầu và push `main`.
- Deploy Vercel/PocketBase thực tế cần cài biến môi trường và máy chủ/collection hợp lệ; push thành công chỉ xác nhận GitHub đã nhận mã nguồn, không thay cho kiểm tra build trong Vercel.

## Phiên 2026-10-06 · Nâng cấp Local-First PWA, Google OAuth & QR 2-in-1

### Thay đổi

- Chuyển danh mục sản phẩm sang Dexie/IndexedDB `QDcom_Offline_DB` với đúng ba bảng `products`, `botVocabulary`, `members`; seed dữ liệu khởi tạo một lần và nhập sản phẩm/từ vựng localStorage cũ khi khởi tạo DB.
- Thay toàn bộ `productService` bằng thao tác IndexedDB; cập nhật tồn kho theo transaction và loại bỏ model/cấu hình PocketBase, Cloudflare Tunnel cũ.
- Thêm manifest, viewport/theme color, icon SVG maskable và service worker cache app shell/tài nguyên tĩnh cùng origin cho lần tải ngoại tuyến sau.
- Tích hợp Google OAuth bằng `@react-oauth/google`; profile/avatar lưu trong `qdcom.user_profile.v1`, dùng chung ở sidebar/header và có nút đăng xuất.
- Thêm QR JSON phiên bản 1 gồm peer profile và sản phẩm tùy chọn, kiểm tra schema trước khi nhận, camera scan bằng `html5-qrcode`, lưu member/sản phẩm theo transaction.
- Thêm backup JSON sản phẩm/từ vựng/thành viên, kiểm tra file tối đa 25 MB và merge theo ID; backup giữ ảnh tải lên, QR bỏ ảnh data URL do giới hạn dung lượng.
- Cập nhật README, `.env.example` và hướng dẫn nạp từ vựng Bot @q trong Cài đặt.

### File tạo/sửa/xóa

- Tạo: `components/google-auth-provider.tsx`, `components/qr-camera-scanner.tsx`, `lib/db/qdcomDB.ts`, `lib/sync/qdcomSync.ts`, `public/manifest.json`, `public/sw.js`, `public/icons/icon-192.svg`, `public/icons/icon-512.svg`.
- Sửa: `package.json`, `package-lock.json`, `app/layout.tsx`, `app/globals.css`, `components/qdcom-app.tsx`, `lib/services/productService.ts`, `types/product.ts`, `.env.example`, `README.md`, `SESSION_LOG.md`.
- Xóa: `config/app.config.ts`, `lib/services/cloudflareTunnel.ts`.
- Dependencies cài mới: `dexie`, `dexie-react-hooks`, `qrcode.react`, `html5-qrcode`, `@react-oauth/google`.

### Cấu hình và giới hạn vận hành

- Google Login chỉ hoạt động sau khi khai báo `NEXT_PUBLIC_GOOGLE_CLIENT_ID` từ Google Cloud Console và cho phép origin hiện tại; mã nguồn không thể tự tạo OAuth Client ID.
- Camera và cài PWA yêu cầu HTTPS hoặc localhost. Service worker cache sau lần tải trực tuyến đầu tiên; dữ liệu kho dùng IndexedDB cục bộ.
- QR chia sẻ là chuyển dữ liệu trực tiếp, không phải đồng bộ thời gian thực và thông tin hồ sơ trong QR không được máy chủ xác thực. Dùng backup JSON để chuyển lượng dữ liệu lớn.
- `npm install` hoàn tất nhưng npm báo 5 lỗ hổng mức high trong dependency tree; không chạy `npm audit fix --force` để tránh nâng cấp phá vỡ ngoài phạm vi.

### Kiểm tra và bàn giao

- `npx tsc --noEmit`: thành công sau các thay đổi mã cuối.
- `npm run lint`: thành công trước hai chỉnh sửa nhỏ cuối ở validator/Blob URL; lần chạy xác nhận lại đã được bỏ qua.
- `npm run build`: chưa chạy vì lệnh xác nhận production build được bỏ qua.
- Thêm cổng đăng nhập glassmorphism dùng video nền sẵn có; dashboard không render khi chưa có hồ sơ hợp lệ. Google Sign-In lần đầu tạo hồ sơ cục bộ, đăng xuất quay về màn hình xác thực; localStorage profile được kiểm tra kiểu trước khi mở app.
- Cập nhật README mô tả cổng đăng nhập và việc tạo hồ sơ tự động qua Google; trạng thái workspace hiện chưa có `NEXT_PUBLIC_GOOGLE_CLIENT_ID` nên màn đăng nhập hiển thị hướng dẫn cấu hình, không cho vào dashboard.
- File phiên này bổ sung: `app/globals.css`, `components/qdcom-app.tsx`, `README.md`, `SESSION_LOG.md`.
- Typecheck và lint đã chạy thành công sau khi thêm cổng đăng nhập; dev server có sẵn trả HTTP 200 trên `http://localhost:3000`. Production build vẫn chưa chạy do lệnh trước đó đã bị bỏ qua.
- Bàn giao tiếp: cấu hình Google Client ID/origin, chạy production build, thử cài PWA sau lần truy cập HTTPS đầu tiên, kiểm thử hai thiết bị quét QR và xác nhận round-trip backup có ảnh.