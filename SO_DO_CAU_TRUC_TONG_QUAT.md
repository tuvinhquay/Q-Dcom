# Sơ đồ kiến trúc tổng quát Q-Dcom

Tài liệu handoff này mô tả kiến trúc và trạng thái mã nguồn tại ngày **21/10/2026**. Khi có thay đổi kiến trúc, hãy cập nhật tài liệu này cùng với mã và README.

## 1. Tổng quan dự án

Q-Dcom là ứng dụng nội bộ quản lý mẫu hàng, tồn kho, vị trí lưu trữ và tra cứu bằng trợ lý `@q`. Ứng dụng không có luồng giỏ hàng, đặt hàng hoặc thanh toán.

### Công nghệ và vai trò

| Công nghệ | Vai trò |
|---|---|
| Next.js App Router 16, React 19, TypeScript | Giao diện web, định tuyến và build triển khai |
| Dexie + IndexedDB | Nguồn dữ liệu trên thiết bị cho sản phẩm, tồn kho, từ vựng bot và thành viên |
| Firebase Authentication | Xác thực danh tính Google để dùng tính năng cộng đồng |
| Cloud Firestore | Gatekeeper cho cộng đồng và backend đồng bộ tenant-scoped riêng của workspace sản xuất |
| Google Drive API v3 | Backup JSON nén Gzip vào thư mục riêng `appDataFolder` của tài khoản |
| `qrcode.react`, `html5-qrcode` | Tạo/đọc QR hồ sơ và dữ liệu chia sẻ |
| Vercel | Build và triển khai web khi nhánh production được cập nhật |

### Luồng dữ liệu

