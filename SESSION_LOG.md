# Nhật ký phát triển Q-Dcom

## Phiên 2026-10-08 · Đăng ký bằng ID và kính mờ

### Thay đổi

- Cho phép đăng ký hồ sơ bằng mã ID, họ tên, chuyên ngành và ảnh đại diện tùy chọn; ảnh giới hạn 700 KB, lưu dạng data URL trong localStorage.
- Sau khi bấm `ĐĂNG KÝ NGAY`, hồ sơ được lưu vào `qdcom.local_members.v1` và `qdcom.user_profile.v1`, sau đó vào dashboard ngay mà không cần Google OAuth.
- Bổ sung đăng nhập lại bằng ID thành viên trên cùng thiết bị. Đăng xuất chỉ xóa hồ sơ đang hoạt động, giữ danh sách thành viên cục bộ để lần sau đăng nhập; Google Login tiếp tục là lựa chọn riêng.
- Chuyển thẻ đăng ký sang glassmorphism nền `rgba(15, 23, 42, 0.6)`, blur 20 px, viền sáng, bóng đổ theo yêu cầu và quầng sáng gradient phía sau.
- Tách video nền đăng nhập `/videos/login-bg-video.mp4` khỏi video nền ứng dụng `/videos/app-bg-video.mp4`; ghi rõ vị trí để người dùng tự thêm video.
- Cập nhật README, hướng dẫn đăng ký và `public/videos/README.md`.

### Giới hạn và kiểm tra

- Hồ sơ ID chỉ nằm trên trình duyệt/thiết bị, không có máy chủ xác thực; ID local không phải cơ chế bảo vệ dữ liệu an toàn.
- Thư mục video mới chỉ khai báo tên/đường dẫn tệp. Không có MP4 demo đi kèm; giao diện dùng nền đồ họa tĩnh cho đến khi bổ sung video.
- `npm run lint`, `npx tsc --noEmit` và `git diff --check`: thành công.
- Đã chạy `npm run dev`; `curl http://localhost:3000/` trả HTTP 200 và trang có đúng tiêu đề Q-Dcom.

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

## Phiên 2026-10-13 · Tái cấu trúc Sidebar và điều hướng dashboard

### Thay đổi

- Tổ chức Sidebar thành các nhóm Quản lý chính, Giới thiệu & phát triển dự án, Hệ thống và Tính năng đang phát triển; giữ badge số mẫu hàng tại mục Kho.
- Bổ sung tab Giới thiệu Q-Dcom và tab tóm tắt Chính sách bảo mật trong khung dashboard; tab bảo mật liên kết tới route `/privacy` hiện có.
- Bổ sung các mục xem trước Đặt đồ ăn nhanh và Tính sản lượng & Năng suất. Khi chọn, các mục chỉ hiển thị toast “Tính năng đang trong quá trình hoàn thiện và sẽ ra mắt ở phiên bản tiếp theo!”, không điều hướng nhầm sang màn hình chức năng.
- Tái sử dụng các nhóm menu cho Sidebar desktop và thanh điều hướng di động; thanh mobile cuộn ngang để tiếp cận đầy đủ các mục.
- Làm mới Sidebar với nền glassmorphism, viền gradient/glow, hiệu ứng slide-in, cùng hiệu ứng nổi và viền sáng cho trạng thái hover/active.
- Bỏ render `AppIntroSection` bên ngoài dashboard ở `app/page.tsx` và xóa component cũ `components/AppIntroSection.tsx`; nội dung giới thiệu được chuyển vào tab nội bộ.
- Cập nhật `README.md` mô tả cấu trúc menu, tab, liên kết `/privacy`, mục preview và hiệu ứng Sidebar.

### Kiểm tra

- `npx eslint components/qdcom-app.tsx app/page.tsx`: thành công.
- `npm run build`: thành công; Next.js 16.3.8 prerender các route `/` và `/privacy`.
- `git diff --check`: thành công.
- `npm run dev` phản hồi HTTP 200 tại `http://localhost:3000` trong phiên kiểm tra.

### Bàn giao Git và triển khai

- Không xóa hay ghi đè các mục lịch sử ở trên; mục này được append để giữ nguyên dấu vết các phiên trước.
- Tại thời điểm ghi log, workspace đang ở nhánh `sync/current-main-updates-2026-10-10`; `HEAD`, `main` và `origin/main` cùng trỏ tới `b26ea27`. Các thay đổi trong workspace chưa được commit, trong đó có cả thay đổi staged và unstaged từ trước phiên Sidebar.
- Chưa tạo commit, push, merge hay kích hoạt deploy Vercel. Trước khi phát hành cần xác nhận rõ phạm vi các thay đổi đang chờ, tránh vô tình đưa các chỉnh sửa tồn tại trước đó vào commit.

