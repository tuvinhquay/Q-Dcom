# Q-Dcom — Thiết kế nền tảng Authentication, Membership và Authorization

> Trạng thái: BẢN THIẾT KẾ ĐANG CHUẨN BỊ — chưa triển khai mã nguồn.  
> Phạm vi: nhóm B trong `TIEN_DO_DU_AN.md`.  
> Nguyên tắc: giữ nguyên kho IndexedDB, Google OAuth/Drive Backup, QR, Chat và các dữ liệu hiện hữu; chỉ thay đổi luồng xác thực/phân quyền theo từng bước có kiểm thử.

## 1. Vấn đề đã xác nhận trong mã nguồn hiện tại

1. `components/qdcom-app.tsx` có hai lối vào khác nhau: đăng nhập Google và đăng nhập ID cục bộ.
2. `submitLocalLogin()` tìm ID trong `localStorage` rồi mở workspace; không xác minh PIN/mật khẩu với máy chủ và không tạo Firebase Auth session.
3. `handleGoogleAuthorization()` xác thực Google và lưu hồ sơ người dùng, nhưng luồng chính chưa thực hiện một bước Membership Gateway bắt buộc trước khi mở các chức năng xưởng.
4. Vai trò đang được khởi tạo/dự phòng thành `worker` khi tenant context chưa khớp hoặc chưa tải xong. Trạng thái chưa xác định không được phép biến thành một vai trò có quyền.
5. `tenantService.ts` hiện đọc membership theo Firebase UID và lấy role từ Firestore; đây là nền tảng có thể tái sử dụng, nhưng chưa đủ cho xác thực thẻ nhân viên.
6. Google Drive OAuth access token phục vụ backup là quyền Google Drive, không phải bằng chứng thành viên xưởng.
7. Firestore Rules có các nhánh legacy và tenant. Mọi thay đổi phải giữ các collection cũ và kiểm tra regression; mã rules trong repo chưa chứng minh được rules đang deploy ở Firebase Console giống hệt.

## 2. Mục tiêu kiến trúc

Mọi phương thức đăng nhập phải kết thúc tại cùng một trạng thái xác thực Firebase và cùng một bộ kiểm tra Membership:

`Phương thức đăng nhập → Firebase Auth → Membership Gateway → Tenant Principal → Điều hướng theo quyền`

- Google OAuth: Firebase Google Auth tạo UID; sau đó kiểm tra membership/tenant được chọn.
- Thẻ nhân viên: mã thẻ là định danh, không phải bí mật. Nhân viên phải cung cấp yếu tố bí mật (PIN/mật khẩu) được máy chủ xác minh. Chỉ sau khi hợp lệ, backend mới phát hành Firebase Custom Token; client đổi token thành Firebase Auth session.
- Hai lối vào dùng chung Membership, trạng thái active, tenantId và role.
- Vai trò và tenantId không được tin từ localStorage, URL, form, chat hoặc state UI.
- Không có Membership hợp lệ: chỉ được vào khu vực hướng dẫn/đăng ký phù hợp; không được truy cập dữ liệu xưởng.
- Người dùng cục bộ/offline cũ vẫn có thể dùng các chức năng local được phép, nhưng không được dùng hồ sơ local để truy cập Firestore hoặc dữ liệu tenant được bảo vệ.

## 3. Trạng thái phiên thống nhất

Dùng trạng thái phân biệt rõ ràng, không gán role mặc định:

| Trạng thái | Ý nghĩa | Quyền |
|---|---|---|
| `initializing` | Firebase/session đang khởi tạo | Chưa render khu vực được bảo vệ |
| `unauthenticated` | Chưa có Firebase Auth user | Chỉ màn hình đăng nhập |
| `membership-loading` | Đã xác thực, đang tải membership | Chưa truy cập dữ liệu tenant |
| `authorized` | Membership active và principal hợp lệ | Theo role từ nguồn có thẩm quyền |
| `membership-required` | Google đã xác thực nhưng chưa thuộc tenant | Không có quyền dữ liệu tenant |
| `suspended` | User/tenant/membership bị khóa | Từ chối truy cập |
| `error` | Không thể xác minh trạng thái | Fail closed; hiển thị lỗi và thử lại |

Không dùng `worker` làm giá trị thay thế cho `unknown/loading/denied`.

## 4. Google OAuth và Google Drive là hai trạng thái độc lập

- Google Sign-In xác thực danh tính Firebase.
- Membership Gateway quyết định người dùng có thuộc tenant và có role nào.
- Google Drive consent/access token chỉ điều khiển chức năng backup và quota.
- UI phải hiển thị riêng: Google account authenticated, tenant membership status, Google Drive connected/needs reconnect/backup status.
- Nếu Google đăng nhập thành công nhưng membership không hợp lệ, không được mở dashboard xưởng.
- Nếu Drive token hết hạn, membership vẫn có thể hợp lệ; chỉ backup cần yêu cầu kết nối lại.

## 5. Thiết kế đăng nhập thẻ nhân viên

### Luồng dự kiến

1. Người dùng nhập mã xưởng, mã thẻ nhân viên và PIN.
2. Client gọi HTTPS Callable Function qua Firebase App Check nếu cấu hình được.
3. Function chuẩn hóa dữ liệu, giới hạn tần suất và xác minh tenant/member đang active.
4. Backend so sánh PIN với hash có salt được lưu an toàn; không lưu PIN dạng rõ, không gửi hash xuống client.
5. Khi hợp lệ, backend tạo Firebase Custom Token cho UID ổn định của nhân viên.
6. Client gọi `signInWithCustomToken`, sau đó chạy đúng Membership Gateway như Google.
7. Khi sai thông tin, trả thông báo chung; không tiết lộ mã thẻ có tồn tại hay không.

