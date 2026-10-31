# Q-Dcom — BẢNG THEO DÕI TIẾN ĐỘ CÔNG VIỆC

> File này là bảng điều khiển tiến độ dài hạn của dự án. Cập nhật trạng thái tại đây sau mỗi công việc; không thay thế `SESSION_LOG.md` (nhật ký diễn biến từng phiên).
>
> **Cập nhật gần nhất:** 2026-10-31 · B3/B4: cô lập vùng credential nhân viên và bổ sung Rules Emulator tests  
> **Nhánh làm việc hiện tại:** `feature/employee-card-pin-auth-2026-10-31` (tách từ nhánh nền tảng)  
> **Phạm vi hiện tại:** xử lý các vấn đề phát hiện trong Phase 1 và Phase 2, đồng thời cải tiến có kiểm soát; bảo toàn các chức năng cũ.

## 1. Quy ước trạng thái

| Ký hiệu | Trạng thái | Ý nghĩa |
|---|---|---|
| 🟢 | HOÀN THÀNH | Đã thực hiện và có bằng chứng kiểm tra phù hợp |
| 🟡 | ĐANG CHUẨN BỊ / ĐANG LÀM | Đã chọn làm tiếp theo hoặc đang thực hiện; chưa được tính là hoàn thành |
| ⚪ | CHƯA BẮT ĐẦU | Đã nằm trong kế hoạch nhưng chưa triển khai |
| 🔴 | BỊ CHẶN | Không thể tiếp tục trước khi xử lý trở ngại |
| 🔵 | CHỜ NGƯỜI DÙNG KIỂM TRA | Technical PASS; chờ kiểm tra thực tế và xác nhận |

**Nguyên tắc:** Không đánh dấu 🟢 chỉ vì đã đọc, đã thảo luận hoặc đã viết kế hoạch. Chỉ đánh dấu hoàn thành khi có thay đổi thực tế và bằng chứng xác minh. Không tự đánh dấu Practical PASS thay cho người dùng.

## 2. Tổng quan vị trí hiện tại

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Khảo sát yêu cầu và vấn đề — Phase 1 | 🟢 | Đã thống nhất yêu cầu, vai trò Admin/Worker, luồng sản xuất và các chức năng phải bảo toàn |
| Kiểm tra Authentication & Authorization — Phase 2 | 🟢 | Đã rà soát tĩnh các luồng và tệp chính; chưa phải kiểm toán bảo mật toàn diện hoặc kiểm thử runtime |
| Lập kế hoạch triển khai theo từng nhóm | 🟡 | Đã tạo thiết kế nền tảng Authentication/Membership; tiếp tục chi tiết hóa và triển khai từng bước |
| Sửa mã nguồn / triển khai thực tế | 🟢 | Đã tích hợp trạng thái xác thực rõ ràng vào app shell/Dashboard; thu hồi dữ liệu xưởng khi Auth đổi UID, Membership/tenant bị khóa hoặc xác minh thất bại |
| Kiểm tra kỹ thuật và kiểm tra thực tế | 🔵 | CI run `41213360712` trên đúng HEAD `6314943` PASS toàn bộ lint, TypeScript, Next build, Functions build và Firestore Rules Emulator; còn chờ smoke test Firebase/Termux bằng tài khoản thật |

       > **Vị trí đang làm:** B2/B6 CI PASS trên nhánh nền tảng; B7 chờ smoke test thực tế. Trên nhánh `feature/employee-card-pin-auth-2026-10-31`, B3/B4 đã có lớp Rules chặn client truy cập credential và login-attempt records, kèm Emulator tests; PR #3 Draft đã mở để chạy CI (run `41215522822` đang chạy). Callable xác minh PIN, rate limit và cấp Custom Token vẫn chưa triển khai; chưa đánh dấu hoàn thành.

## 3. Trình tự công việc tổng thể

### Giai đoạn A — Chuẩn bị và bảo vệ hiện trạng

- [x] 🟢 A1. Thống nhất hướng đi: sửa và xây dựng lại từng phần, không viết lại mù quáng toàn bộ dự án.
- [x] 🟢 A2. Xác định các chức năng cũ bắt buộc phải giữ.
- [x] 🟢 A3. Rà soát yêu cầu Phase 1.
- [x] 🟢 A4. Rà soát tĩnh Authentication & Authorization trong Phase 2.
- [x] 🟢 A5. Kiểm tra lại HEAD, trạng thái nhánh, CI và PR mới nhất trước khi bắt đầu sửa. PR #2 vẫn Draft, chưa merge; HEAD mới nhất thuộc batch Membership đang triển khai.
- [ ] 🟡 A6. Đã có `AUTHENTICATION_ARCHITECTURE.md`; tiếp tục cập nhật danh sách file/rủi ro/rollback theo các phát hiện triển khai thực tế.
- [ ] 🟡 A7. CI Validate run `41147559429` trên Rules commit `b397150` đã PASS (lint, TypeScript, Next build, Functions build, Firestore Emulator); chờ CI cho app-shell commit `5e640be`; còn thiếu smoke test thiết bị và regression thực tế các chức năng cũ.

### Giai đoạn B — Authentication + Membership + Authorization

