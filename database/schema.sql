-- SQLite Schema for Vietstock Clone Database
PRAGMA foreign_keys = ON;

-- 1. Bảng Doanh nghiệp / Cổ phiếu
CREATE TABLE IF NOT EXISTS companies (
    symbol TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    short_name TEXT,
    exchange TEXT NOT NULL, -- HOSE, HNX, UPCOM
    industry TEXT,
    sector TEXT,
    listing_date TEXT,
    charter_capital REAL,     -- Vốn điều lệ (VND)
    shares_outstanding REAL,  -- Số lượng CP lưu hành
    website TEXT,
    address TEXT,
    overview TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Lịch sử Giá (Time-series OHLCV)
CREATE TABLE IF NOT EXISTS stock_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    trading_date DATE NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume REAL NOT NULL,
    value REAL,               -- Giá trị giao dịch
    change REAL,              -- Tăng/giảm tuyệt đối
    change_pct REAL,          -- % Tăng/giảm
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE,
    UNIQUE(symbol, trading_date)
);

CREATE INDEX IF NOT EXISTS idx_stock_prices_symbol_date ON stock_prices (symbol, trading_date DESC);

-- 3. Bảng Báo cáo Tài chính (Balance Sheet, Income Statement, Cash Flow, Ratios)
CREATE TABLE IF NOT EXISTS financial_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    report_type TEXT NOT NULL, -- BS (CĐKT), IS (KQKD), CF (LCTT), RATIO (Chỉ số)
    year INTEGER NOT NULL,
    quarter INTEGER NOT NULL,  -- 0: Cả năm, 1..4: Quý 1..4
    item_code TEXT,
    item_name TEXT NOT NULL,
    item_value REAL,
    display_order INTEGER DEFAULT 0,
    is_bold INTEGER DEFAULT 0, -- 1: Dòng in đậm, 0: Bình thường
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE,
    UNIQUE(symbol, report_type, year, quarter, item_name)
);

CREATE INDEX IF NOT EXISTS idx_fin_symbol_type ON financial_reports (symbol, report_type, year DESC, quarter DESC);

-- 4. Bảng Ban Lãnh đạo & Cổ đông lớn
CREATE TABLE IF NOT EXISTS officers_shareholders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    category TEXT NOT NULL, -- 'OFFICER' (Ban lãnh đạo), 'SHAREHOLDER' (Cổ đông)
    full_name TEXT NOT NULL,
    position TEXT,
    shares_held REAL,
    ownership_pct REAL,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_officers_symbol ON officers_shareholders (symbol);

-- 5. Bảng Sự kiện & Cổ tức
CREATE TABLE IF NOT EXISTS corporate_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'DIVIDEND_CASH', 'DIVIDEND_STOCK', 'AGM', 'ISSUE'
    ex_date DATE,             -- Ngày GDKHQ
    record_date DATE,         -- Ngày ĐKCC
    exec_date DATE,           -- Ngày thực hiện
    description TEXT NOT NULL,
    value REAL,               -- Tỷ lệ hoặc giá trị tiền mặt
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_symbol ON corporate_events (symbol, ex_date DESC);

-- 6. Bảng Tin tức & Công bố thông tin
CREATE TABLE IF NOT EXISTS news_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT,
    title TEXT NOT NULL,
    published_date TIMESTAMP NOT NULL,
    source TEXT,
    url TEXT,
    summary TEXT,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_news_symbol ON news_articles (symbol, published_date DESC);
