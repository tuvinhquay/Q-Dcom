# Báo cáo rà soát Roadmap Q-Dcom — 2026-11-04

Nhánh: `roadmap/batch-b-auth-audit-2026-11-04`
Nguồn: đọc trực tiếp mã nguồn trên nhánh, gồm app shell, Workshop Dashboard, Firebase Auth, Membership, Firestore Rules, Dexie, backup/restore và Cloud Functions.

## Kết luận

**Chưa đủ điều kiện đánh dấu toàn dự án PASS.** Có nhiều chức năng đã có mã nguồn, nhưng kiến trúc hiện hành trong tài liệu ngày 2026-11-04 chưa được triển khai đồng bộ. Một số luồng hiện tại không đáp ứng yêu cầu mới và có nguy cơ gây hiểu nhầm về bảo mật hoặc mất khả năng khôi phục.

## Phát hiện theo thứ tự ưu tiên

### P0 — Phải xử lý trước khi mở rộng tính năng

1. **Đăng ký ID hiện tại không phải đăng ký thẻ ID công ty có xác thực.** `components/qdcom-app.tsx` đang lưu hồ sơ vào `localStorage` (`qdcom.local_members.v1`, `qdcom.user_profile.v1`); đăng nhập lại chỉ tra mã ID trên cùng thiết bị. Không có mật khẩu, không có server verification, không tạo danh tính Firebase. Đây là hồ sơ local legacy, không được gọi là đăng nhập công ty an toàn.
2. **Firebase Auth Gateway hiện yêu cầu Firebase user Google.** `lib/auth/authGateway.ts` mô tả Google-only; `authorizeTenantSession` từ chối anonymous và Membership chỉ nhận Firebase UID. Chưa có provider thẻ ID + mật khẩu và cơ chế ánh xạ danh tính ổn định an toàn.
3. **Google Sign-In đang gộp với Drive consent.** `lib/firebase.ts` thêm scope `drive.appdata` và `drive.metadata.readonly` vào Google provider; `signInWithGooglePopup` yêu cầu access token Drive. `handleGoogleAuthorization` tự đặt trạng thái Drive connected và báo sẽ backup ngay. Điều này không đúng quyết định mới: Google login và Drive backup permission phải là hai lựa chọn riêng.
4. **Backup chưa mã hóa.** `lib/sync/googleDriveBackup.ts` chỉ gzip JSON rồi tải lên Drive. Không có client-side encryption, Recovery Key, authenticated integrity, hoặc restore/download flow hoàn chỉnh được xác minh. Gzip không phải mã hóa.
5. **Backup thiếu dữ liệu nghiệp vụ.** `serializeBackup` hiện chỉ đưa products, botVocabulary và members vào `qdcom-backup` v1. Không bao gồm PO, productionEntries, workerExtras, tenantSettings, chat hoặc các dữ liệu tenant khác; do đó không thể khôi phục toàn bộ trạng thái dữ liệu Q-Dcom.

### P1 — Cần hoàn thiện trước khi đóng các giai đoạn nghiệp vụ

6. **Workshop/PO/Production/Extras có code thực tế.** `components/workshop-dashboard.tsx`, `lib/services/workshopFirestoreService.ts`, `types/tenant.ts`, `firestore.rules` và `functions/src/index.ts` đã có tạo PO, công đoạn, nhập sản lượng, duyệt, phụ phí, chat, ví và trigger tính earnings. Roadmap cũ đánh dấu toàn bộ C/D chưa bắt đầu là không chính xác; tuy nhiên vẫn cần test nghiệp vụ, race conditions, lịch sử và privacy.
7. **Local-first chưa nhất quán.** Dexie version 2 hiện có bảng products, botVocabulary, members, purchaseOrders, productionEntries, workerExtras, tenantMemberships, tenantSettings. Nhưng service xưởng vẫn đọc/ghi Firestore trực tiếp cho nhiều nghiệp vụ; đây là kiến trúc hybrid, không thể tuyên bố toàn bộ dữ liệu xưởng chỉ nằm trên thiết bị. Cần chốt rõ dữ liệu nghiệp vụ local-first và cơ chế sync/backup trước khi triển khai thêm.
8. **Logout/backup coupling nguy hiểm cho trải nghiệm.** `logoutProfile` chặn đăng xuất Google nếu không có Drive access token hoặc backup thất bại; luồng đăng xuất và xóa cache cần được tách khỏi thao tác backup để người dùng luôn có thể thoát an toàn mà không vô tình mất dữ liệu.
9. **Google Drive backup chưa có restore round-trip được xác minh.** Service hiện có logic upload/update một file gzip trong appDataFolder; chưa thấy đầy đủ API download/restore trong service được rà soát. Cần kiểm tra toàn bộ giao diện restore và xử lý version/conflict.
10. **Worker wallet / privacy đã có nền tảng server.** Rules chỉ cho worker đọc earnings của chính mình và client không được ghi earnings; Cloud Function tính lại từ approved entries/extras. Cần kiểm tra dữ liệu sai, rate changes, timezone, duplicate triggers và xóa/tái tính kỳ.
11. **Mobile menu hiện có responsive nav, chưa tương đương drawer theo yêu cầu F.** Cần audit UI thực tế và hoàn thiện drawer/trạng thái focus/escape/touch nếu vẫn là yêu cầu được giữ.