- [x] 🟢 B1. Hoàn tất bản thiết kế Authentication Gateway dùng chung cho Google OAuth và đăng nhập thẻ nhân viên trong `AUTHENTICATION_ARCHITECTURE.md`.
- [x] 🟢 B2. Gateway xác minh Firebase Auth session + Membership; phân loại no-membership/member-disabled/tenant-disabled/membership-invalid/network-error; CI run `41213360712` PASS.
- [ ] 🟡 B3. Đã bổ sung Rules chặn client đọc/ghi `employeeCredentials`; Emulator tests cho credential và login-attempt records đã viết; PR #3 run `41215522822` đang chạy. Còn thiếu callable xác minh PIN, hash an toàn và rate limit.
- [ ] 🟡 B4. Đã chốt luồng phát hành Firebase Custom Token sau khi xác minh PIN + tenant/Membership active; callable cấp token và client sign-in chưa triển khai.
- [ ] ⚪ B5. Hợp nhất Membership và Tenant context; role lấy từ dữ liệu có thẩm quyền phía máy chủ.
- [x] 🟢 B6. App shell đồng bộ Firebase Auth UID, không cấp role fallback; Dashboard hiển thị trạng thái xác minh rõ ràng. CI run `41213360712` PASS.
- [ ] ⚪ B7. Đã bổ sung thu hồi principal/dữ liệu xưởng khi Auth đổi UID, refresh Membership/tenant không hợp lệ hoặc lỗi xác minh; cần kiểm tra runtime và hoàn thiện luồng revoke/expiry.
- [x] 🟢 B8. Siết Firestore Rules: Admin thông thường chỉ tạo Worker; chỉ owner được nâng role Admin; bootstrap Admin chỉ trong giao dịch tạo tenant mới. CI Emulator PASS trên `b397150`.
- [x] 🟢 B9. Emulator tests PASS cho Admin tạo Worker, chặn Admin tự cấp Admin/nâng quyền, bootstrap owner + tenant nguyên tử, cô lập tenant, Worker identity, private earnings và quyền duyệt phụ phí.
- [ ] 🟡 B10. CI cho batch B2/B6/B7 đã PASS; B10 toàn Phase 2 chỉ đóng sau khi hoàn thành B3–B5 và chạy kiểm thử/regression tổng thể.
- [ ] 🔵 B11. Chờ người dùng kiểm tra thực tế bằng tài khoản Admin và Worker.
- [ ] ⚪ B12. Chỉ đóng nhóm khi Technical PASS và Practical PASS.

### Giai đoạn C — Quy trình PO và sản xuất

- [ ] ⚪ C1. Rà soát schema và luồng PO hiện có; xác định dữ liệu cần giữ/migration.
- [ ] ⚪ C2. Hoàn thiện tạo/sửa/đóng PO và công đoạn.
- [ ] ⚪ C3. Hoàn thiện Worker gửi sản lượng theo PO/công đoạn.
- [ ] ⚪ C4. Hoàn thiện duyệt/từ chối và lịch sử thay đổi.
- [ ] ⚪ C5. Hoàn thiện yêu cầu phụ phí và quy trình Admin duyệt.
- [ ] ⚪ C6. Báo cáo tổng hợp sản lượng/năng suất cho Admin.
- [ ] ⚪ C7. Kiểm tra cô lập tenant và chống ghi trùng/gửi sai dữ liệu.
- [ ] ⚪ C8. Technical PASS và regression.
- [ ] 🔵 C9. Chờ người dùng kiểm tra thực tế.
- [ ] ⚪ C10. Đóng nhóm sau Practical PASS.

### Giai đoạn D — Worker Wallet và quyền riêng tư thu nhập

- [ ] ⚪ D1. Rà soát cách tính thu nhập và nguồn dữ liệu được duyệt.
- [ ] ⚪ D2. Xác minh phép tính ở server/Cloud Functions; client không tự quyết định số tiền.
- [ ] ⚪ D3. Worker chỉ xem ví và lịch sử của chính mình.
- [ ] ⚪ D4. Admin xem báo cáo tổng hợp được phép; mặc định không đọc ví riêng từng Worker.
- [ ] ⚪ D5. Kiểm thử truy cập chéo, sửa dữ liệu, dữ liệu chưa duyệt và tính lại thu nhập.
- [ ] ⚪ D6. Technical PASS và regression.
- [ ] 🔵 D7. Chờ người dùng kiểm tra thực tế.
- [ ] ⚪ D8. Đóng nhóm sau Practical PASS.

### Giai đoạn E — Google Integration và sao lưu

- [ ] ⚪ E1. Phân biệt trạng thái Google Sign-In, liên kết tài khoản Google và quyền Google Drive.
- [ ] ⚪ E2. Hiển thị trạng thái liên kết thành công/thất bại/đang chờ và hướng dẫn khi thiếu quyền.
- [ ] ⚪ E3. Rà soát backup/restore Google Drive theo tenant, tránh ghi đè chéo.
- [ ] ⚪ E4. Kiểm thử backup, restore, lỗi mạng, quyền OAuth và dữ liệu lớn.
- [ ] ⚪ E5. Technical PASS và regression.
- [ ] 🔵 E6. Chờ người dùng kiểm tra thực tế.
- [ ] ⚪ E7. Đóng nhóm sau Practical PASS.

### Giai đoạn F — Menu điều hướng Mobile

- [ ] ⚪ F1. Rà soát menu hiện tại và bản đồ tất cả tính năng theo role.
- [ ] ⚪ F2. Thiết kế nút menu góc trên trái và sidebar/drawer trượt từ trái sang phải.
- [ ] ⚪ F3. Hoàn thiện nhóm menu lồng nhau, mở/đóng mượt, đóng khi chọn mục hoặc chạm vùng ngoài.
- [ ] ⚪ F4. Hiển thị menu theo quyền; backend vẫn phải kiểm tra quyền độc lập.
- [ ] ⚪ F5. Kiểm tra màn hình nhỏ, thao tác cảm ứng, cuộn và khả năng truy cập.
- [ ] ⚪ F6. Technical PASS và regression.
- [ ] 🔵 F7. Chờ người dùng kiểm tra trên điện thoại.
- [ ] ⚪ F8. Đóng nhóm sau Practical PASS.

