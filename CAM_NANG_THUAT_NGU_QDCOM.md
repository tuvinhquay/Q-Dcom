# Cẩm nang thuật ngữ lập trình — Q-Dcom

> Tài liệu học bằng tiếng Việt dành cho người cùng phát triển Q-Dcom. Mỗi thuật ngữ có nghĩa đơn giản và ví dụ gắn với dự án. Đây là tài liệu sống, sẽ được bổ sung khi app có thêm công nghệ hoặc chức năng.

## 1. Bản đồ công nghệ của Q-Dcom

| Công nghệ | Hiểu đơn giản |
|---|---|
| Next.js | Bộ khung xây dựng ứng dụng web dựa trên React |
| React | Thư viện dựng giao diện từ các khối component |
| TypeScript | JavaScript có kiểm tra kiểu dữ liệu để giảm lỗi |
| Tailwind CSS | Bộ lớp tiện dụng để thiết kế giao diện |
| Firebase | Nền tảng backend: xác thực, database, functions |
| Firebase Auth | Xác minh người dùng là ai |
| Cloud Firestore | Database trực tuyến dạng document |
| Firestore Rules | Quy định ai được đọc/ghi dữ liệu nào |
| Cloud Functions | Mã chạy trên server để xử lý nghiệp vụ tin cậy |
| Dexie / IndexedDB | Database lưu trên thiết bị, dùng được offline |
| PWA / Service Worker | Giúp web cài như app và hỗ trợ offline |
| Google OAuth / Drive API | Đăng nhập Google và sao lưu lên Drive |
| Git / GitHub Actions | Quản lý phiên bản và tự động kiểm tra code |

## 2. Lập trình căn bản

| Từ khóa | Nghĩa dễ hiểu | Ví dụ Q-Dcom |
|---|---|---|
| Code / Source code | Mã lệnh để máy tính thực hiện | File .ts, .tsx |
| Programming / Coding | Lập trình, viết mã | Làm chức năng quản lý PO |
| App / Application | Ứng dụng | Q-Dcom |
| Repository / Repo | Kho chứa mã nguồn và lịch sử | GitHub Q-Dcom |
| File | Tệp | `qdcom-app.tsx` |
| Folder / Directory | Thư mục | `components/`, `lib/` |
| Path | Đường dẫn tới file | `lib/auth/authGateway.ts` |
| Module | Phần chức năng được tách riêng | Module xác thực |
| Component | Khối giao diện có thể dùng lại | Thẻ sản phẩm |
| Function | Hàm thực hiện một nhiệm vụ | Hàm kiểm tra Membership |
| Method | Hàm thuộc về một đối tượng | Phương thức của service |
| Variable | Biến lưu giá trị | `tenantId` |
| Constant / const | Biến không gán lại | Hằng số cấu hình |
| Parameter | Tham số khai báo trong hàm | Hàm nhận `uid` |
| Argument | Giá trị truyền vào hàm | UID thực tế |
| Return value | Giá trị hàm trả về | TenantPrincipal |
| Object | Nhóm dữ liệu dạng tên–giá trị | Hồ sơ nhân viên |
| Array | Danh sách phần tử | Danh sách PO |
| String | Dữ liệu chữ | Tên sản phẩm |
| Number | Dữ liệu số | Số lượng |
| Boolean | Giá trị đúng/sai | `active: true` |
| Null | Giá trị rỗng có chủ ý | Chưa chọn tenant |
| Undefined | Giá trị chưa được gán | Trường chưa có |
| Type | Quy định dạng dữ liệu được phép | Kiểu Tenant |
| Interface | Bản mô tả cấu trúc dữ liệu TypeScript | Interface Membership |
| Union type | Một trong các kiểu/giá trị được cho phép | Các trạng thái Auth |
| Syntax | Quy tắc viết đúng của ngôn ngữ | Cú pháp TS |
| Runtime | Thời điểm chương trình thực sự chạy | Khi đăng nhập |
| Compile | Kiểm tra/chuyển mã trước khi chạy | TypeScript |
| Dependency | Thư viện/thành phần mà dự án phụ thuộc | Firebase, Dexie |
| Package | Gói thư viện cài vào dự án | `firebase` |
| API | Cách hai phần mềm trao đổi dữ liệu | Firebase API |
| SDK | Bộ công cụ lập trình do nền tảng cung cấp | Firebase SDK |
| CLI | Công cụ điều khiển bằng dòng lệnh | Firebase CLI |
| Config / Configuration | Thông tin cấu hình | `firebase.json` |
| Environment | Môi trường chạy | local, test, production |
| Secret | Thông tin bí mật cần bảo vệ | PIN, private key |
| Log | Nhật ký hoạt động/lỗi | Log CI |

