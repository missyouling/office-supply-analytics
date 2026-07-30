// =============================================
// PDF 生成模块 - 基于 pdf-lib
// 支持 CJK 中文字体（从 CDN 动态加载 Noto Sans CJK SC）
// =============================================
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// 全局字体缓存（Worker 实例级，跨请求复用）
let fontCache = null;
let fontPromise = null;

// 中文字体 URL（Google Fonts TTF，仅 3MB，比 OTF 16MB 小很多）
const FONT_URL = 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_EnYxNbPzS5HE.ttf';

/**
 * 获取中文字体（带单次获取缓存）
 */
async function getCjkFont() {
  if (fontCache) return fontCache;
  if (fontPromise) return fontPromise;

  fontPromise = (async () => {
    try {
      const resp = await fetch(FONT_URL);
      if (!resp.ok) throw new Error(`Font fetch failed: ${resp.status}`);
      const buffer = await resp.arrayBuffer();
      fontCache = buffer;
      return buffer;
    } catch (e) {
      console.error('Failed to load CJK font:', e);
      fontPromise = null; // 允许下次重试
      return null;
    }
  })();

  return await fontPromise;
}

/**
 * 尝试嵌入中文字体（OTF），失败时回退到标准 Helvetica
 */
async function embedCjkFont(pdfDoc) {
  try {
    const fontBytes = await getCjkFont();
    if (fontBytes) {
      // OTF 字体需要 fontkit 注册
      try {
        const { default: fontkit } = await import('@pdf-lib/fontkit');
        pdfDoc.registerFontkit(fontkit);
      } catch (e) {
        console.warn('fontkit not available, font may not be embeddable:', e.message);
        // 即使没有 fontkit，某些格式仍可工作
      }
      try {
        return await pdfDoc.embedFont(fontBytes);
      } catch (e) {
        console.warn('Failed to embed OTF font, trying fallback:', e.message);
      }
    }
  } catch (e) {
    console.warn('Failed to load CJK font, falling back to Helvetica:', e.message);
  }
  // 回退：使用标准 Helvetica（仅支持英文/数字/符号）
  console.warn('Using Helvetica fallback - Chinese characters will fail');
  return await pdfDoc.embedFont(StandardFonts.Helvetica);
}

/**
 * 生成采购单 PDF
 */
export async function generatePurchasePdf(purchase, env) {
  const pdfDoc = await PDFDocument.create();
  const font = await embedCjkFont(pdfDoc);
  const hasCjk = font.name !== StandardFonts.Helvetica;

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  let y = height - 50;
  const margin = 50;
  const lineHeight = hasCjk ? 22 : 16;

  // 标题
  page.drawText('办公劳保用品采购单', {
    x: margin, y, size: 22, font, color: rgb(0.1, 0.1, 0.1)
  });
  y -= 35;

  // 公司名称 + 日期
  const companyName = 'XX公司';
  page.drawText(`${companyName}`, {
    x: margin, y, size: 14, font, color: rgb(0.3, 0.3, 0.3)
  });
  page.drawText(`日期：${purchase.purchase_date}`, {
    x: width - margin - 100, y, size: 11, font, color: rgb(0.3, 0.3, 0.3)
  });
  y -= 30;

  // 采购单号
  page.drawText(`采购单号：PO-${String(purchase.id).padStart(6, '0')}`, {
    x: margin, y, size: 10, font, color: rgb(0.5, 0.5, 0.5)
  });
  y -= 25;

  // 表格标题行
  const cols = [
    { label: '序号', x: margin, w: 35 },
    { label: '品名', x: margin + 35, w: 120 },
    { label: '规格', x: margin + 155, w: 80 },
    { label: '单价', x: margin + 235, w: 60 },
    { label: '数量', x: margin + 295, w: 50 },
    { label: '小计', x: margin + 345, w: 70 },
  ];

  const tableTop = y;
  // 表头背景
  for (const col of cols) {
    page.drawText(col.label, { x: col.x + 4, y: y + 4, size: 10, font, color: rgb(1, 1, 1) });
  }
  // 表头背景色（灰色填充）
  page.drawRectangle({
    x: margin, y, width: width - 2 * margin, height: 22,
    color: rgb(0.25, 0.45, 0.75)
  });
  // 表头文字（白色）
  for (const col of cols) {
    page.drawText(col.label, { x: col.x + 4, y: y + 5, size: 10, font, color: rgb(1, 1, 1) });
  }
  y -= 22;

  // 表格数据行
  let rowNum = 0;
  for (const item of purchase.items) {
    y -= lineHeight + 4;
    if (y < 60) {
      // 分页 - 简单处理，超出范围就不画了
      continue;
    }

    const rowColor = rowNum % 2 === 0 ? rgb(0.97, 0.97, 0.97) : rgb(1, 1, 1);
    page.drawRectangle({
      x: margin, y, width: width - 2 * margin, height: lineHeight + 4,
      color: rowColor
    });

    const hOffset = 3;
    page.drawText(String(rowNum + 1), { x: cols[0].x + 4, y: y + hOffset, size: 9, font });
    page.drawText(String(item.supply_name || ''), { x: cols[1].x + 4, y: y + hOffset, size: 9, font });
    page.drawText(String(item.supply_spec || ''), { x: cols[2].x + 4, y: y + hOffset, size: 9, font });
    page.drawText(`¥${Number(item.unit_price).toFixed(2)}`, { x: cols[3].x + 4, y: y + hOffset, size: 9, font });
    page.drawText(String(item.quantity), { x: cols[4].x + 4, y: y + hOffset, size: 9, font });
    page.drawText(`¥${Number(item.subtotal).toFixed(2)}`, { x: cols[5].x + 4, y: y + hOffset, size: 9, font });

    rowNum++;
  }

  y -= 35;

  // 总金额
  page.drawText(`总金额：¥${Number(purchase.total_amount).toFixed(2)}`, {
    x: width - margin - 180, y, size: 14, font, color: rgb(0.8, 0.2, 0.2)
  });

  // 底部说明
  y = 40;
  page.drawText(`制单日期：${purchase.purchase_date}    采购单号：PO-${String(purchase.id).padStart(6, '0')}`, {
    x: margin, y, size: 8, font, color: rgb(0.6, 0.6, 0.6)
  });

  return pdfDoc.save();
}

