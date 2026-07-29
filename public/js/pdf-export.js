// =============================================
// 客户端 PDF 导出模块（jsPDF + 中文字体）
// 作为服务器 PDF 生成的补充方案
// =============================================

/**
 * 在浏览器端生成采购单 PDF（基于当前清单数据）
 */
function generatePurchasePdfLocal() {
  // 动态加载 jsPDF
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
  script.onload = () => {
    _doGeneratePurchasePdf();
  };
  script.onerror = () => {
    showToast('❌ jsPDF 加载失败，请使用服务端导出');
  };
  document.head.appendChild(script);
}

async function _doGeneratePurchasePdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');

  // 加载中文字体
  try {
    await _loadCjkFont(doc);
  } catch (e) {
    console.warn('Font load failed, using standard font:', e);
  }

  const hasCjk = doc._customFontLoaded;
  const pageW = 210;
  const margin = 15;
  let y = 20;

  // 标题
  doc.setFontSize(18);
  doc.text('办公劳保用品采购单', pageW / 2, y, { align: 'center' });
  y += 12;

  // 公司信息
  doc.setFontSize(11);
  doc.text(`XX公司`, margin, y);
  doc.text(`日期：${document.getElementById('purchaseDate').value || new Date().toISOString().substring(0, 10)}`, pageW - margin, y, { align: 'right' });
  y += 8;

  doc.setFontSize(9);
  doc.text(`采购单号：PO-${String(window._lastPurchaseId || '******').padStart(6, '0')}`, margin, y);
  y += 10;

  // 表格
  const items = entryItems.length > 0 ? entryItems : [];
  if (items.length === 0 && window._lastPurchaseId) {
    // 已保存无清单数据时，只显示单号
    doc.text('（采购数据已保存，详情请登录系统查看）', margin, y);
  } else {
    // 表头
    const headers = ['序号', '品名', '规格', '单价', '数量', '小计'];
    const colWidths = [12, 50, 35, 28, 16, 28];
    const colX = [];
    let cx = margin;
    for (const w of colWidths) {
      colX.push(cx);
      cx += w;
    }

    // 画表头
    doc.setFillColor(37, 99, 235);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    for (let i = 0; i < headers.length; i++) {
      doc.rect(colX[i], y, colWidths[i], 8, 'F');
      doc.text(headers[i], colX[i] + 1, y + 6);
    }
    y += 8;
    doc.setTextColor(0, 0, 0);

    let total = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const subtotal = item.unit_price * item.quantity;
      total += subtotal;

      // 交替行背景
      if (i % 2 === 1) {
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y, pageW - 2 * margin, 7, 'F');
      }

      doc.setFontSize(8);
      doc.text(String(i + 1), colX[0] + 1, y + 5);
      doc.text(String(item.name || ''), colX[1] + 1, y + 5);
      doc.text(String(item.spec || ''), colX[2] + 1, y + 5);
      doc.text(`¥${Number(item.unit_price).toFixed(2)}`, colX[3] + 1, y + 5);
      doc.text(String(item.quantity), colX[4] + 1, y + 5);
      doc.text(`¥${Number(subtotal).toFixed(2)}`, colX[5] + 1, y + 5);
      y += 7;

      // 分页
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    }

    y += 10;
    // 总金额
    doc.setFontSize(14);
    doc.setTextColor(200, 40, 40);
    doc.text(`总金额：¥${total.toFixed(2)}`, pageW - margin, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  doc.save(`采购单_${document.getElementById('purchaseDate').value || new Date().toISOString().substring(0, 10)}.pdf`);
  showToast('✅ 采购单 PDF 已导出');
}

/**
 * 在浏览器端生成分析报告 PDF（客户端兜底方案）
 */
async function generateReportPdfLocal(data) {
  const { jsPDF } = window.jspdf || await _loadJspdf();
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = 210;
  const margin = 15;

  // 加载字体
  try {
    await _loadCjkFont(doc);
  } catch (e) {
    console.warn('Font load failed:', e);
  }

  let y = 20;

  // 封面标题
  doc.setFontSize(18);
  doc.text(data.title || '办公劳保用品采购分析报告', pageW / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(11);
  doc.text(`报告期间：${data.date || ''}`, margin, y);
  y += 15;

  // 插入图表图片
  if (data.chartImages) {
    for (const chart of data.chartImages) {
      if (y > 250) { doc.addPage(); y = 20; }

      doc.setFontSize(12);
      doc.text(chart.name || '', margin, y);
      y += 5;

      try {
        const imgData = chart.imageBase64;
        const imgW = 170; // mm
        const imgH = 90; // mm (approx)
        doc.addImage(imgData, 'PNG', margin, y, imgW, imgH);
        y += imgH + 10;
      } catch (e) {
        doc.text('[图表加载失败]', margin, y);
        y += 5;
      }
    }
  }

  // 优化建议
  if (data.suggestions && data.suggestions.length > 0) {
    doc.addPage();
    y = 20;
    doc.setFontSize(16);
    doc.text('优化建议', margin, y);
    y += 12;

    doc.setFontSize(10);
    for (const sug of data.suggestions) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.text(`${sug.title}`, margin, y);
      y += 6;
      doc.setFontSize(9);
      doc.text(`${sug.content}`, margin + 3, y);
      y += 10;
    }
  }

  // 页脚
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`- ${i} / ${totalPages} -`, pageW / 2 - 10, 292);
    doc.text(`生成时间：${new Date().toLocaleString('zh-CN')}`, pageW - margin, 292, { align: 'right' });
  }

  doc.save(`分析报告_${data.date || new Date().toISOString().substring(0, 10)}.pdf`);
  showToast('✅ 分析报告已导出');
}

/**
 * 加载 jsPDF 库（动态）
 */
function _loadJspdf() {
  return new Promise((resolve, reject) => {
    if (window.jspdf) return resolve(window.jspdf);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
    s.onload = () => resolve(window.jspdf);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/**
 * 加载中文字体到 jsPDF
 * 使用 Google Fonts 的 Noto Sans SC
 */
async function _loadCjkFont(doc) {
  // 检查是否已加载
  if (doc._customFontLoaded) return;

  try {
    // 使用 jsPDF 的 addFileToVFS + addFont 加载中文字体
    // 从 CDN 获取字体文件（WOFF2 格式更小）
    const fontUrl = 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.0.18/files/noto-sans-sc-chinese-simplified-400-normal.woff';

    // 由于 jsPDF addFileToVFS 需要 base64，我们直接获取二进制然后转 base64
    const resp = await fetch(fontUrl);
    const blob = await resp.blob();

    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = function() {
        try {
          const base64 = reader.result.split(',')[1];
          const fontName = 'NotoSansSC';
          doc.addFileToVFS(fontName, base64);
          doc.addFont(fontName, fontName, 'normal');
          doc.setFont(fontName);
          doc._customFontLoaded = true;
          resolve();
        } catch (e) { reject(e); }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Failed to load CJK font for jsPDF:', e);
    // 不阻塞 PDF 生成，使用默认字体（中文会显示为空白）
  }
}
