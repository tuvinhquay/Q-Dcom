# Q-Dcom — BẢNG THEO DÕI TIẾN ĐỘ CÔNG VIỆC

> File này là bảng điều khiển tiến độ dài hạn của dự án. Cập nhật trạng thái tại đây sau mỗi công việc; không thay thế `SESSION_LOG.md` (nhật ký diễn biến từng phiên).
>
> **Cập nhật gần nhất:** 2026-10-31 · rà soát sâu Google OAuth, Membership state và ranh giới Google Drive  
> **Nhánh làm việc dự kiến:** `feature/new-feature-foundation-2026-10-27`  
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
| Sửa mã nguồn / triển khai thực tế | 🟡 | Đã thêm Gateway, tích hợp Dashboard xưởng, khóa Bot/Cộng đồng tenant khi chưa xác minh; tiếp tục hoàn thiện Google/Membership và session |
| Kiểm tra kỹ thuật và kiểm tra thực tế | 🟡 | CI Validate của commit source `8e895e8` và commit docs `436c957` đều PASS; chưa có kiểm tra Firebase thật/Termux |

   > **Vị trí đang làm:** B2/B6 — rà soát và hoàn thiện trạng thái Google identity ↔ Membership; Google OAuth hiện vẫn lưu hồ sơ và điều hướng kho local, còn quyền tenant phải tiếp tục được xác minh độc lập qua Gateway. Chưa triển khai B3/B4.

## 3. Trình tự công việc tổng thể

### Giai đoạn A — Chuẩn bị và bảo vệ hiện trạng

- [x] 🟢 A1. Thống nhất hướng đi: sửa và xây dựng lại từng phần, không viết lại mù quáng toàn bộ dự án.
- [x] 🟢 A2. Xác định các chức năng cũ bắt buộc phải giữ.
- [x] 🟢 A3. Rà soát yêu cầu Phase 1.
- [x] 🟢 A4. Rà soát tĩnh Authentication & Authorization trong Phase 2.
- [x] 🟢 A5. Kiểm tra lại HEAD, trạng thái nhánh, CI và PR mới nhất trước khi bắt đầu sửa. (HEAD `760f93d`; PR #2 vẫn Draft; workflow Validate mới nhất PASS toàn bộ 11 bước.)
- [ ] 🟡 A6. Đã có `AUTHENTICATION_ARCHITECTURE.md`; tiếp tục cập nhật danh sách file/rủi ro/rollback theo các phát hiện triển khai thực tế.
- [ ] 🟡 A7. CI Validate đã PASS trên source commit `8e895e8` và docs commit `436c957`; còn thiếu smoke test thiết bị và regression thực tế các chức năng cũ.

### Giai đoạn B — Authentication + Membership + Authorization

- [x] 🟢 B1. Hoàn tất bản thiết kế Authentication Gateway dùng chung cho Google OAuth và đăng nhập thẻ nhân viên trong `AUTHENTICATION_ARCHITECTURE.md`.
- [ ] 🟡 B2. Gateway xác minh Firebase Auth session + Membership đã được tích hợp vào Dashboard xưởng và app shell; CI PASS trên các commit gần nhất. Cần hoàn thiện hiển thị no-membership/disabled/error và xử lý Google sign-in theo trạng thái tenant.
- [ ] ⚪ B3. Thiết kế đăng nhập thẻ nhân viên có xác minh bảo mật phía máy chủ; không dùng mã thẻ đơn lẻ làm bằng chứng xác thực.
- [ ] ⚪ B4. Phát hành Firebase Auth session hợp lệ cho nhân viên sau khi xác minh.
- [ ] ⚪ B5. Hợp nhất Membership và Tenant context; role lấy từ dữ liệu có thẩm quyền phía máy chủ.
- [ ] 🟡 B6. App shell đã có trạng thái local_only / loading / authorized / denied; bỏ fallback Worker cho tenant và khóa Bot/Cộng đồng tenant khi chưa xác minh. CI PASS; cần rà soát toàn bộ điểm dùng role và kiểm thử runtime.
- [ ] ⚪ B7. Chuẩn hóa đăng xuất, thu hồi thành viên, vô hiệu hóa tài khoản và xử lý phiên hết hạn.
- [ ] ⚪ B8. Kiểm tra quyền tại UI, backend/Cloud Functions và Firestore Rules; UI ẩn mục không thay thế bảo mật.
- [ ] ⚪ B9. Kiểm thử tự động: Google, thẻ nhân viên, Admin, Worker, thành viên bị khóa, tenant khác.
- [ ] ⚪ B10. Technical PASS — lint, typecheck, build, test, rules/emulator và regression liên quan.
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