### Giai đoạn G — Bảo toàn chức năng cũ và kiểm tra hồi quy

- [ ] ⚪ G1. Quản lý kho sản phẩm và CRUD.
- [ ] ⚪ G2. Dexie IndexedDB, migration và dữ liệu offline.
- [ ] ⚪ G3. Google OAuth hiện có và hồ sơ người dùng.
- [ ] ⚪ G4. Đăng nhập thẻ nhân viên tương thích và chuyển đổi an toàn.
- [ ] ⚪ G5. Backup/restore Google Drive.
- [ ] ⚪ G6. QR chia sẻ và quét QR.
- [ ] ⚪ G7. Chat cộng đồng, chat xưởng và @Q Bot.
- [ ] ⚪ G8. Kiểm tra dữ liệu cũ, migration, backup trước migration và phương án rollback.
- [ ] ⚪ G9. Chạy full regression trên nhánh tích hợp.
- [ ] 🔵 G10. Người dùng xác nhận các chức năng cũ vẫn hoạt động.
- [ ] ⚪ G11. Đóng giai đoạn sau PASS.

### Giai đoạn H — Phát hành có kiểm soát

- [ ] ⚪ H1. Kiểm tra CI mới nhất và toàn bộ Definition of Done.
- [ ] ⚪ H2. Kiểm tra Firebase Rules, indexes và Functions trên Firebase test project.
- [ ] ⚪ H3. Lập kế hoạch deploy production, backup và rollback; xin xác nhận trước thao tác triển khai.
- [ ] ⚪ H4. Kiểm tra PR, nội dung diff và tài liệu.
- [ ] ⚪ H5. Người dùng duyệt merge; không tự ý merge vào main.
- [ ] ⚪ H6. Smoke test sau phát hành.
- [ ] ⚪ H7. Cập nhật tài liệu và bàn giao phiên.

## 4. Danh sách chức năng bắt buộc bảo toàn

Các mục dưới đây là **điều kiện regression**, không được xem là đã PASS chỉ vì chúng đã tồn tại trong mã nguồn.

- [ ] ⚪ Quản lý kho sản phẩm.
- [ ] ⚪ Dexie IndexedDB và dữ liệu offline.
- [ ] ⚪ Google OAuth.
- [ ] ⚪ Đăng nhập thẻ nhân viên.
- [ ] ⚪ Backup và khôi phục Google Drive.
- [ ] ⚪ QR chia sẻ/quét QR.
- [ ] ⚪ Chat và @Q Bot.
- [ ] ⚪ Dữ liệu cũ và khả năng migration/rollback.

## 5. Quy tắc cập nhật file

Sau mỗi phiên làm việc:

1. Chuyển đúng công việc đang chuẩn bị/đang làm sang 🟡.
2. Chỉ chuyển sang 🟢 khi đã hoàn thành và có kết quả kiểm tra ghi nhận được.
3. Nếu Technical PASS nhưng chờ người dùng kiểm tra, dùng 🔵.
4. Nếu có lỗi chặn, dùng 🔴 và ghi rõ nguyên nhân/cách gỡ.
5. Ghi ngày, kết quả, commit/PR liên quan và vị trí tiếp theo.
6. Không xóa lịch sử cũ; cập nhật trạng thái hiện tại và append lịch sử thay đổi bên dưới.
7. Cập nhật `SESSION_LOG.md` để ghi chi tiết những gì đã làm trong phiên.

## 6. Lịch sử cập nhật tiến độ

### 2026-10-30 — Tiếp tục triển khai và thiết kế nền tảng xác thực
- Xác nhận nhánh `feature/new-feature-foundation-2026-10-27` tồn tại; PR #2 vẫn mở ở trạng thái Draft, chưa merge.
- PR head SHA hiện tại: `760f93dfbfc6e92ab9535931af2d404789acedde`. Workflow run được tìm thấy có head SHA `9c2b7d35718a00b1460c7e860ba8925f35606e74`, cũ hơn PR head; chưa được coi là CI PASS cho HEAD hiện tại.
- Đọc lại các luồng đăng nhập local ID, Google OAuth, tenant membership, role fallback, Firestore Rules, Cloud Functions và package/CI.
- Tạo `AUTH_MEMBERSHIP_DESIGN.md`; đây là thiết kế đang chuẩn bị, chưa phải code đã triển khai.
- Phát hiện cần xử lý: local ID login chỉ tra localStorage; Google flow chưa có Membership Gateway bắt buộc; tenant role fallback thành worker khi context chưa tải/không khớp; employeeCode hiện không phải yếu tố xác thực độc lập.
- Vị trí tiếp theo: hoàn tất A5/A6 baseline và rà soát thiết kế B1, sau đó mới triển khai B2.

### 2026-10-30 — Khởi tạo bảng theo dõi
- Tạo bảng tiến độ độc lập để theo dõi vị trí hiện tại, các bước đã hoàn thành, đang chuẩn bị và sẽ thực hiện.
- Đánh dấu Phase 1 và Phase 2 là hoàn thành ở mức khảo sát/yêu cầu và rà soát tĩnh; không đồng nghĩa đã sửa code hoặc xác nhận bảo mật toàn diện.
- Vị trí tiếp theo: A5 — kiểm tra lại trạng thái nhánh/CI/PR, sau đó lập kế hoạch chi tiết nhóm B.
- Chưa sửa mã nguồn ứng dụng, chưa chạy deploy Firebase, chưa merge PR.


