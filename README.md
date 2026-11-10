# 📈 VIETSTOCK FINANCE CLONE & DATA ENGINE

Dự án tái tạo toàn diện hệ thống thông tin tài chính - chứng khoán **Vietstock Finance (`finance.vietstock.vn`)**, bao gồm bộ thu thập dữ liệu tự động (Crawler), cơ sở dữ liệu tài chính chuẩn mực (SQLite) và Web App tương tác với biểu đồ kỹ thuật TradingView.

---

## 🏛️ Kiến Trúc Hệ Thống

```
vietstock-clone/
├── database/
│   ├── schema.sql           # Cấu trúc CSDL chuẩn hóa (Doanh nghiệp, Giá OHLCV, BCTC, Cổ đông, Cổ tức)
│   ├── db.py                # Module kết nối và khởi tạo CSDL
│   └── vietstock.db         # Tệp cơ sở dữ liệu SQLite cục bộ
│
├── crawler/
│   ├── scraper.py           # Engine bóc tách toàn bộ dữ liệu tài chính công khai
│   └── fetch_all_symbols.py # Điều phối cào danh sách hàng loạt toàn bộ 1.600 mã chứng khoán
│
├── backend/
│   └── server.py            # Web & REST API server (Thuần Python, không cần cài thư viện rườm rà)
│
└── frontend/
    ├── index.html           # Giao diện clone chuẩn phong cách Vietstock Finance
    └── app.js               # Điều khiển biểu đồ nến TradingView và bảng động BCTC
```

---

## 🚀 Hướng Dẫn Vận Hành

### Bước 1: Thu thập Dữ liệu (Cào dữ liệu về máy)

#### Cào thử nghiệm các mã đầu tàu (VNM, FPT, HPG, VCB):
```bash
python3 /home/jay/Desktop/vietstock-clone/crawler/scraper.py
```

#### Cào toàn bộ 1.600 mã trên toàn sàn (HOSE, HNX, UPCoM):
```bash
python3 /home/jay/Desktop/vietstock-clone/crawler/fetch_all_symbols.py
```
*(Hệ thống đã tích hợp sẵn delay 0.5s giữa các mã để bảo đảm an toàn, không bị nghẽn mạng).*

---

### Bước 2: Khởi chạy Web Server & Giao diện

Chạy lệnh sau trên terminal:
```bash
python3 /home/jay/Desktop/vietstock-clone/backend/server.py 8080
```

Mở trình duyệt truy cập:
👉 **`http://localhost:8080`**

---

## 📊 Những Tính Năng Đã Triển Khai

1. **Giao diện chuẩn phong cách Vietstock**:
   - Header nhận diện thương hiệu Vietstock Finance kèm thanh Ticker chỉ số thị trường (VN-Index, HNX-Index, VN30).
   - Thanh tìm kiếm thông minh tự động gợi ý mã (Live Search Autocomplete).
2. **Biểu đồ Kỹ thuật TradingView**:
   - Tích hợp động cơ nến Nhật `Lightweight Charts` cao cấp của TradingView.
   - Thể hiện đầy đủ nến xanh/đỏ và cột khối lượng giao dịch (Volume).
3. **Báo cáo Tài chính Đa chiều**:
   - Bảng chuyển đổi 4 phân hệ BCTC: **Kết quả kinh doanh (IS)**, **Cân đối kế toán (BS)**, **Lưu chuyển tiền tệ (CF)**, **Chỉ số tài chính (RATIO)**.
   - Hiển thị theo từng Quý / Năm với định dạng tiền tệ chuyên nghiệp.
4. **Cơ cấu Sở hữu & Sự kiện**:
   - Danh sách cổ đông lớn kèm tỷ lệ sở hữu.
   - Lịch sử chia cổ tức tiền mặt / cổ phiếu.
5. **Hồ sơ Doanh nghiệp**:
   - Giới thiệu lịch sử hình thành, ngành nghề, sàn niêm yết, vốn điều lệ và khối lượng lưu hành.