## Phiên 2026-10-27 · Multi-Tenancy xưởng, PO, sản lượng, ví riêng tư và @q Bot

### Mục tiêu và nguyên tắc
- Làm trên nhánh `feature/new-feature-foundation-2026-10-27`; không sửa trực tiếp `main`.
- Đây là nâng cấp mở rộng. Giữ luồng quản lý kho IndexedDB, Google OAuth, đăng nhập thẻ nhân viên cũ, QR chia sẻ và backup Google Drive.
- Không ghi đè các mục phiên trước. Mục này được append vào cuối lịch sử để có thể tiếp tục ở phiên sau.
- Quy tắc riêng tư ưu tiên cao nhất: Admin không đọc tài liệu ví/tổng thu nhập của từng Worker; Admin chỉ xem sản lượng, năng suất và các khoản phụ phí đang chờ duyệt.

### Đã triển khai
- Thêm mô hình `Tenant`, `TenantMembership`, `PurchaseOrder`, `ProductionEntry`, `WorkerExtra`, `TenantOperationsSettings`, `PersonalEarningsSummary` trong `types/tenant.ts`.
- Thêm Dexie version 2 và các bảng theo tenant: PO, sản lượng, phụ phí, thành viên xưởng, cấu hình vận hành. Dữ liệu sản phẩm cũ được gán tenant `local-default` trong migration; không xóa dữ liệu hiện hữu.
- Thêm bộ chọn tenant dùng cho giao diện, tải lại danh mục kho theo tenant đang chọn; tenant ID trên localStorage chỉ là bộ chọn giao diện, không được xem là bằng chứng phân quyền.
- Thêm dịch vụ Firebase tạo xưởng và xác minh thành viên theo UID Google + mã thẻ nhân viên. Role `admin/worker` được lấy từ membership trên Firestore, không lấy từ nội dung chat.
- Thêm dịch vụ Firestore cho PO, đơn giá công đoạn, sản lượng, phụ phí, thành viên, cấu hình giờ nộp, ví cá nhân và chat xưởng theo tenant.
- Thêm Cloud Functions tính lại thu nhập đã duyệt ở phía máy chủ; tài liệu `earnings/{workerUid}` và các kỳ ngày/tuần/tháng/quý/năm chỉ cho chính Worker đọc. Client bị cấm ghi tài liệu earnings.
- Thêm Firestore rules và composite indexes cho tenant, PO, đơn giá, sản lượng, phụ phí, settings, earnings và tin nhắn xưởng.
- Thêm dashboard glassmorphism `Sản lượng xưởng`: tạo xưởng, kết nối tenant, PO nhiều công đoạn/đơn giá, ngày nhập và hạn xuất, QR PO, cảnh báo hạn, duyệt sản lượng/phụ phí, cài chu kỳ 1–3 giờ, xếp hạng theo kỳ và báo động trễ nộp/năng suất thấp.
- Thêm Worker dashboard: nhập sản lượng theo PO/công đoạn, quét QR, khai báo công đoạn phát sinh, gửi phụ phí chờ duyệt, lịch sử, đồng hồ nhắc nộp và ví thu nhập riêng tư theo ngày/tuần/tháng/quý/năm.
- Thêm phòng chat xưởng mới nằm dưới `tenants/{tenantId}/rooms/main/messages`. Các câu hỏi `@q` được trả lời cục bộ theo role; nội dung trả lời không ghi vào chat chung. Admin có thể hỏi PO/tổng sản lượng/năng suất; Worker chỉ tra cứu kho, quy trình đã cấu hình và ví của chính mình.
- Khi tenant khác `local-default` đang hoạt động, mục Cộng đồng trong giao diện chuyển người dùng sang chat xưởng tenant thay vì chat cộng đồng dùng chung cũ.
- Tách backup Google Drive theo tenant: giữ tên file backup cũ cho `local-default`, các tenant khác có file riêng; tránh tenant này ghi đè backup tenant khác.
- Bổ sung CI để build Cloud Functions và chạy kiểm tra Firestore rules bằng Emulator; thêm kiểm thử quyền đọc ví, cô lập tenant, duyệt phụ phí và quyền gửi sản lượng.
- Xóa file `lib/production/productionRepository.ts` chưa được sử dụng vì nó dựa vào quyền role truyền từ client và có thể gây hiểu nhầm về ranh giới bảo mật. Dịch vụ Firestore có rules là nguồn dữ liệu có thẩm quyền.