## 3. JavaScript, TypeScript, React và Next.js

| Từ khóa | Nghĩa dễ hiểu | Ví dụ Q-Dcom |
|---|---|---|
| JavaScript (JS) | Ngôn ngữ lập trình phổ biến trên web | Logic giao diện |
| TypeScript (TS) | JavaScript có kiểm tra kiểu | File `.ts`, `.tsx` |
| JSX | Cú pháp viết giao diện dạng thẻ trong JS | `<div>...</div>` |
| TSX | JSX kết hợp TypeScript | `qdcom-app.tsx` |
| React | Thư viện xây dựng giao diện | Dashboard |
| Props | Dữ liệu component cha truyền xuống con | Tên sản phẩm cho ProductCard |
| State | Dữ liệu trạng thái giao diện đang giữ | Tab hiện tại |
| Hook | Hàm React hỗ trợ state/vòng đời | useState, useEffect |
| useState | Tạo và cập nhật state | Lưu danh sách PO |
| useEffect | Chạy công việc phụ theo điều kiện | Theo dõi Auth |
| useCallback | Giữ tham chiếu hàm ổn định | Hàm clear session |
| Render | Dựng/cập nhật giao diện | Hiển thị dashboard |
| Re-render | Dựng lại khi dữ liệu liên quan đổi | Cập nhật danh sách |
| Event | Sự kiện | Click, submit |
| Event handler | Hàm xử lý sự kiện | Hàm đăng xuất |
| Async | Công việc bất đồng bộ | Đọc Firestore |
| Promise | Kết quả sẽ có trong tương lai | Lời gọi Firebase |
| async/await | Cách viết code chờ tác vụ bất đồng bộ | Chờ tải Membership |
| try/catch | Bắt và xử lý lỗi | Lỗi kết nối |
| Framework | Bộ khung có quy tắc/công cụ sẵn | Next.js |
| App Router | Cơ chế định tuyến theo thư mục Next.js | Thư mục `app/` |
| Route | Địa chỉ/màn hình | `/privacy` |
| Layout | Khung giao diện dùng chung | `app/layout.tsx` |
| Client Component | Component chạy trình duyệt, có tương tác | Dashboard |
| Server Component | Component xử lý phía server | Trang nội dung |
| Middleware | Lớp xử lý trung gian của request | Kiểm soát request nếu cần |
| Build | Đóng gói ứng dụng | `npm run build` |
| Bundle | Các file mã được gom/tối ưu | JavaScript bundle |
| Hydration | React gắn tương tác vào HTML đã dựng | Trang Next hoạt động |
| CSS | Ngôn ngữ định dạng giao diện | Màu, khoảng cách |
| Tailwind CSS | Các lớp CSS tiện dụng | `flex p-4 rounded-xl` |
| Responsive | Tự thích nghi kích thước màn hình | Mobile/desktop |
| Accessibility (a11y) | Khả năng sử dụng dễ tiếp cận | Nhãn nút, bàn phím |

## 4. Database, lưu trữ và đồng bộ

