# Quy trình đóng góp và merge

`main` là nhánh ổn định. Mỗi thay đổi được thực hiện trên một nhánh riêng và đưa vào `main` bằng pull request; không phát triển trực tiếp trên `main`.

## Tạo nhánh

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/ten-thay-doi
```

Đặt tên nhánh theo loại công việc, ví dụ `feat/...`, `fix/...`, `docs/...` hoặc `chore/...`. Mỗi nhánh chỉ nên chứa một thay đổi có thể review độc lập.

## Cập nhật nhánh khi `main` có commit mới

Trước tiên lưu hoặc commit công việc đang làm. Sau đó rebase nhánh cá nhân lên `main` mới nhất:

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch feat/ten-thay-doi
git rebase main
```

Nếu có xung đột, mở từng tệp được Git nêu ra, giữ phần nội dung đúng của cả hai thay đổi, rồi đánh dấu đã xử lý và tiếp tục:

```bash
git add <tep-da-giai-quyet>
git rebase --continue
```

Lặp lại cho đến khi rebase hoàn tất. Nếu cần hủy lần rebase đang diễn ra, dùng `git rebase --abort`. Không dùng `git reset --hard` hoặc force-push lên `main`. Nếu nhánh đã được push trước khi rebase, cập nhật riêng nhánh đó bằng `git push --force-with-lease origin feat/ten-thay-doi`.

## Pull request và merge

1. Chạy các kiểm tra phù hợp với thay đổi, rồi push nhánh lên `origin`.
2. Mở pull request với base là `main`; mô tả mục đích, thay đổi và cách kiểm tra.
3. Chờ review và kiểm tra **Validate** thành công. Workflow này chạy lint, kiểm tra TypeScript và build ứng dụng. Nếu `main` thay đổi, cập nhật nhánh theo hướng dẫn ở trên.
4. Dùng **Squash and merge** để mỗi pull request tạo một commit gọn trên `main`.
5. Xóa nhánh sau khi merge. Cập nhật `main` local trước khi bắt đầu công việc tiếp theo.

## Cài đặt đề xuất trên GitHub

Trong phần cài đặt repository, giới hạn phương thức merge chỉ còn **Squash merging**, bật tự động xóa nhánh sau khi merge, và bảo vệ `main` để yêu cầu pull request cùng status check **Validate** trước khi merge. Chỉ yêu cầu approval nếu có người duy trì khác có thể review; tránh thiết lập bắt buộc approval khiến chủ repo làm một mình không thể merge.

Các thiết lập này cần quyền quản trị repository và phải được bật trên GitHub; tài liệu này không tự thay đổi cài đặt từ xa.