### 2026-10-30 — Kiểm tra lại baseline trước triển khai nhóm B
- Xác nhận nhánh làm việc hiện tại là `feature/new-feature-foundation-2026-10-27`, HEAD `760f93dfbfc6e92ab9535931af2d404789acedde`; không tạo nhánh tự động mới.
- PR #2 vẫn mở ở trạng thái Draft, chưa merge vào `main`.
- GitHub Actions workflow `Validate` tại HEAD hiện tại hoàn tất thành công. Các bước đã PASS: cài dependencies, lint, TypeScript, build Next.js, cài dependencies Cloud Functions, build Functions, thiết lập Java và kiểm tra Firestore Rules bằng Emulator.
- Kết quả CI này chỉ chứng minh các bước tự động nói trên; chưa chứng minh luồng Google/nhân viên hoạt động trên Firebase thật hoặc regression thực tế trên điện thoại.
- Xác nhận lại các vấn đề trọng yếu trong mã nguồn: đăng nhập thẻ nhân viên hiện chỉ tra cứu hồ sơ localStorage; Google OAuth đang tạo/cập nhật hồ sơ cục bộ và điều hướng vào app mà chưa bắt buộc xác minh Membership; trạng thái lỗi tải Membership đang bị hạ xuống role Worker; dashboard xưởng có luồng Firebase Auth riêng.
- Xác nhận Dexie version 2 đã có migration gán sản phẩm cũ vào `local-default`; Google Drive backup đã tách tên file theo tenant; các phần này phải được bảo toàn và regression.
- Chưa sửa mã nguồn ứng dụng, chưa deploy Firebase production, chưa merge PR. Bắt đầu chuẩn bị thiết kế Authentication Gateway tập trung.


### 2026-10-30 — Hoàn tất thiết kế Authentication Gateway
- 🟢 B1: Tạo `AUTHENTICATION_ARCHITECTURE.md`, mô tả luồng Firebase Auth thống nhất, Membership principal, Google OAuth, thẻ nhân viên + PIN, Custom Token, trạng thái UI, vị trí mã nguồn dự kiến và bộ kiểm thử.
- Vị trí tiếp theo: B2 — triển khai Google OAuth qua Membership Gateway. Sau đó B3/B4 — credential thẻ nhân viên và Firebase Custom Token.
- Lưu ý: B1 chỉ là hoàn tất thiết kế; các bước B2 trở đi chưa triển khai.


### 2026-10-30 — Bắt đầu triển khai B2 Authentication Gateway
- Tạo `lib/auth/authGateway.ts`: xác nhận có Firebase Auth user thật, từ chối anonymous, làm mới/kiểm tra ID token và gọi Membership service để lấy TenantPrincipal.
- Chuyển luồng `WorkshopDashboard` khi tham gia xưởng và tạo xưởng sang dùng Authentication Gateway; không còn gọi trực tiếp `getTenantPrincipal` từ hai thao tác này.
- Commit tạo gateway: `4be7e4cfedb84efcbc0739d7c076b83be24f5582`; commit tích hợp dashboard: `84b22a29b327d53926f47eb81bcb02b656ac009b`.
- Workflow Validate mới được kích hoạt nhưng tại lần kiểm tra gần nhất vẫn `in_progress` và chạy trên commit gateway trước khi tích hợp dashboard. Chưa có bằng chứng CI PASS cho HEAD cuối `84b22a2`.
- Giới hạn: đây là lớp xác minh phiên + membership cho kết nối xưởng, chưa hoàn thành toàn bộ Google OAuth/Membership state machine; employee card + PIN/Custom Token chưa triển khai.
- Không deploy Firebase production, không merge PR #2, không sửa `main`.
- Vị trí tiếp theo: xác minh CI đúng HEAD; tiếp tục bỏ role fallback Worker ở app shell, chuẩn hóa trạng thái denied/loading, rồi tích hợp Google OAuth mà không làm mất local-first/Drive backup.


### 2026-10-30 — Chuẩn hóa Membership state trong app shell
- Sửa `components/qdcom-app.tsx`: thay truy vấn Membership trực tiếp bằng `authorizeTenantSession()`.
- Thêm trạng thái `local_only`, `loading`, `authorized`, `denied`; khi đổi tenant sẽ reset principal và bắt đầu xác minh lại.
- Loại bỏ việc gán role Worker khi Membership tải lỗi. Role Worker chỉ còn là giá trị mặc định phục vụ ngữ cảnh kho local-default; không dùng để mở dữ liệu tenant.
- Khóa màn hình Bot và Cộng đồng khi đang xác minh hoặc bị từ chối quyền tenant; hiển thị lý do và hướng người dùng sang Quản lý xưởng.
- Commit source: `a4c87bec57046840e6533cb9ad75214cdccca146`.
- GitHub Actions Validate cho commit này đã được kích hoạt; tại thời điểm ghi log còn `in_progress`, chưa đánh dấu Technical PASS.
- Chưa kiểm thử Firebase thật hoặc Termux; chưa thay đổi Rules/deploy/merge.
- Bước kế tiếp: đợi CI; kiểm tra lại luồng Google OAuth và các trạng thái no-membership/tenant selection, đồng thời rà soát quyền server-side trước khi mở thêm tính năng.


### 2026-10-30 — Sửa lỗi lint sau khi triển khai Membership state
- CI của commit `a4c87bec` thất bại tại ESLint `react-hooks/set-state-in-effect`: cập nhật state đồng bộ trong effect.
- Đã chỉnh cấu trúc state Membership thành một kết quả gắn với tenantId/UID; trong effect chỉ ghi state khi kết quả bất đồng bộ trả về. Trạng thái loading được suy ra khi kết quả hiện tại chưa khớp tenant/UID đang chọn.
- Commit sửa: `8e895e865a593568c5d05787e8141f4f9175e0d5`.
- CI Validate cho commit sửa đang chạy; chưa đánh dấu PASS.