### Điều kiện bảo mật bắt buộc trước khi phát hành

- Không dùng employeeCode đơn lẻ làm mật khẩu.
- PIN/hash không nằm trong client bundle, localStorage, log hoặc Firestore document có thể đọc bởi client.
- Dùng hash mật khẩu phù hợp có salt (ví dụ scrypt/Argon2 trong môi trường backend được hỗ trợ) hoặc cơ chế secret/HMAC có thiết kế và kiểm thử rõ ràng; không tự chế thuật toán.
- Có rate limit/chống dò PIN, độ trễ hoặc khóa tạm thời; không khóa vĩnh viễn dễ bị DoS.
- Có quy trình Admin mời/cấp/reset thông tin xác thực và audit log.
- Không cho phép người dùng tự tạo tài khoản thẻ với role Admin.
- Chỉ người có quyền được xác minh mới được tạo hoặc vô hiệu hóa membership.
- Firebase Custom Token phải được phát hành bằng Admin SDK phía server; không bao giờ tạo ở client.

## 6. Membership và nguồn dữ liệu có thẩm quyền

- Membership là nguồn quyết định `tenantId`, `role`, `active` và quyền.
- Tenant owner/Admin ban đầu chỉ được cấp trong luồng tạo tenant được xác minh; không cho client tự gửi role tùy ý.
- Nhân viên có thể liên kết một Firebase UID duy nhất với membership theo tenant. Nếu cần hỗ trợ cả Google và thẻ nhân viên cho cùng một người, cần quy tắc liên kết tài khoản rõ ràng; không tự động gộp chỉ dựa vào tên hoặc mã thẻ.
- Việc đổi tenant phải tải lại principal từ server và reset dữ liệu tenant trước khi render.
- Quyền phải được thực thi tại Firestore Rules/Cloud Functions; UI chỉ là lớp hiển thị.

## 7. Ma trận quyền tối thiểu

| Tài nguyên/hành động | Admin | Worker |
|---|---|---|
| Thông tin tenant | Đọc/quản lý theo policy | Đọc thông tin cần thiết |
| Thành viên | Quản lý/invite/disable theo policy | Chỉ đọc hồ sơ cần thiết |
| PO và công đoạn | Tạo/sửa/đóng | Đọc PO được giao |
| Đơn giá công đoạn | Quản lý | Không đọc đơn giá nhạy cảm |
| Sản lượng | Xem tổng hợp, duyệt | Tạo và xem dữ liệu của mình |
| Phụ phí | Duyệt/từ chối | Tạo và xem yêu cầu của mình |
| Ví cá nhân | Không đọc ví từng Worker theo mặc định | Chỉ đọc ví của chính mình |
| Báo cáo | Tổng hợp theo policy | Thông tin cá nhân được phép |
| Kho cục bộ | Theo quyền ứng dụng hiện tại | Theo quyền ứng dụng hiện tại |

## 8. Kế hoạch triển khai nhỏ, có thể kiểm tra

1. B1 — Chốt hợp đồng kiến trúc và trạng thái phiên (tài liệu này).
2. B2 — Tạo lớp auth/session gateway, tích hợp Google nhưng chưa phá luồng backup.
3. B3 — Thiết kế và triển khai callable employee-card verification cùng quản trị PIN an toàn.
4. B4 — Đổi thẻ nhân viên sang Custom Token/Firebase Auth.
5. B5 — Hợp nhất Membership principal và tenant switching.
6. B6 — Loại bỏ fallback role; bảo vệ route/page theo trạng thái session.
7. B7 — Xử lý sign-out, disable/revoke, session expiration.
8. B8 — Củng cố Firestore Rules/Functions, giữ nguyên rules legacy cần thiết.
9. B9 — Emulator/unit/integration tests cho Admin, Worker, inactive, wrong PIN, cross-tenant và unauthenticated.
10. B10 — Technical validation và regression.
11. B11 — Người dùng kiểm tra thực tế bằng tài khoản Admin và Worker.
12. B12 — Chỉ hoàn tất khi Technical PASS và Practical PASS.

## 9. Điều kiện nghiệm thu nhóm B

- Google login không tự động đồng nghĩa với quyền vào xưởng.
- Google user chưa có membership không thể đọc/ghi dữ liệu tenant.
- Employee code một mình không thể đăng nhập.
- Employee login tạo Firebase Auth session thật và sau đó dùng chung Membership Gateway.
- Admin/Worker role luôn được tải từ nguồn có thẩm quyền.
- Không có thời điểm loading/unknown bị xem như Worker hoặc Admin.
- Worker không đọc dữ liệu tenant khác hoặc ví của Worker khác.
- Admin không đọc ví cá nhân từng Worker theo mặc định.
- Google Drive có thể reconnect độc lập mà không làm thay đổi membership.
- Các tính năng kho/Dexie/QR/Chat/Drive Backup cũ qua regression.
- Không deploy Firebase production và không merge PR nếu chưa được người dùng duyệt.

## 10. Những điểm chưa được tự ý quyết định

- Chính sách PIN: độ dài, số lần thử, thời gian khóa và quy trình reset cần được chốt cùng chủ dự án trước khi bật đăng nhập nhân viên thực tế.
- Quy trình liên kết Google account và thẻ nhân viên cho cùng một cá nhân cần xác định danh tính đáng tin cậy.
- Firebase production project, App Check enforcement, Secrets và billing phải được xác nhận trước khi triển khai.
- Firestore Rules đang hoạt động trên Firebase Console cần được đối chiếu riêng; không giả định trùng với file trong GitHub.
