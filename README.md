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

Sao chép `.env.example` thành `.env.local`. IndexedDB hoạt động ngay cả khi chưa cấu hình OAuth. Để bật đăng nhập Google, tạo OAuth 2.0 Web Client trong Google Cloud Console, thêm origin ứng dụng vào Authorized JavaScript origins, rồi khai báo:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

Client ID là định danh công khai, không phải client secret. Không đặt secret/token nhạy cảm trong biến `NEXT_PUBLIC_*`. Trên môi trường deploy, khai báo Client ID và các origin OAuth phù hợp trong Google Cloud Console.

Đăng ký bằng ID, họ tên và chuyên ngành mở dashboard ngay, không cần Google OAuth. Hồ sơ ID được lưu cục bộ và có thể đăng nhập lại trên cùng thiết bị sau khi đăng xuất. Google Login vẫn là một lựa chọn độc lập. Hồ sơ cục bộ không phải xác thực an toàn và không được đồng bộ qua máy chủ.

## Dữ liệu ngoại tuyến

Q-Dcom lưu sản phẩm, từ vựng bot và thành viên trong IndexedDB qua Dexie (`QDcom_Offline_DB`). Lần mở đầu tạo dữ liệu từ `data/mockProducts.ts`; dữ liệu sản phẩm/từ vựng localStorage cũ được nhập khi tạo cơ sở dữ liệu. Service worker cache app shell và tài nguyên cùng origin sau lần tải trực tuyến đầu tiên. Camera và Google OAuth cần HTTPS hoặc localhost; IndexedDB và các màn kho/bot/báo cáo vẫn dùng offline.

Trong Cài đặt, nhập từ/cụm từ mới, chọn ý định số lượng/vị trí/chào hỏi rồi nhấn **Thêm từ**. Câu chào và câu trả lời khi không tìm thấy cũng được lưu trong bảng `botVocabulary`.

QR chia sẻ chứa hồ sơ thành viên và mẫu hàng đã chọn theo giới hạn dung lượng thực của mã; ảnh data URL không nhúng vào QR. Người nhận quét sẽ thêm thành viên và upsert các mẫu trong một transaction. QR là dữ liệu trao đổi trực tiếp, hồ sơ trong QR không phải danh tính được máy chủ xác thực và không có đồng bộ nền tự động giữa thiết bị. Backup JSON bao gồm sản phẩm (kể cả ảnh nhúng), từ vựng và thành viên; file nhập được kiểm tra schema, giới hạn 25 MB và được merge theo ID.

PWA dùng `public/manifest.json`, icon SVG placeholder tại `public/icons/` và `public/sw.js`. Đổi icon bằng SVG của riêng bạn hoặc chuyển sang PNG rồi cập nhật loại MIME/đường dẫn trong manifest.

## Cấu trúc module

```text
app/                         App Router, layout và route trang chính
components/
  products/                  ProductCard, ProductImage và trạng thái dùng lại
  search/                    SearchBar dùng lại
  background-video.tsx       Lớp nền video
  qdcom-app.tsx               Điều phối dashboard/chat/cài đặt
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

`app/page.tsx` kết xuất `QDcomApp`. Component điều phối các tab Kho, Tra cứu @q, Tổng quan và Cài đặt. Sản phẩm/từ vựng/thành viên được lưu trong Dexie; hồ sơ ID/Google và tùy chỉnh giao diện được lưu cục bộ. Parser dùng `lib/bot/qBotParser.ts` và `lib/bot/vocabulary.ts`. QR dùng `html5-qrcode`/`qrcode.react`; backup được kiểm tra trong `lib/sync/qdcomSync.ts`.

## Video nền

Thêm các video MP4 tùy chọn theo tên `login-bg-video.mp4` (màn đăng nhập) và `app-bg-video.mp4` (dashboard) vào `public/videos/`. Giao diện nền tĩnh vẫn hoạt động nếu chưa có tệp.