| Từ khóa | Nghĩa dễ hiểu | Ví dụ Q-Dcom |
|---|---|---|
| Database / DB | Cơ sở dữ liệu | Firestore, IndexedDB |
| Schema | Cấu trúc database | Cấu trúc Tenant/PO |
| Data model | Mô hình một loại dữ liệu | `types/tenant.ts` |
| Field | Trường thông tin | `displayName` |
| Record | Bản ghi | Một nhân viên |
| Document | Tài liệu dữ liệu | Document Membership |
| Collection | Nhóm document cùng loại | `purchaseOrders` |
| Subcollection | Collection con trong document | `members` của tenant |
| ID / Primary key | Mã định danh | `tenantId`, `uid` |
| Reference | Tham chiếu tới dữ liệu khác | PO thuộc tenant |
| Query | Yêu cầu tìm dữ liệu | Lấy PO theo tenant |
| Filter | Điều kiện lọc | Chỉ lấy PO đang mở |
| Index | Chỉ mục giúp tìm nhanh | Firestore index |
| Transaction | Nhóm thao tác dữ liệu nhất quán | Tạo tenant + Admin |
| Atomic | Tất cả cùng thành công hoặc cùng thất bại | Tạo xưởng nguyên tử |
| Migration | Chuyển dữ liệu cũ sang cấu trúc mới | Dexie version 2 |
| Backup | Bản sao dự phòng | JSON trên Drive |
| Restore | Khôi phục từ backup | Nhập file backup |
| Cache | Dữ liệu tạm để truy cập nhanh | Cache app shell |
| Persistence | Lưu được sau khi đóng app | IndexedDB |
| localStorage | Kho key-value nhỏ trong trình duyệt | Hồ sơ cục bộ |
| IndexedDB | Database trong trình duyệt | Kho sản phẩm offline |
| Dexie | Thư viện giúp dùng IndexedDB dễ hơn | `lib/db/qdcomDB.ts` |
| Offline | Không có mạng nhưng vẫn dùng phần hỗ trợ | Kho local |
| Local-first | Ưu tiên xử lý/lưu trên thiết bị | Kho Q-Dcom |
| Sync | Đồng bộ dữ liệu giữa các nơi | Đồng bộ backup |
| Conflict | Xung đột dữ liệu | Hai thiết bị sửa cùng bản ghi |
| Data integrity | Tính toàn vẹn dữ liệu | Không ghi nhầm tenant |

## 5. Firebase, đăng nhập và bảo mật