### 2026-10-30 — Xác minh CI và rà soát tiếp luồng xác thực
- Kiểm tra lại GitHub Actions bằng commit SHA cụ thể: workflow Validate run `41080430725` trên source commit `8e895e865a593568c5d05787e8141f4f9175e0d5` kết thúc `success`; run `41080518346` trên docs commit `436c957d6492676e6ebe1ee1154202c7a4c3b52a` cũng kết thúc `success`.
- CI PASS là bằng chứng lint/typecheck/build/rules workflow theo cấu hình hiện tại; không thay thế Firebase runtime hoặc kiểm tra thực tế trên điện thoại.
- Rà soát thêm `authGateway.ts`, `tenantService.ts`, `firebase.ts`, `qdcom-app.tsx`, `workshop-dashboard.tsx`, `functions/src/index.ts` và `firestore.rules`.
- Xác nhận Google OAuth hiện vẫn có thể đăng nhập để dùng kho local; các màn hình Bot/Cộng đồng tenant đã bị khóa cho tới khi Membership được xác minh. Chưa có state machine đầy đủ cho no-membership/disabled/tenant selection và chưa có đăng nhập thẻ + PIN/Custom Token.
- Xác nhận `getTenantPrincipal()` đọc role từ Membership Firestore và kiểm tra active; không chấp nhận role từ localStorage. Tuy nhiên cần tiếp tục rà soát mọi thao tác dữ liệu tenant và điểm dùng `currentTenantRole` để chắc chắn UI fallback không tạo đường truy cập.
- Cloud Functions hiện chỉ có trigger tính lại earnings; chưa có callable auth endpoint cho employee card. Không triển khai thẻ nhân viên bằng cách so sánh mã thẻ ở client.
- Không sửa Firestore Rules, không deploy Firebase, không merge PR #2, không sửa `main`.
- Vị trí tiếp theo: hoàn thiện B2/B6 — trạng thái Google/Membership, xử lý session/logout và rà soát quyền; sau đó thiết kế và triển khai employee card + PIN qua callable function và Firebase Custom Token.


### 2026-10-31 — Rà soát sâu Google OAuth và ranh giới Membership
- Xác nhận nhánh làm việc: `feature/new-feature-foundation-2026-10-27`; PR #2 vẫn mở, chưa merge. Không thay đổi `main`, không deploy Firebase production.
- Đọc lại `lib/auth/authGateway.ts`, `lib/services/tenantService.ts`, `lib/tenancy/authorization.ts`, `components/qdcom-app.tsx`, `functions/src/index.ts`, `firestore.rules` và `package.json`.
- Xác nhận Google OAuth trong app shell đang xác minh Google userinfo/email và Firebase provider, lưu hồ sơ người dùng, giữ Drive access token và điều hướng vào kho. Đây là đăng nhập danh tính + quyền Drive; không tự nó cấp Membership hoặc role trong tenant.
- Xác nhận Gateway hiện xác minh Firebase Auth user không anonymous rồi đọc Membership theo UID/tenant. Membership active và role hợp lệ mới tạo TenantPrincipal. Employee code hiện chỉ là giá trị đối chiếu trong Membership, tuyệt đối chưa đủ làm thông tin đăng nhập.
- Phát hiện cần xử lý tiếp: Gateway hiện ném lỗi tổng quát thay vì trả state machine đầy đủ `no_membership / membership_disabled / tenant_selection / error`; cần kiểm tra cách app shell hiển thị và giữ local-first khi Google account chưa thuộc tenant. Không được buộc đăng nhập kho local vào Membership.
- Phát hiện `createTenant()` hiện ghi tenant và membership admin từ client transaction; cần rà soát chặt Firestore Rules và quy trình tạo tenant để bảo đảm chỉ chủ tenant vừa tạo được cấp Admin, không thể tự nâng quyền trên tenant đã tồn tại.
- Cloud Functions hiện chưa có callable endpoint cho employee card + PIN/Custom Token; B3/B4 vẫn chưa triển khai.
- Chưa sửa source code trong lượt rà soát này; chưa chạy CI mới, chưa chạy Firebase Emulator/Termux hoặc tài khoản thật. Vì vậy không đánh dấu B2/B6 PASS.
- Vị trí tiếp theo: hoàn thiện state machine và đồng bộ auth/session ở app shell; bổ sung test cho no-membership/disabled/tenant mismatch; sau đó mới xây dựng B3/B4 với PIN hash/credential server-only, rate limit/lockout và Firebase Custom Token.


### 2026-10-31 — Tiếp tục rà soát quyền cấp Membership Admin
- Đọc lại lịch sử trong `TIEN_DO_DU_AN.md` và `SESSION_LOG.md` trước khi tiếp tục; giữ nguyên nhánh tính năng và các ràng buộc bảo toàn dữ liệu/chức năng cũ.
- Đối chiếu trực tiếp `firestore.rules`, `tenantService.ts`, `authGateway.ts`, `authorization.ts`, `functions/src/index.ts` và luồng app shell trên nhánh `feature/new-feature-foundation-2026-10-27`.
- Phát hiện rủi ro cần ưu tiên kiểm thử: điều kiện `allow create` tại `tenants/{tenantId}/members/{memberUid}` hiện cho phép nhánh `isTenantAdmin(tenantId)` tạo Membership với cả role `admin` lẫn `worker`. Cần xác định lại chính sách mời thành viên: Admin thông thường chỉ được tạo Worker; cấp Admin bổ sung phải có quy trình chủ sở hữu/ủy quyền riêng.
- Điều kiện tự tạo Admin hiện dựa vào `existsAfter(tenant)` và `ownerUid == request.auth.uid`; cần kiểm thử tình huống tenant đã tồn tại nhưng thiếu Membership để xác nhận không thể tự khôi phục/tự cấp quyền ngoài quy trình tạo tenant nguyên tử.
- Chưa sửa Rules hoặc source, chưa chạy Emulator trong phiên này. Đây là phát hiện rà soát tĩnh, chưa kết luận khai thác được cho đến khi có test Rules tái hiện.
- B2/B6 tiếp tục 🟡; không đánh dấu PASS. B3/B4 vẫn ⚪. Không deploy production, không merge PR #2, không sửa `main`.
- Vị trí tiếp theo: viết/điều chỉnh bộ test Firestore Rules cho các ca tạo Worker, Admin, tự nâng quyền, tenant cũ/tenant mới; sau khi có test bảo vệ mới sửa Rules và chạy CI/Emulator.


