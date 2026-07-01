(function(){
  'use strict';

  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmtLtr(n){ return Number(n||0).toFixed(2); }
  function sarFmt(n) { return '<span class="sar">\uE900</span> ' + fmtLtr(n); }

  window.InvoiceRenderer = {
    applyInvoiceTypeClass: function(settings) {
      try {
        var type = (settings && settings.invoicePaperType) || 'thermal';
        document.body.classList.toggle('invtype-a4', type === 'a4');
        document.documentElement.classList.toggle('invtype-a4', type === 'a4');
      } catch (e) {}
    },

    fillThermalInvoice: function(ctx, els, settings) {
      try {
        var s = settings || {};
        if (!els || !ctx) return;
        els.invShopName.textContent = s.laundryNameAr || s.laundryNameEn || '';
        els.invShopAddr.textContent = s.locationAr || s.locationEn || '';
        els.invShopPhone.textContent = s.phone ? 'هاتف: ' + s.phone : '';
        els.invShopVat.textContent = s.vatNumber ? 'الرقم الضريبي: ' + s.vatNumber : '';
        if (s.logoDataUrl) { els.invLogo.src = s.logoDataUrl; els.invLogo.style.display = ''; } else { els.invLogo.style.display = 'none'; }

        els.invOrderNum.textContent = String(ctx.orderNum || ctx.orderNumber || '—');
        els.invDate.textContent = ctx.dateStr || ctx.date || '';
        els.invPayment.textContent = ctx.paymentLabel || ctx.payment || '';

        if (ctx.customer) {
          els.invCustomer.textContent = ctx.customer.name || '';
          els.invPhone.textContent = ctx.customer.phone || '';
          els.invCustomer.style.display = '';
        } else { els.invCustomer.style.display = 'none'; }

        // items
        if (Array.isArray(ctx.items)) {
          els.invItemsBody.innerHTML = ctx.items.map(function(it){
            var name = escHtml(it.productAr || it.product || 'اشتراك');
            var svc = escHtml(it.serviceAr || it.serviceLabel || 'اشتراك مسبق الدفع');
            var qty = Number(it.qty || it.quantity || 1);
            var line = Number(it.lineTotal || it.lineTotal || it.line_total || 0);
            return '<tr><td class="inv-td-name">'+name+'</td><td class="inv-td-num">'+qty+'</td><td class="inv-td-amt">'+fmtLtr(line)+'</td><td class="inv-td-name">'+svc+'</td></tr>';
          }).join('');
        }

        // totals
        els.invSubtotal.innerHTML = sarFmt(ctx.subtotal || 0);
        if (ctx.vatRate && ctx.vatAmount) {
          els.invVatLabel.textContent = 'ضريبة القيمة المضافة (' + (ctx.vatRate||0) + '%)';
          els.invVat.innerHTML = sarFmt(ctx.vatAmount || 0);
          els.invVat.style.display = '';
        } else { els.invVat.style.display = 'none'; }
        els.invTotal.innerHTML = sarFmt(ctx.total || 0);

        // QR
        if (ctx.qrPayload) {
          els.invQR.innerHTML = '';
          window.api.generateZatcaQR(ctx.qrPayload).then(function(res){ if (res && res.success && res.svg) els.invQR.innerHTML = res.svg; }).catch(()=>{});
        } else { els.invQR.innerHTML = ''; }
      } catch (e) { console.error('InvoiceRenderer.fillThermalInvoice', e); }
    },

    fillA4Invoice: function(ctx, els, settings) {
      try {
        var s = settings || {};
        if (!els || !ctx) return;
        function a4mText(id, val) {
          var el = els.invoicePaperA4 ? els.invoicePaperA4.querySelector('#' + id) : document.getElementById(id);
          if (el) el.textContent = val || '';
        }
        function a4mHtml(id, val) {
          var el = els.invoicePaperA4 ? els.invoicePaperA4.querySelector('#' + id) : document.getElementById(id);
          if (el) el.innerHTML = val || '';
        }
        var logoEl = els.a4Logo || (els.invoicePaperA4 && els.invoicePaperA4.querySelector('#a4Logo'));
        if (logoEl) {
          if (s.logoDataUrl) { logoEl.src = s.logoDataUrl; logoEl.style.display = ''; } else { logoEl.style.display = 'none'; }
        }
        a4mText('a4ShopNameAr', s.laundryNameAr || '');
        a4mText('a4ShopAddressAr', s.locationAr || '');
        a4mText('a4ShopPhoneAr', s.phone ? 'جوال: ' + s.phone : '');
        a4mText('a4VatAr', s.vatNumber ? 'الرقم الضريبي: ' + s.vatNumber : '');

        a4mText('a4OrderNum', ctx.orderNum || ctx.orderNumber || '');
        a4mText('a4Date', ctx.dateStr || ctx.date || '');
        a4mText('a4Payment', ctx.paymentLabel || ctx.payment || '');
        a4mText('a4CustName', (ctx.customer && ctx.customer.name) || '—');
        a4mText('a4CustPhone', (ctx.customer && ctx.customer.phone) || '—');

        // items
        var itemsTbody = els.a4ItemsTbody || (els.invoicePaperA4 && els.invoicePaperA4.querySelector('#a4ItemsTbody'));
        if (itemsTbody && Array.isArray(ctx.items)) {
          itemsTbody.innerHTML = ctx.items.map(function(it,i){
            var name = escHtml(it.productAr || it.product || 'اشتراك');
            var svc = escHtml(it.serviceAr || it.serviceLabel || 'اشتراك مسبق الدفع');
            var qty = Number(it.qty || it.quantity || 1);
            var unit = Number(it.unitPrice || it.unit_price || 0);
            var lineTotal = Number(it.lineTotal || it.line_total || 0);
            return '<tr><td class="a4m-td-num">'+(i+1)+'</td><td class="a4m-td-name">'+name+'</td><td class="a4m-td-name">'+svc+'</td><td class="a4m-td-num">'+qty+'</td><td class="a4m-td-num">'+fmtLtr(unit)+'</td><td class="a4m-td-num">'+fmtLtr(lineTotal)+'</td></tr>';
          }).join('');
        }

        a4mHtml('a4Subtotal', sarFmt(ctx.subtotal || 0));
        if (ctx.discount && ctx.discount > 0) { a4mHtml('a4Discount', sarFmt(ctx.discount)); }
        a4mHtml('a4Total', sarFmt(ctx.total || 0));

        if (ctx.qrPayload) {
          var qrEl = els.a4QR || (els.invoicePaperA4 && els.invoicePaperA4.querySelector('#a4QR'));
          if (qrEl) {
            qrEl.innerHTML = '';
            window.api.generateZatcaQR(ctx.qrPayload).then(function(res){ if (res && res.success && res.svg) qrEl.innerHTML = res.svg; }).catch(()=>{});
          }
        }
      } catch (e) { console.error('InvoiceRenderer.fillA4Invoice', e); }
    }
  };
})();