| Từ khóa | Nghĩa dễ hiểu | Ví dụ Q-Dcom |
|---|---|---|
| Frontend | Phần người dùng nhìn thấy | React dashboard |
| Backend | Phần xử lý phía máy chủ | Cloud Functions |
| Firebase | Nền tảng backend của Google | Auth, Firestore |
| Authentication / AuthN | Xác minh bạn là ai | Google login |
| Authorization / AuthZ | Xác định bạn được làm gì | Worker không duyệt PO |
| Identity | Danh tính người dùng | Firebase UID |
| UID | Mã người dùng Firebase cấp | `request.auth.uid` |
| Firebase Auth | Dịch vụ xác thực | Đăng nhập Google |
| Session | Phiên đăng nhập | Phiên Firebase Auth |
| Token | Chuỗi chứng minh phiên/quyền truy cập | ID token |
| ID Token | Token xác nhận danh tính đã đăng nhập | Firebase ID token |
| Custom Token | Token server tạo để đăng nhập Firebase | Luồng thẻ nhân viên dự kiến |
| OAuth | Chuẩn đăng nhập/ủy quyền qua bên khác | Google OAuth |
| Provider | Nhà cung cấp danh tính | Google |
| Credential | Thông tin xác minh | PIN |
| PIN | Mã bí mật xác minh nhân viên | PIN thẻ |
| Hash | Biến đổi một chiều dữ liệu | Hash PIN |
| Salt | Dữ liệu ngẫu nhiên thêm trước khi hash | Bảo vệ hash PIN |
| Rate limit | Giới hạn số lần gọi | Chống thử PIN |
| Lockout | Tạm khóa sau nhiều lần sai | Khóa đăng nhập |
| Brute force | Tấn công thử nhiều mật khẩu | Thử PIN liên tục |
| Least privilege | Chỉ cấp quyền tối thiểu cần thiết | Worker xem ví mình |
| Tenant | Một đơn vị/xưởng độc lập | Xưởng A |
| Multi-tenancy | Một app phục vụ nhiều đơn vị tách dữ liệu | Nhiều xưởng Q-Dcom |
| Tenant isolation | Cô lập dữ liệu giữa xưởng | A không đọc PO của B |
| Membership | Bản ghi xác định UID thuộc tenant và có role gì | Thành viên xưởng |
| Principal / TenantPrincipal | Danh tính đã xác minh kèm quyền tenant | UID + tenantId + role |
| Role | Vai trò | admin, worker |
| Owner | Chủ sở hữu tenant | Người sở hữu xưởng |
| Admin | Người quản trị xưởng | Quản lý PO, duyệt sản lượng |
| Worker | Nhân viên sản xuất | Gửi sản lượng, xem ví mình |
| Active / Inactive | Đang hoạt động / bị vô hiệu hóa | Membership active=false |
| Permission | Quyền thực hiện một hành động | Quyền đọc PO |
| Access control | Kiểm soát truy cập | Firestore Rules |
| Firestore | Database đám mây dạng document | Dữ liệu xưởng |
| Firestore Security Rules | Luật đọc/ghi dữ liệu | `firestore.rules` |
| Emulator | Môi trường giả lập | Rules Emulator |
| Cloud Functions | Hàm chạy phía server | Tính earnings |
| Admin SDK | Công cụ server quản trị Firebase | Tạo Custom Token |
| Callable Function | Function client gọi theo giao thức Firebase | Đăng nhập thẻ dự kiến |
| HTTPS | Kết nối web mã hóa | Gọi endpoint an toàn |
| CORS | Quy tắc website nào được gọi tài nguyên | Cấu hình API |
| Secret management | Quản lý thông tin bí mật | Không commit token |
| Environment variable | Biến cấu hình môi trường | Firebase config |
| Security boundary | Ranh giới bắt buộc kiểm tra quyền | Server/Rules |

**Điều cần nhớ:** đăng nhập trả lời “bạn là ai”; Membership và Rules trả lời “bạn được vào xưởng nào, được làm gì”. Đăng nhập Google không tự cấp quyền xưởng; quyền Google Drive không phải Membership.

## 6. Nghiệp vụ xưởng, PO và thu nhập

| Từ khóa | Nghĩa dễ hiểu | Ví dụ Q-Dcom |
|---|---|---|
| PO (Purchase Order) | Đơn đặt hàng/đơn sản xuất | Admin tạo PO |
| PO code | Mã đơn | PO-2026-001 |
| Production | Sản xuất | Làm hàng |
| Stage / Operation | Công đoạn sản xuất | Cắt, may, hoàn thiện |
| Operation rate / Unit rate | Đơn giá công đoạn/đơn vị | Tiền công mỗi sản phẩm |
| Production entry | Bản ghi nhân viên gửi sản lượng | 120 sản phẩm công đoạn may |
| Quantity | Số lượng | 120 |
| Submission | Lần gửi báo cáo | Worker gửi sản lượng |
| Pending | Chờ duyệt | Sản lượng mới gửi |
| Approved | Đã duyệt | Sản lượng được xác nhận |
| Rejected | Bị từ chối | Báo cáo sai |
| Review / Approval | Kiểm tra và phê duyệt | Admin duyệt |
| Reviewer | Người duyệt | Admin |
| Extra cost / Worker extra | Khoản phụ phí phát sinh | Công việc ngoài |
| Earnings | Thu nhập được tính | Tiền công đã duyệt |
| Wallet | Ví theo dõi thu nhập | Ví cá nhân Worker |
| Period | Kỳ thời gian | Ngày/tuần/tháng |
| Aggregate report | Báo cáo tổng hợp | Tổng sản lượng xưởng |
| Productivity | Năng suất | Sản lượng theo người |
| Deadline | Hạn hoàn thành | Hạn xuất hàng |
| Overdue | Quá hạn | PO chưa xong đúng hạn |
| Audit trail | Dấu vết ai làm gì, lúc nào | Lịch sử duyệt |
| Privacy | Quyền riêng tư | Admin không tự động xem ví cá nhân |