### File đã tạo
- `SO_DO_CAU_TRUC_TONG_QUAT.md`
- `types/tenant.ts`
- `lib/tenancy/authorization.ts`
- `lib/tenancy/activeTenant.ts`
- `lib/services/tenantService.ts`
- `lib/services/workshopFirestoreService.ts`
- `components/workshop-dashboard.tsx`
- `functions/package.json`
- `functions/tsconfig.json`
- `functions/src/index.ts`
- `firestore.indexes.json`
- `tests/security/package.json`
- `tests/security/rules.test.mjs`

### File đã sửa
- `types/product.ts`, `lib/db/qdcomDB.ts`, `lib/services/productService.ts`, `lib/bot/qBotParser.ts`
- `components/qdcom-app.tsx`, `components/community-chat.tsx`, `app/globals.css`
- `lib/sync/googleDriveBackup.ts`, `firestore.rules`, `firebase.json`
- `.github/workflows/ci.yml`, `README.md`, `File.md`, `SESSION_LOG.md`

### Kiểm tra
- Một số lượt CI đầu tiên thất bại khi phát hiện lỗi lint/TypeScript và thiếu Java 21 cho Firestore Emulator; đã sửa theo lỗi thực tế, không bỏ qua cổng kiểm tra.
- Một workflow trước đó đã PASS lint, TypeScript, build Next.js, build Cloud Functions và nạp rules vào Firestore Emulator.
- Bộ kiểm thử Emulator đã chạy và in: `PASS: tenant isolation, worker identity, private earnings, pending-extra review, and tenant chat rules.`
- CI cuối cùng tại commit hiện tại cần được kiểm tra lại sau các thay đổi mới nhất; không ghi là PASS cho đến khi workflow mới nhất hoàn tất.
- Chưa deploy Firestore rules/indexes/Cloud Functions lên Firebase production và chưa thực hiện thử nghiệm thực tế trên tài khoản Google của xưởng.

### Việc còn lại / bàn giao
- Kiểm tra workflow CI mới nhất của nhánh; sửa tiếp mọi lỗi phát sinh cho đến khi PASS.
- Kiểm thử thủ công hai tài khoản (Admin và Worker) trên Firebase test project, đặc biệt: Admin không thể đọc earnings, Worker không thể đọc tenant khác, duyệt sản lượng kích hoạt tính ví.
- Trước khi sử dụng production: cấu hình Firebase project, bật Google Authentication, deploy rules/indexes/functions; Cloud Functions có thể yêu cầu gói billing phù hợp.
- Chat cộng đồng cũ vẫn được giữ để không phá luồng trước đây; người dùng tenant mới được hướng sang chat xưởng có tenant. Nếu muốn mọi nhóm/chat cũ cũng có tenant bắt buộc, cần lập kế hoạch migration riêng thay vì sửa trực tiếp để tránh khóa người dùng khỏi nhóm hiện có.
- Chưa merge PR #2 vào `main`; PR đang để Draft để tránh đưa tính năng chưa deploy Firebase production vào luồng chính.


## Phiên 2026-10-30 · Tạo bảng theo dõi tiến độ dự án

### Mục tiêu
- Tạo một tệp tiến độ độc lập với `SESSION_LOG.md` để nhìn nhanh các bước đã hoàn thành, đang chuẩn bị/đang làm, chưa bắt đầu, bị chặn và chờ người dùng kiểm tra.
- Theo dõi trình tự triển khai các nhóm Authentication, Membership, Authorization, Production, Worker Wallet, Google Integration, Mobile UI, regression chức năng cũ và phát hành.

### Đã thực hiện
- Tạo `TIEN_DO_DU_AN.md` trên nhánh `feature/new-feature-foundation-2026-10-27`.
- Quy ước trạng thái: 🟢 hoàn thành; 🟡 đang chuẩn bị/đang làm; ⚪ chưa bắt đầu; 🔴 bị chặn; 🔵 chờ người dùng kiểm tra.
- Ghi nhận Phase 1 và Phase 2 đã hoàn thành ở mức khảo sát yêu cầu/rà soát tĩnh; không đánh đồng với triển khai code hoặc kiểm toán bảo mật toàn diện.
- Đánh dấu vị trí tiếp theo là A5: kiểm tra lại HEAD, trạng thái nhánh, CI và PR mới nhất trước khi bắt đầu sửa mã nguồn.
- Đưa các chức năng phải bảo toàn vào danh sách regression riêng: kho sản phẩm, Dexie IndexedDB, Google OAuth, đăng nhập thẻ nhân viên, Google Drive Backup, QR, Chat và @Q Bot.

