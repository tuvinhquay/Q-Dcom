import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Boxes, Cloud, LockKeyhole, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Chính sách bảo mật | Q-Dcom",
  description: "Chính sách bảo mật và quyền riêng tư của ứng dụng Q-Dcom.",
};

const policySections = [
  {
    number: "00",
    title: "Giới thiệu dự án Q-Dcom",
    icon: Boxes,
    content:
      "Q-Dcom là giải pháp hỗ trợ quản lý kho hàng, theo dõi tồn kho và vị trí lưu trữ mẫu mã dành cho cá nhân và chủ hộ kinh doanh nhỏ.",
  },
  {
    number: "01",
    title: "Thu thập thông tin",
    icon: Cloud,
    content:
      "Firebase Auth xác thực tài khoản Google. Firestore lưu mã thành viên và họ tên công khai, nhóm/phòng chat, cùng dữ liệu workspace sản xuất (thành viên, đơn hàng, công đoạn, đơn giá và sản lượng) trong phạm vi nhóm được cấp quyền; anonymous login không được chấp nhận.",
  },
  {
    number: "02",
    title: "Sử dụng dữ liệu",
    icon: Boxes,
    content:
      "Kho hàng, tồn kho, vị trí, từ vựng @q và kết quả tra cứu được lưu trong IndexedDB trên thiết bị. Dữ liệu sản lượng/thu nhập được đồng bộ trong workspace Firestore riêng theo groupId để các thành viên được duyệt cùng sử dụng; backup JSON/Gzip trên Google Drive dùng appDataFolder và quyền drive.appdata. Chat được chia sẻ với thành viên phòng.",
  },
  {
    number: "03",
    title: "An toàn bảo mật",
    icon: LockKeyhole,
    content:
      "Quy tắc Firestore cô lập workspace sản xuất theo groupId: công nhân chỉ đọc lượt của mình, quản lý được cấu hình và duyệt trong nhóm, còn chủ nhóm quản lý thành viên/vai trò. Kết quả @q được dựng cục bộ; dữ liệu sản phẩm và tồn kho không gửi lên Firestore.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <div className="privacy-shell">
        <header className="privacy-header">
          <Link className="privacy-brand" href="/" aria-label="Q-Dcom - về ứng dụng">
            <span className="privacy-brand-mark"><Boxes aria-hidden="true" /></span>
            <span className="privacy-brand-name">Q-<strong>Dcom</strong></span>
          </Link>
          <span className="privacy-secure"><ShieldCheck aria-hidden="true" /> QUYỀN RIÊNG TƯ CỦA BẠN</span>
        </header>

        <article className="privacy-card">
          <div className="privacy-eyebrow">Q-DCOM · MINH BẠCH VÀ AN TOÀN</div>
          <h1>CHÍNH SÁCH BẢO MẬT - APP Q-DCOM</h1>
          <p className="privacy-intro">
            Chúng tôi tôn trọng quyền riêng tư và quyền kiểm soát dữ liệu của bạn.
            Chính sách dưới đây mô tả cách Q-Dcom dùng Firebase, IndexedDB và Google Drive để hỗ trợ bạn.
          </p>

          <div className="privacy-sections">
            {policySections.map(({ number, title, icon: Icon, content }) => (
              <section className="privacy-section" key={number}>
                <div className="privacy-section-icon"><Icon aria-hidden="true" /></div>
                <div className="privacy-section-copy">
                  <div className="privacy-section-heading">
                    <span>{number}</span>
                    <h2>{title}</h2>
                  </div>
                  <p>{content}</p>
                </div>
              </section>
            ))}
            <section className="privacy-section">
              <div className="privacy-section-icon"><ShieldCheck aria-hidden="true" /></div>
              <div className="privacy-section-copy">
                <div className="privacy-section-heading">
                  <span>04</span>
                  <h2>Tuân thủ chính sách người dùng của Google</h2>
                </div>
                <p>
                  Việc Q-Dcom sử dụng và chuyển giao thông tin nhận được từ các API của Google
                  cho bất kỳ ứng dụng nào khác sẽ tuân thủ Chính sách dữ liệu người dùng dịch vụ
                  Google API, bao gồm các yêu cầu về Sử dụng có giới hạn (Limited Use).
                </p>
                <p>
                  App chỉ thao tác trên thư mục và tệp dữ liệu sao lưu kho do chính app tạo ra;
                  tuyệt đối không đọc hoặc truy cập vào bất kỳ tệp tin cá nhân nào khác trên
                  Google Drive của người dùng.
                </p>
              </div>
            </section>
          </div>

          <Link className="privacy-back-link" href="/">
            <ArrowLeft aria-hidden="true" />
            Quay lại ứng dụng
          </Link>
        </article>

        <footer className="privacy-footer">Q-DCOM · CỘNG ĐỒNG KẾT NỐI</footer>
      </div>
    </main>
  );
}
