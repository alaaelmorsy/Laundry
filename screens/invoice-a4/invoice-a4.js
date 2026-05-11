(function () {
  'use strict';

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val || '';
  }

  function setHtml(id, val) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = val || '';
  }

  function showRow(id, show) {
    var el = document.getElementById(id);
    if (el) el.style.display = show ? '' : 'none';
  }

  function fmtMoney(n) {
    return '\uE900 ' + Number(n || 0).toFixed(2);
  }

  function renderQR(payload) {
    var qrEl = document.getElementById('a4QR');
    if (!qrEl) return;
    qrEl.innerHTML = '';
    if (!window.api || !payload) return;
    window.api.generateZatcaQR(payload)
      .then(function (res) {
        if (res && res.success && res.svg) {
          qrEl.innerHTML = res.svg;
        }
      })
      .catch(function () {});
  }

  function fillInvoice(data) {
    /* ── Header bilingual ── */
    setText('a4ShopNameAr',    data.shopNameAr);
    setText('a4ShopAddressAr', data.shopAddressAr);
    setText('a4ShopPhoneAr',   data.shopPhone ? 'جوال: ' + data.shopPhone : '');
    setText('a4VatAr',         data.vatNumber ? 'الرقم الضريبي: ' + data.vatNumber : '');
    setText('a4CrAr',          data.commercialRegister ? 'س.ت: ' + data.commercialRegister : '');

    setText('a4ShopNameEn',    data.shopNameEn);
    setText('a4ShopAddressEn', data.shopAddressEn);
    setText('a4ShopEmail',     data.shopEmail);
    setText('a4VatEn',         data.vatNumber ? 'VAT No: ' + data.vatNumber : '');
    setText('a4CrEn',          data.commercialRegister ? 'CR No: ' + data.commercialRegister : '');

    /* ── Logo ── */
    var logoEl = document.getElementById('a4Logo');
    if (logoEl) {
      if (data.logoDataUrl) {
        logoEl.src = data.logoDataUrl;
        logoEl.style.display = '';
      } else {
        logoEl.style.display = 'none';
      }
    }

    /* ── Meta ── */
    setText('a4OrderNum', data.orderNum);
    setText('a4Date',     data.date);
    setText('a4Payment',  data.payment);

    /* ── Customer ── */
    setText('a4CustName',  data.custName || '—');
    setText('a4CustPhone', data.custPhone || '—');

    if (data.subRef) {
      setText('a4SubRef', data.subRef);
      showRow('a4RowSubRef', true);
    } else { showRow('a4RowSubRef', false); }
    if (data.subPackageName) {
      setText('a4SubPackage', data.subPackageName);
      showRow('a4RowSubPackage', true);
    } else { showRow('a4RowSubPackage', false); }
    if (data.subBalance != null && !isNaN(data.subBalance)) {
      setHtml('a4SubBalance', '\uE900 ' + Number(data.subBalance).toFixed(2));
      showRow('a4RowSubBalance', true);
    } else { showRow('a4RowSubBalance', false); }

    /* ── Order dates ── */
    if (data.paidAt) {
      setText('a4PaidAt', data.paidAt);
      showRow('a4RowPaidAt', true);
    } else {
      showRow('a4RowPaidAt', false);
    }
    if (data.cleanedAt) {
      setText('a4CleanedAt', data.cleanedAt);
      showRow('a4RowCleanedAt', true);
    } else {
      showRow('a4RowCleanedAt', false);
    }
    if (data.deliveredAt) {
      setText('a4DeliveredAt', data.deliveredAt);
      showRow('a4RowDeliveredAt', true);
    } else {
      showRow('a4RowDeliveredAt', false);
    }
    if (data.starch) {
      setText('a4Starch', data.starch);
      showRow('a4RowStarch', true);
    } else {
      showRow('a4RowStarch', false);
    }
    if (data.bluing) {
      setText('a4Bluing', data.bluing);
      showRow('a4RowBluing', true);
    } else {
      showRow('a4RowBluing', false);
    }

    /* ── Items ── */
    var sarSpan = '<span style="font-family:SaudiRiyal;">\uE900</span>';
    var vatRate   = data.vatRate || 0;
    var priceMode = data.priceDisplayMode || 'exclusive';
    var tbody = document.getElementById('a4ItemsTbody');
    if (tbody && data.items) {
      tbody.innerHTML = data.items.map(function (it, i) {
        var lineTotal = Number(it.lineTotal || 0);
        var net, itemVat, gross;
        if (vatRate > 0) {
          if (priceMode === 'inclusive') {
            net     = lineTotal / (1 + vatRate / 100);
            itemVat = lineTotal - net;
            gross   = lineTotal;
          } else {
            net     = lineTotal;
            itemVat = lineTotal * vatRate / 100;
            gross   = lineTotal + itemVat;
          }
        } else { net = lineTotal; itemVat = 0; gross = lineTotal; }

        var nameCell = esc(it.productAr || '');
        if (it.productEn && it.productEn !== it.productAr) {
          nameCell += '<span class="a4-td-en">' + esc(it.productEn) + '</span>';
        }
        var svcCell = esc(it.serviceAr || '—');
        if (it.serviceEn && it.serviceEn !== it.serviceAr) {
          svcCell += '<span class="a4-td-en">' + esc(it.serviceEn) + '</span>';
        }
        return '<tr>'
          + '<td class="a4-td-num">' + (i + 1) + '</td>'
          + '<td class="a4-td-name">' + nameCell + '</td>'
          + '<td class="a4-td-name">' + svcCell + '</td>'
          + '<td class="a4-td-num">' + (it.qty || 1) + '</td>'
          + '<td class="a4-td-num">' + sarSpan + Number(it.unitPrice || 0).toFixed(2) + '</td>'
          + '<td class="a4-td-num">' + sarSpan + net.toFixed(2) + '</td>'
          + '<td class="a4-td-num">' + sarSpan + itemVat.toFixed(2) + '</td>'
          + '<td class="a4-td-num">' + sarSpan + gross.toFixed(2) + '</td>'
          + '</tr>';
      }).join('');
    }

    /* ── Totals ── */
    var sarPfx = sarSpan;
    setHtml('a4Subtotal', sarPfx + Number(data.subtotal || 0).toFixed(2));
    if (data.discount && data.discount > 0) {
      setHtml('a4Discount', sarPfx + Number(data.discount).toFixed(2));
      showRow('a4DiscRow', true);
    } else {
      showRow('a4DiscRow', false);
    }
    if (data.extra && data.extra > 0) {
      setHtml('a4Extra', sarPfx + Number(data.extra).toFixed(2));
      showRow('a4ExtraRow', true);
    } else {
      showRow('a4ExtraRow', false);
    }
    if (vatRate > 0) {
      setText('a4VatLabel', 'ضريبة القيمة المضافة (' + vatRate + '%) / VAT');
      setHtml('a4Vat', sarPfx + Number(data.vatAmount || 0).toFixed(2));
      showRow('a4VatRow', true);
      setText('a4SubtotalLabel', 'المجموع قبل الضريبة / Subtotal');
      setText('a4TotalLabel', 'الإجمالي شامل الضريبة / Grand Total');
    } else {
      showRow('a4VatRow', false);
      setText('a4SubtotalLabel', 'المجموع / Subtotal');
      setText('a4TotalLabel', 'الإجمالي / Total');
    }
    setHtml('a4Total', sarPfx + Number(data.total || 0).toFixed(2));

    /* ── Mixed payment breakdown ── */
    if ((Number(data.paidCash || 0) > 0) || (Number(data.paidCard || 0) > 0)) {
      setHtml('a4MixedCash', sarPfx + Number(data.paidCash || 0).toFixed(2));
      showRow('a4MixedCashRow', true);
      setHtml('a4MixedCard', sarPfx + Number(data.paidCard || 0).toFixed(2));
      showRow('a4MixedCardRow', true);
    } else {
      showRow('a4MixedCashRow', false);
      showRow('a4MixedCardRow', false);
    }

    /* ── Footer notes ── */
    var notesEl = document.getElementById('a4FooterNotes');
    if (notesEl) {
      if (data.invoiceNotes) {
        var notesContent = document.getElementById('a4NotesContent');
        if (notesContent) notesContent.textContent = data.invoiceNotes;
        notesEl.style.display = '';
      } else {
        notesEl.style.display = 'none';
      }
    }

    /* ── QR ── */
    if (data.qrPayload) {
      renderQR(data.qrPayload);
    }
  }

  function init() {
    var raw = localStorage.getItem('a4InvoiceData');
    if (!raw) {
      document.body.innerHTML = '<div style="padding:40px;text-align:center;font-size:18px;">لا توجد بيانات فاتورة</div>';
      return;
    }
    var data;
    try { data = JSON.parse(raw); } catch (e) { return; }

    fillInvoice(data);

    if (data.autoPrint) {
      setTimeout(function () { window.print(); }, 800);
    }
  }

  document.getElementById('btnPrint').addEventListener('click', function () { window.print(); });
  
  document.getElementById('btnExportPdf').addEventListener('click', async function () {
    var exportBtn = document.getElementById('btnExportPdf');
    try {
      exportBtn.disabled = true;
      exportBtn.textContent = 'جارٍ التصدير...';
      
      var paperEl = document.getElementById('a4Paper');
      if (!paperEl) {
        window.print();
        return;
      }
      
      var invoiceHTML = paperEl.outerHTML;
      var orderNumEl = document.getElementById('a4OrderNum');
      var orderNum = orderNumEl ? orderNumEl.textContent : '';
      
      var result = await window.api.exportInvoicePdfFromHtml({ html: invoiceHTML, paperType: 'a4', orderNum: orderNum });
      
      if (result && result.success) {
        exportBtn.textContent = 'تم التصدير';
      }
      exportBtn.disabled = false;
      exportBtn.textContent = 'تصدير PDF';
    } catch (err) {
      console.error('PDF export error:', err);
      // fallback to browser print
      window.print();
      exportBtn.disabled = false;
      exportBtn.textContent = 'تصدير PDF';
    }
  });
  
  document.getElementById('btnClose').addEventListener('click', function () { window.close(); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
