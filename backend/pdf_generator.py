"""
Module sinh tài liệu PDF chuẩn ISO 32000 (PDF-1.4) cho Vietstock Clone.
Không phụ thuộc bất kỳ thư viện bên ngoài nào, sinh trực tiếp byte stream PDF hợp lệ 100%.
Phục vụ tải file và nhúng trình xem In-App PDF Viewer trực tiếp trên trình duyệt.
"""
from pathlib import Path
import os

ROOT_DIR = Path(__file__).resolve().parent.parent
PDF_DIR = ROOT_DIR / "backend" / "static" / "pdf"

def sanitize_pdf_text(text: str) -> str:
    """Loại bỏ ký tự đặc biệt của PDF escape ( và ) """
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

def create_a4_pdf(title: str, doc_no: str, date_str: str, company: str, signer: str, sections: list) -> bytes:
    """
    Tạo một file PDF chuẩn PDF-1.4 kích thước A4 (595 x 842 points).
    Bao gồm Quốc hiệu, Số công văn, Tiêu đề, các Điều khoản và Chữ ký số / Con dấu.
    """
    # Xây dựng các lệnh vẽ PDF stream (PostScript-like)
    stream_lines = []
    
    # 1. Vẽ khung viền trang tài liệu
    stream_lines.append("0.2 0.3 0.5 RG") # Màu viền xanh lam thẫm
    stream_lines.append("1.5 w") # Độ dày viền
    stream_lines.append("30 30 535 782 re S") # Khung chữ nhật bao quanh A4
    
    # Khung chỉ viền mỏng phía trong
    stream_lines.append("0.8 0.85 0.9 RG")
    stream_lines.append("0.5 w")
    stream_lines.append("34 34 527 774 re S")

    # Header dải màu Vietstock / Công Bố Thông Tin
    stream_lines.append("0.08 0.2 0.45 rg") # Nền xanh Vietstock
    stream_lines.append("30 770 535 42 re f")
    
    # Text Header
    stream_lines.append("BT")
    stream_lines.append("/F2 10 Tf") # Helvetica-Bold
    stream_lines.append("1 1 1 rg") # Chữ trắng
    stream_lines.append("45 792 Td")
    stream_lines.append("(VIETSTOCK FINANCE - HE THONG CONG BO THONG TIN CHINH THUC) Tj")
    stream_lines.append("ET")

    stream_lines.append("BT")
    stream_lines.append("/F1 8 Tf") # Helvetica
    stream_lines.append("0.85 0.9 1 rg")
    stream_lines.append("45 778 Td")
    stream_lines.append("(HOSE / HNX / UBCK NHA NUOC - SO GIAO DICH CHUNG KHOAN VIET NAM) Tj")
    stream_lines.append("ET")

    # 2. Quốc hiệu & Đơn vị ban hành
    stream_lines.append("BT")
    stream_lines.append("/F2 10 Tf")
    stream_lines.append("0 0 0 rg")
    stream_lines.append("50 740 Td")
    stream_lines.append(f"({sanitize_pdf_text(company.upper())}) Tj")
    stream_lines.append("ET")

    stream_lines.append("BT")
    stream_lines.append("/F1 9 Tf")
    stream_lines.append("0.3 0.3 0.3 rg")
    stream_lines.append("50 726 Td")
    stream_lines.append(f"(So: {sanitize_pdf_text(doc_no)}) Tj")
    stream_lines.append("ET")

    # Phía phải: Quốc hiệu tiêu ngữ
    stream_lines.append("BT")
    stream_lines.append("/F2 9.5 Tf")
    stream_lines.append("0 0 0 rg")
    stream_lines.append("330 740 Td")
    stream_lines.append("(CONG HOA XA HOI CHU NGHIA VIET NAM) Tj")
    stream_lines.append("ET")

    stream_lines.append("BT")
    stream_lines.append("/F2 8.5 Tf")
    stream_lines.append("0.2 0.2 0.2 rg")
    stream_lines.append("360 726 Td")
    stream_lines.append("(Doc lap - Tu do - Hanh phuc) Tj")
    stream_lines.append("ET")

    # Dòng kẻ ngang phân cách
    stream_lines.append("0.5 0.5 0.5 RG 0.8 w 380 720 m 480 720 l S")
    stream_lines.append("0.7 0.7 0.7 RG 0.5 w 50 705 m 545 705 l S")

    # Ngày tháng ban hành
    stream_lines.append("BT")
    stream_lines.append("/F1 8.5 Tf")
    stream_lines.append("0.3 0.3 0.3 rg")
    stream_lines.append("350 690 Td")
    stream_lines.append(f"(Ngay cong bo: {sanitize_pdf_text(date_str)}) Tj")
    stream_lines.append("ET")

    # 3. Tiêu đề tài liệu chính giữa
    stream_lines.append("BT")
    stream_lines.append("/F2 13 Tf")
    stream_lines.append("0.08 0.2 0.5 rg") # Xanh thẫm
    
    # Chia tiêu đề dài nếu cần
    title_words = title.split()
    line1 = " ".join(title_words[:8])
    line2 = " ".join(title_words[8:]) if len(title_words) > 8 else ""

    stream_lines.append(f"50 660 Td")
    stream_lines.append(f"({sanitize_pdf_text(line1)}) Tj")
    stream_lines.append("ET")

    if line2:
        stream_lines.append("BT")
        stream_lines.append("/F2 12 Tf")
        stream_lines.append("0.08 0.2 0.5 rg")
        stream_lines.append(f"50 642 Td")
        stream_lines.append(f"({sanitize_pdf_text(line2)}) Tj")
        stream_lines.append("ET")

    current_y = 615 if line2 else 630

    # 4. Các điều khoản / Mục nội dung
    for sec_title, sec_body in sections:
        # Mục tiêu đề
        stream_lines.append("BT")
        stream_lines.append("/F2 9.5 Tf")
        stream_lines.append("0.1 0.15 0.2 rg")
        stream_lines.append(f"50 {current_y} Td")
        stream_lines.append(f"({sanitize_pdf_text(sec_title)}) Tj")
        stream_lines.append("ET")
        current_y -= 16

        # Nội dung mục (chia đoạn nhỏ)
        stream_lines.append("BT")
        stream_lines.append("/F1 8.5 Tf")
        stream_lines.append("0.2 0.2 0.2 rg")
        
        # Word wrapping đơn giản
        words = sec_body.split()
        buf = []
        for w in words:
            buf.append(w)
            if len(" ".join(buf)) > 75:
                sub_text = " ".join(buf)
                stream_lines.append(f"60 {current_y} Td")
                stream_lines.append(f"({sanitize_pdf_text(sub_text)}) Tj")
                stream_lines.append("ET")
                current_y -= 13
                buf = []
                stream_lines.append("BT")
                stream_lines.append("/F1 8.5 Tf")
                stream_lines.append("0.2 0.2 0.2 rg")

        if buf:
            sub_text = " ".join(buf)
            stream_lines.append(f"60 {current_y} Td")
            stream_lines.append(f"({sanitize_pdf_text(sub_text)}) Tj")
            stream_lines.append("ET")
            current_y -= 18
        else:
            current_y -= 8

        if current_y < 160:
            break

    # 5. Khối Chữ ký & Con dấu điện tử
    seal_y = max(current_y - 20, 110)
    
    # Hộp con dấu số điện tử UBCK
    stream_lines.append("0.85 0.1 0.1 RG 1 w") # Viền đỏ dấu
    stream_lines.append(f"50 {seal_y - 15} 170 55 re S")
    stream_lines.append("1 0.95 0.95 rg") # Nền hồng nhẹ
    stream_lines.append(f"51 {seal_y - 14} 168 53 re f")
    
    stream_lines.append("BT")
    stream_lines.append("/F2 8 Tf")
    stream_lines.append("0.8 0 0 rg") # Chữ đỏ
    stream_lines.append(f"58 {seal_y + 22} Td")
    stream_lines.append("(CHUNG THUC SO: VIETSTOCK CA) Tj")
    stream_lines.append("ET")

    stream_lines.append("BT")
    stream_lines.append("/F1 7.5 Tf")
    stream_lines.append("0.8 0 0 rg")
    stream_lines.append(f"58 {seal_y + 8} Td")
    stream_lines.append(f"(DA XAC MINH CONG BO THONG TIN) Tj")
    stream_lines.append("ET")

    stream_lines.append("BT")
    stream_lines.append("/F1 7 Tf")
    stream_lines.append("0.5 0.1 0.1 rg")
    stream_lines.append(f"58 {seal_y - 4} Td")
    stream_lines.append(f"(Thoi gian ky: {sanitize_pdf_text(date_str)} 09:15:30) Tj")
    stream_lines.append("ET")

    # Phía phải: Đại diện doanh nghiệp ký tên
    stream_lines.append("BT")
    stream_lines.append("/F2 9.5 Tf")
    stream_lines.append("0 0 0 rg")
    stream_lines.append(f"360 {seal_y + 22} Td")
    stream_lines.append("(TM. HOI DONG QUAN TRI / TONG GIAM DOC) Tj")
    stream_lines.append("ET")

    stream_lines.append("BT")
    stream_lines.append("/F2 9.5 Tf")
    stream_lines.append("0.1 0.2 0.5 rg")
    stream_lines.append(f"380 {seal_y - 10} Td")
    stream_lines.append(f"({sanitize_pdf_text(signer)}) Tj")
    stream_lines.append("ET")

    # 6. Footer tài liệu
    stream_lines.append("0.6 0.6 0.6 RG 0.5 w 30 50 m 565 50 l S")
    stream_lines.append("BT")
    stream_lines.append("/F1 7.5 Tf")
    stream_lines.append("0.4 0.4 0.4 rg")
    stream_lines.append("45 40 Td")
    stream_lines.append("(Tai lieu duoc xuat ban tu dong tu He thong CSDL Vietstock Finance API - Hop chuan Luat Chung Khoan Viet Nam) Tj")
    stream_lines.append("ET")

    content_data = "\n".join(stream_lines).encode("latin1")
    stream_len = len(content_data)

    # Lắp ghép các đối tượng PDF (PDF Objects)
    objects = []
    
    # 1 0 obj: Catalog
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    
    # 2 0 obj: Pages
    objects.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    
    # 3 0 obj: Page
    objects.append(
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>"
    )
    
    # 4 0 obj: Contents Stream
    objects.append(
        f"<< /Length {stream_len} >>\nstream\n".encode("latin1") + content_data + b"\nendstream"
    )
    
    # 5 0 obj: Font F1 (Helvetica)
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    
    # 6 0 obj: Font F2 (Helvetica-Bold)
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")

    # Xuất file PDF hoàn chỉnh với XRef table
    pdf_buf = bytearray()
    pdf_buf.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")

    offsets = []
    for i, obj_content in enumerate(objects):
        offsets.append(len(pdf_buf))
        pdf_buf.extend(f"{i + 1} 0 obj\n".encode("latin1"))
        pdf_buf.extend(obj_content)
        pdf_buf.extend(b"\nendobj\n")

    xref_offset = len(pdf_buf)
    pdf_buf.extend(b"xref\n")
    pdf_buf.extend(f"0 {len(objects) + 1}\n".encode("latin1"))
    pdf_buf.extend(b"0000000000 65535 f \n")
    for off in offsets:
        pdf_buf.extend(f"{off:010d} 00000 n \n".encode("latin1"))

    pdf_buf.extend(b"trailer\n")
    pdf_buf.extend(f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n".encode("latin1"))
    pdf_buf.extend(b"startxref\n")
    pdf_buf.extend(f"{xref_offset}\n".encode("latin1"))
    pdf_buf.extend(b"%%EOF\n")

    return bytes(pdf_buf)

# BỘ DỮ LIỆU TÀI LIỆU CÔNG BỐ THÔNG TIN & SỰ KIỆN CHUẨN
SAMPLE_DISCLOSURES = [
    {
        "id": "HPG_NQ_HDQT_DQ2_2026",
        "symbol": "HPG",
        "company": "CONG TY CO PHAN TAP DOAN HOA PHAT",
        "doc_no": "25/2026/NQ-HPG",
        "date": "25/09/2026",
        "file_name": "HPG_NQ_HDQT_DungQuat2_2026.pdf",
        "file_size": "342 KB",
        "pages": 3,
        "title": "NGHI QUYET HOI DONG QUAN TRI VE BAO LANH TIN DUNG DU AN KLH GANG THEP DUNG QUAT 2",
        "signer": "Tran Dinh Long - Chu tich HDQT",
        "type": "Nghị quyết HĐQT",
        "sections": [
            ("DIEU 1: THONG QUA CHU TRUONG BAO LANH TIN DUNG", "Hoi dong Quan tri thong qua viec Cong ty CP Tap doan Hoa Phat dung toan bo uy tin va nang luc tai chinh bao lanh nghia vu tin dung cho Cong ty CP Thep Hoa Phat Dung Quat tai cac to chuc tin dung quoc te va noi dia voi tong han muc len toi 35,000 ty dong de phuc vu giai ngan phan ky 1 Du an Khu lien hop Gang thep Dung Quat 2."),
            ("DIEU 2: TIEN DO VA NANG LUC SAN XUAT DUNG QUAT 2", "Du an Dung Quat 2 quy mo 5.6 trieu tan thep cuon can nong HRC chat luong cao moi nam, du kien chay thu nghiem thuong mai tu Quy 4/2026 va nang tong cong suat thep tho cua Tap doan len 14 trieu tan/nam, dua Hoa Phat vao Top 30 nha san xuat thep lon nhat the gioi."),
            ("DIEU 3: GIAO QUYEN DIEU HANH THUC HIEN", "Giao Tong Giam doc Cong ty CP Tap doan Hoa Phat va nguoi dai dien theo phap luat chi dao dam phan, ky ket cac hop dong bao lanh, van kien tin dung va chiu trach nhiem cong bo thong tin theo quy dinh cua Uy ban Chung khoan Nha nuoc.")
        ]
    },
    {
        "id": "HPG_BCTC_Q2_2026_SOATXET",
        "symbol": "HPG",
        "company": "CONG TY CO PHAN TAP DOAN HOA PHAT",
        "doc_no": "118/2026/BC-HPG",
        "date": "30/08/2026",
        "file_name": "HPG_BCTC_Q2_2026_SoatXet.pdf",
        "file_size": "1,240 KB",
        "pages": 48,
        "title": "BAO CAO TAI CHINH HOP NHAT SOAT XET BAN NIEN 2026 VA BAO CAO QUAN TRI CONG TY",
        "signer": "Nguyen Viet Thang - Tong Giam doc",
        "type": "BCTC Soát xét",
        "sections": [
            ("MUC 1: KET QUA KINH DOANH HOP NHAT 6 THANG DAU NAM", "Tong doanh thu hop nhat dat 70,400 ty dong, tang 25% so voi cung ky nam truoc. Loi nhuan sau thue hop nhat dat 6,189 ty dong, hoan thanh 62% ke hoach loi nhuan ca nam 2026 do Dai hoi dong co dong thong qua."),
            ("MUC 2: CO CAU SAN PHAM VA THI PHAN", "Thep xay dung va thep cuon can nong HRC dong gop tren 88% tong doanh thu. Hoa Phat tiep tuc duy tri thi phan so 1 Viet Nam voi 38.5% thi phan thep xay dung va cung ung hang trieu tan HRC cho cac nha may ton ma noi dia."),
            ("MUC 3: CO CAU TAI SAN VA NO VAY AN TOAN", "Tong tai san dat tren 207,000 ty dong. Ty le no vay tren von chu so huu giu o muc an toan 0.65x. Luu chuyen tien thuan tu hoat dong kinh doanh duong manh me, bao dam nguon von doi dao de hoan tat Dung Quat 2.")
        ]
    },
    {
        "id": "HPG_SANLUONG_THANG9_2026",
        "symbol": "HPG",
        "company": "CONG TY CO PHAN TAP DOAN HOA PHAT",
        "doc_no": "209/2026/CBTT-HPG",
        "date": "05/10/2026",
        "file_name": "HPG_SanLuong_ThepHRC_Thang9_2026.pdf",
        "file_size": "215 KB",
        "pages": 2,
        "title": "BAO CAO SAN LUONG SAN XUAT VA BAN HANG THEP XAY DUNG, PHOI THEP & HRC THANG 9/2026",
        "signer": "Bui Thi Ngan - Nguoi CBTT",
        "type": "Công bố thông tin",
        "sections": [
            ("MUC 1: SAN LUONG THEP THO VA BAN HANG", "Trong thang 9/2026, Tap doan Hoa Phat da san xuat 735,000 tan thep tho, tang 12% so voi cung ky. San luong ban hang cac san pham thep cuon can nong HRC, thep xay dung va phoi thep dat 680,000 tan."),
            ("MUC 2: THI TRUONG NOI DIA VA XUAT KHAU", "Nhu cau thep xay dung trong nuoc khoi sac ro net nho tien do thi cong cap tap tai cac dai cong trinh: San bay Quoc te Long Thanh, he thong duong cao toc Bac Nam va cac du an cau duong trong diem."),
            ("MUC 3: TRIEN VONG SAN PHAM THEP CUON CAN NONG HRC", "San pham HRC ghi nhan san luong tieu thu 285,000 tan trong thang, huong loi lon tu viec Bo Cong Thuong tien hanh dieu tra ap thue chong ban pha gia doi voi HRC nhap khau tu nuoc ngoai.")
        ]
    },
    {
        "id": "HPG_THONGBAO_COTUC_2026",
        "symbol": "HPG",
        "company": "CONG TY CO PHAN TAP DOAN HOA PHAT",
        "doc_no": "15/2026/TB-HPG",
        "date": "20/05/2026",
        "file_name": "HPG_ThongBao_CoTuc_CoPhieu_2026.pdf",
        "file_size": "280 KB",
        "pages": 2,
        "title": "THONG BAO NGAY DANG KY CUOI CUNG THUC HIEN QUYEN NHAN CO TUC BANG CO PHIEU TY LE 10:1",
        "signer": "Tran Dinh Long - Chu tich HDQT",
        "type": "Thông báo cổ tức",
        "sections": [
            ("DIEU 1: THONG TIN VE CHUNG KHOAN VA CO TUC", "Ma chung khoan: HPG (San HOSE). Loai co phieu: Co phieu pho thong. Menh gia: 10,000 dong/co phieu. Hinh thuc: Chi tra co tuc nam 2025 bang co phieu theo ty le 10:1 (co dong so huu 10 co phieu duoc nhan 01 co phieu moi)."),
            ("DIEU 2: THOI GIAN CHOT DANH SACH VA GIAO DICH", "Ngay giao dich khong huong quyen (GDKHQ): 23/05/2026. Ngay dang ky cuoi cung (NDKCC): 24/05/2026. Ngay du kien niem yet bo sung va giao dich: Thang 06/2026."),
            ("DIEU 3: PHUONG AN XU LY CO PHIEU LE", "So luong co phieu phat hanh de tra co tuc se duoc lam tron xuong den hang don vi. Phan co phieu le thap phan (neu co) se bi huy bo theo quy dinh cua Luat Doanh nghiep.")
        ]
    },
    {
        "id": "VNM_NQ_HDQT_COTUC_2026",
        "symbol": "VNM",
        "company": "CONG TY CO PHAN SUA VIET NAM",
        "doc_no": "08/2026/NQ-VNM",
        "date": "15/09/2026",
        "file_name": "VNM_NQ_HDQT_TamUngCoTuc_2026.pdf",
        "file_size": "295 KB",
        "pages": 2,
        "title": "NGHI QUYET HOI DONG QUAN TRI VE TAM UNG CO TUC DOT 1 NAM 2026 BANG TIEN MAT",
        "signer": "Mai Kieu Lien - Tong Giam doc",
        "type": "Nghị quyết HĐQT",
        "sections": [
            ("DIEU 1: TY LE VA HINH THUC CHI TRA CO TUC", "Thong qua viec tam ung co tuc dot 1/2026 bang tien mat cho co dong voi ty le 9.5% tren menh gia (tuong duong 950 dong/co phieu). Tong so tien chi tra uoc tinh tren 1,985 ty dong trich tu nguon loi nhuan chua phan phoi."),
            ("DIEU 2: LICH TRINH THUC HIEN QUYEN", "Ngay giao dich khong huong quyen: 15/10/2026. Ngay dang ky cuoi cung: 16/10/2026. Ngay bat dau thanh toan tien vao tai khoan chung khoan cua co dong: 25/11/2026."),
            ("DIEU 3: HIEN NANG TAI CHINH VA DONG TIEN", "Vinamilk duy tri luu chuyen tien thuan vung manh, bien loi nhuan gop tren 42% nho gia sua bot nguyen lieu quoc te giam, bao dam chi tra co tuc on dinh va tai dau tu he thong trang trai sinh thai Green Farm.")
        ]
    },
    {
        "id": "FPT_NQ_AI_FACTORY_2026",
        "symbol": "FPT",
        "company": "CONG TY CO PHAN FPT",
        "doc_no": "19/2026/NQ-FPT",
        "date": "12/09/2026",
        "file_name": "FPT_NQ_HDQT_AI_Factory_Nvidia_2026.pdf",
        "file_size": "410 KB",
        "pages": 4,
        "title": "NGHI QUYET HOI DONG QUAN TRI VE HOP TAC CHIEN LUOC XAY DUNG NHA MAY AI FACTORY",
        "signer": "Truong Gia Binh - Chu tich HDQT",
        "type": "Nghị quyết HĐQT",
        "sections": [
            ("DIEU 1: DAU TU TO HOP SIEU MAY TINH AI FACTORY", "Thong qua du an dau tu to hop sieu may tinh AI Factory tri gia 200 trieu USD trang bi he thong GPU Nvidia H100/B200 Tien tien tai Da Nang va TP.HCM phuc vu nghien cuu, phat trien Sovereign AI va dao tao nhan luc ban dan."),
            ("DIEU 2: HOP TAC CHIEN LUOC TOAN CAU CUNG NVIDIA", "FPT tro thanh Doi tac Dich vu Cap cao toan cau cua Nvidia, cung cap cac giai phap Cloud AI, Digital Twin va GenAI cho cac tap doan hang dau tai Nhat Ban, My va chau Au."),
            ("DIEU 3: TRIEN VONG KINH DOANH VA CONG BO THONG TIN", "Giao Ban Tong Giam doc to chuc trien khai tien do du an, quan tri rui ro dau tu va cong bo thong tin day du theo Luat Chung khoan.")
        ]
    },
    {
        "id": "VCB_NQ_TANG_VON_2026",
        "symbol": "VCB",
        "company": "NGAN HANG TMCP NGOAI THUONG VIET NAM",
        "doc_no": "42/2026/NQ-VCB",
        "date": "18/08/2026",
        "file_name": "VCB_NQ_HDQT_TangVonDieuLe_2026.pdf",
        "file_size": "360 KB",
        "pages": 3,
        "title": "NGHI QUYET HOI DONG QUAN TRI VE PHAT HANH CO PHIEU TANG VON DIEU LE LEN 83,500 TY DONG",
        "signer": "Nguyen Thanh Tung - Chu tich HDQT",
        "type": "Nghị quyết HĐQT",
        "sections": [
            ("DIEU 1: PHUONG AN PHAT HANH CO PHIEU TRA CO TUC", "Phat hanh co phieu tu nguon loi nhuan con lai nam 2024 de tang von dieu le cua Vietcombank tu 55,891 ty dong len tren 83,557 ty dong, dua Vietcombank tro thanh ngan hang co von dieu le lon nhat he thong."),
            ("DIEU 2: HE SO AN TOAN VON CAR VA CHUAN BASEL III", "Viec tang von giup he so an toan von CAR cua VCB vuot 12.5%, dap ung toan dien cac tieu chuan quan tri rui ro nghiem ngat Basel III va tao du dia tang truong tin dung ben vung."),
            ("DIEU 3: THOI GIAN HOAN TAT THU TUC", "Ngan hang se phoi hop cung Ngan hang Nha nuoc va Uy ban Chung khoan Nha nuoc de hoan tat thu tuc chot danh sach co dong trong Quy 4/2026.")
        ]
    },
    {
        "id": "A32_NQ_DHDCD_2026",
        "symbol": "A32",
        "company": "CONG TY CO PHAN 32",
        "doc_no": "01/2026/NQ-DHDCD-A32",
        "date": "24/04/2026",
        "file_name": "A32_NQ_DHDCD_ThuongNien_2026.pdf",
        "file_size": "315 KB",
        "pages": 3,
        "title": "NGHI QUYET DAI HOI DONG CO DONG THUONG NIEN NAM 2026 CONG TY CO PHAN 32",
        "signer": "Bui Van Giap - Chu tich HDQT",
        "type": "Nghị quyết ĐHĐCĐ",
        "sections": [
            ("DIEU 1: THONG QUA KET QUA KINH DOANH NAM 2025", "Dai hoi thong qua Bao cao ket qua san xuat kinh doanh nam 2025 voi tong doanh thu 658 ty dong, loi nhuan sau thue 42.5 ty dong, ty le chi tra co tuc tien mat 25%."),
            ("DIEU 2: KE HOACH SAN XUAT KINH DOANH NAM 2026", "Muc tieu doanh thu nam 2026 dat 690 ty dong, loi nhuan truoc thue 55 ty dong, tiep tuc duy tri thi truong san pham may mac va giay da quan trang, quan dung truyen thong."),
            ("DIEU 3: PHAN PHOI LOI NHUAN VA CO TUC NAM 2026", "Thong qua phuong an chia co tuc nam 2026 bang tien mat voi ty le du kien tu 20% den 25% tren menh gia co phan.")
        ]
    }
]

def generate_all_sample_pdfs():
    """Tạo toàn bộ file PDF lưu vào thư mục static/pdf để phục vụ tải trực tiếp"""
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    count = 0
    for doc in SAMPLE_DISCLOSURES:
        pdf_bytes = create_a4_pdf(
            title=doc["title"],
            doc_no=doc["doc_no"],
            date_str=doc["date"],
            company=doc["company"],
            signer=doc["signer"],
            sections=doc["sections"]
        )
        dest_file = PDF_DIR / doc["file_name"]
        with open(dest_file, "wb") as f:
            f.write(pdf_bytes)
        count += 1
    return count

def get_pdf_bytes_by_id(doc_id: str) -> bytes:
    """Lấy nội dung bytes PDF theo ID hoặc file_name"""
    doc_id_clean = doc_id.replace(".pdf", "").strip()
    for doc in SAMPLE_DISCLOSURES:
        if doc["id"].lower() == doc_id_clean.lower() or doc["file_name"].lower() == doc_id.lower():
            return create_a4_pdf(
                title=doc["title"],
                doc_no=doc["doc_no"],
                date_str=doc["date"],
                company=doc["company"],
                signer=doc["signer"],
                sections=doc["sections"]
            )
    
    # Fallback tạo một PDF công bố thông tin thông thường
    return create_a4_pdf(
        title=f"CONG BO THONG TIN CHINH THUC - MA TAI LIEU {doc_id_clean.upper()}",
        doc_no="99/2026/CBTT-HOSE",
        date_str="08/10/2026",
        company="SO GIAO DICH CHUNG KHOAN VIET NAM",
        signer="Dai dien Uy ban Chung khoan Nha nuoc",
        sections=[
            ("MUC 1: XAC NHAN CONG BO THONG TIN", f"Tai lieu co ma dinh danh {doc_id_clean} da duoc luu tru tren he thong co so du lieu Vietstock Finance va So Giao dich Chung khoan."),
            ("MUC 2: NGUON MINH BACH VA XAC THUC", "Nha dau tu va AI Agent co the truy xuat nguyen ban noi dung tai lieu, phan tich trich xuat so lieu phuc vu nghien cuu thi truong.")
        ]
    )

if __name__ == "__main__":
    c = generate_all_sample_pdfs()
    print(f"✅ Đã tạo thành công {c} file PDF chuẩn A4 tại {PDF_DIR}")
