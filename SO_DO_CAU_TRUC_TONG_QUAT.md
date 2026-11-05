# Q-Dcom — Sơ đồ cấu trúc tổng quát

Cập nhật phiên: **2026-10-27**  
Nhánh triển khai: `feature/new-feature-foundation-2026-10-27`  
Pull Request: [#2 — Tenant-scoped workshop production management](https://github.com/tuvinhquay/Q-Dcom/pull/2) · đang Draft  
Trạng thái: triển khai mã nguồn trên nhánh riêng; chưa deploy Firebase production, chưa merge `main`.

## 1. Kiến trúc tổng thể

```text
Q-Dcom PWA / Next.js + TypeScript
├── Kho Local-First (tính năng cũ)
│   ├── Dexie / IndexedDB: products, vocabulary, members
│   ├── Product service: mọi truy vấn kho lọc theo active tenant
│   ├── @q Bot: chỉ đọc dữ liệu kho trên thiết bị hiện tại
│   ├── Google OAuth / đăng nhập thẻ nhân viên cũ
│   └── Google Drive backup: một file riêng cho mỗi tenant
│
└── Quản lý sản lượng xưởng (mới)
    ├── Tenant setup: tạo xưởng / kết nối xưởng
    ├── Admin Dashboard
    │   ├── PO, công đoạn, đơn giá, ngày nhập, hạn xuất
    │   ├── Duyệt sản lượng và phụ phí chờ duyệt
    │   ├── Cấu hình nhắc nộp 1–3 giờ
    │   └── Xếp hạng sản lượng theo ngày/tuần/tháng/quý/năm
    ├── Worker Dashboard
    │   ├── Nhập sản lượng, chọn PO/công đoạn, quét QR
    │   ├── Công đoạn phát sinh và phụ phí cá nhân
    │   ├── Lịch sử, nhắc nộp và ví riêng tư
    │   └── Báo cáo thu nhập theo ngày/tuần/tháng/quý/năm
    ├── Chat xưởng có tenantId; @q trả lời cục bộ theo role
    └── Firebase Auth + Firestore rules + Cloud Functions
        ├── Firestore: dữ liệu xưởng và quyền truy cập
        ├── Rules: kiểm tra tenant/role ở phía máy chủ
        └── Functions: tính thu nhập đã duyệt; client không được ghi earnings
```

## 2. Quy tắc tenant và phân quyền

- Mọi dữ liệu nghiệp vụ xưởng mới có `tenantId`; đường dẫn Firestore đặt dưới `tenants/{tenantId}/...`.
- `activeTenantId` trong localStorage chỉ chọn tenant để hiển thị dữ liệu kho local; **không** phải cơ chế xác thực.
- Danh tính và role được tải từ `tenants/{tenantId}/members/{uid}`, dựa trên Firebase Auth. Mã thẻ nhân viên phải khớp membership sau khi đăng nhập Google; không chấp nhận mã thẻ đơn lẻ làm bằng chứng xác thực máy chủ.
- Firestore rules là ranh giới bảo mật thực tế. Các kiểm tra role trong TypeScript chỉ cải thiện giao diện và thông báo, không thay thế rules.
- Worker chỉ đọc được production entries và phụ phí của chính mình; Admin đọc sản lượng toàn xưởng và chỉ đọc các phụ phí đang `pending` để xét duyệt.
- `tenants/{tenantId}/earnings/{workerUid}` và `periods` chỉ cho UID tương ứng đọc. Client không được tạo/sửa/xóa earnings.
- Admin không được truy vấn thu nhập cá nhân qua dashboard hoặc @q. @q không lưu câu trả lời riêng tư vào chat chung.
- Tin nhắn chat xưởng lưu tại `tenants/{tenantId}/rooms/{roomId}/messages`; thành viên tenant khác không đọc/ghi được.
- Chat cộng đồng legacy được giữ cho `local-default` để bảo toàn nhóm cũ. UI hướng tenant mới sang chat xưởng; migration các nhóm cũ sang tenant bắt buộc cần kế hoạch riêng.

## 3. Dữ liệu IndexedDB

Dexie database `QDcom_Offline_DB` được nâng từ version 1 lên version 2. Migration giữ sản phẩm hiện có và gán `tenantId = local-default` cho bản ghi cũ chưa có tenant.

Bảng mới:
- `purchaseOrders`: PO và công đoạn hiển thị được; đơn giá không được cache vào IndexedDB.
- `productionEntries`: sản lượng và trạng thái duyệt theo tenant.
- `workerExtras`: schema cho phụ phí theo tenant; dữ liệu phụ phí nhạy cảm không cache vào IndexedDB.
- `tenantMemberships`: membership theo tenant.
- `tenantSettings`: cấu hình vận hành theo tenant.

Ví thu nhập và đơn giá có thẩm quyền được lấy từ Firestore/Cloud Functions, không dựa vào dữ liệu local có thể sửa bằng DevTools.

## 4. Mô hình Firestore mới

- `tenants/{tenantId}`
- `tenants/{tenantId}/members/{uid}`
- `tenants/{tenantId}/purchaseOrders/{poId}`
- `tenants/{tenantId}/operationRates/{rateId}` — chỉ Admin đọc/ghi; tách khỏi tài liệu PO để Worker không đọc đơn giá.
- `tenants/{tenantId}/productionEntries/{entryId}`
- `tenants/{tenantId}/workerExtras/{extraId}`
- `tenants/{tenantId}/earnings/{workerUid}`
- `tenants/{tenantId}/earnings/{workerUid}/periods/{periodId}`
- `tenants/{tenantId}/settings/{settingId}`
- `tenants/{tenantId}/rooms/{roomId}/messages/{messageId}`

Cloud Functions:
- `onProductionEntryChanged`: tính lại ví sau khi sản lượng đổi trạng thái.
- `onWorkerExtraChanged`: tính lại ví sau khi phụ phí đổi trạng thái.
- `onOperationRateChanged`: tính lại ví khi đơn giá công đoạn thay đổi.

## 5. @q Bot

- Parser nhận `role` và `tenantId`; danh mục sản phẩm bị lọc theo tenant trước khi so khớp.
- Câu hỏi về thu nhập của người khác, tổng tiền cá nhân và tài liệu mật bị từ chối.
- Worker chỉ được tra cứu mã hàng/vị trí, quy trình đã cấu hình và ví của chính mình; yêu cầu xem báo cáo tổng xưởng bị từ chối.
- Admin được hỏi danh sách PO, tổng sản lượng và báo cáo năng suất. Dữ liệu tiền công cá nhân không được trả lời.
- Trong chat xưởng, câu trả lời @q được tính và hiển thị cục bộ trên thiết bị người xem; không ghi câu trả lời vào tin nhắn chung.

## 6. Kiểm tra tự động

Workflow `.github/workflows/ci.yml` kiểm tra:
1. ESLint.
2. TypeScript.
3. Next.js production build.
4. TypeScript build cho Firebase Functions.
5. Firebase Firestore Emulator.
6. `tests/security/rules.test.mjs`: kiểm tra tenant isolation, quyền ví riêng tư, quyền xem phụ phí đang chờ duyệt và xác minh worker UID khi gửi sản lượng.

## 7. Triển khai production — chưa thực hiện

Trước khi sử dụng dữ liệu thật:
1. Điền cấu hình Firebase Web App và bật Google Authentication.
2. Xác nhận tài khoản Google của Admin/Worker, tạo tenant và thêm UID + mã thẻ vào membership.
3. Deploy Firestore rules và indexes.
4. Deploy Cloud Functions; xác nhận project có billing/quyền cần thiết cho Functions.
5. Thử nghiệm bằng hai tài khoản trên tenant thử nghiệm: Admin không đọc được earnings của Worker; Worker không đọc tenant khác; duyệt sản lượng/phụ phí cập nhật ví đúng kỳ.
6. Xác nhận backup Google Drive được tạo riêng theo tenant và kho local cũ vẫn mở bình thường.

## 8. Điểm tiếp tục ở phiên sau

- Đầu tiên kiểm tra trạng thái CI của commit mới nhất trên nhánh.
- Nếu CI PASS, cập nhật trạng thái trong `SESSION_LOG.md` và review PR #2.
- Không merge vào `main` cho tới khi CI PASS và quyết định rõ kế hoạch deploy Firebase production.