## 7. PWA, QR và Google Drive

| Từ khóa | Nghĩa dễ hiểu | Ví dụ Q-Dcom |
|---|---|---|
| Web app | Ứng dụng chạy trên trình duyệt | Q-Dcom |
| PWA | Web có thể cài như app, hỗ trợ offline tùy cấu hình | Q-Dcom Android |
| Manifest | File tên/icon/màu/cách mở PWA | `public/manifest.json` |
| Service Worker | Chương trình nền quản lý cache/offline | `public/sw.js` |
| App shell | Khung giao diện cơ bản | Giao diện được cache |
| Installable | Có thể cài lên màn hình chính | Add to Home Screen |
| HTTPS secure context | Kết nối an toàn cần cho camera/service worker | Quét QR |
| QR Code | Mã hai chiều chứa dữ liệu | QR chia sẻ/PO |
| QR scanning | Quét và giải mã QR | Worker quét PO |
| Schema validation | Kiểm tra dữ liệu đúng cấu trúc | Kiểm tra file backup |
| JSON | Định dạng văn bản dữ liệu có cấu trúc | Backup JSON |
| Base64 | Biểu diễn dữ liệu nhị phân thành chữ | Ảnh nhúng |
| Gzip | Thuật toán nén dữ liệu | Backup JSON/Gzip |
| Google Drive API | Giao diện lập trình thao tác Drive | Upload backup |
| OAuth scope | Phạm vi quyền xin từ Google | Quyền appDataFolder |
| appDataFolder | Vùng dữ liệu riêng của ứng dụng trên Drive | Backup Q-Dcom |
| Consent | Sự đồng ý cấp quyền | Chấp thuận Drive |
| Sidebar | Thanh menu cạnh màn hình | Menu Q-Dcom |
| Drawer | Menu trượt từ cạnh | Menu mobile dự kiến |
| Modal / Dialog | Hộp thoại nổi | Xác nhận xóa |
| Toast | Thông báo ngắn | Báo lưu thành công |
| Loading state | Trạng thái đang tải | Đang kiểm tra Membership |
| Empty state | Chưa có dữ liệu | Chưa có PO |
| Error state | Có lỗi | Không tải được dữ liệu |
| Responsive design | Giao diện thích nghi màn hình | Điện thoại/máy tính |
| Glassmorphism | Phong cách kính mờ | Dashboard |

## 8. Kiểm thử, GitHub và phát hành