### 2026-10-31 — Siết quyền cấp Membership Admin và bổ sung kiểm thử
- Đọc lại `TIEN_DO_DU_AN.md` và `SESSION_LOG.md` trước khi tiếp tục; xác minh đúng nhánh `feature/new-feature-foundation-2026-10-27` và PR #2.
- Xác minh PR #2 head trước khi sửa là `eb6f52330d3500b93e514857c2a5d01ac195bd4b`; bảng tiến độ trước đó ghi HEAD cũ nên đã đồng bộ theo head mới.
- Đọc `firestore.rules` và `tests/security/rules.test.mjs`. Bộ test hiện có đã chạy qua Firebase Emulator trong workflow CI; bổ sung các ca Admin tạo Worker, Admin tạo Admin bị từ chối, Admin không phải owner không thể nâng Worker thành Admin, không tự tạo Membership Admin trên tenant đã tồn tại, và bootstrap owner + tenant trong cùng batch.
- Sửa `firestore.rules`: Admin thông thường chỉ tạo Membership role `worker`; bootstrap Admin yêu cầu tenant chưa tồn tại trước giao dịch và tồn tại sau giao dịch với ownerUid khớp caller; cập nhật role thành `admin` chỉ được phép khi caller là ownerUid.
- Cập nhật `tests/security/rules.test.mjs` với các ca bảo mật mới.
- Commit test: `5014a05eb7260f64c80861c465cb8a4f0f249ed3`; commit Rules: `b397150ac59145272db9e87e33a277e271034e49`.
- GitHub Actions Validate run `41147559429` trên đúng HEAD `b397150` đã được tạo và tại thời điểm cập nhật còn `in_progress`. Chưa có kết quả Emulator cuối cùng, chưa đánh dấu PASS.
- PR #2 vẫn Draft, chưa merge; không deploy Firebase production; không thay đổi `main`.
- Vị trí tiếp theo: đợi workflow Validate/Firestore Emulator; nếu PASS, tiếp tục kiểm tra các nhánh cập nhật Membership và bootstrap; nếu FAIL, sửa theo log rồi chạy lại. Sau khi Rules ổn định mới tiếp tục Membership state machine và employee PIN/Custom Token.


### 2026-10-31 — Đồng bộ Firebase Auth session với quyền tenant
- Đã xác minh workflow Validate run `41147559429` trên commit Rules `b397150ac59145272db9e87e33a277e271034e49` kết thúc `completed / success`; các bước lint, TypeScript, Next.js build, Cloud Functions build và Firestore Rules Emulator đều PASS.
- Rà soát sâu app shell cho thấy quyền tenant trước đây chỉ được xác minh khi tenant/UID trong hồ sơ local thay đổi; nếu Firebase Auth session bị sign-out hoặc đổi tài khoản từ nơi khác, UI có thể giữ trạng thái authorized cũ cho tới lần tải/đổi tenant tiếp theo.
- Sửa `components/qdcom-app.tsx`: đăng ký `onAuthStateChanged`, ghi nhận Firebase UID hiện tại và chỉ cho phép chạy Membership Gateway khi Firebase Auth đã sẵn sàng và UID phiên trùng UID hồ sơ. Khi session mất hoặc UID khác, trạng thái tenant bị từ chối và không dùng role fallback để cấp quyền.
- Source commit: `5e640be01250a43851f9ed6e997b29943ba7eae4`.
- CI cho commit app-shell mới đang chờ kết quả; chưa đánh dấu B2/B6/B7 hoặc Technical PASS.
- Không thay đổi luồng Google Drive backup, Dexie/IndexedDB, kho local-default, QR, chat hoặc dữ liệu sản phẩm. Không deploy production, không merge PR #2, không sửa `main`.
- Vị trí tiếp theo: xác minh CI cho `5e640be`; sau đó bổ sung test/state mapping cho no-membership, disabled tenant/member và session revocation; chỉ khi B2/B6/B7 ổn định mới bắt đầu B3/B4 employee card + PIN/Custom Token.


### 2026-10-31 — Thu hồi phiên xưởng khi Firebase Auth thay đổi
- Đọc lại hai tài liệu tiến độ/nhật ký và xác minh PR #2 vẫn Draft, chưa merge.
- Xác nhận CI run 41149954526 trên commit app shell 5e640be đã completed/success; toàn bộ Validate gồm lint, TypeScript, Next build, Functions build và Firestore Rules Emulator đều PASS. CI docs commit 53e39cad cũng PASS.
- Rà soát components/workshop-dashboard.tsx: observer Firebase Auth chỉ cập nhật UID/tên, không xóa TenantPrincipal và dữ liệu xưởng khi sign-out/đổi tài khoản; kết nối bất đồng bộ cũng chưa kiểm tra lại UID trước khi kích hoạt principal.
- Đã sửa observer: khi Firebase UID khác UID của principal hiện tại (bao gồm sign-out/anonymous), xóa principal, PO, sản lượng, phụ phí, thành viên, settings, earnings, chat và kết quả Q-Bot; hiển thị thông báo yêu cầu xác minh lại.
- Bổ sung kiểm tra Firebase Auth UID hiện tại sau khi Gateway trả principal trong cả luồng kết nối xưởng và tạo xưởng.
- Source commits: e8953f3, 5346f99, 5341a97, 9eedc74. Workflow Validate mới nhất 41167638066 trên commit 9eedc7462c1cffcf8a74e1e6d60dece095827aa8 đang chạy; chưa đánh dấu Technical PASS.
- Chưa có test Firebase runtime/Termux hoặc tài khoản Admin/Worker thật. Chưa deploy Firebase production, không merge PR #2, không sửa main.
- Vị trí tiếp theo: chờ CI đúng HEAD; nếu PASS, chuẩn hóa trạng thái Membership (no-membership, member disabled, tenant disabled, lỗi mạng) và rà soát luồng logout/thu hồi quyền ở mọi điểm truy cập tenant.