```text
┌────────────────────────── Trình duyệt người dùng ──────────────────────────┐
│                                                                            │
│  components/qdcom-app.tsx ── CRUD/tra cứu @q ──> Dexie / IndexedDB         │
│          │                                      │                           │
│          │ Google popup                         └─ JSON backup             │
│          v                                               │                  │
│  Firebase Authentication                                 v                  │
│  Google identity + Firebase UID           gzip -> Google Drive appDataFolder│
│          │                                                                 │
│          ├── community-chat.tsx -> gatekeeperService -> Firestore          │
│          │                              users / groups / chats / messages  │
│          └── production module -> productionService -> Firestore           │
│                                         productionGroups/{groupId}/...      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**Nguyên tắc dữ liệu:** sản phẩm, số lượng tồn, vị trí kho, từ vựng và kết quả `@q` tiếp tục nằm trong IndexedDB, không ghi vào Firestore. Ngoại lệ được xác định rõ là module sản lượng/thu nhập dùng workspace Firestore riêng để đồng bộ người dùng trong cùng nhóm; mọi collection sản xuất đều nằm dưới `productionGroups/{groupId}` và được bảo vệ bằng rules RBAC. Tin nhắn `@q` chỉ chia sẻ câu hỏi; mỗi thiết bị tự truy vấn IndexedDB và tự tạo thẻ kết quả. Drive là bản sao lưu, không phải nguồn dữ liệu chính.

Hồ sơ ID cá nhân có thể dùng ngoại tuyến nhưng chỉ nằm trên thiết bị. ID local không phải xác thực an toàn, không cấp quyền Firebase và không thay thế đăng nhập Google.

## 2. Xác thực, OAuth và phân quyền

### Firebase Authentication

- Ứng dụng dùng `GoogleAuthProvider` và `signInWithPopup`; Firebase UID là định danh cho danh bạ, nhóm và chat.
- Anonymous Auth không được cung cấp như một luồng đăng nhập cộng đồng. `firestore.rules` từ chối provider `anonymous`; service đăng nhập còn xác minh user có Google provider.
- Module workspace sản xuất yêu cầu Firebase UID đã xác thực. ID hồ sơ local không cấp quyền đọc/ghi Firestore.
- Firebase Web config lấy từ `.env.local` theo tên trong `.env.example` (`NEXT_PUBLIC_FIREBASE_*`). Các biến `NEXT_PUBLIC_` được đưa vào client bundle; chúng không được chứa OAuth client secret hay access token.
- OAuth access token được giữ trong bộ nhớ. Sau reload hoặc khi token hết hạn, người dùng cần kết nối Google lại để tiếp tục đồng bộ Drive.

### Google Drive scope tối thiểu

Scope duy nhất do mã nguồn yêu cầu:

```text
https://www.googleapis.com/auth/drive.appdata
```

Scope này cho phép ứng dụng quản lý dữ liệu trong `appDataFolder` ẩn, riêng cho ứng dụng; không cấp quyền đọc danh sách/tệp Drive thông thường của người dùng. Backup được serialize thành JSON, nén Gzip và tạo/cập nhật thành `Q-Dcom_Backup.json.gz`. Mã backup chỉ tìm trong `spaces=appDataFolder` và giới hạn truy vấn vào parent `appDataFolder`.

Không thêm các scope rộng như `drive`, `drive.readonly` hoặc `drive.metadata.readonly`. Vì scope `drive.appdata` không cho phép đọc quota tổng tài khoản, giao diện chỉ hiển thị trạng thái backup, không hiển thị thanh quota toàn Drive.

### Cấu hình Firebase / Google Cloud

1. Trong Firebase Console, bật Google tại **Authentication → Sign-in method** và thêm domain ứng dụng (localhost và domain triển khai) vào **Authorized domains**.
2. Trong Google Cloud project gắn với Firebase, bật **Google Drive API**.
3. Cấu hình OAuth consent screen, thông tin ứng dụng và chỉ khai báo scope `https://www.googleapis.com/auth/drive.appdata`.
4. Nếu consent screen ở chế độ **Testing**, thêm các tài khoản thử nghiệm vào **Test users**. Khi phát hành rộng rãi, hoàn tất yêu cầu xác minh scope của Google nếu được yêu cầu.
5. Nếu dùng OAuth client cấu hình thủ công, kiểm tra authorized domain/origin và redirect handler Firebase `https://<auth-domain>/__/auth/handler`. Không đưa client secret vào repository.
6. Cấp các biến `NEXT_PUBLIC_FIREBASE_*` cho môi trường local/Vercel, sau đó build lại.
7. Khi đã thay đổi rules, deploy đúng Firebase project:

   ```bash
   firebase use <firebase-project-id>
   firebase deploy --only firestore:rules
   ```

   `firebase.json` ánh xạ rules từ `firestore.rules`. Việc build/push web không tự triển khai Firestore rules.
   Rules hiện tại nằm trong worktree; đã kiểm tra bằng Firebase Emulator nhưng chưa deploy lên production.

### Mô hình Firestore

| Đường dẫn | Dữ liệu | Quyền chính |
|---|---|---|
| `users/{uid}` | `memberId`, `fullName` | Tài khoản đã xác thực đọc; chỉ UID chính chủ tạo/sửa/xóa hồ sơ của mình |
| `groups/{groupId}` | `name`, `ownerId`, `memberIds` | Người dùng thật đọc/tạo nhóm; chỉ `ownerId` thay đổi thành viên, đồng bộ với participant của chat |
| `groups/{groupId}/joinRequests/{uid}` | `userId`, `status`, `requestedAt` | Người dùng gửi/xem yêu cầu của mình; owner xem, duyệt hoặc từ chối; người gửi có thể gửi lại yêu cầu đã bị từ chối |
| `chats/{chatId}` | `chatType`, `participantIds`, `groupId`, `name`, `createdAt` | Chỉ participant đọc; tạo chat riêng với hồ sơ hợp lệ hoặc tạo đồng bộ cùng group; owner quản lý participant group |
| `chats/{chatId}/messages/{messageId}` | `senderId`, `text`, `kind`, `createdAt` | Chỉ participant đọc/gửi; sender phải trùng UID; tối đa 4.000 ký tự; không sửa/xóa |
| `productionGroups/{groupId}` | tên workspace, `ownerId`, `memberIds`, `managerIds`, chế độ duyệt và tỷ giá ví | Chỉ thành viên đọc; owner quản lý roster/vai trò/tỷ giá; manager cấu hình danh mục và chế độ duyệt |
| `productionGroups/{groupId}/joinRequests/{uid}` | user, tên hiển thị, trạng thái yêu cầu, thời điểm | Người gửi xem/gửi lại yêu cầu của mình; owner duyệt/từ chối và việc thêm thành viên được xác nhận cùng transaction |
| `productionGroups/{groupId}/orders/{orderId}` | mã đơn, PO, màu, sản phẩm, trạng thái hoạt động | Thành viên workspace đọc; owner/manager thêm, sửa, xóa |
| `productionGroups/{groupId}/stages/{stageId}` | đơn hàng, công đoạn, chuyền, đơn giá VND, trạng thái | Thành viên workspace đọc; owner/manager cấu hình; stage phải trỏ đơn hàng cùng workspace |
| `productionGroups/{groupId}/customFields/{fieldId}` | nhãn, kiểu dữ liệu, đơn vị, bắt buộc | Thành viên workspace đọc; owner/manager định nghĩa trường riêng của nhóm |
| `productionGroups/{groupId}/entries/{entryId}` | worker, snapshot đơn hàng/công đoạn/giá, quantity, amount, trạng thái duyệt | Worker chỉ đọc lượt của mình; manager/owner đọc và duyệt trong nhóm; mọi entry xác minh `groupId`, stage/order và phép nhân số tiền |
| Mọi collection/path khác | Không dùng | Từ chối read/write |

