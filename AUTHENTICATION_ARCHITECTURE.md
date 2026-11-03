# Kiến trúc xác thực và phân quyền — Q-Dcom

> Quyết định kiến trúc hiện hành: **không sử dụng PIN hoặc đăng nhập bằng mã thẻ nhân viên**. Mọi người dùng cần xác thực bằng tài khoản Google/Firebase Auth chính chủ; máy chủ xác minh Membership để quyết định quyền truy cập Tenant.

## 1. Nguyên tắc bắt buộc

1. Firebase Auth xác minh danh tính người dùng và tạo phiên đăng nhập đáng tin cậy.
2. Firebase UID là định danh chính. Không dùng tên, email hiển thị, mã nhân viên, localStorage hoặc Tenant ID làm bằng chứng xác thực.
3. Sau đăng nhập, Q-Dcom chỉ cấp quyền vào Tenant khi Membership tương ứng tồn tại, có UID và tenantId khớp, trạng thái active và role hợp lệ.
4. Tenant ID chỉ là thông tin định tuyến/tìm kiếm. Biết Tenant ID không đồng nghĩa có quyền truy cập.
5. Role luôn lấy từ Membership có thẩm quyền; client không được tự gửi role để cấp quyền.
6. Firestore Security Rules phải kiểm tra người gọi đã đăng nhập và có Membership active trong đúng Tenant. Cloud Functions phải kiểm tra `request.auth.uid` và Membership phía server trước mọi thao tác đặc quyền.
7. Khi tài khoản đăng xuất, đổi UID, Membership bị khóa hoặc Tenant bị khóa, ứng dụng phải xóa principal và dữ liệu tenant khỏi phiên hiện tại.
8. Không có PIN, mật khẩu nội bộ Q-Dcom, Custom Token đăng nhập thẻ hoặc credential xác thực riêng của nhân viên.

## 2. Luồng đăng nhập và vào xưởng

```text
Người dùng
   |
   v
Đăng nhập Google qua Firebase Auth
   |
   v
Firebase xác minh tài khoản và cấp Auth session / ID token
   |
   v
Q-Dcom lấy Firebase UID từ phiên hiện tại
   |
   v
Chọn hoặc xác định Tenant cần truy cập
   |
   v
Server / Membership Gateway kiểm tra:
- Tenant tồn tại và active
- tenants/{tenantId}/members/{uid} tồn tại
- membership.uid == Firebase UID
- membership.tenantId == Tenant đang truy cập
- membership.active == true
- role là admin hoặc worker
   |
   +---- Không hợp lệ ---> Từ chối, không tải dữ liệu tenant
   |
   v
Tạo TenantPrincipal từ Membership đáng tin cậy
   |
   v
Firestore Rules / Cloud Functions tiếp tục kiểm tra quyền từng thao tác
```

## 3. Dữ liệu định danh và Membership

Đường dẫn Membership hiện hành:

`tenants/{tenantId}/members/{firebaseUid}`

Các trường quan trọng:
- `tenantId`: Tenant sở hữu Membership.
- `uid`: Firebase UID chính chủ, phải trùng document ID.
- `role`: `admin` hoặc `worker`, do luồng quản trị hợp lệ ghi.
- `active`: trạng thái cho phép tham gia.
- `employeeCode`: mã nhân viên để nhận diện/quản lý nội bộ, không phải mật khẩu.
- `displayName`: tên hiển thị.

Mọi truy vấn tenant phải ràng buộc theo Tenant ID và UID đã xác minh. Không cho phép client tự tạo Membership hoặc tự nâng role.

## 4. Quy trình Admin thêm công nhân

1. Công nhân đăng nhập Google lần đầu để Firebase Auth tạo/nhận diện tài khoản.
2. Hệ thống lấy Firebase UID từ phiên đã xác thực.
3. Admin thêm đúng UID đó vào Membership của Tenant, gán role Worker và mã nhân viên.
4. Khi công nhân chọn Tenant, Gateway kiểm tra Membership. Chỉ khi hợp lệ mới cho vào khu vực xưởng.
5. Nếu công nhân chưa đăng nhập hoặc Admin chưa gắn đúng UID, hệ thống từ chối truy cập và hướng dẫn liên hệ Admin.

**Điểm cần hoàn thiện trong sản phẩm:** trải nghiệm mời/liên kết tài khoản công nhân với Membership cần rõ ràng, tránh Admin nhập nhầm UID. Có thể xây luồng yêu cầu tham gia/chờ duyệt sau khi nền tảng Auth ổn định; không được thay bằng mã nhân viên đơn thuần.

## 5. Quy tắc bảo mật

- Không tin dữ liệu identity/role/tenant do giao diện gửi lên nếu chưa đối chiếu với Firebase Auth và Firestore.
- Cloud Functions đặc quyền bắt buộc xác minh `request.auth`, Tenant active, Membership active, UID, tenantId và role.
- Firestore Rules từ chối truy cập chéo tenant; Worker chỉ được truy cập dữ liệu cá nhân/những nghiệp vụ được phép.
- Không ghi ID token, refresh token hoặc dữ liệu bí mật vào log.
- Khi thu hồi Membership, quyền truy cập phải bị từ chối ở lần đọc/ghi tiếp theo; giao diện phải xóa dữ liệu đang hiển thị.
- Google Drive OAuth là quyền riêng biệt, không thay thế Firebase Auth hoặc Membership.

## 6. Trạng thái triển khai

- Đã có Firebase Auth session và Membership Gateway trong `lib/auth/authGateway.ts` / `lib/services/tenantService.ts`.
- Đã có kiểm tra trạng thái Tenant, Membership, UID, tenantId và role.
- Đã có trạng thái lỗi rõ ràng; không tự fallback Worker khi chưa xác minh.
- Đã có Firestore Rules và Emulator tests cho các ranh giới quyền quan trọng.
- Đã gỡ thử nghiệm callable đăng nhập PIN và cấp PIN; không triển khai Custom Token cho thẻ nhân viên.
- Chưa coi toàn bộ Auth hoàn tất: còn kiểm thử CI trên commit mới, rà soát callable nghiệp vụ khác, kiểm thử tài khoản Admin/Worker thật và trải nghiệm liên kết UID công nhân.

## 7. Kiểm thử bắt buộc

- Google/Firebase Auth session hợp lệ và không hợp lệ.
- Người chưa đăng nhập không đọc/ghi dữ liệu Tenant.
- Người đã đăng nhập nhưng chưa có Membership bị từ chối.
- Membership inactive hoặc Tenant inactive bị từ chối.
- UID khác, Tenant ID khác hoặc document Membership không khớp bị từ chối.
- Worker không thể tự nâng role Admin hoặc truy cập tenant khác.
- Đổi tài khoản/đăng xuất/thu hồi Membership phải xóa principal và dữ liệu tenant khỏi UI.
- Admin và Worker thực tế chỉ nhìn thấy đúng dữ liệu/quyền của mình.

## 8. Giới hạn và quyết định phát hành

- Không dùng mã nhân viên hoặc Tenant ID làm thông tin đăng nhập độc lập.
- Không triển khai PIN, mật khẩu nội bộ hay Custom Token cho nhân viên.
- Chưa deploy Firebase production hoặc merge PR nếu chưa có xác nhận của chủ dự án.
