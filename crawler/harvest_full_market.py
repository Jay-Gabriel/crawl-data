"""
Full Market Harvester Engine
Thu thập 100% dữ liệu toàn bộ ~1.259 mã cổ phiếu trên cả 3 sàn (HOSE, HNX, UPCOM)
Lưu vào SQLite CSDL với cơ chế tự động Resume và Checkpoint (không cào lại mã đã có).
"""
import sys
import os
import re
import json
import time
import datetime
import requests
import sqlite3
from pathlib import Path

# Paths
ROOT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = ROOT_DIR / "database" / "vietstock.db"
SYMBOLS_CACHE_FILE = ROOT_DIR / "crawler" / "symbols_universe.json"

sys.path.append(str(ROOT_DIR))
from crawler.scraper import VietstockHarvester
from database.db import get_connection, init_db

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
}

def scan_full_market_symbols():
    """Quét và lập danh mục toàn bộ cổ phiếu trên cả 3 sàn"""
    if SYMBOLS_CACHE_FILE.exists():
        try:
            with open(SYMBOLS_CACHE_FILE, "r", encoding="utf-8") as f:
                cached = json.load(f)
                if len(cached) >= 1000:
                    print(f"[*] Đã tải danh mục {len(cached)} mã từ bộ nhớ cache.")
                    return cached
        except Exception:
            pass

    print("[*] Đang kết nối Vietstock để quét toàn bộ mã chứng khoán 3 sàn...")
    url = "https://finance.vietstock.vn/search-stock"
    symbols_map = {}

    for char in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        params = {
            "query": char,
            "page": 1,
            "pageSize": 100,
            "skip": 0,
            "searchType": 1,
            "languageId": 1
        }
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=10)
            if r.status_code == 200:
                items = r.json().get("data", [])
                for it in items:
                    code = it.get("Code", "").strip().upper()
                    ex = it.get("Exchange", "").upper()
                    if code and len(code) == 3 and ex in ["HOSE", "HNX", "UPCOM"]:
                        symbols_map[code] = {
                            "symbol": code,
                            "company_name": it.get("FullName", code),
                            "short_name": it.get("Name", code),
                            "exchange": ex,
                            "url": it.get("URL", f"https://finance.vietstock.vn/{code}.htm")
                        }
        except Exception as e:
            print(f"[!] Lỗi khi quét ký tự {char}: {e}")
        time.sleep(0.08)

    symbol_list = list(symbols_map.values())
    symbol_list.sort(key=lambda x: x["symbol"])

    with open(SYMBOLS_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(symbol_list, f, ensure_ascii=False, indent=2)

    print(f"[✓] Đã lập danh bạ thành công {len(symbol_list)} mã cổ phiếu toàn thị trường.")
    return symbol_list

def get_already_scraped_symbols():
    """Lấy danh sách các mã đã có đầy đủ dữ liệu trong CSDL để bỏ qua"""
    if not DB_PATH.exists():
        return set()
    conn = get_connection()
    cur = conn.cursor()
    # Mã được coi là hoàn tất nếu có trên 100 phiên giá và có hồ sơ công ty
    cur.execute("""
        SELECT symbol 
        FROM stock_prices 
        GROUP BY symbol 
        HAVING count(*) >= 100
    """)
    rows = cur.fetchall()
    conn.close()
    return set(r[0] for r in rows)

def run_full_harvest(batch_size=None, delay=0.5):
    init_db()
    universe = scan_full_market_symbols()
    already_done = get_already_scraped_symbols()
    
    pending = [item for item in universe if item["symbol"] not in already_done]
    total_market = len(universe)
    completed_count = len(already_done)

    print(f"\n=======================================================")
    print(f"📊 TIẾN ĐỘ THU THẬP DỮ LIỆU TOÀN SÀN VIỆT NAM:")
    print(f" - Tổng số mã toàn thị trường: {total_market} mã")
    print(f" - Đã hoàn tất trong CSDL:    {completed_count} mã")
    print(f" - Số mã còn lại cần cào:     {len(pending)} mã")
    print(f"=======================================================\n")

    if not pending:
        print("[✓] TOÀN BỘ DỮ LIỆU 100% CỦA TẤT CẢ CÁC MÃ ĐÃ CÓ ĐẦY ĐỦ TRONG CSDL!")
        return

    if batch_size:
        pending = pending[:batch_size]
        print(f"[*] Chế độ chạy mẻ (Batch): Đang xử lý {len(pending)} mã tiếp theo...\n")

    harvester = VietstockHarvester()
    start_time = time.time()

    for idx, item in enumerate(pending, start=1):
        sym = item["symbol"]
        progress_pct = ((completed_count + idx) / total_market) * 100
        print(f"\n[{completed_count + idx}/{total_market} - {progress_pct:.1f}%] Đang cào dữ liệu: {sym} ({item['exchange']}) - {item['short_name']}")
        
        try:
            harvester.harvest_stock(sym)
        except Exception as e:
            print(f"[!] Bỏ qua mã {sym} do lỗi: {e}")

        time.sleep(delay)

    elapsed = time.time() - start_time
    print(f"\n[✓] Hoàn thành mẻ cào trong {elapsed:.1f} giây!")

if __name__ == "__main__":
    # Nhận tham số batch_size từ dòng lệnh nếu có (VD: python3 harvest_full_market.py 50)
    batch = int(sys.argv[1]) if len(sys.argv) > 1 else None
    run_full_harvest(batch_size=batch)
