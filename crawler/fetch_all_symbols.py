"""
Module quét danh sách mã chứng khoán toàn sàn từ Vietstock
và điều phối cào dữ liệu hàng loạt.
"""
import sys
import time
import requests
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from crawler.scraper import VietstockHarvester

def get_vietstock_top_symbols(limit=50):
    """Lấy danh sách mã phổ biến trên thị trường từ Vietstock Search"""
    url = "https://finance.vietstock.vn/search-stock"
    headers = {"User-Agent": "Mozilla/5.0"}
    symbols = []
    
    # Tìm kiếm các ký tự chữ cái phổ biến để tập hợp mã
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    for char in alphabet:
        params = {
            "query": char,
            "page": 1,
            "pageSize": 50,
            "skip": 0,
            "searchType": 1,
            "languageId": 1
        }
        try:
            r = requests.get(url, params=params, headers=headers, timeout=10)
            if r.status_code == 200:
                data = r.json()
                for item in data.get("data", []):
                    code = item.get("Code", "").strip()
                    if code and len(code) == 3 and code not in symbols: # Mã cổ phiếu chuẩn 3 ký tự
                        symbols.append(code)
                        if limit and len(symbols) >= limit:
                            return symbols
        except Exception:
            pass
        time.sleep(0.1)
    
    return symbols

def batch_harvest(symbols_list=None, limit=20):
    harvester = VietstockHarvester()
    
    if not symbols_list:
        print("[*] Đang quét danh sách mã cổ phiếu từ Vietstock...")
        symbols_list = get_vietstock_top_symbols(limit=limit)
    
    print(f"[*] Bắt đầu cào dữ liệu cho {len(symbols_list)} mã cổ phiếu: {symbols_list}")
    
    for idx, sym in enumerate(symbols_list, start=1):
        print(f"\n[{idx}/{len(symbols_list)}] Đang cào dữ liệu mã: {sym}")
        try:
            harvester.harvest_stock(sym)
        except Exception as e:
            print(f"[!] Lỗi khi cào mã {sym}: {e}")
        time.sleep(0.5)

if __name__ == "__main__":
    # Cào thêm 10 mã tiêu biểu tiếp theo
    sample = ["MWG", "TCB", "MBB", "SSI", "VHM", "VIC", "MSN", "STB", "DGC", "VRE"]
    batch_harvest(symbols_list=sample)