### Kiểm tra và giới hạn
- Tệp mới đã được tạo thành công qua GitHub Contents API; commit: `7cf3d96fec95dbac93107b41815824df428690d0`.
- Chỉ thêm tài liệu; không sửa mã nguồn ứng dụng, không deploy Firebase, không merge PR.
- Các trạng thái 🟢 hiện tại chỉ áp dụng cho công việc khảo sát/định nghĩa đã thực hiện; các nhóm triển khai kỹ thuật vẫn chưa bắt đầu.

### Vị trí bàn giao
- Mở `TIEN_DO_DU_AN.md` để xem và cập nhật trạng thái công việc.
- Tiếp tục A5 rồi lập kế hoạch chi tiết nhóm B — Authentication + Membership + Authorization.


## Phiên 2026-10-30 · Xác minh baseline và bắt đầu chuẩn bị nhóm Authentication

### Đã kiểm tra
- Nhánh `feature/new-feature-foundation-2026-10-27`, HEAD ban đầu `760f93dfbfc6e92ab9535931af2d404789acedde`; PR #2 đang mở ở Draft, chưa merge.
- GitHub Actions `Validate` ở HEAD hiện tại: PASS. Các bước gồm lint, TypeScript, Next.js build, build Cloud Functions và Firestore Rules Emulator.
- Đã đọc lại các tệp trọng tâm: `lib/firebase.ts`, `lib/services/gatekeeperService.ts`, `lib/services/tenantService.ts`, `lib/tenancy/authorization.ts`, `types/tenant.ts`, `components/qdcom-app.tsx`, `components/workshop-dashboard.tsx`, `functions/src/index.ts`, `firestore.rules`, `lib/db/qdcomDB.ts`, `lib/sync/googleDriveBackup.ts`.

### Phát hiện cần xử lý
- Đăng nhập thẻ hiện tại chỉ tra cứu `qdcom.local_members.v1` trong localStorage, không xác minh phía máy chủ và không tạo Firebase Auth session.
- Google OAuth xác thực Firebase và lưu hồ sơ nhưng chưa bắt buộc kiểm tra Membership tập trung trước khi vào các khu vực tenant.
- Khi tải Membership thất bại, UI đang gán role Worker thay vì trạng thái loading/denied rõ ràng.
- Dashboard xưởng đang có luồng Firebase Auth riêng; cần hợp nhất về một nguồn phiên đăng nhập và principal.
- Dexie v2 đã có migration giữ sản phẩm cũ ở `local-default`; Google Drive backup đã tách tên file theo tenant. Không được phá hai cơ chế này.

### Trạng thái và giới hạn
- Đã cập nhật `TIEN_DO_DU_AN.md`: A5 🟢; A6/A7 và B1 🟡.
- CI PASS không thay thế kiểm tra tài khoản Firebase thật, kiểm thử thiết bị và regression các chức năng cũ.
- Phiên này chưa sửa mã nguồn ứng dụng, chưa deploy Firebase production, chưa merge PR.

### Vị trí tiếp theo
- Hoàn tất thiết kế Authentication Gateway, mô hình thông tin xác thực nhân viên và luồng cấp Firebase Custom Token; sau đó mới triển khai từng phần cùng kiểm thử Emulator.


## Phiên 2026-10-30 · Hoàn tất thiết kế Authentication Gateway

### Đã thực hiện
- Tạo `AUTHENTICATION_ARCHITECTURE.md` trên nhánh `feature/new-feature-foundation-2026-10-27`.
- Chốt kiến trúc một Firebase Auth session và một Membership/Authorization pipeline cho Google OAuth và employee card + PIN.
- Đặc tả trạng thái `signed_out`, `authenticating`, `loading_memberships`, `tenant_selection`, `authorized`, `no_membership`, `membership_disabled`, `error`; không fallback role Worker khi chưa xác định được quyền.
- Đặc tả callable function xác minh thẻ + PIN, phát hành Firebase Custom Token, rate limit/lockout và credential chỉ server đọc.
- Ghi danh sách file dự kiến, bộ test bảo mật và tiêu chí hoàn thành nhóm B.

### Kiểm tra và giới hạn
- Tài liệu kiến trúc đã được tạo và xác minh qua GitHub.
- Cập nhật `TIEN_DO_DU_AN.md`: B1 🟢; B2 là bước kế tiếp.
- Chưa thay đổi source code, chưa chạy test mới, chưa deploy Firebase, chưa merge PR.

### Vị trí bàn giao
- Bắt đầu B2: triển khai Google OAuth dùng Membership Gateway và trạng thái UI thống nhất; sau đó mới triển khai credential thẻ nhân viên và Custom Token.


