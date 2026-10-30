# Q-Dcom — Thiết kế Authentication Gateway và Membership tập trung

> Trạng thái: Bản thiết kế triển khai cho nhóm B. Chưa phải xác nhận mã nguồn đã được sửa hoặc hệ thống production đã an toàn.
> Nhánh: `feature/new-feature-foundation-2026-10-27`

## 1. Mục tiêu

Hợp nhất Google OAuth và đăng nhập thẻ nhân viên thành hai phương thức đi vào **một Firebase Authentication session và một Membership/Authorization pipeline**. Không có đường đăng nhập riêng nào được tự cấp role hoặc tự mở dữ liệu tenant.

## 2. Quy tắc không thương lượng

1. Firebase Auth xác định danh tính (UID); Membership Firestore xác định tenant, role và trạng thái thành viên.
2. Role chỉ được lấy từ dữ liệu tin cậy phía máy chủ. Không tin role, tenantId hay employeeCode do UI/localStorage/chat tự khai báo.
3. Google đăng nhập thành công không đồng nghĩa đã được cấp quyền vào một tenant.
4. Google Drive OAuth/backup consent không đồng nghĩa là membership xưởng.
5. Mã thẻ nhân viên không phải mật khẩu. Phải xác minh thêm PIN/mật khẩu bằng server và phát hành Firebase Custom Token.
6. Local ID/offline profile chỉ được giữ cho tương thích dữ liệu cũ; tuyệt đối không cấp quyền truy cập Firestore/tenant.
7. Lỗi hoặc chưa tải xong Membership phải là trạng thái `loading`/`denied`, không được mặc định thành Worker.
8. UI ẩn chức năng không thay thế Firestore Rules và kiểm tra quyền trong Cloud Functions.

## 3. Kiến trúc phiên đăng nhập

```text
Google OAuth ───────┐
                    ├─> Firebase Auth session ─> Authentication Gateway
Employee Card + PIN ┘                             |
                                                   v
                                      Load trusted Membership(s)
                                                   |
                           ┌───────────────────────┼──────────────────────┐
                           v                       v                      v
                        loading                 authorized               denied
                                                  |
                                    TenantPrincipal (uid, tenantId, role)
                                                  |
                              UI + service layer + Firestore Rules
```

## 4. Luồng Google OAuth

1. Gọi Firebase Google provider.
2. Kiểm tra Firebase User không anonymous và provider là `google.com`.
3. Chờ Firebase Auth state được khôi phục/ổn định.
4. Đọc danh sách Membership theo UID từ nguồn server-authoritative.
5. Với từng membership: xác minh tenant tồn tại, tenant active, membership active, role thuộc `admin | worker`.
6. Nếu có một tenant hợp lệ: chọn tenant theo chính sách đã lưu nhưng phải xác minh lại membership trước khi mở dữ liệu.
7. Nếu có nhiều tenant: hiển thị bộ chọn tenant chỉ từ danh sách server trả về.
8. Nếu chưa có membership: hiển thị trạng thái chưa được thêm vào xưởng hoặc luồng tạo xưởng; không vào dashboard tenant.
9. Chỉ sau khi có principal hợp lệ mới khởi tạo các subscription/dịch vụ tenant.

## 5. Luồng đăng nhập thẻ nhân viên

### Dữ liệu đề xuất
- Membership công khai: tenantId, uid, role, displayName, employeeCode, active.
- Credential riêng server-only: tenantId, normalizedEmployeeCode, uid, salt, pinHash, failedAttempts, lockedUntil, active, updatedAt.
- Credential không được đọc từ client; không lưu PIN dạng rõ hoặc hash yếu.

