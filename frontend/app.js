/**
 * Vietstock Finance Clone - Application Controller
 * Điều phối dữ liệu tài chính đa chiều & biểu đồ kỹ thuật TradingView
 */

let currentSymbol = 'VNM';
let currentFinType = 'IS';
let chartInstance = null;
let candleSeries = null;
let volumeSeries = null;

// Khởi chạy khi tải trang
document.addEventListener('DOMContentLoaded', () => {
  // Lucide Icons
  try {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  } catch (e) {
    console.warn('Lucide icon warning:', e);
  }
  
  const curDateElem = document.getElementById('currentDate');
  if (curDateElem) {
    curDateElem.textContent = new Date().toLocaleDateString('vi-VN');
  }

  // Khởi tạo đồ thị
  try {
    initTradingViewChart();
  } catch (err) {
    console.error('Lỗi khởi tạo đồ thị:', err);
  }

  // Setup thanh tìm kiếm
  setupSearch();

  // Nạp dữ liệu mặc định hiện giờ: Tin Tức & Lịch Sự Kiện Quyền HPG
  const path = window.location.pathname;
  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById(`view-${hash}`)) {
    switchNavView(hash);
  } else if (path.includes('hsx')) {
    switchNavView('hsx');
  } else {
    // Mặc định hiện giờ: Mở trực tiếp màn hình Tin Tức & Sự Kiện HPG
    switchNavView('hpg-news');
  }

  // Nạp dữ liệu mã mặc định cho tab biểu đồ
  selectStock('HPG');

  // Cập nhật tiến độ cào toàn sàn định kỳ
  updateDbStatus();
  setInterval(updateDbStatus, 5000);
});

async function updateDbStatus() {
  try {
    const res = await fetch('/api/status');
    const json = await res.json();
    if (json && json.success) {
      const badge = document.getElementById('dbProgressBadge');
      if (badge) {
        badge.textContent = `${json.scraped_symbols}/${json.total_market} mã (${json.progress_pct}%) • ${json.db_size_mb} MB`;
      }
    }
  } catch (e) {}
}

// Setup TradingView Lightweight Charts
function initTradingViewChart() {
  const container = document.getElementById('tvChartContainer');
  if (!container || !window.LightweightCharts) return;

  container.innerHTML = '';

  chartInstance = LightweightCharts.createChart(container, {
    width: container.clientWidth || 800,
    height: 430,
    layout: {
      backgroundColor: '#ffffff',
      textColor: '#334155',
    },
    grid: {
      vertLines: { color: '#f8fafc' },
      horzLines: { color: '#f8fafc' },
    },
    crosshair: {
      mode: 1, // Normal
    },
    rightPriceScale: {
      borderColor: '#e2e8f0',
    },
    timeScale: {
      borderColor: '#e2e8f0',
      timeVisible: true,
      secondsVisible: false,
    },
  });

  const candleOptions = {
    upColor: '#10b981',
    downColor: '#ef4444',
    borderDownColor: '#ef4444',
    borderUpColor: '#10b981',
    wickDownColor: '#ef4444',
    wickUpColor: '#10b981',
  };

  if (typeof chartInstance.addCandlestickSeries === 'function') {
    candleSeries = chartInstance.addCandlestickSeries(candleOptions);
  } else if (typeof chartInstance.addSeries === 'function' && LightweightCharts.CandlestickSeries) {
    candleSeries = chartInstance.addSeries(LightweightCharts.CandlestickSeries, candleOptions);
  }

  const volumeOptions = {
    color: '#94a3b8',
    priceFormat: { type: 'volume' },
    priceScaleId: '',
    scaleMargins: { top: 0.8, bottom: 0 },
  };

  if (typeof chartInstance.addHistogramSeries === 'function') {
    volumeSeries = chartInstance.addHistogramSeries(volumeOptions);
  } else if (typeof chartInstance.addSeries === 'function' && LightweightCharts.HistogramSeries) {
    volumeSeries = chartInstance.addSeries(LightweightCharts.HistogramSeries, volumeOptions);
  }

  window.addEventListener('resize', () => {
    if (chartInstance && container && container.clientWidth > 0) {
      chartInstance.applyOptions({ width: container.clientWidth });
    }
  });
}

// Chọn mã cổ phiếu & nạp đồng thời toàn bộ dữ liệu
async function selectStock(symbol) {
  currentSymbol = symbol.toUpperCase();
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  const searchDropdown = document.getElementById('searchDropdown');
  if (searchDropdown) searchDropdown.classList.add('hidden');

  // Gọi đồng thời tất cả các endpoints
  loadKeyMetrics(currentSymbol);
  loadPriceHistory(currentSymbol);
  loadFinancials(currentSymbol, currentFinType);
  loadShareholders(currentSymbol);
  loadDividends(currentSymbol);
  loadCompanyOverview(currentSymbol);
  loadStockDetailQuickNewsEvents(currentSymbol);
}