## Phiên 2026-10-30 · Tiếp tục triển khai nền tảng xác thực Q-Dcom

### Kiểm tra hiện trạng
- Xác nhận nhánh `feature/new-feature-foundation-2026-10-27` tồn tại.
- PR #2 vẫn mở và đang ở trạng thái Draft; chưa merge vào `main`.
- PR head SHA tại thời điểm kiểm tra: `760f93dfbfc6e92ab9535931af2d404789acedde`.
- Workflow run được tìm thấy có head SHA `9c2b7d35718a00b1460c7e860ba8925f35606e74`, cũ hơn PR head. Vì vậy không đánh dấu CI PASS cho HEAD hiện tại.
- Đọc lại `components/qdcom-app.tsx`, `lib/firebase.ts`, `lib/services/tenantService.ts`, `lib/tenancy/authorization.ts`, `firestore.rules`, `functions/src/index.ts`, `types/tenant.ts`, `AUTH_REGISTER_GUIDE.md`, `package.json` và workflow CI.

### Phát hiện được xác nhận trong mã nguồn
- `submitLocalLogin()` tìm member ID trong localStorage và mở workspace; không xác minh PIN/mật khẩu phía server, không tạo Firebase Auth session.
- `handleGoogleAuthorization()` xử lý Google identity và hồ sơ, nhưng chưa có Membership Gateway bắt buộc trước khi mở các chức năng tenant.
- `currentTenantRole` dùng `worker` làm fallback khi tenant/UID context chưa khớp; cần thay bằng trạng thái loading/denied tách biệt.
- `getTenantPrincipal()` đọc role từ membership Firestore là nền tảng có thể tái sử dụng, nhưng employeeCode chỉ là giá trị đối chiếu, không phải yếu tố xác thực.
- Google Drive access token và quyền backup phải độc lập với membership của xưởng.
- File `firestore.rules` trong repo không chứng minh được rules đang deploy ở Firebase Console giống hệt.

### Đã thực hiện
- Tạo `AUTH_MEMBERSHIP_DESIGN.md` mô tả kiến trúc Authentication Gateway, trạng thái phiên, Google/employee login, Membership, ma trận quyền, các điều kiện bảo mật và tiêu chí nghiệm thu.
- Cập nhật `TIEN_DO_DU_AN.md`: A5 vẫn 🟡 vì CI chưa xác minh trên HEAD hiện tại; A6 và B1 🟡 vì đang chuẩn bị thiết kế/triển khai.
- Không sửa mã nguồn ứng dụng; không thay đổi Firestore Rules; không deploy Firebase; không merge PR.

### Vị trí tiếp theo
- Hoàn tất baseline CI/check cho đúng PR head và đối chiếu file/rules hiện tại.
- Chốt thiết kế B1 và danh sách file/rủi ro/rollback.
- Sau đó triển khai B2 — lớp Authentication/Session Gateway dùng chung, giữ nguyên Google Drive Backup và các chức năng local-first.


## Phiên 2026-10-30 · Bắt đầu triển khai Authentication Gateway (B2)

### Đã thực hiện
- Tạo `lib/auth/authGateway.ts` làm điểm xác minh tập trung cho truy cập tenant.
- Gateway lấy Firebase Auth user đang hoạt động trực tiếp từ `getFirebaseAuth().currentUser`, từ chối tài khoản anonymous, yêu cầu Firebase ID token và sau đó mới xác minh Membership bằng UID thật.
- Chuyển thao tác kết nối xưởng và tạo xưởng trong `components/workshop-dashboard.tsx` sang dùng `authorizeTenantSession()`.
- Không thay đổi Google Drive OAuth scope, logic backup, Dexie/IndexedDB, QR, chat, kho sản phẩm hoặc Firestore Rules trong lượt này.

### Commit
- `4be7e4cfedb84efcbc0739d7c076b83be24f5582` — thêm Authentication Gateway.
- `84b22a29b327d53926f47eb81bcb02b656ac009b` — tích hợp WorkshopDashboard với Gateway.

### Kiểm tra và giới hạn
- GitHub Actions Validate được kích hoạt trên commit gateway; lần kiểm tra gần nhất còn `in_progress`, chưa có kết quả PASS cho HEAD cuối `84b22a2`.
- Chưa chạy Termux, chưa kiểm thử tài khoản Firebase thật, chưa xác nhận quyền bằng hai tài khoản Admin/Worker.
- Đây mới là bước đầu B2; màn hình chính vẫn còn role fallback cần xử lý, Google OAuth chưa có trạng thái Membership tập trung hoàn chỉnh, employee card + PIN/Custom Token chưa triển khai.
- Không deploy Firebase production, không merge PR #2, không sửa `main`.