Rule helper `isRealUser()` yêu cầu có `request.auth` và chặn `firebase.sign_in_provider == 'anonymous'`. `isChatParticipant()` xác minh UID hiện tại nằm trong `participantIds`. Rules giới hạn schema và phối hợp cập nhật group/chat/request trong cùng transaction. Không mở quyền chung cho toàn bộ tài khoản đã đăng nhập trên các tin nhắn riêng tư.

### Sơ đồ quyền

```text
Google Auth đã xác thực
  ├── users: đọc danh bạ công khai tối thiểu; tự sửa hồ sơ UID của mình
  ├── groups: đọc danh sách; tạo nhóm với chính mình là owner/member đầu tiên
  │     └── joinRequests: requester gửi; owner duyệt/từ chối
  └── chats
        ├── chat riêng: chỉ hai UID participant
        ├── chat nhóm: participantIds khớp memberIds của group
        └── messages: chỉ participant; senderId phải là request.auth.uid

Anonymous / chưa đăng nhập / path khác -> deny

productionGroups/{groupId}
  ├── owner: quản lý thành viên, phân quyền manager, cấu hình, đơn giá và duyệt
  ├── manager: cấu hình danh mục/giá và duyệt entry, không quản lý roster
  └── worker: đọc danh mục, gửi entry và chỉ đọc kho cá nhân
        └── entry: amountVnd == quantity × unitPriceVnd; giá phải khớp stage cùng tenant
```

Các workspace có thể đặt `exchangeRateVndPerUsd`, `goldPriceVndPerChi` và `goldType`. Đây là tỷ giá tham chiếu cố định do owner quản lý, không phải báo giá trực tiếp; các mức quy đổi ví chỉ thay đổi khi owner sửa cấu hình. `localProduction` trong Dexie lưu riêng dữ liệu fallback theo UID, không được xem là dữ liệu đã đồng bộ hoặc dùng để cấp quyền cloud.

## 3. Cấu trúc thư mục và mã nguồn