### Quy trình
1. Người dùng nhập mã xưởng, mã thẻ và PIN.
2. Client gọi HTTPS Callable Function `loginWithEmployeeCard`.
3. Function kiểm tra input, giới hạn tần suất và trạng thái khóa.
4. Function tìm credential trong đúng tenant; xác minh PIN bằng thuật toán hash có salt và so sánh an toàn.
5. Function kiểm tra tenant active và membership active.
6. Nếu hợp lệ, Admin SDK phát hành Firebase Custom Token cho UID đã gắn với membership.
7. Client đăng nhập bằng `signInWithCustomToken`; sau đó chạy chung Membership Gateway như Google.
8. Nếu thất bại, trả thông báo chung, không tiết lộ mã thẻ có tồn tại hay không.

### Quản trị credential
- Chỉ Admin đã được xác thực và có membership active mới được thêm nhân viên hoặc cấp/đặt lại PIN qua callable function.
- Mã nhân viên phải duy nhất trong tenant.
- Không cho Admin thay đổi UID/role bằng payload tùy ý; function tự xác minh caller.
- Có quy trình khóa/mở khóa và thu hồi credential.
- Không log PIN, token, hash hoặc dữ liệu xác thực nhạy cảm.

## 6. Authentication Gateway và trạng thái UI

Định nghĩa trạng thái duy nhất:
- `signed_out`: chưa có Firebase user.
- `authenticating`: OAuth/custom-token đang xử lý.
- `loading_memberships`: Firebase user có nhưng đang tải Membership.
- `tenant_selection`: có nhiều Membership hợp lệ.
- `authorized`: có TenantPrincipal hợp lệ.
- `no_membership`: đã đăng nhập nhưng chưa được thêm vào xưởng.
- `membership_disabled`: membership hoặc tenant bị khóa.
- `error`: lỗi xác thực/đọc quyền; không cấp quyền dự phòng.

Không sử dụng role mặc định `worker` để che trạng thái chưa xác định.

## 7. Tổ chức mã nguồn dự kiến

- `lib/auth/authTypes.ts`: trạng thái phiên và kiểu principal.
- `lib/auth/authGateway.ts`: điều phối Firebase Auth + Membership.
- `lib/auth/authSession.ts`: helper đăng nhập Google/thẻ và đăng xuất.
- `lib/services/membershipService.ts`: đọc Membership và xác minh tenant.
- `functions/src/auth.ts`: callable functions cấp credential, đăng nhập thẻ, khóa/đặt lại PIN.
- `functions/src/index.ts`: export callable functions.
- `firestore.rules`: chặn client đọc credential; membership/tenant chỉ theo đúng ma trận quyền.
- `components/qdcom-app.tsx` và `components/workshop-dashboard.tsx`: dùng chung gateway, bỏ luồng xác thực song song sau khi chuyển đổi an toàn.

Tên file có thể điều chỉnh sau khi kiểm tra import graph; không xóa file/luồng cũ trước khi migration và regression chứng minh không còn phụ thuộc.

## 8. Kiểm thử bắt buộc

- Google user có Membership active.
- Google user không có Membership.
- Membership inactive, tenant inactive, role không hợp lệ.
- Một user thuộc nhiều tenant.
- Employee card + PIN hợp lệ cấp đúng UID và role từ Membership.
- Sai PIN, mã thẻ không tồn tại, tenant không tồn tại; phản hồi không tiết lộ credential.
- Thử brute force/rate limit/lockout.
- Worker không thể tự cấp Admin, đổi tenantId hoặc UID.
- Admin chỉ thêm thành viên trong tenant của mình.
- Client không đọc được credential collection.
- Sau đăng xuất, phiên Firebase bị thu hồi ở client; dữ liệu tenant không còn được truy cập.
- Legacy local ID vẫn mở được dữ liệu offline được phép nhưng không truy cập Firestore tenant.

## 9. Điều kiện hoàn thành nhóm B

- Lint, TypeScript, Next.js build, Cloud Functions build PASS.
- Firestore Rules và callable tests bằng Emulator PASS.
- Regression kho/Dexie/QR/chat/backup PASS.
- Kiểm tra thực tế trên điện thoại bằng tài khoản Admin và Worker PASS.
- Chưa deploy production/merge main cho đến khi người dùng xác nhận.