### Vị trí tiếp theo
- Kiểm tra CI đúng HEAD mới nhất.
- Tiếp tục chuẩn hóa trạng thái quyền trong app shell và luồng Google OAuth; giữ nguyên chế độ local-first cho kho offline và backup Drive.


## Phiên 2026-10-30 · Chuẩn hóa trạng thái Membership ở app shell

### Đã thực hiện
- Thay luồng đọc Membership trực tiếp trong `components/qdcom-app.tsx` bằng `authorizeTenantSession()`.
- Thêm state rõ ràng: `local_only`, `loading`, `authorized`, `denied`.
- Khi đổi tenant, xóa principal cũ trước khi kiểm tra tenant mới; không giữ quyền cũ trong lúc tải.
- Bỏ fallback gán role Worker khi xác minh Membership thất bại.
- Khóa Bot và Cộng đồng ở tenant không phải local-default cho đến khi Membership được xác minh.
- Kho local-default vẫn giữ chế độ local-first, không yêu cầu Firebase Auth/Membership để truy cập dữ liệu cục bộ.

### Commit và kiểm tra
- Source commit: `a4c87bec57046840e6533cb9ad75214cdccca146`.
- Workflow Validate chạy trên đúng commit `a4c87bec`; tại thời điểm ghi nhận còn `in_progress`.
- Chưa chạy Termux hoặc Firebase thật; chưa đánh dấu B6/B2 hoàn tất.
- Không thay đổi Firestore Rules, không deploy production, không merge PR.

### Vị trí tiếp theo
- Xác nhận kết quả CI cho commit mới.
- Rà soát hoàn chỉnh Google OAuth flow, xử lý no-membership/tenant selection và đồng bộ auth state khi đăng xuất/hết hạn phiên.


## Phiên 2026-10-30 · Xử lý lỗi lint trong Membership state

- CI commit `a4c87bec` báo lỗi ESLint `react-hooks/set-state-in-effect` tại effect đồng bộ tenant.
- Đã sửa bằng cách lưu kết quả xác minh có gắn `tenantId` và `uid`; loading được suy ra khi kết quả chưa khớp context hiện tại, không gọi setState đồng bộ trong effect.
- Commit sửa: `8e895e865a593568c5d05787e8141f4f9175e0d5`.
- Workflow Validate trên commit sửa được kích hoạt và đang chạy tại thời điểm ghi nhận.
- Các lần CI trước đó thất bại chỉ tại bước lint; TypeScript/build/rules chưa chạy do workflow dừng sớm. Không được suy diễn là đã PASS.
- Chưa chạy Termux/Firebase thật; không deploy/merge.


## Phiên 2026-10-30 · Xác minh CI và rà soát tiếp luồng xác thực

### Kết quả kiểm tra
- GitHub Actions Validate run `41080430725` trên source commit `8e895e865a593568c5d05787e8141f4f9175e0d5`: `completed / success`.
- GitHub Actions Validate run `41080518346` trên docs commit `436c957d6492676e6ebe1ee1154202c7a4c3b52a`: `completed / success`.
- Đã đọc lại Gateway, Membership service, Firebase Auth, app shell, Workshop Dashboard, Cloud Functions và Firestore Rules.
- Xác nhận Google OAuth vẫn phục vụ đăng nhập kho local; Bot/Cộng đồng tenant bị khóa cho đến khi Membership được xác minh.
- `getTenantPrincipal()` lấy role từ Membership Firestore, kiểm tra tenant/member active và UID/tenant khớp. Chưa có state machine hoàn chỉnh cho no-membership/disabled/tenant selection.
- Cloud Functions hiện chỉ có trigger tính earnings; chưa có callable function xác minh employee card + PIN và cấp Firebase Custom Token.
- Cần tiếp tục rà soát mọi điểm dùng role và mọi thao tác tenant trước khi coi B2/B6 hoàn tất.

### Giới hạn
- CI PASS không thay thế kiểm thử Firebase runtime, tài khoản Admin/Worker thật hoặc smoke test Termux.
- Không sửa Firestore Rules, không deploy Firebase production, không merge PR #2, không sửa `main`.
- Không đánh dấu B2/B6 hoàn tất; vẫn là công việc đang triển khai.

### Vị trí tiếp theo
- Tiếp tục B2/B6: hoàn thiện trạng thái Google/Membership và logout/session; sau đó triển khai B3/B4 bằng callable function + Firebase Custom Token, có rate limit/lockout và credential server-only.


## Phiên 2026-10-31 · Rà soát sâu Google OAuth và Membership Gateway