```text
app/
  page.tsx                         Route chính, kết xuất QDcomApp
  layout.tsx                       Metadata, viewport, import global CSS
  globals.css                      Giao diện dashboard, responsive và community chat
  privacy/page.tsx                 Chính sách quyền riêng tư đầy đủ

components/
  qdcom-app.tsx                    Điều phối đăng nhập, kho, bot, cộng đồng và cài đặt
  layout/                          Sidebar nhóm tính năng và hiệu ứng chuyển trang
  production/                      Workspace sản xuất, form, ví, pipeline và console quản lý
  community-chat.tsx               UI chat; tìm user/QR, nhóm, moderation và local @q
  google-drive-login-button.tsx    Google popup và trả session cho app
  qr-camera-scanner.tsx            Quét mã QR
  background-video.tsx             Video/nền dashboard
  products/                        ProductCard, ProductImage
  search/                          SearchBar

lib/
  firebase.ts                      Firebase singleton, Auth, Firestore, Google scope
  db/qdcomDB.ts                    Dexie schema: kho, bot, members, custom fields, sản lượng và production fallback cục bộ
  bot/qBotParser.ts                Parser truy vấn sản phẩm local
  bot/vocabulary.ts                Từ vựng và câu trả lời mặc định
  services/productService.ts       CRUD sản phẩm trong IndexedDB
  services/gatekeeperService.ts    Profiles, groups, requests, chats, messages
  services/productionService.ts    Workspace sản xuất, danh mục, custom fields và entry workflow
  sync/qdcomSync.ts                Schema/validate/import/export backup v3, local production và QR
  sync/googleDriveBackup.ts        Gzip, Drive files API và appDataFolder

data/mockProducts.ts               Dữ liệu khởi tạo cục bộ
types/product.ts                   Kiểu dữ liệu nghiệp vụ Product
public/manifest.json                PWA manifest
public/sw.js                        Cache app shell/tài nguyên cùng origin
firestore.rules                     Security boundary Firestore
firebase.json                       Cấu hình Firebase CLI, đường dẫn rules
.env.example                        Tên biến Firebase client config
README.md                           Setup, lệnh chạy, lưu trữ và module
AUTH_REGISTER_GUIDE.md              Luồng auth, OAuth và triển khai
File.md                             Nhật ký tiến độ ngắn theo phiên
SESSION_LOG.md                      Lịch sử và bàn giao các phiên phát triển
SO_DO_CAU_TRUC_TONG_QUAT.md         Tài liệu kiến trúc/handoff tổng hợp này
```

### Luồng chat cộng đồng

1. `community-chat.tsx` đăng ký listener danh sách chats theo `participantIds array-contains uid`, danh sách groups, messages của phòng đang chọn và join requests cho các group do user sở hữu.
2. `gatekeeperService.ts` thực hiện tìm hồ sơ, tạo chat riêng, tạo group + chat trong transaction, gửi yêu cầu vào nhóm, duyệt/từ chối, gỡ thành viên và gửi tin nhắn.
3. Query danh sách chat phải được Firestore chứng minh an toàn bằng điều kiện `request.auth.uid in resource.data.participantIds`. Không dùng helper đọc lại cùng document bằng `get()` cho phép đọc collection chat, vì query không chứng minh được điều kiện membership và sẽ trả `Missing or insufficient permissions`. Với subcollection messages, rules dùng `isChatParticipant(chatId)` để xác minh document cha.
4. Khi nội dung bắt đầu bằng `@q`, client gắn `kind: "q-query"` và mỗi client gọi parser với dữ liệu sản phẩm IndexedDB của chính nó. Firestore chỉ nhận text query, không nhận card hoặc product record.
5. Trên mobile, danh sách và phòng chat là hai trạng thái chuyển đổi; nút quay lại đưa người dùng về danh sách. Trên desktop hiển thị sidebar và panel hội thoại song song.

Khi gặp `Missing or insufficient permissions`, kiểm tra theo thứ tự: user có đăng nhập Google/Firebase không; Firebase UID có profile nếu thao tác cần profile không; đúng chat/group và participant/owner không; query có lọc theo participant không; rules local có được deploy vào đúng Firebase project chưa. Lỗi permission trên Vercel không thể được sửa chỉ bằng `npm run build`; cần deploy `firestore.rules`.

## 4. Lịch sử phát triển (Evolution Log)