| Từ khóa | Nghĩa dễ hiểu | Ví dụ Q-Dcom |
|---|---|---|
| Test / Testing | Kiểm thử tìm lỗi | Test Rules |
| Unit test | Kiểm tra một hàm nhỏ riêng lẻ | Test hàm tính |
| Integration test | Kiểm tra nhiều phần phối hợp | Auth + Membership |
| Emulator test | Test trên môi trường giả lập | Firestore Emulator |
| Regression test | Kiểm tra chức năng cũ không bị hỏng | Kho, QR, backup |
| Smoke test | Kiểm tra nhanh luồng chính | Mở app, xem kho |
| Lint | Kiểm tra lỗi/quy tắc code | `npm run lint` |
| ESLint | Công cụ phân tích mã JS/TS | CI lint |
| Type check | Kiểm tra kiểu dữ liệu | `npx tsc --noEmit` |
| Build check | Kiểm tra đóng gói ứng dụng | `npm run build` |
| CI | Tự động kiểm tra khi có thay đổi code | GitHub Actions |
| CD | Tự động chuẩn bị/phát hành phần mềm | Quy trình deploy |
| Git | Công cụ quản lý lịch sử code | Commit, branch |
| GitHub | Dịch vụ lưu repo/cộng tác | Repo Q-Dcom |
| Branch | Nhánh phát triển riêng | feature branch |
| Main | Nhánh chính | `main` |
| Commit | Một mốc lưu thay đổi | Commit SHA |
| SHA | Mã nhận diện commit/nội dung | Commit hash |
| Push | Gửi commit lên GitHub | Push branch |
| Pull Request (PR) | Đề nghị gộp nhánh | PR #2 |
| Draft PR | PR đang soạn, chưa sẵn sàng merge | PR #2 |
| Merge | Gộp thay đổi hai nhánh | Merge vào main |
| Conflict | Hai thay đổi va chạm | Cùng sửa file |
| Diff | Phần khác nhau giữa hai phiên bản | Diff Rules |
| Review | Đánh giá thay đổi trước khi chấp nhận | Review PR |
| Workflow | Chuỗi bước tự động | Validate |
| Job | Nhóm việc trong workflow | Build Functions |
| Step | Một bước trong job | Cài dependencies |
| Artifact | Tệp/kết quả được tạo ra | Báo cáo build |
| PASS / FAIL | Đạt / không đạt kiểm tra | CI success/failure |
| Technical PASS | Kiểm tra kỹ thuật đã đạt | Lint/build/test |
| Practical PASS | Người dùng đã thử thực tế và xác nhận | Thử trên điện thoại |
| Definition of Done (DoD) | Điều kiện cần đạt để đóng công việc | Code + test + docs |
| Rollback | Quay về phiên bản ổn định trước | Hoàn tác deploy |
| Release | Phiên bản phát hành | Bản chính thức |
| Deploy | Đưa mã/cấu hình lên môi trường chạy thật | Deploy Rules |
| Production | Môi trường phục vụ người dùng thật | Firebase production |
| Staging | Môi trường thử trước production | Firebase test |

**Quy tắc Q-Dcom:** CI xanh không có nghĩa Firebase production đã cập nhật. Build thành công không có nghĩa đã thử trên điện thoại. Không merge hoặc deploy production khi chưa được người dùng cho phép.

## 9. Trạng thái Authentication trong dự án

| Từ khóa | Ý nghĩa |
|---|---|
| `signed_out` | Chưa có phiên Firebase Auth |
| `authenticating` | Đang xác minh/đăng nhập |
| `loading_memberships` | Đã có danh tính, đang tải Membership |
| `tenant_selection` | Có nhiều xưởng hợp lệ, cần chọn |
| `authorized` | Đã xác minh và được vào tenant |
| `no_membership` | Đã đăng nhập nhưng chưa được thêm vào xưởng |
| `membership_disabled` | Membership bị vô hiệu hóa |
| `tenant_disabled` | Xưởng bị vô hiệu hóa |
| `membership_invalid` | Dữ liệu Membership không hợp lệ |
| `network_error` | Không xác minh được do lỗi mạng |
| `local_only` | Chỉ dùng dữ liệu cục bộ, không có quyền tenant |
| `loading` | Đang tải/xác minh |
| `denied` | Bị từ chối quyền |

## 10. File quan trọng trong Q-Dcom

| File / thư mục | Vai trò |
|---|---|
| `app/` | Route, layout và trang Next.js |
| `components/qdcom-app.tsx` | Điều phối app shell/dashboard |
| `components/workshop-dashboard.tsx` | Dashboard xưởng Admin/Worker |
| `lib/auth/authGateway.ts` | Điều phối Auth + Membership |
| `lib/services/tenantService.ts` | Đọc/xác minh tenant và Membership |
| `lib/tenancy/authorization.ts` | Logic quyền tenant |
| `lib/firebase.ts` | Khởi tạo Firebase client |
| `lib/db/qdcomDB.ts` | Dexie / IndexedDB |
| `lib/sync/qdcomSync.ts` | QR và backup |
| `lib/sync/googleDriveBackup.ts` | Backup Google Drive |
| `lib/services/workshopFirestoreService.ts` | Dịch vụ dữ liệu xưởng |
| `lib/services/gatekeeperService.ts` | Kiểm soát truy cập |
| `types/` | Kiểu dữ liệu TypeScript |
| `functions/src/` | Cloud Functions server |
| `firestore.rules` | Nguồn Rules chuẩn duy nhất |
| `firestore.indexes.json` | Chỉ mục Firestore |
| `firebase.json` | Cấu hình Firebase CLI |
| `tests/security/rules.test.mjs` | Test Firestore Rules |
| `package.json` | Thư viện và lệnh npm |
| `TIEN_DO_DU_AN.md` | Roadmap/tiến độ |
| `SESSION_LOG.md` | Nhật ký phiên |
| `AUTHENTICATION_ARCHITECTURE.md` | Thiết kế Auth/Membership |