### Đã kiểm tra
- Xác nhận nhánh `feature/new-feature-foundation-2026-10-27` tồn tại; PR #2 vẫn mở. Giữ nguyên quy tắc không merge, không deploy production và không sửa `main`.
- Đọc trực tiếp các file: `lib/auth/authGateway.ts`, `lib/services/tenantService.ts`, `lib/tenancy/authorization.ts`, `components/qdcom-app.tsx`, `functions/src/index.ts`, `firestore.rules`, `package.json`.
- Đọc chính xác handler `handleGoogleAuthorization()`: xác minh Google userinfo/email, Firebase Google provider, lưu hồ sơ local, giữ Drive access token, bật trạng thái Drive và điều hướng trang kho.
- Đối chiếu Gateway: `authorizeTenantSession()` chỉ tạo principal sau khi có Firebase Auth user không anonymous và Membership khớp UID/tenant, đang active và có role hợp lệ.

### Kết luận kỹ thuật
- Google Sign-In, Google Drive authorization và Tenant Membership là ba trạng thái khác nhau. Handler Google hiện không trực tiếp cấp Membership; quyền tenant phải tiếp tục được xác minh riêng qua Gateway.
- Kho local-first cần tiếp tục hoạt động với Google identity ngay cả khi tài khoản chưa có Membership; không được nhầm no-membership với lỗi đăng nhập Google hoặc làm mất quyền backup Drive.
- Gateway hiện trả principal hoặc throw error; cần mở rộng state mapping rõ ràng cho no-membership, membership-disabled, tenant-selection và lỗi mạng/xác minh để UI không suy diễn role.
- `createTenant()` đang tạo tenant + admin membership trong client transaction. Cần xác minh rules bảo đảm quyền tạo admin chỉ trong cùng giao dịch tạo tenant mới bởi owner UID; tuyệt đối không cho tự nâng role ở tenant đã tồn tại.
- `functions/src/index.ts` hiện chưa có callable function xác minh employee card + PIN và phát hành Firebase Custom Token. Không được triển khai đăng nhập thẻ bằng cách tra localStorage hoặc so mã thẻ ở client.

### Trạng thái và giới hạn
- Đây là lượt rà soát mã nguồn, chưa sửa source code và chưa có commit ứng dụng mới.
- Chưa chạy CI cho thay đổi mới, Firebase Emulator, Termux hoặc thử tài khoản Admin/Worker thật.
- Không đánh dấu B2/B6 hoàn thành; B3/B4 chưa bắt đầu.
- Không thay đổi Firestore Rules, không deploy production, không merge PR #2.

### Vị trí tiếp theo
- Tiếp tục B2/B6: triển khai state machine Membership rõ ràng và xử lý auth/session/logout nhất quán trong app shell; giữ Google Drive backup và kho local-first độc lập.
- Thêm kiểm thử cho no-membership, member disabled, tenant mismatch, session hết hạn và lỗi mạng.
- Chỉ sau khi B2/B6 có Technical PASS mới chuyển B3/B4: callable function xác minh PIN an toàn, rate limit/lockout và Firebase Custom Token.


## Phiên 2026-10-31 · Rà soát quyền tạo Membership Admin

### Đã đọc lịch sử và hiện trạng
- Đọc lại toàn bộ phần lịch sử tiến độ gần nhất trong `TIEN_DO_DU_AN.md` và phần phiên gần nhất trong `SESSION_LOG.md` trước khi làm.
- Đọc trực tiếp các file trên nhánh `feature/new-feature-foundation-2026-10-27`: `firestore.rules`, `lib/services/tenantService.ts`, `lib/auth/authGateway.ts`, `lib/tenancy/authorization.ts`, `components/qdcom-app.tsx`, `functions/src/index.ts`.
- Xác nhận Gateway hiện chỉ tạo TenantPrincipal sau khi Firebase Auth user hợp lệ và Membership active, role hợp lệ; Gateway vẫn đang trả principal hoặc ném lỗi, chưa có state result đầy đủ cho từng tình huống Membership.

### Phát hiện mới cần xác minh bằng Emulator
- Trong rule tạo `tenants/{tenantId}/members/{memberUid}`, nhánh `isTenantAdmin(tenantId)` hiện không giới hạn role được tạo là `worker`. Vì vậy, theo biểu thức tĩnh, Admin hiện hữu có thể tạo Membership mang role `admin` cho UID khác. Cần chốt chính sách: mời Worker do Admin quản lý; cấp Admin bổ sung chỉ qua chủ tenant hoặc quy trình được ủy quyền rõ ràng.
- Nhánh bootstrap Admin dùng `existsAfter(tenant)` và kiểm tra `ownerUid`; cần có test chứng minh nó chỉ hoạt động khi tenant và Membership Admin được tạo cùng giao dịch ban đầu, không mở đường tự cấp quyền trên tenant đã tồn tại.
- Đây là cảnh báo từ đọc Rules tĩnh, chưa có test Emulator tái hiện; chưa được ghi nhận là lỗ hổng đã xác nhận khai thác.