- **2026-10-25 — Workspace sản lượng đa tenant, thu nhập và phân quyền trưởng nhóm:**
    - Tách dữ liệu sản xuất khỏi nhóm chat thành `productionGroups/{groupId}`; thêm yêu cầu tham gia, đơn hàng, công đoạn/đơn giá, custom fields và entries có `groupId`.
    - Bổ sung RBAC tại `firestore.rules`: owner quản lý thành viên và cấp manager; manager cấu hình bảng giá/danh mục và duyệt; worker chỉ truy vấn sản lượng của chính mình. Rules cũng xác minh tenant, snapshot stage/order, ngày ISO và `amountVnd == quantity × unitPriceVnd`.
    - Thêm service Firestore production, luồng tạo/tham gia workspace, nộp/đính chính sản lượng, duyệt đơn/lô, bật/tắt kiểm duyệt và tính tiền bằng số nguyên VND. Không migrate tự động dữ liệu Dexie cũ vì chưa có định danh tenant/ủy quyền an toàn cho dữ liệu đó.
    - Tách UI thành form worker có QR và custom inputs, ví cá nhân có lọc ngày/tuần/tháng/quý/năm và reminder local, pipeline có thể đổi đơn hàng theo dõi, cùng owner/manager console và tổng hợp xưởng. Scheduler được mount ở app shell để tiếp tục nhắc khi rời tab; thu nhập cá nhân chỉ nhận entry của UID hiện tại.
    - Cập nhật README/chính sách riêng tư để phân biệt dữ liệu kho local-first với ngoại lệ sản lượng đồng bộ Firestore; bổ sung summary xưởng và tạo/tham gia thêm workspace từ giao diện hiện có.
    - Xác nhận: `npm run lint`, `npx tsc --noEmit --pretty false`, `npm run build`, `git diff --check`; Firestore Emulator khởi động và nạp `firestore.rules` thành công. Chưa deploy rules production.
    - **Bổ sung cùng ngày — tương phản, quy đổi và fallback quyền:**
      - Tăng tương phản tiêu đề/nội dung của module production; input/select có viền 2px rõ ràng.
      - Ví hiển thị VNĐ cùng USD và chỉ vàng. Tỷ giá VND/USD và giá VND/chỉ vàng do trưởng nhóm cấu hình trong workspace, giữ nguyên cho đến khi được cập nhật thủ công; không tự lấy tỷ giá thị trường/API. Khi chưa cấu hình giá vàng, ví hiển thị trạng thái chưa cấu hình thay vì tự bịa giá.
      - Nếu Firestore trả `permission-denied` khi tạo workspace hoặc gửi sản lượng, lưu dữ liệu Dexie riêng theo UID trên thiết bị. Workspace/phiếu cục bộ được đánh dấu rõ là chưa chia sẻ/chưa đồng bộ; không biến thành thành viên Firestore hoặc báo đã nộp thành công trên cloud.
      - Nâng backup JSON lên version 3 để sao lưu/khôi phục các bản ghi production cục bộ, giới hạn export theo Firebase UID hiện tại và kiểm tra schema trước khi import; backup v1/v2 cũ vẫn được chấp nhận.
      - Mở rộng `firestore.rules` để cho phép các trường tỷ giá tùy chọn, được xác thực kiểu/giới hạn và chỉ owner cập nhật qua service. Giữ nguyên `productionGroups/{groupId}` cùng kiểm tra member/owner/manager và deny-all fallback; không thay bằng rule cho phép mọi tài khoản đăng nhập đọc/ghi.
      - Xác nhận bổ sung: `npm run lint`, `npx tsc --noEmit --pretty false`, `npm run build`, `git diff --check` đều đạt; Firestore Emulator nạp rules thành công. Chưa deploy rules production.