## 11. Lệnh thường dùng

| Lệnh | Tác dụng |
|---|---|
| `npm install` | Cài thư viện |
| `npm run dev` | Chạy server phát triển |
| `npm run build` | Build ứng dụng |
| `npm run start` | Chạy bản build |
| `npm run lint` | Kiểm tra quy tắc code |
| `npx tsc --noEmit` | Kiểm tra TypeScript |
| `git status` | Xem file thay đổi |
| `git diff` | Xem nội dung thay đổi |
| `git branch` | Xem nhánh |
| `git log` | Xem lịch sử commit |
| `git pull` | Lấy thay đổi từ remote |
| `git push` | Gửi commit lên remote |
| `firebase emulators:start` | Chạy Firebase Emulator |
| `firebase deploy --only firestore:rules` | Chỉ deploy Rules; cần được duyệt trước |

## 12. Những cặp từ dễ nhầm

1. **Authentication vs Authorization:** xác minh bạn là ai khác với xác định bạn được làm gì.
2. **Google Sign-In vs Drive permission:** đăng nhập Google khác với quyền sao lưu Drive.
3. **Tenant vs Membership:** Tenant là xưởng; Membership là hồ sơ xác định UID thuộc xưởng và có vai trò nào.
4. **Role vs Permission:** Role là vai trò; Permission là quyền cụ thể.
5. **Frontend vs Backend:** giao diện người dùng khác với xử lý phía máy chủ.
6. **localStorage vs IndexedDB:** localStorage hợp vài giá trị nhỏ; IndexedDB hợp dữ liệu có cấu trúc/nhiều bản ghi.
7. **Firestore vs IndexedDB:** Firestore là database đám mây; IndexedDB là database trên thiết bị.
8. **Backup vs Sync:** backup là bản sao dự phòng; sync là đồng bộ thay đổi.
9. **Build PASS vs Runtime PASS:** build được không có nghĩa chạy thật không lỗi.
10. **CI PASS vs Practical PASS:** máy kiểm tra đạt không thay thế thử thực tế.
11. **Hide UI vs Security enforcement:** ẩn nút không bảo vệ dữ liệu; Rules/backend phải chặn.
12. **Employee code vs Authentication factor:** mã thẻ là mã nhận diện, không phải bí mật đủ để chứng minh danh tính.
13. **Admin vs Owner:** Admin vận hành; Owner là chủ sở hữu có quyền đặc biệt.
14. **PO vs Production Entry:** PO là đơn cần làm; Production Entry là lần nhân viên báo sản lượng.
15. **Pending vs Approved:** gửi lên chưa có nghĩa là đã được duyệt.

## 13. Cách học và cách giải thích từ nay về sau

Khi thuật ngữ mới xuất hiện, sẽ giải thích theo mẫu:
- **Từ khóa:** tên tiếng Anh.
- **Dịch nghĩa:** nghĩa tiếng Việt.
- **Hiểu đơn giản:** nói bằng ngôn ngữ đời thường.
- **Trong Q-Dcom:** vị trí/chức năng thực tế.
- **Ví dụ và lưu ý:** tình huống cụ thể, nhất là khi liên quan bảo mật.

Không cần học thuộc hết trước khi làm app. Ta học từng nhóm đúng lúc công việc cần dùng và cập nhật cẩm nang theo mã nguồn thật.
