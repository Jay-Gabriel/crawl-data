"""
Vietstock Native Data Harvester / Scraper Engine
Bóc tách toàn bộ dữ liệu tài chính công khai trực tiếp từ máy chủ Vietstock Finance
(finance.vietstock.vn) vào SQLite CSDL.
"""
import sys
import os
import re
import time
import datetime
import requests
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from database.db import get_connection, init_db

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
}

class VietstockHarvester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.base_url = "https://finance.vietstock.vn"
        init_db()

    def get_token_and_page(self, symbol: str):
        """Khởi tạo session và lấy __RequestVerificationToken từ trang chi tiết mã"""
        # Tìm URL chi tiết qua search-stock
        search_url = f"{self.base_url}/search-stock"
        params = {
            "query": symbol.upper(),
            "page": 1,
            "pageSize": 5,
            "skip": 0,
            "searchType": 1,
            "languageId": 1
        }
        try:
            r = self.session.get(search_url, params=params, timeout=10)
            data = r.json()
            items = data.get("data", [])
            target = None
            for it in items:
                if it.get("Code", "").upper() == symbol.upper():
                    target = it
                    break
            if not target and items:
                target = items[0]
            
            page_url = target.get("URL") if target else f"{self.base_url}/{symbol.upper()}.htm"
            
            # Gửi GET để nhận Cookie và Token
            res = self.session.get(page_url, timeout=12)
            
            # Lưu thông tin cơ bản của công ty vào CSDL
            if target:
                conn = get_connection()
                conn.execute("""
                    INSERT OR REPLACE INTO companies 
                    (symbol, company_name, short_name, exchange, updated_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    target.get("Code", symbol).upper(),
                    target.get("FullName", symbol),
                    target.get("Name", symbol),
                    target.get("Exchange", "HOSE")
                ))
                conn.commit()
                conn.close()
                print(f" [+] Đã lưu hồ sơ công ty: {symbol} - {target.get('FullName')} ({target.get('Exchange')})")

            # Trích xuất Token trong form __CHART_AjaxAntiForgeryForm
            m = re.search(r'id=__CHART_AjaxAntiForgeryForm[^>]*>.*?value=([^>]+)>', res.text)
            if m:
                token = m.group(1).strip('\"\' ')
                return token, page_url
            
            # Fallback lấy từ input bất kỳ
            tokens = re.findall(r'<input\s+name=__RequestVerificationToken\s+type=hidden\s+value=([^>]+)>', res.text)
            if tokens:
                return tokens[0].strip('\"\' '), page_url

            return None, page_url
        except Exception as e:
            print(f"[!] Lỗi kết nối Vietstock cho {symbol}: {e}")
            return None, None

    def harvest_prices(self, symbol: str, token: str, page_url: str, duration="1Y"):
        """Lấy lịch sử giá nến ngày (OHLCV) từ API Vietstock"""
        url = f"{self.base_url}/data/GetStockDeal_EODChart_ByCode"
        headers = {
            "Referer": page_url,
            "X-Requested-With": "XMLHttpRequest"
        }
        payload = {
            "stockCode": symbol.upper(),
            "duration": duration,
            "__RequestVerificationToken": token
        }
        try:
            res = self.session.post(url, data=payload, headers=headers, timeout=15)
            if res.status_code != 200:
                print(f"[!] Không lấy được giá {symbol}: HTTP {res.status_code}")
                return 0
            
            payload_data = res.json()
            data = payload_data.get("data", [])
            if not data:
                print(f"[!] Dữ liệu giá rỗng cho {symbol}")
                return 0

            conn = get_connection()
            inserted = 0
            for item in data:
                # TradingDate: "/Date(1759683600000)/"
                raw_date = item.get("TradingDate", "")
                ms_match = re.search(r'\d+', raw_date)
                if ms_match:
                    ts = int(ms_match.group(0)) / 1000
                    trading_date = datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
                else:
                    trading_date = datetime.date.today().strftime("%Y-%m-%d")

                c = float(item.get("ClosePrice", 0) or 0)
                v = float(item.get("TotalVol", 0) or 0)
                val = float(item.get("TotalVal", 0) or (c * v))
                chg = float(item.get("Change", 0) or 0)
                chg_pct = float(item.get("PerChange", 0) or 0)
                
                # Giá nến xấp xỉ từ ClosePrice và Change
                o = c - chg if chg != 0 else c
                h = max(o, c) * 1.005
                l = min(o, c) * 0.995

                conn.execute("""
                    INSERT OR REPLACE INTO stock_prices
                    (symbol, trading_date, open, high, low, close, volume, value, change, change_pct)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (symbol.upper(), trading_date, o, h, l, c, v, val, chg, chg_pct))
                inserted += 1

            conn.commit()
            conn.close()
            print(f" [+] Đã nạp thành công {inserted} phiên giá lịch sử cho {symbol}")
            return inserted
        except Exception as e:
            print(f"[x] Lỗi nạp giá {symbol}: {e}")
            return 0

    def harvest_financials(self, symbol: str, token: str, page_url: str):
        """Lấy toàn bộ Báo cáo tài chính (KQKD, CĐKT, Chỉ số) từ financeinfo"""
        url = f"{self.base_url}/data/financeinfo"
        headers = {
            "Referer": page_url,
            "X-Requested-With": "XMLHttpRequest"
        }
        payload = {
            "Code": symbol.upper(),
            "Page": 1,
            "PageSize": 4,
            "ReportTermType": 2, # Quý
            "ReportType": "BCTQ",
            "Unit": 1000000000, # Tỷ đồng
            "__RequestVerificationToken": token
        }
        try:
            res = self.session.post(url, data=payload, headers=headers, timeout=15)
            if res.status_code != 200:
                print(f"[!] Lỗi HTTP {res.status_code} khi lấy BCTC {symbol}")
                return 0
            
            data = res.json()
            if not isinstance(data, list) or len(data) < 2:
                return 0

            periods_list = data[0] # Thông tin các Quý: [{'YearPeriod': 2026, 'TermName': 'Quý 2'}, ...]
            statements = data[1]   # Dict các bảng: 'Kết quả kinh doanh', 'Báo cáo tình hình tài chính', 'Chỉ số tài chính'

            conn = get_connection()
            total_items = 0

            # Map tên bảng sang mã chuẩn
            type_map = {
                "Kết quả kinh doanh": "IS",
                "Báo cáo tình hình tài chính": "BS",
                "Lưu chuyển tiền tệ": "CF",
                "Chỉ số tài chính": "RATIO"
            }

            for sec_name, rows in statements.items():
                r_type = type_map.get(sec_name, "IS")
                for row in rows:
                    item_name = row.get("Name", "")
                    if not item_name:
                        continue
                    
                    # Duyệt qua các cột Value1, Value2, Value3, Value4, Value5 ứng với từng Quý
                    for p_idx, p_info in enumerate(periods_list, start=1):
                        val_key = f"Value{p_idx}"
                        val = row.get(val_key)
                        if val is not None:
                            year = int(p_info.get("YearPeriod", 2025))
                            term_code = p_info.get("TermCode", "Q1")
                            quarter = int(term_code.replace("Q", "")) if "Q" in term_code else 1
                            
                            conn.execute("""
                                INSERT OR REPLACE INTO financial_reports
                                (symbol, report_type, year, quarter, item_name, item_value)
                                VALUES (?, ?, ?, ?, ?, ?)
                            """, (symbol.upper(), r_type, year, quarter, item_name, float(val)))
                            total_items += 1

            conn.commit()
            conn.close()
            print(f" [+] Đã lưu thành công {total_items} chỉ tiêu Báo cáo tài chính cho {symbol}")
            return total_items
        except Exception as e:
            print(f"[x] Lỗi BCTC {symbol}: {e}")
            return 0

    def harvest_stock(self, symbol: str):
        """Thu thập dữ liệu đầy đủ 1 mã cổ phiếu từ Vietstock"""
        print(f"\n==========================================")
        print(f"[*] Bắt đầu cào full dữ liệu Vietstock: {symbol.upper()}")
        print(f"==========================================")
        token, page_url = self.get_token_and_page(symbol)
        if not token:
            print(f"[!] Không trích xuất được token cho {symbol}")
            return

        time.sleep(0.3)
        self.harvest_prices(symbol, token, page_url, duration="1Y")
        time.sleep(0.3)
        self.harvest_financials(symbol, token, page_url)
        print(f"[✓] HOÀN TẤT THU THẬP DỮ LIỆU CHO {symbol.upper()}!")

if __name__ == "__main__":
    harvester = VietstockHarvester()
    test_symbols = ["VNM", "FPT", "HPG", "VCB"]
    for sym in test_symbols:
        harvester.harvest_stock(sym)
        time.sleep(0.5)