- **2026-09-30 — Khởi tạo lại dự án:** chuyển repo từ trang đơn HTML/JavaScript thành ứng dụng Next.js App Router, TypeScript và Tailwind; tạo dashboard quản lý kho, CRUD, báo cáo, parser `@q` và dữ liệu demo. PocketBase/cloud service từng được thử nghiệm ban đầu nhưng sau đó bị loại khỏi luồng nghiệp vụ.
- **2026-10-01 — Tách module và nâng cấp parser:** chuẩn hóa truy vấn tiếng Việt không dấu, tìm ID/tên/từ khóa và intent số lượng/vị trí; tách component sản phẩm, search, config và service.
- **2026-10-06 — Local-first/PWA/QR:** chuyển dữ liệu nghiệp vụ sang Dexie IndexedDB, thêm backup JSON và QR, offline app shell, service worker, scanner camera. Google OAuth và Drive backup được tích hợp trong các phiên tiếp theo; IndexedDB giữ vai trò nguồn chính.
- **2026-10-08 — Hồ sơ ID cục bộ và UI:** bổ sung đăng ký/đăng nhập ID trên cùng thiết bị, avatar, cảnh báo giới hạn an toàn của local profile, glassmorphism và tách nền video login/dashboard.
- **2026-10-10 đến 2026-10-15 — Firebase Gatekeeper và cộng đồng:** xác định Firebase Auth là hộ chiếu Google; bỏ Anonymous login; Firestore giới hạn hồ sơ tối thiểu, nhóm, yêu cầu tham gia, chat và tin nhắn; tạo nhóm/chat, tìm user bằng ID/QR, duyệt thành viên và @q local. Thêm rules và firebase.json. Drive backup chuyển sang JSON/Gzip trong `appDataFolder`, token chỉ giữ trong bộ nhớ.
- **2026-10-13 — Dashboard navigation:** gom Sidebar theo nhóm chức năng, bổ sung trang giới thiệu/chính sách, điều hướng mobile dạng thanh cuộn và hiệu ứng glassmorphism.
- **2026-10-15 — Đồng bộ main/Vercel:** merge architecture vào `main`, push lên `origin/main`; Vercel triển khai commit `5401afb` thành công.
- **2026-10-17 — Least-privilege OAuth Drive:** thu scope về duy nhất `drive.appdata`; bỏ `drive.metadata.readonly` và API quota tổng vì scope đó vượt phạm vi appDataFolder. Giữ backup Gzip riêng.
- **2026-10-21 — Chat permissions/UI và tài liệu handoff:** Emulator cho thấy rule đọc chat dùng `get()` parent thay vì `resource.data` làm query collection participant không được chứng minh, gây `Missing or insufficient permissions`. Sửa điều kiện read chat theo `resource.data.participantIds`; giữ helper kiểm tra parent cho messages. Làm cho yêu cầu đang pending idempotent, cho phép requester gửi lại yêu cầu đã bị từ chối; thiết kế lại chat responsive/mobile, avatar, bong bóng tin nhắn, panel quản trị và thông báo lỗi deploy rules. Ghi tài liệu tổng hợp này.

Chi tiết từng phiên cũ nằm trong `SESSION_LOG.md`; không xóa hoặc viết lại lịch sử cũ khi thêm entry mới.

## 5. Nguyên tắc cho AI Agent tiếp theo

1. **Local-first:** dữ liệu kho và bot phải tiếp tục nằm trong IndexedDB. Không ghi sản phẩm, tồn kho, vị trí, ảnh hoặc kết quả tra cứu `@q` vào Firestore; workspace sản lượng/thu nhập là ngoại lệ đồng bộ có tenant scope.
2. **Firestore allowlist:** cho phép schema cộng đồng đã liệt kê và `productionGroups/{groupId}` cùng các subcollections được mô tả. Mọi path khác phải tiếp tục deny.
3. **Least privilege OAuth:** yêu cầu duy nhất scope Drive `https://www.googleapis.com/auth/drive.appdata`. Không thêm scope rộng hoặc endpoint vượt appDataFolder mà chưa có yêu cầu và giải thích rõ.
4. **Auth không đồng nghĩa local profile:** ID local là tiện ích ngoại tuyến, không được dùng để cấp quyền Firebase. Không khôi phục anonymous login.
5. **Rules và service phải thay đổi cùng nhau:** trước khi đổi query/write trong `gatekeeperService.ts`, xác minh Firestore query có thể được chứng minh an toàn bởi rules. Dùng transaction và `getAfter` khi các document group/chat phải đồng bộ.
6. **Không nới quyền để che lỗi:** tìm nguyên nhân giữa auth state, UID, document schema, query constraints và rules deploy. Không dùng `allow read, write: if request.auth != null` cho toàn bộ database hoặc collection riêng tư.
7. **Deploy rules là thao tác riêng:** `firebase.json` chỉ trỏ tới file; deploy cần project ID đúng. Không tự deploy production nếu người dùng chưa yêu cầu/xác nhận.
8. **UI dùng Next.js hiện hành:** `QDcomApp`/community là Client Components vì dùng hooks, event handlers và browser APIs. Đọc guide tương ứng trong `node_modules/next/dist/docs/` trước khi thay đổi convention của Next.js.
9. **Bảo toàn worktree:** kiểm tra `git status` trước/sau; không đưa các file người dùng chưa track hoặc thay đổi không liên quan vào commit.
10. **Kiểm tra thay đổi:** chạy `npm run lint`, `npx tsc --noEmit --pretty false`, `npm run build`, `git diff --check`; khi sửa rules, xác thực bằng Firestore Emulator và kiểm tra đúng Firebase project trước deploy.
11. **Tài liệu:** đồng bộ README/hướng dẫn auth/chính sách khi thay đổi hành vi lưu trữ hoặc OAuth; cập nhật mục mới vào `File.md` hoặc `SESSION_LOG.md` nhưng giữ lại nội dung lịch sử.

