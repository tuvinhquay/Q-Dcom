# Nhật ký phát triển Q-Dcom

- Đã cấu hình Firebase Auth bằng các biến `NEXT_PUBLIC_FIREBASE_*` trong `.env.local` và `.env.example`.
- Chỉ tài khoản Google thật được cấp Firebase Auth; Anonymous Auth bị chặn. ID cá nhân vẫn dùng được ngoại tuyến nhưng không cấp quyền truy cập cộng đồng.
- Kho, từ vựng Bot và dữ liệu thành viên ở IndexedDB; backup JSON/Gzip tự đồng bộ thành `Q-Dcom_Backup.json.gz` trong vùng `appDataFolder` riêng tư. Thay đổi được gom trong 500 ms; khi đăng xuất, ứng dụng chờ backup cuối cùng hoàn tất.
- Firestore giữ hồ sơ công khai tối thiểu, nhóm/phòng chat, yêu cầu tham gia và tin nhắn. @q gửi câu hỏi trong chat nhưng tra cứu dữ liệu kho cục bộ, không ghi kết quả sản phẩm lên Firestore.
- Token OAuth chỉ tồn tại trong bộ nhớ; nếu tải lại trang hoặc token hết hạn, hãy kết nối lại Google Drive trong Cài đặt. Nếu backup khi đăng xuất gặp lỗi, ứng dụng giữ trạng thái đăng nhập và hiển thị lỗi.
- Giao diện đăng ký có nền glow/wave chuyển động, placeholder để thay bằng video MP4 xuyên thấu và card kính mờ với nền `rgba(15, 23, 42, 0.55)`, blur `20px`, viền trắng 18%.
- Triển khai thực tế cần bật Google (không bật Anonymous như một luồng đăng nhập ứng dụng) trong Firebase Authentication, deploy `firestore.rules`, thêm domain ứng dụng vào Authorized domains, bật Google Drive API và cấu hình OAuth consent screen chỉ với scope `https://www.googleapis.com/auth/drive.appdata`. Không xin quyền metadata toàn Drive; vì vậy giao diện không đọc quota tổng.

## Tiến độ phiên làm việc — 15/10/2026

- Hoàn thiện định hướng Local-First: IndexedDB là nơi lưu dữ liệu nghiệp vụ; Firebase Auth xác thực Google; Firestore chỉ quản lý hồ sơ công khai, nhóm, yêu cầu tham gia và tin nhắn.
- Bổ sung Firestore security rules và cấu hình `firebase.json`; cấm anonymous login và giới hạn quyền đọc/ghi theo chủ sở hữu, trưởng nhóm và thành viên phòng chat.
- Tích hợp backup Google Drive dạng JSON/Gzip, hiển thị dung lượng Drive và cảnh báo sao lưu cho tài khoản ID cá nhân khi đăng xuất hoặc thoát.
- Bổ sung chat cộng đồng kiểu Telegram với tìm người dùng, chat riêng, tạo nhóm, mã QR/mã mời, duyệt yêu cầu và gỡ thành viên.
- Tích hợp truy vấn `@q` trong chat: câu trả lời được tạo từ dữ liệu IndexedDB trên thiết bị, không tải dữ liệu kho lên Firestore.
- Đã xác nhận `npm run lint`, `npx tsc --noEmit --pretty false`, `npm run build`, và nạp rules bằng Firebase Emulator thành công.
- Đã khởi chạy máy chủ phát triển bằng `npm run dev`; địa chỉ cục bộ: `http://localhost:3000`.
- Chưa triển khai rules lên Firebase production; cần cấu hình dự án/Google OAuth thực tế trước khi deploy.

## Phiên 2026-10-21 · Chat cộng đồng, Firestore rules và handoff kiến trúc

- Rà soát các truy vấn trong `components/community-chat.tsx` và các thao tác Firestore tương ứng trong `lib/services/gatekeeperService.ts`; sửa rule đọc chat dùng `get()` khiến Firestore không chứng minh được truy vấn participant; bổ sung thông báo hướng dẫn đăng nhập và deploy rules.
- Xử lý idempotent yêu cầu vào nhóm đang chờ; cho phép chính người gửi mở lại yêu cầu đã bị từ chối, không nới quyền duyệt/thêm/xóa thành viên của trưởng nhóm.
- Thiết kế lại chat responsive cho desktop/mobile: panel tìm thành viên/tạo nhóm, danh sách hội thoại có avatar, màn chat mobile có nút quay lại, bong bóng chat, thẻ kết quả @q, QR mời nhóm và quản trị yêu cầu/thành viên.
- Bổ sung tài liệu tập trung `SO_DO_CAU_TRUC_TONG_QUAT.md`, ghi kiến trúc Local-First, Firebase Gatekeeper, Firestore schema/rules, OAuth tối thiểu, cấu trúc mã, tiến trình phát triển và hướng dẫn agent.
- Kiểm tra lại rules bằng Firebase Emulator, chạy lint, typecheck và production build.
- Rules thay đổi trong repo cần được deploy vào đúng Firebase project trước khi khắc phục lỗi permission trên môi trường đang chạy.