### 2026-10-31 — Batch Membership state, tenant disable và session lifecycle
- Xác minh CI baseline mới nhất trước batch: run `41167699490` trên commit `80ce04c493b2512ba119b4c52b4ff8eecc6cb376` completed/success; lint, TypeScript, Next build, Functions build và Firestore Rules Emulator đều PASS.
- Giữ nguyên branch `feature/new-feature-foundation-2026-10-27`; PR #2 vẫn Draft, không merge; không deploy Firebase production, không sửa `main`.
- Chuẩn hóa `TenantAccessError` với các mã: tenant_not_found, tenant_disabled, no_membership, membership_disabled, membership_invalid, employee_code_mismatch. Gateway nhận diện lỗi kết nối Firestore và trả thông báo network_error; không cấp quyền dự phòng.
- Sửa thứ tự xác minh: đọc document Membership của chính UID trước, kiểm tra trạng thái/role/code, sau đó mới đọc trạng thái tenant. Phát hiện Rules cũ chặn cả người dùng đọc document Membership của chính họ nếu chưa phải member; cập nhật Rules chỉ cho phép self-read đúng document UID của caller và chỉ đọc metadata tenant khi đã có record Membership. Không mở quyền đọc dữ liệu nghiệp vụ.
- Thêm Firestore Emulator cases: người chưa được mời có thể xác định document Membership của chính họ không tồn tại nhưng không đọc metadata tenant; thành viên bị khóa chỉ đọc được Membership/metadata tối thiểu, không đọc PO; tenant bị khóa không đọc được dữ liệu nghiệp vụ.
- Cập nhật Dashboard xưởng: dùng một hàm thu hồi session thống nhất để xóa principal, PO, sản lượng, phụ phí, members, settings, earnings, chat và Q-Bot; refresh xác minh lại Membership trước khi tải dữ liệu.
- Source commits trong batch: `b4611a5`, `d377324`, `7c4e293`, `11cec20`, `3774044`, `cd47896`, `3c4646e`, `9d4f853`, `96342c5`.
- CI mới nhất tại thời điểm ghi nhận: run `41169076083` trên commit `96342c59bf46b58b807acf4eb47e76560f9d13e0` đang in_progress; chưa đánh dấu Technical PASS. Các run trung gian không thay thế kiểm tra đúng HEAD.
- Chưa có Firebase runtime/Termux hoặc tài khoản Admin/Worker thực tế. Không triển khai employee card + PIN/Custom Token trong batch này; chờ Membership/session ổn định.
- Vị trí tiếp theo: kiểm tra CI đúng HEAD và xử lý lỗi nếu có; sau đó rà soát trạng thái hiển thị app shell và kiểm thử thực tế trước khi chuyển B3/B4.


## Quy trình quản lý và đồng bộ Firebase Rules

- **Nguồn chuẩn duy nhất:** file gốc `firestore.rules` tại thư mục gốc repository. `firebase.json` đã trỏ `firestore.rules` tới đúng file này; không tạo bản Rules thứ hai gây lệch phiên bản.
- Mọi thay đổi cấu trúc dữ liệu, quyền Admin/Worker, Membership, PO, sản lượng, phụ phí hoặc earnings phải cập nhật file `firestore.rules` và `tests/security/rules.test.mjs` cùng một đợt.
- CI phải chạy Firestore Rules Emulator và PASS trước khi coi thay đổi Rules là hoàn tất.
- **Chưa tự deploy Firebase production.** Trong Phase 1–2, chỉ cập nhật file chuẩn trong GitHub và kiểm thử Emulator; gom bản Rules ổn định để người dùng cập nhật Firebase một lần sau khi Phase 1–2 hoàn tất.
- Nếu phát hiện lỗ hổng bảo mật nghiêm trọng hoặc thay đổi Rules bắt buộc phải áp dụng sớm, phải báo người dùng trước, nêu rõ lý do/phạm vi và chờ xác nhận trước khi deploy.
- Trước mỗi lần cập nhật Firebase, đối chiếu đúng commit/branch đã PASS, sao lưu Rules hiện hành và chỉ deploy Rules bằng Firebase CLI; không deploy các dịch vụ khác ngoài phạm vi được duyệt.


### 2026-10-31 — Tạo cẩm nang thuật ngữ lập trình Q-Dcom
- Tạo `CAM_NANG_THUAT_NGU_QDCOM.md`, giải thích tiếng Việt các thuật ngữ lập trình, công nghệ và nghiệp vụ thực tế trong Q-Dcom.
- Nội dung gồm: lập trình căn bản; JavaScript/TypeScript/React/Next.js; database và lưu trữ; Firebase/Auth/Security; Tenant/Membership/PO/sản lượng/ví; PWA/QR/Google Drive; kiểm thử/GitHub/CI-CD; trạng thái Auth; bản đồ file và lệnh thường dùng.
- Có ví dụ theo Q-Dcom và phần phân biệt các cặp thuật ngữ dễ nhầm. Cẩm nang là tài liệu sống, sẽ bổ sung khi dự án phát triển.
- Chỉ thay đổi tài liệu; không sửa app, Rules, cấu hình Firebase hoặc dữ liệu.
- PR #2 vẫn Draft; không merge, không deploy production, không sửa `main`.
- Vị trí quay lại: Phase 2 — xác minh CI mới nhất cho Membership/Rules/session batch, sau đó tiếp tục B2/B6/B7. Chưa chuyển B3/B4 cho đến khi nhóm hiện tại ổn định.