## 6. Lệnh vận hành thường dùng

```bash
npm install
npm run dev
npm run lint
npx tsc --noEmit --pretty false
npm run build
firebase emulators:exec --only firestore --project demo-qdcom --non-interactive "echo firestore-rules-loaded"
firebase deploy --only firestore:rules
```

Lệnh deploy cuối cần chọn/đặt đúng project Firebase trước khi chạy. Push nhánh production lên GitHub có thể kích hoạt Vercel deployment nếu repository đã liên kết và cấu hình `main` là production branch; điều đó không tự deploy Firestore rules.

- **2026-10-23 — Nâng cấp Giao diện Menu Trượt 3D Glassmorphism & Trường tùy chỉnh Đa ngành:**
    - Cải tiến sidebar menu trái chia nhóm tính năng, hiệu ứng slide-in trượt ngang mượt mà.
    - Chuẩn hóa UI theo phong cách thẻ khối nổi Neumorphic / Glassmorphic 3D.
    - Bổ sung trình quản lý Custom Fields cho phép người dùng tự định nghĩa các trường dữ liệu theo ngành nghề; backup JSON/Drive lưu cả cấu hình và lịch sử sản lượng, vẫn đọc được backup phiên bản cũ.
    - Phân chia mã nguồn thành các module độc lập kèm comment giải thích chức năng và dữ liệu chính.

- **2026-10-23 — Dashboard sản lượng Dark Glassmorphism và sơ đồ chuyền may 3D:**
    - Nâng cấp `components/production/industry-custom-fields.tsx` và `app/globals.css` theo giao diện dark glass: nền card/input trong suốt `rgba(15, 23, 42, 0.65)`, blur 16px, viền sáng và bóng đổ nổi; bổ sung màu chữ, trạng thái focus và lựa chọn ngành phù hợp nền tối.
    - Thêm dashboard thống kê sản lượng trong ngày theo ngành nghề đang chọn. Tổng sản lượng lấy từ các bản ghi Dexie có ngày hiện tại; người dùng chỉnh được định mức ngày và vòng tiến độ tròn hiển thị phần trăm hoàn thành, giới hạn tối đa 100%.
    - Bổ sung sơ đồ luồng năm công đoạn Cắt → May vành → May thân → KCS → Đóng gói, gồm thẻ công đoạn, icon, số lượng đã ghi nhận trong ngày, đường nối/mũi tên neon và particle pulse.
    - Cho phép nhập số lượng đang chờ ở từng công đoạn. Số lượng từ 50 sản phẩm trở lên đánh dấu nút thắt bằng nhãn cảnh báo và hiệu ứng glow đỏ; trạng thái hàng chờ lưu cục bộ trong `localStorage`, phân tách theo ngành nghề, không ghi sang Firestore.
    - Giữ nguyên các luồng đã có: field tùy chỉnh và bản ghi sản lượng tiếp tục lưu trong Dexie; snapshot field đi theo từng bản ghi để lịch sử vẫn hiển thị đúng khi định nghĩa field thay đổi. Sơ đồ cuộn ngang ở màn hình nhỏ và tắt animation khi hệ điều hành bật `prefers-reduced-motion`.
    - Kiểm tra sau thay đổi: `npm run lint`, `npm run build` và `git diff --check` đều thành công.
