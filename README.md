# Q-Dcom

Ứng dụng nội bộ quản lý mẫu hàng, tồn kho và vị trí lưu trữ. Q-Dcom không có luồng mua hàng, giỏ hàng, đặt hàng hay thanh toán.

## Chạy local

Yêu cầu Node.js 20.9 trở lên.

```bash
npm install
npm run dev
```

Mở http://localhost:3000. Kiểm tra bằng `npm run lint`, `npx tsc --noEmit` và `npm run build`; chạy bản build với `npm start`.

## Đóng góp và merge

Tạo nhánh cho từng thay đổi, mở pull request vào `main`, review rồi squash-merge. Hướng dẫn chi tiết và checklist nằm trong [CONTRIBUTING.md](CONTRIBUTING.md).

## Cấu hình môi trường

Sao chép `.env.example` thành `.env.local` và điền cấu hình Web App từ Firebase project:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

Trong Firebase Console, chỉ bật Google trong Authentication > Sign-in method, đồng thời thêm domain ứng dụng vào Authorized domains. Anonymous Auth không được sử dụng; Firestore rules từ chối mọi phiên anonymous. Các biến cấu hình Firebase `NEXT_PUBLIC_*` được nhúng vào bundle trình duyệt; không đặt secret/token nhạy cảm vào những biến này. Khai báo các biến tương ứng trong môi trường deploy.

Đăng nhập Google dùng Firebase Auth popup và yêu cầu scope `drive.appdata` để lưu backup trong vùng dữ liệu riêng, cùng `drive.metadata.readonly` để đọc thanh dung lượng Drive. Bật Google Drive API và, nếu OAuth consent screen ở chế độ Testing, thêm email đăng nhập vào danh sách Test users trong Google Cloud Console. Token chỉ được giữ trong bộ nhớ ứng dụng khi đồng bộ.

Firebase Auth là hộ chiếu Google cho danh bạ và chat. Đăng ký/đăng nhập bằng ID cá nhân vẫn hoạt động ngoại tuyến nhưng hồ sơ chỉ nằm trên thiết bị; hồ sơ này không cấp quyền Firebase và không được đồng bộ qua máy chủ.

## Dữ liệu ngoại tuyến

Q-Dcom lưu sản phẩm, từ vựng bot và thành viên trong IndexedDB qua Dexie (`QDcom_Offline_DB`). Lần mở đầu tạo dữ liệu từ `data/mockProducts.ts`; dữ liệu sản phẩm/từ vựng localStorage cũ được nhập khi tạo cơ sở dữ liệu. Google Drive nhận bản backup JSON/Gzip tự động trong vùng `appDataFolder`; Cài đặt hiển thị dung lượng Drive và cho tải file JSON về máy. Service worker cache app shell và tài nguyên cùng origin sau lần tải trực tuyến đầu tiên. Camera và Google OAuth cần HTTPS hoặc localhost; IndexedDB và các màn kho/bot/báo cáo vẫn dùng offline.

Firestore chỉ chứa hồ sơ công khai tối thiểu (mã thành viên, họ tên), nhóm/phòng chat, yêu cầu tham gia và tin nhắn. Kho hàng và lịch sử nghiệp vụ không được ghi lên Firestore. Tin nhắn `@q` lưu câu hỏi; mỗi thiết bị tự truy vấn IndexedDB và dựng thẻ kết quả cục bộ, không phát tán số lượng/vị trí hàng qua máy chủ. Xem [firestore.rules](firestore.rules) và `lib/services/gatekeeperService.ts` để biết giới hạn truy cập.

Trong Cài đặt, nhập từ/cụm từ mới, chọn ý định số lượng/vị trí/chào hỏi rồi nhấn **Thêm từ**. Câu chào và câu trả lời khi không tìm thấy cũng được lưu trong bảng `botVocabulary`.

QR chia sẻ chứa định danh thành viên và chỉ các trường mẫu hàng cơ bản (ID, tên, số lượng, giá); ảnh và mô tả không nhúng vào QR. Người nhận quét sẽ thêm thành viên và upsert các mẫu trong một transaction. QR là dữ liệu trao đổi trực tiếp, hồ sơ trong QR không phải danh tính được máy chủ xác thực và không có đồng bộ nền tự động giữa thiết bị. Backup JSON bao gồm sản phẩm (kể cả ảnh nhúng), từ vựng và thành viên; có thể bật **Nén nhẹ (bỏ dữ liệu ảnh Base64)** khi tải file backup. File nhập được kiểm tra schema, giới hạn 25 MB và được merge theo ID.

