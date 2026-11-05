# Kiến trúc xác thực, phân quyền và khôi phục dữ liệu — Q-Dcom

> **Quyết định hiện hành (2026-11-04):** Q-Dcom hỗ trợ hai phương thức đăng ký độc lập: (1) thẻ ID công ty + mật khẩu riêng; (2) Google. Chỉ loại bỏ PIN cũ. Firebase là cổng xác thực/ủy quyền và bảo vệ Tenant; dữ liệu nghiệp vụ chính theo kiến trúc Local-first, không lấy Firestore làm kho dữ liệu chính.

## 1. Hai phương thức đăng ký

### A. Thẻ ID công ty + mật khẩu riêng

1. Người dùng nhập mã thẻ nhân viên công ty đã cấp và tự tạo mật khẩu riêng.
2. Backend xác minh mã thẻ thuộc nhân viên hợp lệ, đúng Tenant và đang active; quy trình kích hoạt phải chống người khác chiếm mã thẻ.
3. Mật khẩu được băm bằng thuật toán chuyên dụng có salt riêng; không lưu mật khẩu rõ, không log credential; có rate limit, lockout phù hợp và quy trình đặt lại an toàn.
4. Sau xác minh, hệ thống tạo/xác nhận danh tính tài khoản và Membership. Role lấy từ nguồn có thẩm quyền, không lấy từ client.
5. Cấp **Q-Dcom Recovery Key** để người dùng khôi phục dữ liệu đã backup khi đổi/mất thiết bị.

Mã thẻ là mã nhận diện do công ty cấp, không phải bí mật đủ để xác minh một mình. Cần có bước kích hoạt/đối chiếu do Admin hoặc cơ chế mời có kiểm soát để ngăn đăng ký giả mạo.

### B. Google

1. Người dùng chọn tài khoản Google và xác thực qua Firebase Auth.
2. Firebase UID là định danh tài khoản; Membership trong Tenant quyết định role và quyền truy cập.
3. Người dùng có thể cấp quyền Google Drive riêng để sao lưu/khôi phục. Google Sign-In **không tự động** đồng nghĩa với việc đã cấp quyền Drive.
4. Có thể đăng nhập cùng tài khoản Google trên thiết bị khác và khôi phục từ bản backup nếu đã có backup hợp lệ.

## 2. Firebase — cổng xác thực và người gác cổng số

Firebase chịu trách nhiệm:
- Xác minh phiên/danh tính theo phương thức đã đăng ký.
- Kiểm tra Membership, Tenant, trạng thái active và role.
- Bảo vệ request bằng Security Rules và server-side checks trong Cloud Functions.
- Thu hồi quyền khi tài khoản/Membership/Tenant bị khóa hoặc đăng xuất.
- Lưu metadata định danh/xác thực tối thiểu cần thiết cho bảo mật.

Firebase **không phải nơi lưu dữ liệu nghiệp vụ chính** theo định hướng Local-first. Không được hiểu câu này thành “Firebase không lưu bất kỳ dữ liệu nào”: Auth và Membership/security metadata vẫn cần thiết để kiểm soát truy cập.

## 3. Local-first và phân vùng dữ liệu

- **Thiết bị:** nguồn lưu trữ/vận hành chính cho dữ liệu nghiệp vụ người dùng, ưu tiên Dexie/IndexedDB. Cần bảo vệ dữ liệu nhạy cảm và xử lý logout/đổi tài khoản đúng cách.
- **Firebase:** danh tính, Membership, quyền, trạng thái bảo mật và metadata tối thiểu; không thay thế database nghiệp vụ local.
- **Google Drive:** chỉ chứa bản sao lưu khi người dùng chọn và cấp quyền. Không dùng Drive như database vận hành trực tiếp.
- Backup phải có schema/version, tenant binding, checksum hoặc cơ chế xác thực toàn vẹn, chống restore nhầm tenant và xử lý xung đột.

## 4. Q-Dcom Recovery Key

- Áp dụng cho tài khoản đăng ký bằng thẻ ID công ty để khôi phục dữ liệu khi đổi/mất thiết bị mà không bắt buộc có Google.
- Tạo bằng bộ sinh số ngẫu nhiên mật mã mạnh; không dùng mã tuần tự, ngày sinh hoặc mã nhân viên.
- Recovery Key là bí mật do người dùng tự bảo quản. Chỉ hiển thị khi cấp/tạo lại; cung cấp cách lưu hoặc in an toàn và yêu cầu xác nhận đã lưu.
- Không lưu Recovery Key dạng văn bản rõ ở Firebase/server, không ghi vào log/analytics.
- Dùng Recovery Key trong thiết kế mã hóa backup phía client. Server/Drive chỉ nhận ciphertext và metadata tối thiểu.
- Phải có kiểm tra integrity, tenant ownership, version và xác nhận trước khi restore/ghi đè.
- Mất cả thông tin đăng nhập và Recovery Key có thể khiến backup mã hóa không thể giải mã; không hứa hẹn có thể bypass hoặc khôi phục plaintext từ server.
- Cần thiết kế luồng đổi/luân chuyển Recovery Key có tái mã hóa hoặc bọc khóa dữ liệu an toàn; không chỉ thay chuỗi hiển thị.

