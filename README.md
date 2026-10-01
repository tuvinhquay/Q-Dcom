# Q-Dcom

Ứng dụng nội bộ quản lý mẫu hàng, tồn kho và vị trí lưu trữ. Q-Dcom không có luồng mua hàng, giỏ hàng, đặt hàng hay thanh toán.

## Chạy local

Yêu cầu Node.js 20.9 trở lên.

```bash
npm install
npm run dev
```

Mở http://localhost:3000. Kiểm tra bằng `npm run lint`, `npx tsc --noEmit` và `npm run build`; chạy bản build với `npm start`.

## Cấu hình môi trường

Sao chép `.env.example` thành `.env.local`, rồi điều chỉnh trước khi chạy hoặc deploy:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_USE_LOCAL_SERVER=false
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
NEXT_PUBLIC_POCKETBASE_COLLECTION=products
```

Các biến `NEXT_PUBLIC_*` có thể được đọc ở trình duyệt và không được chứa secret, admin token hay thông tin xác thực. Cấu hình runtime tập trung tại `config/app.config.ts`. Trên Vercel, khai báo cùng biến trong Project Settings → Environment Variables rồi redeploy; không cần commit `.env.local`.

## Chạy dữ liệu từ xa

Mặc định Q-Dcom dùng dữ liệu ban đầu trong `data/mockProducts.ts` và lưu thay đổi vào localStorage. Để dùng PocketBase, đặt `NEXT_PUBLIC_USE_LOCAL_SERVER=true`, cấu hình `NEXT_PUBLIC_POCKETBASE_URL` và bật chế độ máy chủ trong Cài đặt. URL máy chủ có thể là địa chỉ LAN hoặc hostname HTTPS được publish qua Cloudflare Tunnel/reverse proxy.

Tạo collection `products` với các trường ứng dụng: `product_id` (text), `name`, `brand`, `color`, `size` (JSON), `quantity` (number), `image_urls` (JSON), `image_notes`, `description`, `category`, `status`, `location`, `created_by`, `created_at`, `updated_at`, `search_keywords` (JSON). Cấu hình API rules và CORS theo origin của ứng dụng. Dùng quyền collection tối thiểu phù hợp; không nhúng admin credentials vào frontend. Kiểm tra tunnel bằng `lib/services/cloudflareTunnel.ts`; connector này dùng health endpoint PocketBase `/api/health`.

## Cấu trúc module

```text
app/                         App Router, layout và route trang chính
components/
  products/                  ProductCard, ProductImage và trạng thái dùng lại
  search/                    SearchBar dùng lại
  background-video.tsx       Lớp nền video
  qdcom-app.tsx               Điều phối dashboard/chat/cài đặt
config/app.config.ts          Cấu hình ứng dụng và tích hợp tập trung
data/mockProducts.ts          Dữ liệu local khởi tạo
lib/bot/                      Từ điển và parser @q
lib/services/                 Product service và Cloudflare Tunnel probe
public/videos/                Đặt video tùy chọn bg-video.mp4
types/                        Product, Inventory, BotQuery và UserRole
SESSION_LOG.md                Lịch sử và handoff giữa các agent
```

## Luồng ứng dụng

`app/page.tsx` kết xuất `QDcomApp`. Component điều phối state và chọn màn Kho, Tra cứu @q, Tổng quan hoặc Cài đặt. Danh sách kho dùng `SearchBar` và `ProductCard`; thao tác dữ liệu đi qua `productService`, nơi chọn localStorage hoặc PocketBase REST theo cấu hình. Bot chuẩn hóa truy vấn bằng `lib/bot/qBotParser.ts`, dùng `lib/bot/vocabulary.ts` và trả ID sản phẩm để UI hiển thị rich card. Các model mở rộng nằm trong `types/`.

## Video nền

Sao chép MP4 vào `public/videos/bg-video.mp4`. Video là tùy chọn; giao diện vẫn hoạt động khi không có tệp.