PWA dùng `public/manifest.json`, icon SVG placeholder tại `public/icons/` và `public/sw.js`. Đổi icon bằng SVG của riêng bạn hoặc chuyển sang PNG rồi cập nhật loại MIME/đường dẫn trong manifest.

## Cấu trúc module

```text
app/                         App Router, layout và route trang chính
  privacy/                   Chính sách bảo mật đầy đủ
components/
  products/                  ProductCard, ProductImage và trạng thái dùng lại
  search/                    SearchBar dùng lại
  background-video.tsx       Lớp nền video
  qdcom-app.tsx               Điều phối dashboard, các tab và menu Sidebar
data/mockProducts.ts          Dữ liệu local khởi tạo
lib/bot/                      Từ điển và parser @q
lib/db/                       Dexie IndexedDB: products, botVocabulary, members
lib/services/productService.ts Product service Dexie
lib/sync/                     Schema QR và backup JSON
public/manifest.json          PWA manifest
public/sw.js                  Offline app-shell cache
public/videos/                Video riêng cho đăng nhập và ứng dụng
types/                        Product, Inventory, BotQuery và UserRole
SESSION_LOG.md                Lịch sử và handoff giữa các agent
```

## Luồng ứng dụng

`app/page.tsx` kết xuất `QDcomApp`; nội dung Giới thiệu được tích hợp trong ứng dụng, không còn render thêm section bên ngoài dashboard. Sidebar nhóm điều hướng thành Quản lý chính (Mẫu hàng & Kho, Tra cứu @q, Tổng quan kho), Giới thiệu & phát triển dự án (Giới thiệu Q-Dcom, Chính sách bảo mật dữ liệu), Hệ thống (Cài đặt) và các mục xem trước đang phát triển. Các mục xem trước chỉ hiển thị thông báo, chưa điều hướng tới chức năng chưa có.

Các màn hình Kho, Tra cứu @q, Tổng quan kho, Giới thiệu, Chính sách bảo mật tóm tắt và Cài đặt chuyển đổi trong cùng khung dashboard. Tab bảo mật có liên kết tới trang chính sách đầy đủ `/privacy`. Trên di động, thanh điều hướng cuộn ngang để giữ khả năng truy cập mọi tab; mục xem trước vẫn hiện toast. Sản phẩm/từ vựng/thành viên được lưu trong Dexie; hồ sơ ID/Google và tùy chỉnh giao diện được lưu cục bộ. Parser dùng `lib/bot/qBotParser.ts` và `lib/bot/vocabulary.ts`. QR dùng `html5-qrcode`/`qrcode.react`; backup được kiểm tra trong `lib/sync/qdcomSync.ts`.

Sidebar dùng viền gradient, nền kính blur, glow và hiệu ứng trượt vào; mục active/hover có viền sáng và hiệu ứng nổi. Tôn trọng `prefers-reduced-motion` toàn cục để giảm chuyển động khi người dùng đã bật tùy chọn này.

## Video nền

Thêm các video MP4 tùy chọn theo tên `login-bg-video.mp4` (màn đăng nhập) và `app-bg-video.mp4` (dashboard) vào `public/videos/`. Giao diện nền tĩnh vẫn hoạt động nếu chưa có tệp.

## Quản lý sản lượng xưởng theo tenant

Nhánh tính năng `feature/new-feature-foundation-2026-10-27` bổ sung khu vực **Sản lượng xưởng** gồm dashboard Admin/Worker, PO và đơn giá công đoạn, báo cáo sản lượng, phụ phí chờ duyệt, ví thu nhập riêng tư, QR PO và chat xưởng có `tenantId`.

- Kiến trúc: [SO_DO_CAU_TRUC_TONG_QUAT.md](SO_DO_CAU_TRUC_TONG_QUAT.md)
- Nhật ký phiên: [SESSION_LOG.md](SESSION_LOG.md)
- Firebase rules: `firestore.rules`; indexes: `firestore.indexes.json`; Cloud Functions: `functions/`
- Kiểm thử rules: `tests/security/rules.test.mjs` chạy bằng Firestore Emulator.
- **Chưa triển khai production**: trước khi dùng dữ liệu thật cần deploy rules/indexes/functions và xác nhận quyền Firebase/Google OAuth. Admin không được đọc tài liệu earnings cá nhân; ví được tính phía máy chủ và chỉ Worker sở hữu mới đọc được.