### Thay đổi trong phiên
- Chỉ cập nhật tài liệu theo dõi; chưa sửa source code hoặc Firestore Rules.
- Đã append kết quả và vị trí tiếp theo vào `TIEN_DO_DU_AN.md`, sau đó append nhật ký phiên này vào `SESSION_LOG.md`.
- Chưa chạy lint/build/CI hoặc Firebase Emulator trong phiên này; không đánh dấu Technical PASS.
- Không merge PR #2, không deploy Firebase production, không sửa `main`; không yêu cầu người dùng mở Termux ở bước này.

### Việc tiếp theo
1. Bổ sung/kiểm tra Firestore Rules Emulator tests cho bootstrap tenant mới, tạo Worker bởi Admin, tạo Admin bởi Admin, tự cấp Admin trên tenant cũ, tenant bị khóa và UID không khớp.
2. Chỉ sửa Rules sau khi hiểu rõ bộ test hiện có và bảo đảm không làm hỏng các quy tắc PO, sản lượng, phụ phí, ví cá nhân, chat và các chức năng cũ.
3. Chạy test Emulator + CI; ghi kết quả thực tế vào hai file trước khi chuyển tiếp.


## Phiên 2026-10-31 · Siết quyền cấp Membership Admin và bổ sung kiểm thử

### Đọc lịch sử và xác minh hiện trạng
- Đọc lại `TIEN_DO_DU_AN.md` và `SESSION_LOG.md` trước khi làm tiếp.
- Xác minh nhánh `feature/new-feature-foundation-2026-10-27` tồn tại; PR #2 vẫn mở ở trạng thái Draft, chưa merge.
- PR head trước khi sửa: `eb6f52330d3500b93e514857c2a5d01ac195bd4b`. Bảng tiến độ cũ ghi HEAD `760f93d` nên cần đồng bộ lại.
- Đọc `firestore.rules`, `tests/security/rules.test.mjs`, `.github/workflows/ci.yml` và cấu hình test `tests/security/package.json`.

### Phát hiện
- Rule tạo Membership cho phép Admin hiện hữu cấp role `admin` cho UID khác.
- Rule cập nhật Membership chưa giới hạn người có quyền nâng role lên `admin`.
- Điều kiện bootstrap trước đó dùng `existsAfter` nhưng chưa yêu cầu tenant chưa tồn tại trước giao dịch; vì vậy chưa khóa rõ bootstrap vào giao dịch tạo tenant mới.

### Đã thay đổi
- Bổ sung test Rules: Admin tạo Worker được phép; Admin tạo Admin bị từ chối; Admin không phải owner không thể nâng Worker lên Admin; không thể tự tạo Membership Admin trên tenant đã tồn tại; bootstrap owner + tenant trong cùng batch được phép.
- Sửa `firestore.rules`: Admin thông thường chỉ tạo Worker; bootstrap Admin yêu cầu `!exists(tenant)` trước và `existsAfter(tenant)` sau cùng ownerUid khớp caller; chỉ ownerUid được phép cập nhật Membership thành role Admin.
- Commit test: `5014a05eb7260f64c80861c465cb8a4f0f249ed3`.
- Commit Rules: `b397150ac59145272db9e87e33a277e271034e49`.

### Kiểm thử và giới hạn
- GitHub Actions Validate run `41147559429` trên đúng commit `b397150` đã bắt đầu; các bước Node setup đang chạy, các bước Emulator còn chờ.
- Chưa có kết quả cuối cùng từ lint/typecheck/build/Firestore Emulator; không đánh dấu Technical PASS.
- Chưa thử Firebase project thật hoặc Termux; chưa cần người dùng thao tác thủ công ở bước này.
- Không merge PR #2, không deploy Firebase production, không sửa `main`.

### Vị trí tiếp theo
1. Kiểm tra kết quả workflow `41147559429` và log Emulator.
2. Nếu test phát hiện sai, sửa Rules/test và xác minh lại.
3. Sau khi Rules PASS, tiếp tục Membership state machine, auth/session/logout và kiểm thử role/tenant.
4. Chỉ sau đó chuyển sang callable employee card + PIN và Firebase Custom Token.