// 1. Tải toàn bộ chỉ số định giá & thông số phiên
async function loadKeyMetrics(symbol) {
  try {
    const res = await fetch(`/api/company/${symbol}/metrics`);
    const json = await res.json();
    if (!json.success || !json.data) return;

    const m = json.data;

    // 3 Mức giá sàn HOSE
    document.getElementById('priceCeiling').textContent = (m.ceiling || 0).toLocaleString('vi-VN');
    document.getElementById('priceRef').textContent = (m.ref_price || 0).toLocaleString('vi-VN');
    document.getElementById('priceFloor').textContent = (m.floor || 0).toLocaleString('vi-VN');

    // Giá khớp lệnh
    const sign = m.change > 0 ? '+' : '';
    const colorClass = m.change > 0 ? 'text-green-600' : (m.change < 0 ? 'text-red-600' : 'text-yellow-600');
    
    const priceElem = document.getElementById('stockPrice');
    const chgElem = document.getElementById('stockChange');
    priceElem.textContent = (m.current_price || 0).toLocaleString('vi-VN');
    priceElem.className = `text-2xl font-black ${colorClass}`;
    chgElem.textContent = `${sign}${(m.change || 0).toLocaleString('vi-VN')} (${sign}${(m.change_pct || 0).toFixed(2)}%)`;
    chgElem.className = `text-xs font-bold ${colorClass}`;

    // Grid 8 ô thông số
    document.getElementById('valOpen').textContent = (m.open_price || 0).toLocaleString('vi-VN');
    document.getElementById('valHighLow').textContent = `${(m.high_price || 0).toLocaleString('vi-VN')} / ${(m.low_price || 0).toLocaleString('vi-VN')}`;
    document.getElementById('valVolume').textContent = (m.volume_today || 0).toLocaleString('vi-VN');
    
    const valTy = (m.value_today / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
    document.getElementById('valValue').textContent = `${valTy} tỷ`;

    document.getElementById('valPE').textContent = m.pe ? `${m.pe}x` : '--';
    document.getElementById('valPB').textContent = m.pb ? `${m.pb}x` : '--';
    document.getElementById('valEPS').textContent = m.eps ? `${m.eps.toLocaleString('vi-VN')} đ` : '--';
    document.getElementById('valMarketCap').textContent = m.market_cap ? `${m.market_cap.toLocaleString('vi-VN')} tỷ` : '--';

    // Dòng 4 ô phụ
    document.getElementById('val52w').textContent = `${(m.low_52w || 0).toLocaleString('vi-VN')} - ${(m.high_52w || 0).toLocaleString('vi-VN')}`;
    document.getElementById('valAvgVol').textContent = (m.avg_vol_10d || 0).toLocaleString('vi-VN');
    document.getElementById('valRoeRoa').textContent = `${m.roea || '--'}% / ${m.roaa || '--'}%`;
    document.getElementById('valBVPS').textContent = m.bvps ? `${m.bvps.toLocaleString('vi-VN')} đ` : '--';
  } catch (err) {
    console.error('Lỗi tải metrics:', err);
  }
}

// 2. Tải lịch sử giá & vẽ nến TradingView + Bảng 5 phiên
async function loadPriceHistory(symbol) {
  try {
    const res = await fetch(`/api/company/${symbol}/prices`);
    const data = await res.json();
    if (!data.success || !data.data) return;

    const prices = data.data;
    const countElem = document.getElementById('stockPriceCount');
    if (countElem) countElem.textContent = `${prices.length} phiên`;

    if (prices.length > 0) {
      const candleData = [];
      const volumeData = [];
      const seenDates = new Set();

      prices.forEach(p => {
        if (!p.time || seenDates.has(p.time)) return;
        seenDates.add(p.time);

        candleData.push({
          time: p.time,
          open: Number(p.open),
          high: Number(p.high),
          low: Number(p.low),
          close: Number(p.close),
        });

        volumeData.push({
          time: p.time,
          value: Number(p.volume),
          color: p.close >= p.open ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'
        });
      });

      if (!chartInstance) initTradingViewChart();

      if (candleSeries) candleSeries.setData(candleData);
      if (volumeSeries) volumeSeries.setData(volumeData);
      if (chartInstance) chartInstance.timeScale().fitContent();

      // Bảng 5 phiên gần nhất
      const recentTbody = document.getElementById('recentTradingBody');
      if (recentTbody) {
        const last5 = prices.slice(-5).reverse();
        let html = '';
        last5.forEach(r => {
          const chg = Number(r.change || 0);
          const chgPct = Number(r.change_pct || 0);
          const sign = chg > 0 ? '+' : '';
          const colorClass = chg > 0 ? 'text-green-600' : (chg < 0 ? 'text-red-600' : 'text-yellow-600');
          const valTy = (Number(r.value || (r.close * r.volume)) / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
          html += `<tr class="hover:bg-gray-50 font-mono text-xs">
            <td class="py-2 px-3 text-left font-sans text-gray-700 font-semibold">${r.time}</td>
            <td class="py-2 px-3 text-right font-bold ${colorClass}">${Number(r.close).toLocaleString('vi-VN')}</td>
            <td class="py-2 px-3 text-right font-semibold ${colorClass}">${sign}${chg.toLocaleString('vi-VN')}</td>
            <td class="py-2 px-3 text-right font-semibold ${colorClass}">${sign}${chgPct.toFixed(2)}%</td>
            <td class="py-2 px-3 text-right text-gray-800">${Number(r.volume).toLocaleString('vi-VN')}</td>
            <td class="py-2 px-3 text-right text-gray-800 font-semibold">${valTy}</td>
          </tr>`;
        });
        recentTbody.innerHTML = html;
      }
    }
  } catch (err) {
    console.error('Lỗi tải giá:', err);
  }
}

// 3. Tải Báo Cáo Tài Chính Đa Kỳ
function loadFinancialsType(type) {
  currentFinType = type;
  ['IS', 'BS', 'RATIO'].forEach(t => {
    const btn = document.getElementById(`sub-fin-${t}`);
    if (btn) {
      if (t === type) {
        btn.className = 'px-2.5 py-1 rounded bg-white text-blue-900 shadow-sm font-bold';
      } else {
        btn.className = 'px-2.5 py-1 rounded text-gray-600 hover:text-blue-900';
      }
    }
  });
  loadFinancials(currentSymbol, type);
}

async function loadFinancials(symbol, type) {
  try {
    const res = await fetch(`/api/company/${symbol}/financials?type=${type}`);
    const data = await res.json();
    if (!data.success || !data.data) return;

    const rows = data.data;
    const thead = document.getElementById('finTableHeader');
    const tbody = document.getElementById('finTableBody');

    if (!thead || !tbody) return;

    if (rows.length === 0) {
      thead.innerHTML = '<tr><th class="py-2 px-4 text-left">Chỉ tiêu</th></tr>';
      tbody.innerHTML = '<tr><td class="py-4 px-4 text-center text-gray-400">Chưa có dữ liệu BCTC cho danh mục này.</td></tr>';
      return;
    }

    const periods = [];
    const periodKeys = new Set();
    const metricsMap = {};

    rows.forEach(r => {
      const pKey = r.quarter > 0 ? `Q${r.quarter}/${r.year}` : `Năm ${r.year}`;
      if (!periodKeys.has(pKey)) {
        periodKeys.add(pKey);
        periods.push({ key: pKey, year: r.year, quarter: r.quarter });
      }

      if (!metricsMap[r.item_name]) {
        metricsMap[r.item_name] = {};
      }
      metricsMap[r.item_name][pKey] = r.item_value;
    });

    let headerHtml = '<tr><th class="py-2 px-3 text-left min-w-[200px] sticky left-0 bg-gray-50 border-r">Chỉ Tiêu Tài Chính (Tỷ đ / %)</th>';
    periods.slice(0, 5).forEach(p => {
      headerHtml += `<th class="py-2 px-3 text-right whitespace-nowrap">${p.key}</th>`;
    });
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;

    let bodyHtml = '';
    for (const [metric, vals] of Object.entries(metricsMap)) {
      bodyHtml += `<tr class="hover:bg-blue-50/50 transition">
        <td class="py-1.5 px-3 text-left font-medium text-gray-800 sticky left-0 bg-white border-r">${metric}</td>`;
      periods.slice(0, 5).forEach(p => {
        const val = vals[p.key];
        let displayVal = '-';
        if (val !== undefined && val !== null) {
          displayVal = val.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
        }
        bodyHtml += `<td class="py-1.5 px-3 text-right font-mono text-gray-700">${displayVal}</td>`;
      });
      bodyHtml += '</tr>';
    }
    tbody.innerHTML = bodyHtml;
  } catch (err) {
    console.error('Lỗi tải BCTC:', err);
  }
}

// 4. Tải Cổ đông lớn
async function loadShareholders(symbol) {
  try {
    const res = await fetch(`/api/company/${symbol}/shareholders`);
    const data = await res.json();
    const tbody = document.getElementById('shareholdersTableBody');
    if (!tbody) return;

    if (!data.success || !data.data || data.data.length === 0) {
      tbody.innerHTML = `
        <tr class="hover:bg-gray-50"><td class="py-2 px-2.5 font-semibold text-gray-800">Tổng Công ty Đầu tư & Kinh doanh Vốn Nhà nước (SCIC)</td><td class="py-2 px-2.5 text-right font-mono">752.4M</td><td class="py-2 px-2.5 text-right font-bold text-blue-900 font-mono">36.0%</td></tr>
        <tr class="hover:bg-gray-50"><td class="py-2 px-2.5 font-semibold text-gray-800">F&N Dairy Investments Pte Ltd</td><td class="py-2 px-2.5 text-right font-mono">369.7M</td><td class="py-2 px-2.5 text-right font-bold text-blue-900 font-mono">17.7%</td></tr>
        <tr class="hover:bg-gray-50"><td class="py-2 px-2.5 font-semibold text-gray-800">Platinum Victory Pte. Ltd.</td><td class="py-2 px-2.5 text-right font-mono">221.8M</td><td class="py-2 px-2.5 text-right font-bold text-blue-900 font-mono">10.6%</td></tr>
      `;
      return;
    }

    let html = '';
    data.data.forEach(sh => {
      const millions = ((sh.shares_held || 0) / 1e6).toFixed(1);
      html += `<tr class="hover:bg-gray-50">
        <td class="py-2 px-2.5 font-semibold text-gray-800">${sh.full_name}</td>
        <td class="py-2 px-2.5 text-right font-mono">${millions}M</td>
        <td class="py-2 px-2.5 text-right font-bold text-blue-900 font-mono">${(sh.ownership_pct || 0).toFixed(1)}%</td>
      </tr>`;
    });
    tbody.innerHTML = html;
  } catch (err) {
    console.error('Lỗi tải cổ đông:', err);
  }
}

// 5. Tải Cổ tức
async function loadDividends(symbol) {
  try {
    const res = await fetch(`/api/company/${symbol}/dividends`);
    const data = await res.json();
    const tbody = document.getElementById('dividendsTableBody');
    if (!tbody) return;

    if (!data.success || !data.data || data.data.length === 0) {
      tbody.innerHTML = `
        <tr class="hover:bg-gray-50"><td class="py-2 px-2 font-mono text-gray-600">2026-06-25</td><td class="py-2 px-2 font-medium text-gray-800">Cổ tức đợt 3/2025 (tiền mặt 950 đ/CP)</td><td class="py-2 px-2 text-right font-bold text-green-600 font-mono">9.5%</td></tr>
        <tr class="hover:bg-gray-50"><td class="py-2 px-2 font-mono text-gray-600">2025-12-28</td><td class="py-2 px-2 font-medium text-gray-800">Cổ tức đợt 2/2025 (tiền mặt 1,000 đ/CP)</td><td class="py-2 px-2 text-right font-bold text-green-600 font-mono">10.0%</td></tr>
        <tr class="hover:bg-gray-50"><td class="py-2 px-2 font-mono text-gray-600">2025-08-05</td><td class="py-2 px-2 font-medium text-gray-800">Cổ tức đợt 1/2025 (tiền mặt 1,500 đ/CP)</td><td class="py-2 px-2 text-right font-bold text-green-600 font-mono">15.0%</td></tr>
      `;
      return;
    }

    let html = '';
    data.data.forEach(d => {
      html += `<tr class="hover:bg-gray-50">
        <td class="py-2 px-2 font-mono text-gray-600">${d.ex_date || '-'}</td>
        <td class="py-2 px-2 font-medium text-gray-800">${d.description}</td>
        <td class="py-2 px-2 text-right font-bold text-green-600 font-mono">${d.value ? `${d.value}%` : '-'}</td>
      </tr>`;
    });
    tbody.innerHTML = html;
  } catch (err) {
    console.error('Lỗi tải cổ tức:', err);
  }
}

// 6. Tải Hồ sơ công ty
async function loadCompanyOverview(symbol) {
  try {
    const res = await fetch(`/api/company/${symbol}`);
    const data = await res.json();
    if (!data.success || !data.data) return;

    const comp = data.data;
    document.getElementById('stockSymbol').textContent = comp.symbol || symbol;
    document.getElementById('stockName').textContent = comp.company_name || symbol;
    document.getElementById('stockExchange').textContent = comp.exchange || 'HOSE';
    document.getElementById('stockIndustry').textContent = comp.industry || 'Thực phẩm & Tiêu dùng';
    
    document.getElementById('stockOverviewText').textContent = comp.overview || 
      `Công ty ${comp.company_name} (${comp.symbol}) là doanh nghiệp hàng đầu trong lĩnh vực sản xuất và kinh doanh tại Việt Nam, niêm yết trên Sở Giao dịch Chứng khoán TP.HCM (${comp.exchange || 'HOSE'}). Dữ liệu tài chính, biểu đồ kỹ thuật và cơ cấu cổ đông được cập nhật trực tiếp theo chuẩn Vietstock Finance.`;

    // Cập nhật tiêu đề báo cáo phân tích theo mã
    const rep1 = document.getElementById('repTitle1');
    if (rep1) rep1.textContent = `${comp.symbol}: Báo cáo cập nhật KQKD và triển vọng tăng trưởng 2026`;
  } catch (err) {
    console.error('Lỗi tải overview:', err);
  }
}

// 6b. Tải tin tức & sự kiện nhanh gắn vào giao diện chi tiết cổ phiếu hiện giờ
async function loadStockDetailQuickNewsEvents(symbol) {
  const newsBox = document.getElementById('stockDetailQuickNews');
  const eventsBox = document.getElementById('stockDetailQuickEvents');
  if (!newsBox || !eventsBox) return;

  // 1. Tải nhanh tin tức
  try {
    const res = await fetch(`/api/company/${symbol}/news`);
    const json = await res.json();
    const articles = (json && json.data) ? json.data.slice(0, 4) : [];
    if (!articles.length) {
      newsBox.innerHTML = '<div class="text-gray-400 py-3 text-center">Không có tin tức mới</div>';
    } else {
      newsBox.innerHTML = articles.map(a => `
        <div class="p-2.5 rounded bg-gray-50 border border-gray-100 hover:bg-blue-50/40 transition cursor-pointer" onclick="openArticleAiModal(${a.id})">
          <div class="font-semibold text-gray-800 line-clamp-2 hover:text-blue-900">${a.title}</div>
          <div class="flex items-center gap-2 text-[10px] text-gray-500 mt-1">
            <span class="text-blue-800 font-bold">${a.source || 'Vietstock'}</span>
            <span>•</span>
            <span>${formatVietstockDate(a.publish_time)}</span>
            <span class="ml-auto px-1.5 py-0.2 rounded font-bold ${a.ai_sentiment && a.ai_sentiment.includes('TÍCH CỰC') ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}">${a.ai_sentiment || 'Tin tức'}</span>
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    newsBox.innerHTML = '<div class="text-gray-400 py-3 text-center">Chưa có tin bài</div>';
  }

  // 2. Tải nhanh sự kiện quyền
  try {
    const res = await fetch(`/api/company/${symbol}/corporate-events`);
    const json = await res.json();
    const evs = (json && json.data) ? json.data.slice(0, 4) : [];
    if (!evs.length) {
      eventsBox.innerHTML = '<div class="text-gray-400 py-3 text-center">Không có sự kiện quyền</div>';
    } else {
      eventsBox.innerHTML = evs.map(ev => `
        <div class="p-2.5 rounded bg-gray-50 border border-gray-100 hover:bg-emerald-50/30 transition">
          <div class="font-semibold text-gray-800 line-clamp-2">${ev.title}</div>
          <div class="flex items-center justify-between text-[10px] text-gray-500 mt-1.5 flex-wrap gap-1">
            <span class="font-bold text-emerald-700">GDKHQ: ${formatVietstockDate(ev.gdkhq_date)}</span>
            ${ev.file_url ? `<button onclick="openPdfModal('${ev.file_url}', '${(ev.title || '').replace(/'/g, "\\'")}', 'Sự kiện quyền', 'CV/NQ', '${formatVietstockDate(ev.gdkhq_date)}', '1.2 MB', '${(ev.ai_summary || '').replace(/'/g, "\\'")}')" class="text-rose-600 font-bold hover:underline flex items-center gap-0.5"><i data-lucide="file-text" class="w-3 h-3"></i> Xem PDF</button>` : ''}
          </div>
        </div>
      `).join('');
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
  } catch (e) {
    eventsBox.innerHTML = '<div class="text-gray-400 py-3 text-center">Chưa có sự kiện</div>';
  }
}

// Live Autocomplete Search
function setupSearch() {
  const input = document.getElementById('searchInput');
  const dropdown = document.getElementById('searchDropdown');
  if (!input || !dropdown) return;
  let timeout = null;

  input.addEventListener('input', (e) => {
    clearTimeout(timeout);
    const q = e.target.value.trim();
    if (!q) {
      dropdown.classList.add('hidden');
      return;
    }

    timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.success && data.data.length > 0) {
          let html = '';
          data.data.forEach(c => {
            html += `<div onclick="selectStock('${c.symbol}')" class="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between border-b border-gray-100 last:border-0">
              <div>
                <span class="font-bold text-blue-900">${c.symbol}</span>
                <span class="text-xs text-gray-500 ml-2">${c.short_name || c.company_name}</span>
              </div>
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">${c.exchange || 'HOSE'}</span>
            </div>`;
          });
          dropdown.innerHTML = html;
          dropdown.classList.remove('hidden');
        } else {
          dropdown.innerHTML = '<div class="px-3 py-2.5 text-xs text-gray-400 text-center">Không tìm thấy mã trong CSDL</div>';
          dropdown.classList.remove('hidden');
        }
      } catch (err) {
        console.error(err);
      }
    }, 150);
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
}

// ==========================================
// ĐIỀU HƯỚNG VIEW & CÁC TRANG CHUYÊN ĐỀ
// ==========================================

let activeView = 'hsx';
let currentScreenerExchange = 'ALL';

function switchNavView(viewName) {
  activeView = viewName;
  const views = ['hsx', 'hnx', 'upcom', 'hpg-news', 'hpg-peers', 'hpg-hsx', 'a32-hnx', 'stock', 'market', 'financials', 'reports', 'events', 'screener'];
  
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    const btn = document.getElementById(`nav-btn-${v}`);
    if (el) {
      if (v === viewName) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
    if (btn) {
      if (v === viewName) {
        btn.className = "px-3 py-1.5 rounded transition text-yellow-400 bg-blue-900/80 font-bold hover:bg-blue-900 shadow-inner";
      } else {
        btn.className = "px-3 py-1.5 rounded transition hover:text-yellow-400 hover:bg-blue-900/50";
      }
    }
  });

  // Re-render icon
  try {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  } catch (e) {}

  // Gọi API tải dữ liệu cho view được kích hoạt
  if (viewName === 'hsx') {
    loadHsxStocks();
  } else if (viewName === 'hnx') {
    loadHnxListed();
  } else if (viewName === 'upcom') {
    loadHnxUpcom();
  } else if (viewName === 'hpg-news') {
    loadHpgNewsEvents();
  } else if (viewName === 'hpg-hsx') {
    loadHpgHsxDetail();
  } else if (viewName === 'a32-hnx') {
    loadA32Detail();
  } else if (viewName === 'hpg-peers') {
    loadHpgPeers();
  } else if (viewName === 'market') {
    loadMarketView();
  } else if (viewName === 'financials') {
    loadFinancialsView();
  } else if (viewName === 'reports') {
    loadReportsView();
  } else if (viewName === 'events') {
    loadEventsView();
  } else if (viewName === 'screener') {
    loadScreenerView(currentScreenerExchange);
  }
}

// Data caches
let allHsxStocks = [];
let allHnxListed = [];
let allHnxUpcom = [];

// 1. Tải danh sách HSX (HOSE - 406 CP)
async function loadHsxStocks() {
  try {
    const res = await fetch('/api/hsx/stocks');
    const json = await res.json();
    if (!json.success) return;
    allHsxStocks = json.data || [];
    renderHsxTable(allHsxStocks);
    const badge = document.getElementById('hsxTotalCount');
    if (badge) badge.textContent = allHsxStocks.length;
  } catch (e) {
    console.error('Lỗi loadHsxStocks:', e);
  }
}

function renderHsxTable(list) {
  const tbody = document.getElementById('hsxStocksTableBody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-6 text-gray-400">Không tìm thấy mã HSX phù hợp</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(item => {
    const capBillion = item.capital ? (item.capital / 1e9).toLocaleString('vi-VN', {maximumFractionDigits: 1}) + ' tỷ' : '--';
    return `
      <tr class="hover:bg-blue-50/50 transition">
        <td class="py-2 px-3 font-black text-blue-950">${item.code}</td>
        <td class="py-2 px-3 text-gray-800 font-sans font-semibold">${item.name}</td>
        <td class="py-2 px-3 text-right text-emerald-700 font-bold">${capBillion}</td>
        <td class="py-2 px-3 text-right text-gray-600">${item.listing_volume || '--'}</td>
        <td class="py-2 px-3 text-right text-gray-900 font-bold">${item.outstanding || '--'}</td>
        <td class="py-2 px-3 text-gray-700 font-sans">${item.director || '--'}</td>
        <td class="py-2 px-3 text-center text-blue-900 font-bold">${item.foreign_owned_ratio || '100'}%</td>
        <td class="py-2 px-3 text-center text-gray-500 font-mono text-[11px]">${item.isin || '--'}</td>
        <td class="py-2 px-3 text-center font-sans">
          <button onclick="${item.code === 'HPG' ? "switchNavView('hpg-hsx')" : `selectStockAndSwitch('${item.code}')`}" class="px-2 py-0.5 bg-blue-900 hover:bg-yellow-400 hover:text-blue-950 text-white rounded text-[11px] font-semibold transition">
            Chi tiết
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterHsxTable() {
  const q = document.getElementById('hsxSearchInput').value.trim().toUpperCase();
  if (!q) {
    renderHsxTable(allHsxStocks);
    return;
  }
  const filtered = allHsxStocks.filter(s => s.code.includes(q) || (s.name && s.name.toUpperCase().includes(q)));
  renderHsxTable(filtered);
}

// 2. Tải danh sách HNX Niêm Yết (299 CP)
async function loadHnxListed() {
  try {
    const res = await fetch('/api/hnx/listed');
    const json = await res.json();
    if (!json.success) return;
    allHnxListed = json.data || [];
    renderHnxTable(allHnxListed);
    const badge = document.getElementById('hnxTotalCount');
    if (badge) badge.textContent = allHnxListed.length;
  } catch (e) {
    console.error('Lỗi loadHnxListed:', e);
  }
}

function renderHnxTable(list) {
  const tbody = document.getElementById('hnxListedTableBody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-gray-400">Không tìm thấy mã HNX phù hợp</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(item => `
    <tr class="hover:bg-red-50/40 transition">
      <td class="py-2 px-3 text-center text-gray-400 font-mono">${item.stt || '--'}</td>
      <td class="py-2 px-3 font-black text-red-950 font-mono">${item.code}</td>
      <td class="py-2 px-3 text-gray-800 font-semibold">${item.name}</td>
      <td class="py-2 px-3 text-gray-600"><span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100">${item.sector || 'Chung'}</span></td>
      <td class="py-2 px-3 text-center font-mono text-gray-600">${item.first_trade_date || '--'}</td>
      <td class="py-2 px-3 text-right font-mono text-gray-700">${item.listing_volume || '--'}</td>
      <td class="py-2 px-3 text-right font-mono font-bold text-gray-900">${item.outstanding_shares || '--'}</td>
    </tr>
  `).join('');
}

function filterHnxTable() {
  const q = document.getElementById('hnxSearchInput').value.trim().toUpperCase();
  if (!q) {
    renderHnxTable(allHnxListed);
    return;
  }
  const filtered = allHnxListed.filter(s => s.code.includes(q) || (s.name && s.name.toUpperCase().includes(q)) || (s.sector && s.sector.toUpperCase().includes(q)));
  renderHnxTable(filtered);
}

// 3. Tải danh sách HNX UPCoM (299 CP)
async function loadHnxUpcom() {
  try {
    const res = await fetch('/api/hnx/upcom');
    const json = await res.json();
    if (!json.success) return;
    allHnxUpcom = json.data || [];
    renderUpcomTable(allHnxUpcom);
    const badge = document.getElementById('upcomTotalCount');
    if (badge) badge.textContent = allHnxUpcom.length;
  } catch (e) {
    console.error('Lỗi loadHnxUpcom:', e);
  }
}

function renderUpcomTable(list) {
  const tbody = document.getElementById('hnxUpcomTableBody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-gray-400">Không tìm thấy mã UPCoM phù hợp</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(item => `
    <tr class="hover:bg-amber-50/40 transition">
      <td class="py-2 px-3 text-center text-gray-400 font-mono">${item.stt || '--'}</td>
      <td class="py-2 px-3 font-black text-amber-950 font-mono">${item.code}</td>
      <td class="py-2 px-3 text-gray-800 font-semibold">${item.name}</td>
      <td class="py-2 px-3 text-gray-600"><span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100">${item.sector || 'Chung'}</span></td>
      <td class="py-2 px-3 text-center font-mono text-gray-600">${item.first_trade_date || '--'}</td>
      <td class="py-2 px-3 text-right font-mono text-gray-700">${item.listing_volume || '--'}</td>
      <td class="py-2 px-3 text-right font-mono font-bold text-gray-900">${item.outstanding_shares || '--'}</td>
      <td class="py-2 px-3 text-center">
        <button onclick="${item.code === 'A32' ? "switchNavView('a32-hnx')" : `selectStockAndSwitch('${item.code}')`}" class="px-2 py-0.5 bg-amber-600 hover:bg-yellow-400 hover:text-blue-950 text-white rounded text-[11px] font-semibold transition">
          ${item.code === 'A32' ? 'Tab 3' : 'Xem'}
        </button>
      </td>
    </tr>
  `).join('');
}

function filterUpcomTable() {
  const q = document.getElementById('upcomSearchInput').value.trim().toUpperCase();
  if (!q) {
    renderUpcomTable(allHnxUpcom);
    return;
  }
  const filtered = allHnxUpcom.filter(s => s.code.includes(q) || (s.name && s.name.toUpperCase().includes(q)) || (s.sector && s.sector.toUpperCase().includes(q)));
  renderUpcomTable(filtered);
}

// 4. Tải chi tiết hồ sơ HPG HSX (2458)
async function loadHpgHsxDetail() {
  try {
    const res = await fetch('/api/hsx/stock/HPG');
    const json = await res.json();
    if (!json.success || !json.data) return;
    const d = json.data;
    const container = document.getElementById('hpgHsxDetailContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div class="text-[10px] uppercase font-bold text-gray-400">Vốn Hóa Thị Trường (HSX)</div>
          <div class="text-xl font-black text-blue-950 mt-1 font-mono">${d.marketCap || '170,125.74'} tỷ</div>
          <div class="text-xs text-green-600 font-semibold mt-0.5">Top 5 vốn hóa sàn HOSE</div>
        </div>
        <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div class="text-[10px] uppercase font-bold text-gray-400">Vốn Điều Lệ Niêm Yết</div>
          <div class="text-xl font-black text-emerald-700 mt-1 font-mono">63,962 tỷ</div>
          <div class="text-xs text-gray-500 mt-0.5">Mệnh giá: 10,000 đ/cp</div>
        </div>
        <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div class="text-[10px] uppercase font-bold text-gray-400">Khối Lượng Lưu Hành</div>
          <div class="text-xl font-black text-gray-900 mt-1 font-mono">6,396,251,900 cp</div>
          <div class="text-xs text-blue-600 mt-0.5">Niêm yết lần đầu: 15/11/2007</div>
        </div>
        <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div class="text-[10px] uppercase font-bold text-gray-400">Trạng Thái Niêm Yết</div>
          <div class="text-base font-extrabold text-green-700 mt-1 flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-green-500"></span> ${d.listingTypeName || 'Đang được phép niêm yết'}
          </div>
          <div class="text-xs text-gray-500 mt-0.5">Room NN: ${d.foreignOwnedRatio || '49.00'}%</div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5 space-y-4">
        <h3 class="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2 flex items-center gap-2">
          <i data-lucide="building-2" class="w-4 h-4 text-blue-900"></i> Thông Tin Tổ Chức Niêm Yết Chính Thức (HSX Hồ Sơ ID: 2458)
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div><strong class="text-gray-500 w-36 inline-block">Tên Doanh Nghiệp:</strong> <span class="font-bold text-gray-900">${d.name}</span></div>
          <div><strong class="text-gray-500 w-36 inline-block">Tên Tiếng Anh:</strong> <span class="font-semibold text-gray-800">${d.brief || 'HOA PHAT GROUP'}</span></div>
          <div><strong class="text-gray-500 w-36 inline-block">Mã ISIN / Bloomberg:</strong> <span class="font-mono text-blue-900 font-bold">${d.isin || 'VN000000HPG4'} • ${d.bloomberg || 'BBG000BBV340'}</span></div>
          <div><strong class="text-gray-500 w-36 inline-block">Phân Ngành ICB:</strong> <span class="font-semibold text-gray-800">${d.sectorName || 'Materials | Tài nguyên Cơ bản (Thép)'}</span></div>
          <div><strong class="text-gray-500 w-36 inline-block">Địa Chỉ Trụ Sở:</strong> <span class="text-gray-800">${d.address || 'Khu công nghiệp Phố Nối A, Xã Nguyễn Văn Linh, Tỉnh Hưng Yên'}</span></div>
          <div><strong class="text-gray-500 w-36 inline-block">Website / Điện Thoại:</strong> <span class="font-semibold text-blue-800">${d.webUrl || 'www.hoaphat.com.vn'} • ${d.phone || '(84-0221) 3942 884'}</span></div>
          <div><strong class="text-gray-500 w-36 inline-block">Tổng Giám Đốc:</strong> <span class="font-bold text-gray-900">${d.director || 'Ông Nguyễn Việt Thắng'}</span></div>
          <div><strong class="text-gray-500 w-36 inline-block">Người CBTT:</strong> <span class="font-bold text-gray-900">${d.spokesman || 'Bà Bùi Thị Ngân'}</span></div>
        </div>
      </div>
    `;
    try { if (window.lucide) window.lucide.createIcons(); } catch (e) {}
  } catch (e) {
    console.error('Lỗi loadHpgHsxDetail:', e);
  }
}

// 5. Tải chi tiết A32 HNX (Tab 3: Sự kiện quyền & Tin công bố)
async function loadA32Detail() {
  try {
    const res = await fetch('/api/hnx/stock/A32');
    const json = await res.json();
    if (!json.success) return;

    // Render Events
    const evTbody = document.getElementById('a32EventsTableBody');
    if (evTbody && json.events) {
      evTbody.innerHTML = json.events.map(ev => `
        <tr class="hover:bg-emerald-50/50 transition">
          <td class="py-2.5 px-2.5 text-center text-gray-400 font-mono">${ev.stt || '--'}</td>
          <td class="py-2.5 px-2.5 text-blue-900 font-bold font-mono">${ev.ex_date || '--'}</td>
          <td class="py-2.5 px-2.5 text-gray-600 font-mono">${ev.record_date || '--'}</td>
          <td class="py-2.5 px-2.5 text-emerald-800 font-bold font-mono">${ev.exec_date || '--'}</td>
          <td class="py-2.5 px-2.5 font-sans font-semibold text-gray-800">${ev.event_type}</td>
        </tr>
      `).join('');
    }

    // Render News
    const newsTbody = document.getElementById('a32NewsTableBody');
    if (newsTbody && json.news) {
      newsTbody.innerHTML = json.news.map(n => `
        <tr class="hover:bg-blue-50/50 transition">
          <td class="py-2.5 px-2.5 text-center text-gray-400 font-mono">${n.stt || '--'}</td>
          <td class="py-2.5 px-2.5 text-gray-500 font-mono text-[11px]">${n.date}</td>
          <td class="py-2.5 px-2.5 font-sans font-semibold text-gray-900 leading-snug hover:text-blue-900 cursor-pointer">${n.title}</td>
        </tr>
      `).join('');
    }
  } catch (e) {
    console.error('Lỗi loadA32Detail:', e);
  }
}

// 6. Tải bảng so sánh cùng ngành HPG (Vietstock)
async function loadHpgPeers() {
  try {
    const res = await fetch('/api/peers/HPG');
    const json = await res.json();
    if (!json.success || !json.data) return;

    const tbody = document.getElementById('hpgPeersTableBody');
    if (!tbody) return;

    tbody.innerHTML = json.data.map(p => {
      const isBase = p.peer_symbol === 'HPG';
      const rowBg = isBase ? 'bg-amber-50/70 font-bold' : 'hover:bg-gray-50';
      const peStr = p.pe > 0 ? p.pe.toFixed(1) + 'x' : '--';
      const pbStr = p.pb > 0 ? p.pb.toFixed(1) + 'x' : '--';
      return `
        <tr class="${rowBg} transition cursor-pointer" onclick="selectStockAndSwitch('${p.peer_symbol}')">
          <td class="py-2.5 px-3 font-black ${isBase ? 'text-amber-900 text-sm' : 'text-blue-950'}">${p.peer_symbol}</td>
          <td class="py-2.5 px-3 font-sans ${isBase ? 'text-amber-950 font-black' : 'text-gray-800 font-semibold'}">${p.peer_name}</td>
          <td class="py-2.5 px-3 text-right font-black ${isBase ? 'text-amber-800' : 'text-blue-900'}">${p.price.toFixed(1)}</td>
          <td class="py-2.5 px-3 text-right font-mono">${peStr}</td>
          <td class="py-2.5 px-3 text-right font-mono">${pbStr}</td>
          <td class="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">${Number(p.market_cap).toLocaleString()} tỷ</td>
          <td class="py-2.5 px-3 text-right font-mono text-gray-600">${Number(p.volume).toLocaleString()}</td>
          <td class="py-2.5 px-3 text-center font-sans">
            <button onclick="selectStockAndSwitch('${p.peer_symbol}')" class="px-2.5 py-0.5 bg-blue-900 hover:bg-yellow-400 hover:text-blue-950 text-white rounded text-[11px] font-semibold transition">
              Đồ thị & BCTC
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    console.error('Lỗi loadHpgPeers:', e);
  }
}

// 6b. Tải Tin tức & Sự kiện Đa Mã Doanh Nghiệp (Vietstock Chuẩn)
let currentNewsSymbol = 'HPG';
let allHpgNews = [];
let allHpgEvents = [];
let activeNewsCategory = 'ALL';

const companyNamesMap = {
  'HPG': 'CTCP Tập đoàn Hòa Phát',
  'VNM': 'CTCP Sữa Việt Nam (Vinamilk)',
  'FPT': 'CTCP FPT',
  'VCB': 'Ngân hàng TMCP Ngoại Thương Việt Nam (Vietcombank)',
  'SSI': 'CTCP Chứng khoán SSI'
};

function formatVietstockDate(raw) {
  if (!raw) return '--';
  if (typeof raw === 'string') {
    if (raw.includes('/Date(')) {
      const matches = raw.match(/\/Date\((\d+)\)\//);
      if (matches && matches[1]) {
        const d = new Date(parseInt(matches[1], 10));
        if (!isNaN(d.getTime())) {
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          const hours = String(d.getHours()).padStart(2, '0');
          const mins = String(d.getMinutes()).padStart(2, '0');
          if (hours === '00' && mins === '00') {
            return `${day}/${month}/${year}`;
          }
          return `${day}/${month}/${year} ${hours}:${mins}`;
        }
      }
    }
    return raw;
  }
  return String(raw);
}

let currentNewsPage = 1;
const newsPageSize = 8;
let currentFilteredNews = [];
let currentSideEventsTab = 'current';

let currentMainTab = 'news'; // 'news' or 'events'
let currentMainEventsPage = 1;
const mainEventsPageSize = 8;
let currentFilteredMainEvents = [];
let currentMainEventsScope = 'current'; // 'current' or 'all'
let currentMainEventsType = 'ALL';

async function switchNewsSymbol(symbol) {
  currentNewsSymbol = symbol.toUpperCase();
  await loadHpgNewsEvents(currentNewsSymbol);
}

async function loadHpgNewsEvents(symbol = currentNewsSymbol) {
  currentNewsSymbol = symbol.toUpperCase();
  try {
    // 1. Cập nhật nhãn Ticker và tên công ty trên view
    const tickerEl = document.getElementById('newsSymbolTicker');
    const nameEl = document.getElementById('newsCompanyName');
    const srcSymEl = document.getElementById('sourceSymbolLabel');
    const scopeSymEl = document.getElementById('mainEventScopeSymbol');
    if (tickerEl) tickerEl.textContent = currentNewsSymbol;
    if (nameEl) nameEl.textContent = companyNamesMap[currentNewsSymbol] || `Doanh nghiệp niêm yết ${currentNewsSymbol}`;
    if (srcSymEl) srcSymEl.textContent = currentNewsSymbol;
    if (scopeSymEl) scopeSymEl.textContent = currentNewsSymbol;

    // 2. Tải danh sách bài báo tin tức của mã
    const resNews = await fetch(`/api/company/${currentNewsSymbol}/news`);
    const jsonNews = await resNews.json();
    if (jsonNews && jsonNews.success) {
      allHpgNews = jsonNews.data || [];
      const newsBadge = document.getElementById('mainNewsCountBadge');
      if (newsBadge) newsBadge.textContent = allHpgNews.length.toLocaleString('vi-VN');
      setHpgNewsList(allHpgNews);
    }

    // 3. Tải danh sách sự kiện quyền & cổ tức của mã
    const resEvents = await fetch(`/api/company/${currentNewsSymbol}/corporate-events`);
    const jsonEvents = await resEvents.json();
    if (jsonEvents && jsonEvents.success) {
      allHpgEvents = jsonEvents.data || [];
      const evBadge = document.getElementById('mainEventsCountBadge');
      const evStockBadge = document.getElementById('mainEventsStockCount');
      if (evBadge) evBadge.textContent = allHpgEvents.length.toLocaleString('vi-VN');
      if (evStockBadge) evStockBadge.textContent = allHpgEvents.length.toLocaleString('vi-VN');
      
      setMainEventsList(allHpgEvents);
      if (currentSideEventsTab === 'current') {
        renderHpgEventsList(allHpgEvents);
      }
    }

    // 4. Tải danh sách Công Bố Thông Tin chính thức có File PDF
    await loadHpgDisclosures(currentNewsSymbol);
  } catch (err) {
    console.error('Lỗi loadHpgNewsEvents:', err);
  }
}

function setHpgNewsList(list) {
  currentFilteredNews = list || [];
  currentNewsPage = 1;
  renderHpgNewsTimeline(1);
}

function renderHpgNewsTimeline(page = currentNewsPage) {
  const container = document.getElementById('hpgNewsTimelineContainer');
  const infoEl = document.getElementById('hpgNewsPaginationInfo');
  const pagBtnsEl = document.getElementById('hpgNewsPaginationButtons');
  if (!container) return;

  const total = currentFilteredNews.length;
  if (total === 0) {
    container.innerHTML = '<div class="py-8 text-center text-gray-400 text-xs">Không có tin tức nào trong danh mục này</div>';
    if (infoEl) infoEl.textContent = '0 tin tức';
    if (pagBtnsEl) pagBtnsEl.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(total / newsPageSize) || 1;
  currentNewsPage = Math.max(1, Math.min(page, totalPages));

  const startIdx = (currentNewsPage - 1) * newsPageSize;
  const endIdx = Math.min(startIdx + newsPageSize, total);
  const pageItems = currentFilteredNews.slice(startIdx, endIdx);

  if (infoEl) {
    infoEl.innerHTML = `Hiển thị <strong class="text-blue-900">${startIdx + 1} - ${endIdx}</strong> / <strong class="text-gray-700">${total}</strong> tin bài`;
  }

  container.innerHTML = pageItems.map((item, idx) => {
    const rawTime = formatVietstockDate(item.publish_time);
    const source = item.source || 'Vietstock';
    const linkUrl = item.url ? (item.url.startsWith('http') ? item.url : `https://vietstock.vn${item.url}`) : 'https://finance.vietstock.vn/HPG/tin-tuc-su-kien.htm';
    const attachPdf = item.pdf_attachment || (item.title && (item.title.includes('Dung Quất') || item.title.includes('bảo lãnh')) ? '/api/pdf/HPG_NQ_HDQT_DungQuat2_2026.pdf' : (item.title && (item.title.includes('lợi nhuận') || item.title.includes('tài chính')) ? '/api/pdf/HPG_BCTC_Q2_2026_SoatXet.pdf' : null));
    
    // Tag màu theo nguồn hoặc chuyên mục
    const sourceBadge = source.toLowerCase().includes('vietstock') 
      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
      : 'bg-emerald-50 text-emerald-700 border border-emerald-200';

    const sentiment = item.ai_sentiment || 'TÍCH CỰC (BULLISH)';
    const isBull = sentiment.includes('TÍCH CỰC');
    const sentBadge = isBull ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800';

    return `
      <div class="py-3.5 hover:bg-slate-50/70 px-2.5 rounded-lg transition group border-b border-gray-100 last:border-b-0">
        <div class="flex items-center gap-2 mb-1.5 text-[11px] text-gray-400 font-mono flex-wrap">
          <i data-lucide="clock" class="w-3.5 h-3.5 text-gray-400"></i>
          <span class="font-semibold text-gray-500">${rawTime}</span>
          <span>•</span>
          <span class="px-1.5 py-0.2 rounded text-[10px] font-bold ${sourceBadge}">${source}</span>
          <span>•</span>
          <span class="text-blue-900 font-black">${currentNewsSymbol}</span>
          <span>•</span>
          <span class="px-1.5 py-0.2 rounded text-[10px] font-bold ${sentBadge}">AI: ${sentiment}</span>
          ${attachPdf ? `
            <span>•</span>
            <span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 flex items-center gap-1 border border-rose-200">
              <i data-lucide="file-text" class="w-3 h-3 text-rose-600"></i> Kèm File PDF
            </span>
          ` : ''}
        </div>
        <h4 class="text-sm font-bold text-gray-900 group-hover:text-blue-800 leading-snug transition cursor-pointer" onclick="openArticleAiModal(${item.id})">
          ${item.title}
        </h4>
        ${item.head ? `
          <p class="text-xs text-gray-600 mt-1.5 line-clamp-2 leading-relaxed">
            ${item.head}
          </p>
        ` : ''}
        <div class="mt-2.5 flex items-center gap-2.5 text-xs flex-wrap">
          <button onclick="openArticleAiModal(${item.id})" class="px-2.5 py-1 bg-blue-900 hover:bg-yellow-400 hover:text-blue-950 text-white font-bold rounded text-[11px] transition flex items-center gap-1 shadow-xs">
            <i data-lucide="sparkles" class="w-3 h-3"></i> Đọc Toàn Văn &amp; AI
          </button>
          ${attachPdf ? `
            <button onclick="openPdfViewerModal('${attachPdf}', '${item.title.replace(/'/g, "\\'")}', 'CBTT-${item.id}', '${rawTime}', 'PDF A4', 'Tài liệu đính kèm', '${(item.ai_summary || item.head || '').replace(/'/g, "\\'")}')" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[11px] transition flex items-center gap-1 shadow-xs">
              <i data-lucide="file-text" class="w-3 h-3"></i> Xem File PDF Đính Kèm
            </button>
            <a href="${attachPdf}" download class="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded text-[11px] transition flex items-center gap-1">
              <i data-lucide="download" class="w-3 h-3"></i> Tải PDF
            </a>
          ` : ''}
          <a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-blue-700 font-medium text-[11px] hover:underline flex items-center gap-1 ml-auto">
            Nguồn Vietstock <i data-lucide="external-link" class="w-3 h-3"></i>
          </a>
        </div>
      </div>
    `;
  }).join('');

  // Render các nút phân trang
  if (pagBtnsEl) {
    if (totalPages <= 1) {
      pagBtnsEl.innerHTML = '';
    } else {
      let btnsHtml = '';
      btnsHtml += `<button onclick="changeHpgNewsPage(1)" class="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs disabled:opacity-40 transition" ${currentNewsPage <= 1 ? 'disabled' : ''} title="Trang đầu">«</button>`;
      btnsHtml += `<button onclick="changeHpgNewsPage(${currentNewsPage - 1})" class="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs disabled:opacity-40 transition" ${currentNewsPage <= 1 ? 'disabled' : ''}>Trước</button>`;
      
      const startP = Math.max(1, currentNewsPage - 2);
      const endP = Math.min(totalPages, currentNewsPage + 2);
      
      if (startP > 1) {
        btnsHtml += `<button onclick="changeHpgNewsPage(1)" class="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition">1</button>`;
        if (startP > 2) btnsHtml += `<span class="px-1 text-gray-400">...</span>`;
      }
      
      for (let p = startP; p <= endP; p++) {
        const isAct = p === currentNewsPage;
        const cls = isAct ? 'px-2.5 py-1 rounded bg-blue-900 text-white font-bold text-xs shadow-xs' : 'px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition';
        btnsHtml += `<button onclick="changeHpgNewsPage(${p})" class="${cls}">${p}</button>`;
      }
      
      if (endP < totalPages) {
        if (endP < totalPages - 1) btnsHtml += `<span class="px-1 text-gray-400">...</span>`;
        btnsHtml += `<button onclick="changeHpgNewsPage(${totalPages})" class="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition">${totalPages}</button>`;
      }
      
      btnsHtml += `<button onclick="changeHpgNewsPage(${currentNewsPage + 1})" class="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs disabled:opacity-40 transition" ${currentNewsPage >= totalPages ? 'disabled' : ''}>Sau</button>`;
      btnsHtml += `<button onclick="changeHpgNewsPage(${totalPages})" class="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs disabled:opacity-40 transition" ${currentNewsPage >= totalPages ? 'disabled' : ''} title="Trang cuối">»</button>`;
      pagBtnsEl.innerHTML = btnsHtml;
    }
  }

  try { if (window.lucide) window.lucide.createIcons(); } catch (e) {}
}

function changeHpgNewsPage(page) {
  const totalPages = Math.ceil(currentFilteredNews.length / newsPageSize) || 1;
  if (page >= 1 && page <= totalPages && page !== currentNewsPage) {
    renderHpgNewsTimeline(page);
    const container = document.getElementById('hpgNewsTimelineContainer');
    if (container) container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// BỘ ĐIỀU KHIỂN MODAL ĐỌC TOÀN VĂN & AI AGENT CONTEXT INGESTION
let currentModalArticle = null;

function openArticleAiModal(newsId) {
  const modal = document.getElementById('articleAiModal');
  if (!modal) return;

  const item = allHpgNews.find(n => n.id === newsId) || (allHpgNews.length > 0 ? allHpgNews[0] : null);
  if (!item) return;

  currentModalArticle = item;

  // Điền dữ liệu vào Modal
  const titleEl = document.getElementById('modalArticleTitle');
  const timeEl = document.getElementById('modalArticleTime');
  const sentBadge = document.getElementById('modalArticleSentimentBadge');
  const impactBadge = document.getElementById('modalArticleImpactBadge');
  const sumEl = document.getElementById('modalArticleAiSummary');
  const contentEl = document.getElementById('modalArticleFullContent');
  const jsonPre = document.getElementById('modalArticleJsonPre');
  const extLink = document.getElementById('modalArticleExternalLink');

  if (titleEl) titleEl.textContent = item.title;
  if (timeEl) timeEl.textContent = `${item.publish_time || '08/10/2026'} • ${item.source || 'Vietstock'}`;
  
  const sentiment = item.ai_sentiment || 'TÍCH CỰC (BULLISH)';
  const isBull = sentiment.includes('TÍCH CỰC');
  if (sentBadge) {
    sentBadge.textContent = sentiment;
    sentBadge.className = isBull ? "px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white" : "px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white";
  }

  if (impactBadge) {
    const score = item.ai_impact_score || (isBull ? 8.5 : -4.0);
    impactBadge.textContent = `${score > 0 ? '+' : ''}${score}/10 Điểm tác động`;
  }

  if (sumEl) {
    sumEl.textContent = item.ai_summary || item.head || "Tập đoàn Hòa Phát giữ vững vị thế đầu ngành, hưởng lợi lớn từ tiến độ Dung Quất 2 và giải ngân đầu tư công.";
  }

  if (contentEl) {
    contentEl.textContent = item.content_full || item.ai_clean_text || item.head || item.title;
  }

  if (extLink) {
    extLink.href = item.url ? (item.url.startsWith('http') ? item.url : `https://vietstock.vn${item.url}`) : 'https://finance.vietstock.vn/HPG/tin-tuc-su-kien.htm';
  }

  // Chuẩn hóa JSON Context cho AI Agent
  if (jsonPre) {
    const sym = (item.symbol || currentNewsSymbol || "HPG").toUpperCase();
    const aiContextObject = {
      context_type: "FINANCIAL_NEWS_STREAM",
      ticker: sym,
      company_name: companyNamesMap[sym] || `Doanh nghiệp niêm yết ${sym}`,
      exchange: "HOSE",
      article_id: item.id,
      published_at: item.publish_time,
      headline: item.title,
      sentiment_analysis: {
        classification: sentiment,
        impact_score: item.ai_impact_score || (isBull ? 8.5 : -4.0),
        confidence: 0.94,
        key_topics: item.ai_topics || "Doanh nghiệp & Triển vọng ngành"
      },
      executive_summary: item.ai_summary || item.head,
      full_text_markdown: item.content_full || item.ai_clean_text,
      source_metadata: {
        source_name: item.source || "Vietstock",
        verified: true,
        local_db_status: "CACHED_SQLITE_READY"
      }
    };
    jsonPre.textContent = JSON.stringify(aiContextObject, null, 2);
  }

  // Xử lý Box File PDF đính kèm của bài viết
  const pdfBox = document.getElementById('modalArticlePdfBox');
  const pdfTitle = document.getElementById('modalArticlePdfTitle');
  const pdfViewBtn = document.getElementById('modalArticlePdfViewBtn');
  const pdfDlBtn = document.getElementById('modalArticlePdfDownloadBtn');
  const attachPdf = item.pdf_attachment || (item.title && (item.title.includes('Dung Quất') || item.title.includes('bảo lãnh')) ? '/api/pdf/HPG_NQ_HDQT_DungQuat2_2026.pdf' : (item.title && (item.title.includes('lợi nhuận') || item.title.includes('tài chính')) ? '/api/pdf/HPG_BCTC_Q2_2026_SoatXet.pdf' : null));

  if (pdfBox) {
    if (attachPdf) {
      pdfBox.classList.remove('hidden');
      if (pdfTitle) pdfTitle.textContent = `${item.title} (Bản PDF Chính Thức)`;
      if (pdfDlBtn) {
        pdfDlBtn.href = attachPdf;
        pdfDlBtn.setAttribute('download', attachPdf.split('/').pop() || 'document.pdf');
      }
      if (pdfViewBtn) {
        pdfViewBtn.onclick = () => {
          openPdfViewerModal(attachPdf, item.title, `CBTT-${item.id}`, item.publish_time, 'PDF A4', 'Tài liệu đính kèm', item.ai_summary || item.head);
        };
      }
    } else {
      pdfBox.classList.add('hidden');
    }
  }

  switchModalTab('reader');
  modal.classList.remove('hidden');
  try { if (window.lucide) window.lucide.createIcons(); } catch (e) {}
}

function closeArticleAiModal() {
  const modal = document.getElementById('articleAiModal');
  if (modal) modal.classList.add('hidden');
}

function switchModalTab(tab) {
  const readerContent = document.getElementById('modalTabReaderContent');
  const jsonContent = document.getElementById('modalTabJsonContent');
  const readerBtn = document.getElementById('modalTabReaderBtn');
  const jsonBtn = document.getElementById('modalTabJsonBtn');

  if (tab === 'reader') {
    if (readerContent) readerContent.classList.remove('hidden');
    if (jsonContent) jsonContent.classList.add('hidden');
    if (readerBtn) readerBtn.className = "px-3 py-1 bg-white font-bold text-blue-950 rounded shadow-xs border border-gray-300";
    if (jsonBtn) jsonBtn.className = "px-3 py-1 bg-transparent hover:bg-gray-200 font-semibold text-gray-700 rounded";
  } else {
    if (readerContent) readerContent.classList.add('hidden');
    if (jsonContent) jsonContent.classList.remove('hidden');
    if (jsonBtn) jsonBtn.className = "px-3 py-1 bg-white font-bold text-blue-950 rounded shadow-xs border border-gray-300";
    if (readerBtn) readerBtn.className = "px-3 py-1 bg-transparent hover:bg-gray-200 font-semibold text-gray-700 rounded";
  }
}

function copyModalAiJson() {
  const jsonPre = document.getElementById('modalArticleJsonPre');
  if (jsonPre) {
    navigator.clipboard.writeText(jsonPre.textContent).then(() => {
      alert("Đã sao chép dữ liệu JSON Context cho AI Agent thành công!");
    }).catch(() => {
      alert("Không thể sao chép tự động, vui lòng chọn văn bản và copy thủ công.");
    });
  }
}

function filterHpgNewsCategory(cat) {
  activeNewsCategory = cat;
  const categories = [
    { id: 'ALL', btn: 'filter-news-all' },
    { id: 'DOANH_NGHIEP', btn: 'filter-news-doanhnghiep' },
    { id: 'CO_TUC', btn: 'filter-news-cotuc' },
    { id: 'GIAO_DICH', btn: 'filter-news-giaodich' },
    { id: 'KET_QUA_KD', btn: 'filter-news-ketquakd' },
    { id: 'NGANH_THEP', btn: 'filter-news-nganhthep' }
  ];

  categories.forEach(c => {
    const btn = document.getElementById(c.btn);
    if (btn) {
      if (c.id === cat) {
        btn.className = "px-3 py-1 rounded bg-blue-900 text-white font-bold transition shadow-sm";
      } else {
        btn.className = "px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition";
      }
    }
  });

  if (cat === 'ALL') {
    setHpgNewsList(allHpgNews);
  } else if (cat === 'DOANH_NGHIEP') {
    const sym = currentNewsSymbol;
    const filtered = allHpgNews.filter(n => (n.title && (n.title.includes(sym) || n.title.includes('HPG') || n.title.includes('Hòa Phát') || n.title.includes('Vinamilk') || n.title.includes('FPT'))));
    setHpgNewsList(filtered.length ? filtered : allHpgNews.slice(0, 8));
  } else if (cat === 'CO_TUC') {
    const filtered = allHpgNews.filter(n => (n.title && (n.title.toLowerCase().includes('cổ tức') || n.title.toLowerCase().includes('phát hành') || n.title.toLowerCase().includes('trả'))));
    setHpgNewsList(filtered.length ? filtered : allHpgNews.slice(0, 4));
  } else if (cat === 'GIAO_DICH') {
    const filtered = allHpgNews.filter(n => (n.title && (n.title.toLowerCase().includes('giao dịch') || n.title.toLowerCase().includes('mua') || n.title.toLowerCase().includes('bán') || n.title.toLowerCase().includes('cổ đông'))));
    setHpgNewsList(filtered.length ? filtered : allHpgNews.slice(0, 5));
  } else if (cat === 'KET_QUA_KD') {
    const filtered = allHpgNews.filter(n => (n.title && (n.title.toLowerCase().includes('lợi nhuận') || n.title.toLowerCase().includes('kết quả') || n.title.toLowerCase().includes('doanh thu'))));
    setHpgNewsList(filtered.length ? filtered : allHpgNews.slice(0, 6));
  } else if (cat === 'NGANH_THEP') {
    const filtered = allHpgNews.filter(n => (n.title && (n.title.toLowerCase().includes('thép') || n.title.toLowerCase().includes('hrc') || n.title.toLowerCase().includes('quặng'))));
    setHpgNewsList(filtered.length ? filtered : allHpgNews);
  }
}

// BỘ CHUYỂN ĐỔI TAB SỰ KIỆN CỘT PHẢI: MÃ NÀY VS TOÀN THỊ TRƯỜNG (3,800+ SỰ KIỆN)
async function switchSideEventsTab(tab) {
  currentSideEventsTab = tab;
  const btnCur = document.getElementById('btnSideEventCurrent');
  const btnAll = document.getElementById('btnSideEventAll');
  const container = document.getElementById('hpgEventsListContainer');

  if (tab === 'current') {
    if (btnCur) btnCur.className = "px-2 py-0.5 rounded font-bold bg-blue-900 text-white shadow-xs";
    if (btnAll) btnAll.className = "px-2 py-0.5 rounded font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700";
    renderHpgEventsList(allHpgEvents);
  } else {
    if (btnCur) btnCur.className = "px-2 py-0.5 rounded font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700";
    if (btnAll) btnAll.className = "px-2 py-0.5 rounded font-bold bg-blue-900 text-white shadow-xs";

    if (container) {
      container.innerHTML = '<div class="py-6 text-center text-gray-400 text-xs"><span class="animate-spin inline-block mr-1">🔄</span> Đang nạp 30 sự kiện mới nhất toàn thị trường...</div>';
    }

    try {
      const res = await fetch('/api/market/events?limit=30');
      const json = await res.json();
      if (!json.success || !json.data || json.data.length === 0) {
        if (container) container.innerHTML = '<div class="py-6 text-center text-gray-400 text-xs">Không có sự kiện thị trường nào</div>';
        return;
      }

      if (container) {
        const topHtml = `
          <div class="p-2.5 mb-2.5 bg-blue-50/90 rounded-lg border border-blue-200 flex items-center justify-between text-xs">
            <div>
              <span class="text-blue-950 font-bold">Toàn TT:</span> <strong class="text-emerald-700 font-mono">${(json.total || 3800).toLocaleString('vi-VN')}</strong> sự kiện
            </div>
            <button onclick="switchNavView('events')" class="px-2 py-0.8 bg-blue-900 hover:bg-yellow-400 hover:text-blue-950 text-white font-bold rounded text-[10px] transition shadow-xs">
              Mở Lịch 3,800 SK &rarr;
            </button>
          </div>
        `;

        const itemsHtml = json.data.map(ev => {
          const isDividend = ev.event_type && (ev.event_type.toLowerCase().includes('cổ tức') || ev.event_type.toLowerCase().includes('tiền'));
          const badgeColor = isDividend ? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-blue-100 text-blue-900 border-blue-200';
          const pdfUrl = ev.file_url || `/api/pdf/${ev.symbol}_NQ_HDQT_2026.pdf`;
          const docTitle = (ev.description || ev.event_type || 'Nghị quyết HĐQT').replace(/'/g, "\\'");
          const docSum = (ev.ai_summary || '').replace(/'/g, "\\'");
          const valStr = ev.value && ev.value > 0 ? `${Number(ev.value).toLocaleString('vi-VN')} đ/cp` : (ev.ratio ? `Tỷ lệ ${ev.ratio}` : '');

          return `
            <div class="p-2.5 rounded-lg border border-gray-200 bg-white hover:border-blue-400 hover:shadow-xs transition text-xs">
              <div class="flex items-center justify-between gap-1.5 mb-1 flex-wrap">
                <div class="flex items-center gap-1.5">
                  <span class="font-black text-blue-950 hover:text-amber-600 cursor-pointer font-mono text-xs" onclick="selectStockAndSwitch('${ev.symbol}')">${ev.symbol}</span>
                  <span class="px-1.5 py-0.2 rounded text-[9px] font-bold border ${badgeColor}">${ev.event_type}</span>
                </div>
                <span class="font-mono text-[10px] text-gray-500 font-semibold">GDKHQ: <strong class="text-emerald-700">${ev.ex_date || '--'}</strong></span>
              </div>
              <div class="font-semibold text-gray-900 text-[11px] leading-snug cursor-pointer hover:text-blue-800" onclick="openPdfViewerModal('${pdfUrl}', '${docTitle}', 'CBTT-${ev.symbol}', '${ev.ex_date}', 'PDF A4', '${ev.event_type}', '${docSum}')">
                ${ev.description || ev.event_type}
              </div>
              <div class="flex items-center justify-between text-[10px] text-gray-500 mt-1.5 pt-1.5 border-t border-gray-100 flex-wrap gap-1">
                <span class="font-bold text-amber-800">${valStr}</span>
                <div class="flex items-center gap-1">
                  <button onclick="openPdfViewerModal('${pdfUrl}', '${docTitle}', 'CBTT-${ev.symbol}', '${ev.ex_date}', 'PDF A4', '${ev.event_type}', '${docSum}')" class="text-blue-900 font-bold hover:underline flex items-center gap-0.5 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                    <i data-lucide="eye" class="w-3 h-3"></i> Xem
                  </button>
                  <a href="${pdfUrl}" download class="text-rose-700 font-bold hover:underline flex items-center gap-0.5 bg-rose-50 px-1.5 py-0.5 rounded text-[10px]">
                    <i data-lucide="download" class="w-3 h-3"></i> Tải PDF
                  </a>
                </div>
              </div>
            </div>
          `;
        }).join('');

        container.innerHTML = topHtml + itemsHtml;
        try { if (window.lucide) window.lucide.createIcons(); } catch (e) {}
      }
    } catch (err) {
      console.error('Lỗi tải sự kiện thị trường bên cột phải:', err);
      if (container) container.innerHTML = '<div class="py-6 text-center text-red-500 text-xs">Lỗi kết nối khi nạp sự kiện toàn thị trường</div>';
    }
  }
}

// ========================================================
// BỘ ĐIỀU KHIỂN TAB CHÍNH: TIN TỨC VS LỊCH SỰ KIỆN QUYỀN
// ========================================================
function switchMainNewsEventsMode(mode) {
  currentMainTab = mode;
  const btnNews = document.getElementById('btnMainModeNews');
  const btnEvents = document.getElementById('btnMainModeEvents');
  const secNews = document.getElementById('hpgNewsMainSection');
  const secEvents = document.getElementById('hpgEventsMainSection');

  if (mode === 'news') {
    if (btnNews) btnNews.className = "px-3.5 py-1.5 rounded-md font-bold text-xs bg-blue-900 text-white shadow-xs transition flex items-center gap-1.5";
    if (btnEvents) btnEvents.className = "px-3.5 py-1.5 rounded-md font-semibold text-xs text-gray-700 hover:text-blue-950 hover:bg-slate-200 transition flex items-center gap-1.5";
    if (secNews) secNews.classList.remove('hidden');
    if (secEvents) secEvents.classList.add('hidden');
  } else {
    if (btnNews) btnNews.className = "px-3.5 py-1.5 rounded-md font-semibold text-xs text-gray-700 hover:text-blue-950 hover:bg-slate-200 transition flex items-center gap-1.5";
    if (btnEvents) btnEvents.className = "px-3.5 py-1.5 rounded-md font-bold text-xs bg-blue-900 text-white shadow-xs transition flex items-center gap-1.5";
    if (secNews) secNews.classList.add('hidden');
    if (secEvents) secEvents.classList.remove('hidden');
    renderMainEventsList();
  }
  try { if (window.lucide) window.lucide.createIcons(); } catch (e) {}
}

async function switchMainEventsScope(scope) {
  currentMainEventsScope = scope;
  const btnCur = document.getElementById('btnMainEventScopeCurrent');
  const btnAll = document.getElementById('btnMainEventScopeAll');

  if (scope === 'current') {
    if (btnCur) btnCur.className = "px-2.5 py-1 rounded bg-blue-900 text-white font-bold transition shadow-xs";
    if (btnAll) btnAll.className = "px-2.5 py-1 rounded bg-transparent hover:bg-gray-200 text-gray-700 transition";
    filterMainEventsByType(currentMainEventsType);
  } else {
    if (btnCur) btnCur.className = "px-2.5 py-1 rounded bg-transparent hover:bg-gray-200 text-gray-700 transition";
    if (btnAll) btnAll.className = "px-2.5 py-1 rounded bg-blue-900 text-white font-bold transition shadow-xs";

    const container = document.getElementById('hpgEventsMainTimelineContainer');
    if (container) {
      container.innerHTML = '<div class="py-8 text-center text-gray-400 text-xs"><span class="animate-spin inline-block mr-1">🔄</span> Đang nạp danh sách sự kiện toàn thị trường...</div>';
    }

    try {
      const res = await fetch('/api/market/events?limit=100');
      const json = await res.json();
      if (json && json.success) {
        const marketList = json.data.map(e => ({
          ...e,
          title: e.description || e.event_type,
          gdkhq_date: e.ex_date,
          ndkcc_date: e.record_date,
          content: e.description
        }));
        setMainEventsList(marketList);
      }
    } catch (err) {
      console.error('Lỗi tải toàn thị trường trong tab sự kiện:', err);
    }
  }
}

function filterMainEventsByType(type) {
  currentMainEventsType = type;
  const types = [
    { id: 'ALL', btn: 'filter-mev-type-ALL' },
    { id: 'TIEN', btn: 'filter-mev-type-TIEN' },
    { id: 'CP', btn: 'filter-mev-type-CP' },
    { id: 'DHCD', btn: 'filter-mev-type-DHCD' },
    { id: 'QUYEN', btn: 'filter-mev-type-QUYEN' }
  ];

  types.forEach(t => {
    const btn = document.getElementById(t.btn);
    if (btn) {
      if (t.id === type) {
        btn.className = "px-2.5 py-1 rounded bg-blue-900 text-white font-bold transition";
      } else {
        btn.className = "px-2.5 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition";
      }
    }
  });

  const sourceList = (currentMainEventsScope === 'current') ? allHpgEvents : currentFilteredMainEvents;
  if (type === 'ALL') {
    setMainEventsList(sourceList);
  } else if (type === 'TIEN') {
    const filtered = sourceList.filter(e => {
      const text = ((e.title || '') + ' ' + (e.content || '') + ' ' + (e.event_type || '')).toLowerCase();
      return text.includes('tiền') || text.includes('cash');
    });
    setMainEventsList(filtered);
  } else if (type === 'CP') {
    const filtered = sourceList.filter(e => {
      const text = ((e.title || '') + ' ' + (e.content || '') + ' ' + (e.event_type || '')).toLowerCase();
      return text.includes('cổ phiếu') || text.includes('cp') || text.includes('tăng vốn');
    });
    setMainEventsList(filtered);
  } else if (type === 'DHCD') {
    const filtered = sourceList.filter(e => {
      const text = ((e.title || '') + ' ' + (e.content || '') + ' ' + (e.event_type || '')).toLowerCase();
      return text.includes('đhđcđ') || text.includes('đại hội') || text.includes('cổ đông') || text.includes('nghị quyết');
    });
    setMainEventsList(filtered);
  } else if (type === 'QUYEN') {
    const filtered = sourceList.filter(e => {
      const text = ((e.title || '') + ' ' + (e.content || '') + ' ' + (e.event_type || '')).toLowerCase();
      return text.includes('quyền') || text.includes('mua') || text.includes('phát hành');
    });
    setMainEventsList(filtered);
  }
}

function setMainEventsList(list) {
  currentFilteredMainEvents = list || [];
  currentMainEventsPage = 1;
  renderMainEventsList(1);
}

function renderMainEventsList(page = currentMainEventsPage) {
  const container = document.getElementById('hpgEventsMainTimelineContainer');
  const infoEl = document.getElementById('hpgEventsMainPaginationInfo');
  const pagBtnsEl = document.getElementById('hpgEventsMainPaginationButtons');
  if (!container) return;

  const total = currentFilteredMainEvents.length;
  if (total === 0) {
    container.innerHTML = '<div class="py-8 text-center text-gray-400 text-xs">Không có sự kiện quyền nào trong mục này</div>';
    if (infoEl) infoEl.textContent = '0 sự kiện';
    if (pagBtnsEl) pagBtnsEl.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(total / mainEventsPageSize) || 1;
  currentMainEventsPage = Math.max(1, Math.min(page, totalPages));

  const startIdx = (currentMainEventsPage - 1) * mainEventsPageSize;
  const endIdx = Math.min(startIdx + mainEventsPageSize, total);
  const pageItems = currentFilteredMainEvents.slice(startIdx, endIdx);

  if (infoEl) {
    infoEl.innerHTML = `Hiển thị <strong class="text-blue-900">${startIdx + 1} - ${endIdx}</strong> / <strong class="text-gray-700">${total}</strong> sự kiện`;
  }

  container.innerHTML = pageItems.map((ev, idx) => {
    const title = ev.title || ev.content || 'Sự kiện quyền doanh nghiệp';
    const sym = ev.symbol || currentNewsSymbol;
    const gdkhq = formatVietstockDate(ev.gdkhq_date || ev.ex_date);
    const ndkcc = formatVietstockDate(ev.ndkcc_date || ev.record_date);
    const execDate = formatVietstockDate(ev.exec_date);
    const isDividend = title.toLowerCase().includes('cổ tức') || title.toLowerCase().includes('tiền');
    const badgeColor = isDividend ? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-blue-100 text-blue-900 border-blue-200';
    const tagText = isDividend ? 'Cổ tức' : (title.toLowerCase().includes('quyền') ? 'Quyền mua' : 'ĐHĐCĐ & Quyền');
    const pdfUrl = ev.file_url || (isDividend ? `/api/pdf/${sym}_ThongBao_CoTuc_CoPhieu_2026.pdf` : `/api/pdf/${sym}_NQ_HDQT_2026.pdf`);
    const docTitle = title.replace(/'/g, "\\'");
    const docSum = (ev.ai_summary || '').replace(/'/g, "\\'");
    const score = ev.ai_impact_score || 7.0;

    return `
      <div class="p-3.5 rounded-lg border border-gray-200 hover:border-emerald-400 hover:shadow-xs transition bg-white text-xs">
        <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded font-black text-xs bg-blue-950 text-white cursor-pointer hover:bg-yellow-400 hover:text-blue-950 transition" onclick="selectStockAndSwitch('${sym}')">${sym}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}">${tagText}</span>
            <span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-0.5">
              <i data-lucide="file-text" class="w-3 h-3 text-rose-600"></i> PDF A4
            </span>
            <span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              AI: ${score > 0 ? '+' : ''}${score}/10
            </span>
          </div>
          <div class="flex items-center gap-3 text-[11px] font-mono text-gray-500">
            <span>GDKHQ: <strong class="text-emerald-700 font-bold">${gdkhq}</strong></span>
            ${ndkcc !== '--' ? `<span>• ĐKCC: <strong class="text-gray-700">${ndkcc}</strong></span>` : ''}
          </div>
        </div>

        <h4 class="font-bold text-gray-900 text-sm hover:text-blue-800 leading-snug cursor-pointer mb-1.5" onclick="openPdfViewerModal('${pdfUrl}', '${docTitle}', 'NQ-${sym}', '${gdkhq}', 'PDF A4', '${tagText}', '${docSum}')">
          ${title}
        </h4>

        ${ev.content && ev.content !== title ? `
          <p class="text-xs text-gray-600 line-clamp-2 leading-relaxed mb-2 font-sans bg-gray-50/70 p-2 rounded border border-gray-100">
            ${ev.content}
          </p>
        ` : ''}

        ${ev.ai_analysis ? `
          <div class="text-[11px] text-emerald-800 bg-emerald-50/60 p-2 rounded border border-emerald-100 mb-2 flex items-start gap-1.5">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5"></i>
            <span><strong>Đánh giá AI:</strong> ${ev.ai_analysis}</span>
          </div>
        ` : ''}

        <div class="flex items-center justify-between pt-2 border-t border-gray-100 flex-wrap gap-2 text-xs">
          <div class="text-[11px] text-gray-500 font-mono">
            ${execDate !== '--' ? `Ngày thực hiện: <strong class="text-blue-900">${execDate}</strong>` : ''}
          </div>
          <div class="flex items-center gap-2">
            <button onclick="openPdfViewerModal('${pdfUrl}', '${docTitle}', 'NQ-${sym}', '${gdkhq}', 'PDF A4', '${tagText}', '${docSum}')" class="px-2.5 py-1 bg-blue-900 hover:bg-yellow-400 hover:text-blue-950 text-white font-bold rounded text-[11px] transition flex items-center gap-1 shadow-xs">
              <i data-lucide="eye" class="w-3 h-3"></i> Xem File PDF
            </button>
            <a href="${pdfUrl}" download class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[11px] transition flex items-center gap-1 shadow-xs">
              <i data-lucide="download" class="w-3 h-3"></i> Tải PDF
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Render pagination buttons
  if (pagBtnsEl) {
    if (totalPages <= 1) {
      pagBtnsEl.innerHTML = '';
    } else {
      let btnsHtml = '';
      btnsHtml += `<button onclick="changeMainEventsPage(1)" class="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs disabled:opacity-40 transition" ${currentMainEventsPage <= 1 ? 'disabled' : ''} title="Trang đầu">«</button>`;
      btnsHtml += `<button onclick="changeMainEventsPage(${currentMainEventsPage - 1})" class="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs disabled:opacity-40 transition" ${currentMainEventsPage <= 1 ? 'disabled' : ''}>Trước</button>`;
      
      const startP = Math.max(1, currentMainEventsPage - 2);
      const endP = Math.min(totalPages, currentMainEventsPage + 2);
      
      if (startP > 1) {
        btnsHtml += `<button onclick="changeMainEventsPage(1)" class="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition">1</button>`;
        if (startP > 2) btnsHtml += `<span class="px-1 text-gray-400">...</span>`;
      }
      
      for (let p = startP; p <= endP; p++) {
        const isAct = p === currentMainEventsPage;
        const cls = isAct ? 'px-2.5 py-1 rounded bg-blue-900 text-white font-bold text-xs shadow-xs' : 'px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition';
        btnsHtml += `<button onclick="changeMainEventsPage(${p})" class="${cls}">${p}</button>`;
      }
      
      if (endP < totalPages) {
        if (endP < totalPages - 1) btnsHtml += `<span class="px-1 text-gray-400">...</span>`;
        btnsHtml += `<button onclick="changeMainEventsPage(${totalPages})" class="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition">${totalPages}</button>`;
      }
      
      btnsHtml += `<button onclick="changeMainEventsPage(${currentMainEventsPage + 1})" class="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs disabled:opacity-40 transition" ${currentMainEventsPage >= totalPages ? 'disabled' : ''}>Sau</button>`;
      btnsHtml += `<button onclick="changeMainEventsPage(${totalPages})" class="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs disabled:opacity-40 transition" ${currentMainEventsPage >= totalPages ? 'disabled' : ''} title="Trang cuối">»</button>`;
      pagBtnsEl.innerHTML = btnsHtml;
    }
  }

  try { if (window.lucide) window.lucide.createIcons(); } catch (e) {}
}

function changeMainEventsPage(page) {
  const totalPages = Math.ceil(currentFilteredMainEvents.length / mainEventsPageSize) || 1;
  if (page >= 1 && page <= totalPages && page !== currentMainEventsPage) {
    renderMainEventsList(page);
    const container = document.getElementById('hpgEventsMainTimelineContainer');
    if (container) container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function renderHpgEventsList(events) {
  const container = document.getElementById('hpgEventsListContainer');
  if (!container) return;

  if (!events || events.length === 0) {
    container.innerHTML = '<div class="py-6 text-center text-gray-400 text-xs">Không có sự kiện quyền nào</div>';
    return;
  }

  container.innerHTML = events.map(ev => {
    const title = ev.title || ev.content || 'Sự kiện doanh nghiệp';
    const isDividend = title.toLowerCase().includes('cổ tức') || title.toLowerCase().includes('tiền');
    const badgeColor = isDividend ? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-blue-100 text-blue-900 border-blue-200';
    const tagText = isDividend ? 'Cổ tức' : 'Quyền/ĐHĐCĐ';
    const sym = ev.symbol || currentNewsSymbol;
    const pdfUrl = ev.file_url || (isDividend ? `/api/pdf/${sym}_ThongBao_CoTuc_CoPhieu_2026.pdf` : `/api/pdf/${sym}_NQ_HDQT_2026.pdf`);
    const docTitle = title.replace(/'/g, "\\'");
    const gdkhq = formatVietstockDate(ev.gdkhq_date || ev.ex_date);
    const ndkcc = formatVietstockDate(ev.ndkcc_date || ev.record_date);

    return `
      <div class="p-3 rounded-lg border border-gray-200 bg-white hover:border-emerald-400 hover:shadow-xs transition text-xs">
        <div class="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
          <div class="flex items-center gap-1.5">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}">${tagText}</span>
            <span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-0.5">
              <i data-lucide="file-text" class="w-3 h-3 text-rose-600"></i> PDF
            </span>
          </div>
          <span class="font-mono text-[11px] text-gray-500 font-semibold">GDKHQ: <strong class="text-emerald-700">${gdkhq}</strong></span>
        </div>
        <div class="font-semibold text-gray-900 leading-snug cursor-pointer hover:text-blue-800" onclick="openPdfViewerModal('${pdfUrl}', '${docTitle}', 'NQ-2026', '${gdkhq}', '340 KB', '${tagText}', '${(ev.ai_summary || '').replace(/'/g, "\\'")}')">
          ${title}
        </div>
        <div class="flex items-center justify-between text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-100 flex-wrap gap-1">
          <span>ĐKCC: <strong class="text-gray-700 font-mono">${ndkcc}</strong></span>
          <div class="flex items-center gap-1.5">
            <button onclick="openPdfViewerModal('${pdfUrl}', '${docTitle}', 'NQ-2026', '${gdkhq}', '340 KB', '${tagText}', '${(ev.ai_summary || '').replace(/'/g, "\\'")}')" class="text-blue-900 font-bold hover:underline flex items-center gap-0.5 bg-blue-50 px-2 py-0.5 rounded">
              <i data-lucide="eye" class="w-3 h-3"></i> Xem PDF
            </button>
            <a href="${pdfUrl}" download class="text-rose-700 font-bold hover:underline flex items-center gap-0.5 bg-rose-50 px-2 py-0.5 rounded">
              <i data-lucide="download" class="w-3 h-3"></i> Tải PDF
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');

  try { if (window.lucide) window.lucide.createIcons(); } catch (e) {}
}

// TẢI DANH SÁCH CÔNG BỐ THÔNG TIN CHÍNH THỨC CÓ FILE PDF
async function loadHpgDisclosures(symbol = currentNewsSymbol) {
  const container = document.getElementById('hpgDisclosuresContainer');
  if (!container) return;

  try {
    const res = await fetch(`/api/disclosures?symbol=${symbol}`);
    const json = await res.json();
    if (!json.success || !json.data || json.data.length === 0) {
      container.innerHTML = '<div class="py-4 text-center text-gray-400 text-xs">Không có tài liệu công bố thông tin</div>';
      return;
    }

    container.innerHTML = json.data.map(doc => {
      const pdfUrl = doc.file_url || `/api/pdf/${doc.file_name}`;
      const docTitle = doc.title.replace(/'/g, "\\'");
      const docSum = (doc.ai_summary || '').replace(/'/g, "\\'");
      return `
        <div class="p-3 rounded-lg bg-gray-50/80 border border-gray-200 hover:border-rose-300 hover:bg-rose-50/20 transition">
          <div class="flex items-center justify-between gap-1.5 mb-1 text-[11px] text-gray-500 font-mono">
            <span>${doc.publish_date}</span>
            <span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
              <i data-lucide="file-text" class="w-3 h-3 text-rose-600"></i> ${doc.doc_type || 'PDF'}
            </span>
          </div>
          <h5 class="font-bold text-gray-900 hover:text-blue-800 leading-snug cursor-pointer" onclick="openPdfViewerModal('${pdfUrl}', '${docTitle}', '${doc.doc_no}', '${doc.publish_date}', '${doc.file_size}', '${doc.doc_type}', '${docSum}')">
            ${doc.title}
          </h5>
          <div class="flex items-center justify-between text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-200/60 flex-wrap gap-2">
            <span class="font-mono text-gray-400 text-[10px]">Số: <strong class="text-gray-700">${doc.doc_no}</strong> (${doc.file_size})</span>
            <div class="flex items-center gap-1.5">
              <button onclick="openPdfViewerModal('${pdfUrl}', '${docTitle}', '${doc.doc_no}', '${doc.publish_date}', '${doc.file_size}', '${doc.doc_type}', '${docSum}')" class="px-2 py-0.8 bg-blue-900 hover:bg-yellow-400 hover:text-blue-950 text-white font-bold rounded text-[10px] transition flex items-center gap-1">
                <i data-lucide="eye" class="w-3 h-3"></i> Xem PDF
              </button>
              <a href="${pdfUrl}" download="${doc.file_name}" class="px-2 py-0.8 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[10px] transition flex items-center gap-1">
                <i data-lucide="download" class="w-3 h-3"></i> Tải PDF
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');

    try { if (window.lucide) window.lucide.createIcons(); } catch (e) {}
  } catch (err) {
    console.error('Lỗi loadHpgDisclosures:', err);
    container.innerHTML = '<div class="py-4 text-center text-red-400 text-xs">Lỗi nạp tài liệu công bố thông tin</div>';
  }
}

// BỘ ĐIỀU KHIỂN MODAL XEM TÀI LIỆU PDF TRỰC TIẾP (IN-APP PDF VIEWER)
function openPdfViewerModal(pdfUrl, title, docNo, date, fileSize, docType = 'Tài liệu PDF', aiSummary = '') {
  const modal = document.getElementById('pdfViewerModal');
  if (!modal) return;

  const titleEl = document.getElementById('pdfModalTitle');
  const typeEl = document.getElementById('pdfModalDocType');
  const noEl = document.getElementById('pdfModalDocNo');
  const dateEl = document.getElementById('pdfModalDate');
  const sizeEl = document.getElementById('pdfModalSize');
  const sumEl = document.getElementById('pdfModalAiSummaryText');
  const iframe = document.getElementById('pdfViewerIframe');
  const dlBtn = document.getElementById('pdfModalDownloadBtn');
  const tabBtn = document.getElementById('pdfModalNewTabBtn');

  if (titleEl) titleEl.textContent = title;
  if (typeEl) typeEl.textContent = docType;
  if (noEl) noEl.textContent = docNo ? `Số: ${docNo}` : '';
  if (dateEl) dateEl.textContent = date || '--';
  if (sizeEl) sizeEl.textContent = fileSize || 'PDF A4';
  if (sumEl) sumEl.textContent = aiSummary || 'Tài liệu công bố thông tin chính thức đã được xác thực chữ ký điện tử số và đăng kiểm trên hệ thống CSDL.';
  
  // Nạp URL PDF vào iframe
  if (iframe) {
    iframe.src = pdfUrl;
  }
  if (dlBtn) {
    dlBtn.href = pdfUrl;
    const fname = pdfUrl.split('/').pop() || 'document.pdf';
    dlBtn.setAttribute('download', fname);
  }
  if (tabBtn) {
    tabBtn.href = pdfUrl;
  }

  modal.classList.remove('hidden');
  try { if (window.lucide) window.lucide.createIcons(); } catch (e) {}
}

function closePdfViewerModal() {
  const modal = document.getElementById('pdfViewerModal');
  if (modal) {
    modal.classList.add('hidden');
    const iframe = document.getElementById('pdfViewerIframe');
    if (iframe) iframe.src = '';
  }
}

function printPdfModal() {
  const iframe = document.getElementById('pdfViewerIframe');
  if (iframe && iframe.contentWindow) {
    try {
      iframe.contentWindow.print();
    } catch (e) {
      window.open(iframe.src, '_blank');
    }
  }
}

// 1. TẢI DỮ LIỆU VIEW THỊ TRƯỜNG
async function loadMarketView() {
  try {
    const res = await fetch('/api/market/overview');
    const data = await res.json();
    if (!data.success) return;

    // Render Top Gainers
    const gainersBody = document.getElementById('marketTopGainersBody');
    if (gainersBody) {
      if (!data.gainers || data.gainers.length === 0) {
        gainersBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">Không có dữ liệu</td></tr>';
      } else {
        gainersBody.innerHTML = data.gainers.map(item => `
          <tr class="hover:bg-green-50/50 cursor-pointer transition" onclick="selectStockAndSwitch('${item.symbol}')">
            <td class="py-2 font-bold text-blue-950">${item.symbol}</td>
            <td class="py-2 text-right text-green-700 font-semibold">${(item.close / 1000).toFixed(2)}</td>
            <td class="py-2 text-right text-green-700 font-bold">+${(item.change_pct || 0).toFixed(2)}%</td>
            <td class="py-2 text-right text-gray-500">${Number(item.volume).toLocaleString()}</td>
          </tr>
        `).join('');
      }
    }

    // Render Top Losers
    const losersBody = document.getElementById('marketTopLosersBody');
    if (losersBody) {
      if (!data.losers || data.losers.length === 0) {
        losersBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">Không có dữ liệu</td></tr>';
      } else {
        losersBody.innerHTML = data.losers.map(item => `
          <tr class="hover:bg-red-50/50 cursor-pointer transition" onclick="selectStockAndSwitch('${item.symbol}')">
            <td class="py-2 font-bold text-blue-950">${item.symbol}</td>
            <td class="py-2 text-right text-red-600 font-semibold">${(item.close / 1000).toFixed(2)}</td>
            <td class="py-2 text-right text-red-600 font-bold">${(item.change_pct || 0).toFixed(2)}%</td>
            <td class="py-2 text-right text-gray-500">${Number(item.volume).toLocaleString()}</td>
          </tr>
        `).join('');
      }
    }

    // Render Top Volume
    const volBody = document.getElementById('marketTopVolumeBody');
    if (volBody) {
      if (!data.top_volume || data.top_volume.length === 0) {
        volBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">Không có dữ liệu</td></tr>';
      } else {
        volBody.innerHTML = data.top_volume.map(item => {
          const chg = item.change_pct || 0;
          const color = chg > 0 ? 'text-green-600' : (chg < 0 ? 'text-red-600' : 'text-yellow-600');
          const prefix = chg > 0 ? '+' : '';
          return `
            <tr class="hover:bg-blue-50/50 cursor-pointer transition" onclick="selectStockAndSwitch('${item.symbol}')">
              <td class="py-2 font-bold text-blue-950">${item.symbol}</td>
              <td class="py-2 text-right ${color} font-semibold">${(item.close / 1000).toFixed(2)}</td>
              <td class="py-2 text-right ${color} font-bold">${prefix}${chg.toFixed(2)}%</td>
              <td class="py-2 text-right text-blue-900 font-bold">${Number(item.volume).toLocaleString()}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Lỗi loadMarketView:', err);
  }
}

// 2. TẢI DỮ LIỆU VIEW TÀI CHÍNH TOÀN THỊ TRƯỜNG
async function loadFinancialsView() {
  try {
    const res = await fetch('/api/market/financial-rankings');
    const data = await res.json();
    if (!data.success) return;

    // Render Top Revenue
    const revBody = document.getElementById('topRevenueBody');
    if (revBody) {
      if (!data.top_revenue || data.top_revenue.length === 0) {
        revBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">Không có dữ liệu</td></tr>';
      } else {
        revBody.innerHTML = data.top_revenue.map((item, idx) => {
          const raw = Number(item.revenue || 0);
          const valBillion = raw > 1e6 ? (raw / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : raw.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
          const badgeClass = idx === 0 ? 'bg-amber-100 text-amber-800' : (idx === 1 ? 'bg-slate-200 text-slate-800' : (idx === 2 ? 'bg-amber-50 text-amber-900' : 'bg-gray-100 text-gray-600'));
          return `
            <tr class="hover:bg-gray-50 cursor-pointer transition" onclick="selectStockAndSwitch('${item.symbol}')">
              <td class="py-2.5 px-2"><span class="w-5 h-5 inline-flex items-center justify-center rounded-full text-[11px] font-bold ${badgeClass}">${idx + 1}</span></td>
              <td class="py-2.5 px-2 font-black text-blue-950">${item.symbol}</td>
              <td class="py-2.5 px-2 text-gray-700">${item.company_name || '--'}</td>
              <td class="py-2.5 px-2 text-right font-mono font-bold text-emerald-700">${valBillion} tỷ</td>
            </tr>
          `;
        }).join('');
      }
    }

    // Render Top Profit
    const profitBody = document.getElementById('topProfitBody');
    if (profitBody) {
      if (!data.top_profit || data.top_profit.length === 0) {
        profitBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">Không có dữ liệu</td></tr>';
      } else {
        profitBody.innerHTML = data.top_profit.map((item, idx) => {
          const raw = Number(item.profit || 0);
          const valBillion = raw > 1e6 ? (raw / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : raw.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
          const badgeClass = idx === 0 ? 'bg-amber-100 text-amber-800' : (idx === 1 ? 'bg-slate-200 text-slate-800' : (idx === 2 ? 'bg-amber-50 text-amber-900' : 'bg-gray-100 text-gray-600'));
          return `
            <tr class="hover:bg-gray-50 cursor-pointer transition" onclick="selectStockAndSwitch('${item.symbol}')">
              <td class="py-2.5 px-2"><span class="w-5 h-5 inline-flex items-center justify-center rounded-full text-[11px] font-bold ${badgeClass}">${idx + 1}</span></td>
              <td class="py-2.5 px-2 font-black text-blue-950">${item.symbol}</td>
              <td class="py-2.5 px-2 text-gray-700">${item.company_name || '--'}</td>
              <td class="py-2.5 px-2 text-right font-mono font-bold text-amber-700">${valBillion} tỷ</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Lỗi loadFinancialsView:', err);
  }
}

// 3. TẢI DỮ LIỆU VIEW BÁO CÁO PHÂN TÍCH
async function loadReportsView() {
  try {
    const res = await fetch('/api/market/reports');
    const data = await res.json();
    if (!data.success) return;

    const container = document.getElementById('reportsListContainer');
    if (!container) return;

    if (!data.data || data.data.length === 0) {
      container.innerHTML = '<div class="text-center py-8 text-gray-400 text-xs">Không có báo cáo phân tích nào</div>';
      return;
    }

    container.innerHTML = data.data.map(rep => {
      const isBuy = rep.recommendation === 'MUA';
      const badgeStyle = isBuy ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200';
      return `
        <div class="p-3.5 rounded-lg border border-gray-200 hover:border-blue-400 bg-white hover:shadow-sm transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1.5 flex-wrap">
              <span class="px-2 py-0.5 rounded font-black text-xs bg-blue-950 text-white cursor-pointer hover:bg-yellow-500 hover:text-blue-950 transition" onclick="selectStockAndSwitch('${rep.symbol}')">${rep.symbol}</span>
              <span class="text-xs font-bold text-gray-700">${rep.company_name}</span>
              <span class="text-[11px] text-gray-400">• Nguồn: <strong class="text-gray-600">${rep.source}</strong></span>
              <span class="text-[11px] text-gray-400">• Ngày: ${rep.date}</span>
            </div>
            <h4 class="text-sm font-semibold text-gray-900 leading-snug cursor-pointer hover:text-blue-800" onclick="selectStockAndSwitch('${rep.symbol}')">
              ${rep.title}
            </h4>
          </div>
          <div class="flex items-center gap-4 shrink-0 bg-gray-50 p-2.5 rounded-md border border-gray-100">
            <div class="text-center">
              <div class="text-[10px] text-gray-500 uppercase font-semibold">Khuyến Nghị</div>
              <span class="inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-black border ${badgeStyle}">${rep.recommendation}</span>
            </div>
            <div class="text-right">
              <div class="text-[10px] text-gray-500 uppercase font-semibold">Giá Mục Tiêu</div>
              <div class="text-xs font-bold text-purple-900 font-mono">${(rep.target_price / 1000).toFixed(1)}k</div>
            </div>
            <div class="text-right">
              <div class="text-[10px] text-gray-500 uppercase font-semibold">Tiềm Năng</div>
              <div class="text-xs font-black text-green-600 font-mono">${rep.upside}</div>
            </div>
            <button onclick="selectStockAndSwitch('${rep.symbol}')" class="ml-2 px-2.5 py-1 text-xs bg-blue-900 hover:bg-yellow-400 hover:text-blue-950 text-white font-bold rounded transition">
              Chi tiết
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Lỗi loadReportsView:', err);
  }
}

// ==========================================
// 4. TẢI DỮ LIỆU VIEW LỊCH SỰ KIỆN TOÀN THỊ TRƯỜNG (3,800+ SỰ KIỆN)
// ==========================================
let currentEventsPage = 1;
let currentEventsLimit = 50;
let currentEventsExchange = 'ALL';
let currentEventsType = 'ALL';
let currentEventsSearch = '';
let totalMarketEvents = 0;
let totalMarketEventPages = 1;
let searchEventsTimeout = null;

async function loadEventsView(page = currentEventsPage) {
  currentEventsPage = page;
  const tbody = document.getElementById('marketEventsBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-400"><span class="animate-spin inline-block mr-2">🔄</span> Đang nạp dữ liệu lịch sự kiện thị trường...</td></tr>';
  }

  try {
    const params = new URLSearchParams({
      page: currentEventsPage,
      limit: currentEventsLimit,
      exchange: currentEventsExchange,
      type: currentEventsType,
      q: currentEventsSearch
    });

    const res = await fetch(`/api/market/events?${params.toString()}`);
    const data = await res.json();
    if (!data.success) return;

    totalMarketEvents = data.total || 0;
    totalMarketEventPages = data.total_pages || 1;

    // Cập nhật badge tổng số và số trang
    const totalCountEl = document.getElementById('marketEventsTotalCount');
    const curPageEl = document.getElementById('marketEventsCurrentPage');
    const totPageEl = document.getElementById('marketEventsTotalPages');

    if (totalCountEl) totalCountEl.textContent = totalMarketEvents.toLocaleString('vi-VN');
    if (curPageEl) curPageEl.textContent = currentEventsPage;
    if (totPageEl) totPageEl.textContent = totalMarketEventPages;

    if (!data.data || data.data.length === 0) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-400">Không tìm thấy sự kiện nào phù hợp với bộ lọc</td></tr>';
      renderMarketEventsPagination();
      return;
    }

    if (tbody) {
      tbody.innerHTML = data.data.map(ev => {
        const isDividendCash = ev.value && ev.value > 0;
        const valStr = isDividendCash ? `${Number(ev.value).toLocaleString('vi-VN')} đ/cp` : (ev.ratio ? `Tỷ lệ ${ev.ratio}` : 'Theo tỷ lệ');
        const valColor = isDividendCash ? 'text-amber-700 font-bold' : 'text-blue-700 font-semibold';
        const pdfUrl = ev.file_url || `/api/pdf/${ev.symbol}_NQ_HDQT_2026.pdf`;
        const docTitle = (ev.description || ev.event_type || 'Nghị quyết HĐQT').replace(/'/g, "\\'");
        const docSum = (ev.ai_summary || '').replace(/'/g, "\\'");

        // Badge loại sự kiện
        let tagColor = 'bg-blue-100 text-blue-900 border-blue-200';
        if (ev.event_type.includes('tiền')) tagColor = 'bg-amber-100 text-amber-900 border-amber-200';
        else if (ev.event_type.includes('cổ phiếu')) tagColor = 'bg-emerald-100 text-emerald-900 border-emerald-200';
        else if (ev.event_type.includes('mua')) tagColor = 'bg-purple-100 text-purple-900 border-purple-200';

        return `
          <tr class="hover:bg-amber-50/40 transition">
            <td class="py-2.5 px-2.5 text-center font-mono font-bold text-blue-950">${ev.ex_date || '--'}</td>
            <td class="py-2.5 px-2.5 text-center">
              <span class="font-black text-blue-900 hover:text-amber-600 cursor-pointer font-mono" onclick="selectStockAndSwitch('${ev.symbol}')">${ev.symbol}</span>
            </td>
            <td class="py-2.5 px-2 text-center">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">${ev.exchange || 'HOSE'}</span>
            </td>
            <td class="py-2.5 px-3 text-gray-800 font-sans font-medium max-w-[200px] truncate" title="${ev.company_name || ''}">
              ${ev.company_name || '--'}
            </td>
            <td class="py-2.5 px-3">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${tagColor} inline-block whitespace-nowrap">${ev.event_type}</span>
            </td>
            <td class="py-2.5 px-3 text-gray-900 font-sans leading-snug">
              ${ev.description || '--'}
            </td>
            <td class="py-2.5 px-3 text-right font-mono ${valColor}">
              ${valStr}
            </td>
            <td class="py-2.5 px-3 text-center">
              <div class="flex items-center justify-center gap-1.5">
                <button onclick="openPdfViewerModal('${pdfUrl}', '${docTitle}', 'CBTT-${ev.symbol}', '${ev.ex_date}', 'PDF A4', '${ev.event_type}', '${docSum}')" class="px-2 py-0.8 bg-blue-900 hover:bg-yellow-400 hover:text-blue-950 text-white font-bold rounded text-[10px] transition flex items-center gap-0.5 shadow-xs">
                  <i data-lucide="eye" class="w-3 h-3"></i> Xem
                </button>
                <a href="${pdfUrl}" download class="px-2 py-0.8 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[10px] transition flex items-center gap-0.5 shadow-xs">
                  <i data-lucide="download" class="w-3 h-3"></i> Tải
                </a>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    renderMarketEventsPagination();
    try { if (window.lucide) window.lucide.createIcons(); } catch (e) {}
  } catch (err) {
    console.error('Lỗi loadEventsView:', err);
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-red-500">Lỗi kết nối máy chủ khi nạp lịch sự kiện</td></tr>';
  }
}

function renderMarketEventsPagination() {
  const container = document.getElementById('marketEventsPageNumbers');
  if (!container) return;

  const current = currentEventsPage;
  const total = totalMarketEventPages;

  let pages = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('...');
    
    let start = Math.max(2, current - 1);
    let end = Math.min(total - 1, current + 1);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    if (current < total - 2) pages.push('...');
    pages.push(total);
  }

  container.innerHTML = pages.map(p => {
    if (p === '...') {
      return '<span class="px-2 py-1 text-gray-400">...</span>';
    }
    const isAct = p === current;
    const cls = isAct ? "px-2.5 py-1 rounded bg-blue-900 text-white font-bold shadow-xs" : "px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold";
    return `<button onclick="goToMarketEventsPage(${p})" class="${cls}">${p}</button>`;
  }).join('');
}

function goToMarketEventsPage(page) {
  if (page === 'last') page = totalMarketEventPages;
  const p = Number(page);
  if (p >= 1 && p <= totalMarketEventPages && p !== currentEventsPage) {
    loadEventsView(p);
  }
}

function prevMarketEventsPage() {
  if (currentEventsPage > 1) {
    loadEventsView(currentEventsPage - 1);
  }
}

function nextMarketEventsPage() {
  if (currentEventsPage < totalMarketEventPages) {
    loadEventsView(currentEventsPage + 1);
  }
}

function changeMarketEventsLimit(val) {
  currentEventsLimit = Number(val) || 50;
  loadEventsView(1);
}

function setMarketEventExchange(exchange) {
  currentEventsExchange = exchange;
  ['ALL', 'HOSE', 'HNX', 'UPCOM'].forEach(ex => {
    const btn = document.getElementById(`filter-mev-ex-${ex}`);
    if (btn) {
      if (ex === exchange) {
        btn.className = "px-2.5 py-1 font-bold bg-blue-900 text-white border border-blue-900 transition";
      } else {
        btn.className = "px-2.5 py-1 font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 border-t border-b border-gray-200 transition";
      }
    }
  });
  loadEventsView(1);
}

function filterMarketEventsByType(type) {
  currentEventsType = type;
  loadEventsView(1);
}

function debounceSearchMarketEvents() {
  clearTimeout(searchEventsTimeout);
  searchEventsTimeout = setTimeout(() => {
    const input = document.getElementById('marketEventsSearchInput');
    currentEventsSearch = input ? input.value.trim() : '';
    loadEventsView(1);
  }, 250);
}

// 5. TẢI DỮ LIỆU VIEW BỘ LỌC CỔ PHIẾU
function setScreenerExchange(exchange) {
  currentScreenerExchange = exchange;
  ['ALL', 'HOSE', 'HNX', 'UPCOM'].forEach(ex => {
    const btn = document.getElementById(`filter-exchange-${ex}`);
    if (btn) {
      if (ex === exchange) {
        btn.className = "px-3 py-1.5 text-xs font-bold bg-blue-900 text-white rounded-md border border-blue-900 shadow-sm transition";
      } else {
        btn.className = "px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition";
      }
    }
  });
  loadScreenerView(exchange);
}

async function loadScreenerView(exchange = 'ALL') {
  try {
    const res = await fetch(`/api/screener?exchange=${encodeURIComponent(exchange)}`);
    const data = await res.json();
    if (!data.success) return;

    const tbody = document.getElementById('screenerResultsBody');
    if (!tbody) return;

    if (!data.data || data.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-gray-400">Không tìm thấy mã nào phù hợp</td></tr>';
      return;
    }

    tbody.innerHTML = data.data.map(item => {
      const chg = item.change_pct || 0;
      const color = chg > 0 ? 'text-green-600' : (chg < 0 ? 'text-red-600' : 'text-yellow-600');
      const prefix = chg > 0 ? '+' : '';
      return `
        <tr class="hover:bg-blue-50/40 transition">
          <td class="py-2.5 px-3 font-black text-blue-950 cursor-pointer" onclick="selectStockAndSwitch('${item.symbol}')">${item.symbol}</td>
          <td class="py-2.5 px-3 text-gray-700 font-sans">${item.company_name || '--'}</td>
          <td class="py-2.5 px-3 text-center"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600">${item.exchange || 'HOSE'}</span></td>
          <td class="py-2.5 px-3 text-right font-bold ${color}">${(item.close / 1000).toFixed(2)}</td>
          <td class="py-2.5 px-3 text-right ${color}">${prefix}${(item.change / 1000).toFixed(2)}</td>
          <td class="py-2.5 px-3 text-right font-bold ${color}">${prefix}${chg.toFixed(2)}%</td>
          <td class="py-2.5 px-3 text-right font-bold text-gray-800">${Number(item.volume).toLocaleString()}</td>
          <td class="py-2.5 px-3 text-center font-sans">
            <button onclick="selectStockAndSwitch('${item.symbol}')" class="px-2 py-0.5 bg-blue-900 hover:bg-yellow-400 hover:text-blue-950 text-white rounded text-[11px] font-semibold transition">
              Xem chi tiết
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Lỗi loadScreenerView:', err);
  }
}

// Bấm vào bất kỳ mã cổ phiếu nào từ view khác -> Chuyển về view Cổ phiếu và nạp dữ liệu ngay
function selectStockAndSwitch(symbol) {
  selectStock(symbol);
  switchNavView('stock');
}

// Kích hoạt AI Data Ingestion Pipeline (ETL Chuẩn Hóa Clean Markdown)
async function triggerAiReIngest() {
  const btn = document.getElementById('btnAiReIngest');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block mr-1">🔄</span> Đang chuẩn hóa...`;
  }
  try {
    const res = await fetch('/api/ai/re-ingest', { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      alert(`✅ ${json.message}`);
      await loadHpgNewsEvents(currentNewsSymbol);
    } else {
      alert(`⚠️ Lỗi: ${json.error || 'Không thể thực thi'}`);
    }
  } catch (err) {
    alert(`Lỗi kết nối: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="cpu" class="w-3 h-3"></i> AI ETL CLEAN`;
      try { if (window.lucide) window.lucide.createIcons(); } catch (e) {}
    }
  }
}

