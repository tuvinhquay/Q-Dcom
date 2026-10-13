# Nhật ký phát triển Q-Dcom

- Đã cấu hình Firebase Auth bằng các biến `NEXT_PUBLIC_FIREBASE_*` trong `.env.local` và `.env.example`.
- Đăng nhập Google dùng Firebase popup, yêu cầu thêm quyền `drive.appdata`, xác minh hồ sơ Google và chuyển thẳng đến trang kho; đăng nhập khách dùng Firebase Anonymous Auth.
- Dữ liệu sản phẩm, từ vựng Bot và danh sách thành viên được tự động sao lưu thành `Q-Dcom_Backup.json` trong vùng `appDataFolder` riêng tư của người dùng. Thay đổi được gom trong 500 ms; khi đăng xuất, ứng dụng chờ backup cuối cùng hoàn tất.
- Token OAuth chỉ tồn tại trong bộ nhớ; nếu tải lại trang hoặc token hết hạn, hãy kết nối lại Google Drive trong Cài đặt. Nếu backup khi đăng xuất gặp lỗi, ứng dụng giữ trạng thái đăng nhập và hiển thị lỗi.
- Giao diện đăng ký có nền glow/wave chuyển động, placeholder để thay bằng video MP4 xuyên thấu và card kính mờ với nền `rgba(15, 23, 42, 0.55)`, blur `20px`, viền trắng 18%.
- Triển khai thực tế cần bật Google và Anonymous trong Firebase Authentication, thêm domain ứng dụng vào Authorized domains, bật Google Drive API và cấu hình OAuth consent screen cho scope `drive.appdata`.