### 2026-10-31 — CI PASS cho Membership state và auth session UI
- Xác minh đúng nhánh `feature/new-feature-foundation-2026-10-27`, PR #2 vẫn open/Draft; không merge, không deploy Firebase production, không sửa `main`.
- CI run `41213360712` trên HEAD `631494360cd7e966ba44531ade6625ad42d29865` completed/success. Các bước lint, TypeScript, Next.js build, Cloud Functions build và Firestore Rules Emulator đều completed/success.
- `authGateway.ts` có state mapping cho signed_out, no_membership, membership_disabled, tenant_disabled, membership_invalid, network_error và error; lỗi không xác minh được không tự cấp quyền.
- `qdcom-app.tsx` chỉ xác minh tenant khi Firebase Auth đã khôi phục và UID phiên khớp UID hồ sơ; trạng thái lỗi được giữ rõ ràng thay vì fallback Worker.
- `workshop-dashboard.tsx` xác minh Membership trước khi kết nối/refresh, kiểm tra UID sau xác minh và hiển thị thông báo trạng thái khi chưa có principal.
- Cập nhật B2/B6 thành 🟢 theo bằng chứng CI. B7 chuyển 🔵 vì cơ chế kỹ thuật đã có và CI PASS nhưng chưa có smoke test trên Firebase thật/Termux. Không đánh dấu toàn Phase 2 hoàn thành.
- Bảo toàn nguyên tắc: Google Sign-In không tự cấp Membership; Drive permission không phải quyền tenant; kho local-first/Dexie, Google OAuth/Drive Backup, QR, chat và dữ liệu sản phẩm không nằm trong phạm vi thay đổi của batch.
- Vị trí tiếp theo: bắt đầu B3/B4 theo batch bảo mật employee card + PIN server-side + Firebase Custom Token; trước đó rà soát Cloud Functions, schema Membership và cơ chế rate limit hiện có. Không yêu cầu người dùng cung cấp PIN/secret thật.


### 2026-10-31 — Bắt đầu rà soát thiết kế Employee Card + PIN
- Chốt batch kế tiếp là B3/B4, không mở rộng sang các hạng mục PO/Wallet/Menu.
- Rà soát `functions/src/index.ts`, `functions/package.json`, `types/tenant.ts`, `tenantService.ts`, `authGateway.ts`, `firestore.rules`, `tests/security/rules.test.mjs`, `package.json` và `firebase.json`.
- Hiện Cloud Functions chỉ có trigger tính lại earnings; chưa có callable authentication endpoint. Thành viên lưu `employeeCode` trong Membership, nhưng chưa có credential PIN server-side và chưa có luồng cấp Custom Token.
- Không được lưu PIN thô/hash trong document Membership mà Worker/Admin có thể đọc. Cần vùng credential riêng chỉ Admin SDK truy cập; client không được đọc/ghi.
- Thiết kế cần có: PIN hash bằng thuật toán password hashing phù hợp + salt riêng; xác minh timing-safe; giới hạn thử theo cả tài khoản và nguồn gọi; trạng thái lockout; chỉ cấp token khi tenant active + Membership active + employeeCode khớp; sau sign-in vẫn gọi Membership Gateway để lấy role từ dữ liệu có thẩm quyền.
- Chưa sửa code hoặc Rules cho B3/B4 trong bước rà soát này; chưa có test Functions Emulator. B3/B4 đang 🟡, chưa đánh dấu PASS.
- Vị trí tiếp theo: hoàn thiện thiết kế schema/endpoint/test trước khi triển khai callable functions; kiểm tra khả năng test Functions Emulator trong CI. Không yêu cầu PIN hoặc secret thật từ người dùng.


### 2026-10-31 — B3/B4: cô lập vùng credential nhân viên
- Tạo nhánh riêng `feature/employee-card-pin-auth-2026-10-31` từ nhánh nền tảng, không làm việc trên `main`.
- Sửa `firestore.rules`: thêm match `tenants/{tenantId}/employeeCredentials/{uid}` với deny read/write cho mọi client. Admin SDK trong Cloud Functions có thể truy cập ngoài Firestore Rules.
- Sửa `tests/security/rules.test.mjs`: seed credential/login-attempt fixture bằng Rules-disabled context; thêm test client không đọc/ghi credential và không đọc/ghi login-attempt records.
- Cập nhật `AUTHENTICATION_ARCHITECTURE.md`: schema server-only, PIN hashing có salt, constant-time compare, dummy hash khi mã thẻ không tồn tại, rate limit transactionally, tenant/Membership validation trước khi phát token.
- B3/B4 vẫn 🟡: chưa có callable Functions, chưa có Custom Token flow ở client, chưa có test Functions Emulator và chưa chạy CI cho nhánh mới. Không đánh dấu PASS.
- Nỗ lực tạo mã nguồn callable trong lượt này bị công cụ chặn; không có mã callable nào được ghi vào repository. Dừng ở lớp Rules/tests có thể kiểm chứng, không tìm cách lách cơ chế chặn.
- Không thay đổi các luồng kho/Dexie, Google OAuth, Drive Backup, QR, chat hoặc dữ liệu sản phẩm. Không deploy Firebase, không merge PR.