## 5. Quy tắc phiên và quyền

1. Mỗi phương thức xác thực phải ánh xạ tới một định danh tài khoản ổn định, không cấp role từ dữ liệu client.
2. Mọi thao tác Tenant phải xác minh danh tính + Membership active + tenantId + role ở backend/Rules.
3. Đăng xuất phải thu hồi phiên, xóa principal và dữ liệu nhạy cảm khỏi bộ nhớ ứng dụng. Dữ liệu local được giữ/xóa theo lựa chọn rõ ràng; không âm thầm xóa dữ liệu nghiệp vụ.
4. Đổi thiết bị phải đăng nhập/xác minh lại, sau đó restore backup hợp lệ; không tin tenantId do client tự khai.
5. Chuyển đổi giữa Google và thẻ ID (nếu có nhu cầu liên kết) phải là luồng liên kết tài khoản được xác thực cả hai phía, không tự ghép chỉ dựa trên email/mã thẻ.

## 6. Cảnh báo người dùng trong màn hình đăng ký

**Thẻ ID công ty:** “Nhập mã thẻ công ty và tự tạo mật khẩu riêng. Hãy lưu Q-Dcom Recovery Key ở nơi an toàn. Mã này cần thiết để khôi phục dữ liệu khi đổi hoặc mất thiết bị. Không chia sẻ mật khẩu hoặc mã khôi phục.”

**Google:** “Đăng ký bằng Google để đăng nhập thuận tiện. Muốn sao lưu/khôi phục qua Google Drive, bạn cần chủ động cấp quyền. Hãy bảo vệ tài khoản Google và không chia sẻ quyền truy cập.”

## 7. Kiểm thử bắt buộc trước khi hoàn thành

- Đăng ký thẻ hợp lệ/không hợp lệ, thẻ đã dùng, thẻ inactive, tenant mismatch và chống chiếm mã thẻ.
- Mật khẩu đúng/sai, hash/salt, rate limit, lockout, đổi/đặt lại mật khẩu.
- Google Auth thành công/thất bại, không có Membership, Membership/tenant bị khóa.
- Không thể tự cấp role hoặc truy cập chéo tenant.
- Recovery Key đủ mạnh, không xuất hiện trong log/server plaintext; backup ciphertext không đọc được nếu thiếu khóa.
- Restore đúng tài khoản/tenant, sai tenant, file hỏng, backup cũ, thiết bị mới và xung đột dữ liệu.
- Google Drive chưa cấp quyền, đã thu hồi quyền, mất mạng, upload/download gián đoạn.
- Logout, đổi tài khoản và chuyển thiết bị không làm lộ dữ liệu người trước.

## 8. Trạng thái và phát hành

- Firebase Auth + Membership Gateway hiện có là nền tảng cần audit và mở rộng; chưa coi là hoàn thành cho hai phương thức.
- Module PIN cũ đã bị gỡ; phải khảo sát lịch sử và khôi phục đúng phần employee-card cần thiết, tuyệt đối không khôi phục PIN.
- Recovery Key, client-side encryption và backup/restore theo thiết kế mới chưa được triển khai.
- Không merge PR hoặc deploy Firebase production khi chưa có xác nhận của chủ dự án.


## 9. Cập nhật triển khai 2026-11-05 — Google identity và Drive consent

- `signInWithGooglePopup()` chỉ dùng Google provider cho Firebase Auth identity; không yêu cầu Drive scopes và không trả Drive access token.
- `requestGoogleDriveAccess()` là hành động riêng, chỉ chạy khi đã có Google Firebase user; dùng re-auth popup để xin Drive scopes và xác minh UID trả về vẫn là UID hiện tại.
- UI tách nút đăng nhập Google và nút kết nối Google Drive tùy chọn trong Cài đặt.
- Đăng xuất không còn bị chặn khi Drive token hết hạn hoặc backup lỗi. Backup khi đăng xuất chỉ là best-effort; người dùng vẫn thoát được và được thông báo nếu backup thất bại.
- Code đã cập nhật trên nhánh `feature/batch-b-google-drive-consent-2026-11-05`; trạng thái đang chờ CI. Chưa có Firebase live popup/revoke test, vì vậy chưa đánh dấu Technical PASS.
- **Giới hạn chưa xử lý:** backup hiện hành vẫn Gzip, chưa mã hóa, thiếu PO/sản lượng/phụ phí/tenant data và chưa có restore round-trip được xác minh. Không được quảng bá backup hiện tại là bản sao lưu đầy đủ; đây là Batch E.