### P2 — Regression và phát hành

12. Các chức năng cũ hiện diện trong source: kho, Dexie, Google OAuth, local ID legacy, Google Drive upload, QR share/scan, community chat, @Q bot. Tuy nhiên phải chạy regression end-to-end; sự hiện diện file không phải PASS.
13. Firestore Rules có Emulator test trong `tests/security/rules.test.mjs`; CI trước đó đã PASS ở commit cũ, không chứng minh các thay đổi tài liệu hoặc code sau đó. Cần lấy kết quả CI theo đúng commit mới nhất.
14. Chưa có bằng chứng Firebase production, Google Drive live restore hoặc Android/Termux smoke test trong phiên audit này.

## Ma trận trạng thái đã hiệu chỉnh

| Giai đoạn | Tình trạng sau audit | Lý do |
|---|---|---|
| A — Chuẩn bị | 🟡 | Có tài liệu, nhưng cần cập nhật risk/rollback theo phát hiện mới |
| B — Auth/Membership | 🔴 | Google-only; thiếu employee ID + password; local ID legacy không an toàn |
| C — PO/Sản xuất | 🟡 | Nhiều module đã có; cần test/hoàn thiện nghiệp vụ và data strategy |
| D — Wallet/Privacy | 🟡 | Có server triggers + Rules; cần test logic, thời gian, dữ liệu bất thường |
| E — Google/Backup | 🔴 | Login gộp Drive consent; gzip không mã hóa; backup thiếu dữ liệu và restore chưa chứng minh |
| F — Mobile menu | 🟡 | Có responsive nav, cần đối chiếu yêu cầu drawer và test mobile |
| G — Regression | 🔴 | Chưa có full regression trên đúng HEAD |
| H — Release | ⚪ | Chưa đủ điều kiện; chưa deploy/merge |

## Kế hoạch xử lý bắt buộc

1. B1: Hoàn thiện kiến trúc identity cho Google và employee ID/password; thiết kế activation chống chiếm mã thẻ, không phục hồi PIN.
2. B2: Tách Google Auth khỏi Drive authorization; thiết kế luồng đăng xuất/cache an toàn.
3. B3: Xây employee credential backend an toàn (password hash/salt, rate limit, reset, server verified membership) và test Emulator.
4. E1: Thiết kế Recovery Key + client-side authenticated encryption, backup version/schema/tenant binding/integrity.
5. E2: Bao phủ tất cả bảng nghiệp vụ cần khôi phục; upload/download/restore, conflict handling và migration.
6. C/D: Audit và test các luồng PO, sản lượng, duyệt, phụ phí, earnings theo từng kịch bản; sửa các lỗi phát hiện.
7. F: Hoàn thiện mobile drawer theo yêu cầu đã chốt; kiểm tra responsive.
8. G/H: Full regression, CI đúng HEAD, staging smoke test; chỉ production sau approval.

Không thực hiện gộp tất cả vào một commit lớn. Mỗi batch phải có branch/commit riêng, test trước/sau, cập nhật roadmap và session log. Không đánh dấu PASS khi thiếu evidence.