/**
 * 生成分析报告 PDF
 * data: { title, dateRange, charts: [{ name, imageBase64 }], suggestions, summaryData }
 */
export async function generateReportPdf(data, env) {
  const pdfDoc = await PDFDocument.create();
  const font = await embedCjkFont(pdfDoc);
  const hasCjk = font.name !== StandardFonts.Helvetica;

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const lineHeight = hasCjk ? 24 : 16;

  // ---- 第一页：封面 + 图表 ----
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 50;

  // 标题
  page.drawText(data.title || '办公劳保用品采购分析报告', {
    x: margin, y, size: 22, font, color: rgb(0.1, 0.1, 0.1)
  });
  y -= 30;

  // 日期范围
  if (data.dateRange) {
    page.drawText(`报告期间：${data.dateRange}`, {
      x: margin, y, size: 12, font, color: rgb(0.4, 0.4, 0.4)
    });
    y -= 30;
  }

  // 摘要信息
  if (data.summaryData) {
    page.drawText('数据概览', {
      x: margin, y, size: 14, font, color: rgb(0.2, 0.2, 0.2)
    });
    y -= 22;
    const summaries = [
      `总采购金额：¥${Number(data.summaryData.total_amount || 0).toFixed(2)}`,
      `采购单总数：${data.summaryData.total_purchases || 0} 单`,
      `用品分类数：${data.summaryData.total_categories || 0} 类`
    ];
    for (const s of summaries) {
      page.drawText(`· ${s}`, { x: margin + 10, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
      y -= 18;
    }
    y -= 15;
  }

  // 插入图表图片
  if (data.charts && data.charts.length > 0) {
    for (const chart of data.charts) {
      if (y < 200) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - 50;
      }

      // 图表名称
      if (chart.name) {
        page.drawText(chart.name, {
          x: margin, y, size: 14, font, color: rgb(0.2, 0.2, 0.2)
        });
        y -= 25;
      }

      if (chart.imageBase64) {
        try {
          const imageData = chart.imageBase64.replace(/^data:image\/\w+;base64,/, '');
          const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
          const isPng = chart.imageBase64.includes('image/png');

          let chartImage;
          if (isPng) {
            chartImage = await pdfDoc.embedPng(imageBytes);
          } else {
            chartImage = await pdfDoc.embedJpg(imageBytes);
          }

          const maxW = pageWidth - 2 * margin;
          const maxH = pageHeight - 250;
          const scale = Math.min(1, maxW / chartImage.width, maxH / chartImage.height);
          const imgW = chartImage.width * scale;
          const imgY = y - chartImage.height * scale;

          // 检查是否需要分页
          if (imgY < 80) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            y = pageHeight - 80;
          }

          page.drawImage(chartImage, {
            x: margin + (maxW - imgW) / 2,
            y: y - chartImage.height * scale - 10,
            width: imgW,
            height: chartImage.height * scale
          });

          y = y - chartImage.height * scale - 30;
        } catch (e) {
          console.warn('Failed to embed chart image:', e.message);
          page.drawText(`[图表加载失败: ${e.message}]`, {
            x: margin + 10, y, size: 10, font, color: rgb(0.8, 0.3, 0.3)
          });
          y -= 20;
        }
      }
    }
  }

  // ---- 优化建议页面 ----
  if (data.suggestions && data.suggestions.length > 0) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - 50;

    page.drawText('优化建议', {
      x: margin, y, size: 18, font, color: rgb(0.1, 0.1, 0.1)
    });
    y -= 35;

    for (const sug of data.suggestions) {
      if (y < 100) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - 50;
      }

      // 建议标题（带类型标识）
      const typeLabel = sug.type === 'warning' ? '⚠️ 警告'
        : sug.type === 'success' ? '✅ 良好'
        : sug.type === 'suggestion' ? '💡 建议' : 'ℹ️ 提示';
      const titleColor = sug.type === 'warning' ? rgb(0.8, 0.2, 0.2)
        : sug.type === 'success' ? rgb(0.2, 0.6, 0.2)
        : rgb(0.2, 0.4, 0.7);

      page.drawText(`${typeLabel}：${sug.title}`, {
        x: margin, y, size: 12, font, color: titleColor
      });
      y -= 20;

      page.drawText(`    ${sug.content}`, {
        x: margin, y, size: 10, font, color: rgb(0.3, 0.3, 0.3)
      });
      y -= 28;
    }
  }

  // 页脚
  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const pg = pdfDoc.getPage(i);
    pg.drawText(`- ${i + 1} / ${totalPages} -`, {
      x: pageWidth / 2 - 20, y: 25, size: 9, font, color: rgb(0.6, 0.6, 0.6)
    });
    pg.drawText(`生成时间：${new Date().toISOString().substring(0, 19).replace('T', ' ')}`, {
      x: pageWidth - 180, y: 25, size: 8, font, color: rgb(0.6, 0.6, 0.6)
    });
  }

  return pdfDoc.save();
}
