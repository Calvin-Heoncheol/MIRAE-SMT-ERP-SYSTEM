  /** ERP HTML 페이지 렌더 (embed=1 이면 iframe용: 상단 메뉴 숨김) */
  function renderErpPage_(filename, title, embed, extras) {
    var t = HtmlService.createTemplateFromFile(filename);
    t.embed = embed === true;
    if (extras) {
      Object.keys(extras).forEach(function (k) {
        t[k] = extras[k];
      });
    }
    return t
      .evaluate()
      .setTitle(title)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  /** 상단 메뉴 고정 + 본문만 iframe으로 바꿔 빠른 화면 전환 */
  function renderAppShell_() {
    var t = HtmlService.createTemplateFromFile('AppShell');
    return t
      .evaluate()
      .setTitle('미래SMT ERP 시스템')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  function doGet(e) {
    var page = e ? e.parameter.page : null;
    var embed = e && String(e.parameter.embed) === '1';

    if (page === 'quote') {
      return renderErpPage_('QuoteManagement', '견적서 관리 - 미래SMT ERP 시스템', embed);
    } else if (page === 'order' || page === 'production-dashboard') {
      var orderTab = 'list';
      if (page === 'production-dashboard' || (e && String(e.parameter.tab) === 'status')) {
        orderTab = 'status';
      }
      return renderErpPage_('OrderManagement', '주문서 관리 - 미래SMT ERP 시스템', embed, { initialTab: orderTab });
    } else if (page === 'pdf') {
      var quoteNumber = e ? e.parameter.quoteNumber : null;
      if (quoteNumber) {
        return generateQuotePDF(quoteNumber);
      }
      return HtmlService.createHtmlOutput('견적서번호가 필요합니다.');
    } else if (page === 'quote-excel') {
      var excelQuoteNumber = e ? e.parameter.quoteNumber : null;
      if (!excelQuoteNumber) {
        return HtmlService.createHtmlOutput('견적서번호가 필요합니다.');
      }
      try {
        return serveQuoteExcelDownload_(excelQuoteNumber);
      } catch (excelErr) {
        Logger.log('견적 엑셀 다운로드 오류: ' + excelErr);
        return HtmlService.createHtmlOutput('엑셀 생성 중 오류가 발생했습니다: ' + (excelErr.message || excelErr));
      }
    } else if (page === 'material-order-pdf') {
      try {
        Logger.log('=== material-order-pdf 페이지 접근 ===');
        Logger.log('전체 파라미터: ' + JSON.stringify(e ? e.parameter : {}));
        
        var orderNumber = null;
        if (e && e.parameter) {
          orderNumber = e.parameter.orderNumber;
        }
        
        Logger.log('발주번호 파라미터: ' + orderNumber);
        
        if (!orderNumber) {
          Logger.log('발주번호가 없습니다.');
          var errorHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>오류</title></head><body><h1>오류</h1><p>발주번호가 필요합니다.</p><p>파라미터: ' + JSON.stringify(e ? e.parameter : {}) + '</p></body></html>';
          return HtmlService.createHtmlOutput(errorHtml)
            .setTitle('오류')
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
        }
        
        Logger.log('generateMaterialOrderPDF 함수 호출 시작 - 발주번호: ' + orderNumber);
        var result = generateMaterialOrderPDF(orderNumber);
        Logger.log('generateMaterialOrderPDF 함수 호출 완료');
        
        if (!result) {
          Logger.log('결과가 null입니다!');
          var nullHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>오류</title></head><body><h1>오류</h1><p>PDF 생성 결과가 없습니다.</p></body></html>';
          return HtmlService.createHtmlOutput(nullHtml)
            .setTitle('오류')
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
        }
        
        Logger.log('결과 반환 전');
        return result;
      } catch (error) {
        Logger.log('doGet에서 오류 발생: ' + error.toString());
        Logger.log('스택: ' + (error.stack || '없음'));
        var errorHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>오류</title></head><body><h1>오류</h1><p>' + error.toString() + '</p><p>스택: ' + (error.stack || '없음') + '</p></body></html>';
        return HtmlService.createHtmlOutput(errorHtml)
          .setTitle('오류')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      }
    } else if (page === 'material-order') {
      return renderErpPage_('MaterialOrder', '자재 발주 - 미래SMT ERP 시스템', embed);
    } else if (page === 'material-inbound' || page === 'material-outbound') {
      return renderErpPage_('MaterialInboundOutbound', '자재 입고 & 생산 불출 - 미래SMT ERP 시스템', embed);
    } else if (page === 'production-lot') {
      return renderErpPage_('ProductionStatus', 'SMT - 미래SMT ERP 시스템', embed);
    } else if (page === 'production-plan') {
      return renderAppShell_();
    } else if (page === 'production-status' || page === 'production-input') {
      return renderErpPage_('ProductionStatus', 'SMT - 미래SMT ERP 시스템', embed);
    } else if (page === 'post-process') {
      return renderErpPage_('PostProcess', '후공정 - 미래SMT ERP 시스템', embed);
    } else if (page === 'order-shipment-pdf') {
      try {
        var shipCountKey = e && e.parameter.countKey ? String(e.parameter.countKey) : '';
        var shipDateParam = e && e.parameter.shipDate ? String(e.parameter.shipDate) : '';
        var shipQtyParam = e && e.parameter.qty != null ? e.parameter.qty : '';
        var shipNoteParam = e && e.parameter.note != null ? String(e.parameter.note) : '';
        var shipUnitPriceParam = e && e.parameter.unitPrice != null ? e.parameter.unitPrice : '';
        var shipSupplyParam = e && e.parameter.supplyAmount != null ? e.parameter.supplyAmount : '';
        var shipOrderNoParam = e && e.parameter.orderNumber ? String(e.parameter.orderNumber) : '';
        var shipProductParam = e && e.parameter.productName ? String(e.parameter.productName) : '';
        var shipCustomerParam = e && e.parameter.customer ? String(e.parameter.customer) : '';
        return generateOrderShipmentStatementPDF(
          shipCountKey,
          shipDateParam,
          shipQtyParam,
          shipNoteParam,
          shipUnitPriceParam,
          shipSupplyParam,
          shipOrderNoParam,
          shipProductParam,
          shipCustomerParam
        );
      } catch (shipPdfErr) {
        Logger.log('order-shipment-pdf 오류: ' + shipPdfErr.toString());
        var shipPdfErrHtml =
          '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>오류</title></head><body><h1>거래명세서 생성 오류</h1><p>' +
          (shipPdfErr.message || String(shipPdfErr)) +
          '</p></body></html>';
        return HtmlService.createHtmlOutput(shipPdfErrHtml)
          .setTitle('오류')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      }
    } else if (page === 'order-shipment') {
      return renderErpPage_('OrderShipment', '완제품 출하(납품) - 미래SMT ERP 시스템', embed);
    } else if (page === 'material-register') {
      return renderErpPage_('MaterialRegister', '자재 - 미래SMT ERP 시스템', embed);
    } else if (page === 'material-inventory') {
      return renderErpPage_('MaterialInventory', '자재 재고 - 미래SMT ERP 시스템', embed);
    } else if (page === 'material-inbound-outbound') {
      return renderErpPage_('MaterialInboundOutbound', '자재 입고 & 생산 불출 - 미래SMT ERP 시스템', embed);
    } else if (page === 'dashboard') {
      return renderAppShell_();
    } else if (!page) {
      return renderAppShell_();
    } else {
      return renderAppShell_();
    }
  }

  function include(filename) {
    try {
      return HtmlService.createHtmlOutputFromFile(filename).getContent();
    } catch (err) {
      Logger.log('include 실패 [' + filename + ']: ' + err);
      var tag = 'div';
      return (
        '<' + tag + ' style="padding:20px;margin:16px;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;font-size:14px;">' +
        '<strong>화면 구성 오류</strong><br>HTML 파일 <code>' +
        String(filename) +
        '</code>을(를) Apps Script 프로젝트에서 찾을 수 없습니다. ' +
        '에디터에 해당 파일이 있는지 확인한 뒤 웹앱을 다시 배포하세요.' +
        '</' + tag + '>'
      );
    }
  }

  /**
   * 시트 하단에 2차원 배열 여러 행 추가 (getRange 3번째 인자 = 행 개수)
   * @return {number} 첫 추가 행 번호(1-based)
   */
  function _sheetAppendRows_(sheet, rows, numCols) {
    if (!sheet || !rows || !rows.length) return 0;
    var startRow = sheet.getLastRow() + 1;
    var w = numCols > 0 ? numCols : rows[0] ? rows[0].length : 1;
    sheet.getRange(startRow, 1, rows.length, w).setValues(rows);
    return startRow;
  }

  /**
   * 스프레드시트 열릴 때 사용자 메뉴 추가
   */
  function onOpen() {
    try {
      var ui = SpreadsheetApp.getUi();
      ui.createMenu('SMT')
        .addItem('SMT생산기록 동기화(현재 라인현황)', 'runSyncSmtProductionRecordFromLineStatusMenu')
        .addSeparator()
        .addItem('SMT생산기록 자동동기화 1분 시작', 'installSmtProductionRecordAutoSyncEveryMinute')
        .addItem('SMT생산기록 자동동기화 중지', 'removeSmtProductionRecordAutoSyncTrigger')
        .addSeparator()
        .addItem('자재코드 변환 (접두사 붙이기)', 'runMaterialCodeConversion')
        .addToUi();
    } catch (e) {
      Logger.log('onOpen 메뉴 생성 오류: ' + e.toString());
    }
  }

  /**
   * 설치형 트리거/수동 설치 시 메뉴 보장
   */
  function onInstall() {
    onOpen();
  }

  /**
   * 메뉴: 현재 라인현황 스냅샷을 SMT생산기록 시트에 반영
   */
  function runSyncSmtProductionRecordFromLineStatusMenu() {
    try {
      var res = syncSmtProductionRecordFromLineStatusNow({ forceWrite: true, changedOnly: false });
      var synced = res && res.synced ? res.synced : [];
      var skipped = res && res.skipped ? res.skipped : [];
      var msg =
        'SMT생산기록 동기화 완료\n\n' +
        '(주문서를 라인에 배정한 경우에만 기록됩니다.)\n\n' +
        '- 반영 라인: ' + (synced.length ? synced.join(', ') : '없음') + '\n' +
        '- 건너뜀: ' + (skipped.length ? skipped.join(', ') : '없음');
      SpreadsheetApp.getUi().alert('안내', msg, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {
      SpreadsheetApp.getUi().alert('오류', '동기화 중 오류: ' + (e.message || String(e)), SpreadsheetApp.getUi().ButtonSet.OK);
    }
  }

  /**
   * 메뉴: 선택 범위 셀 값 앞에 접두사를 붙임 (예: J-137 + SC → SC-J-137)
   */
  function runMaterialCodeConversion() {
    var ui = SpreadsheetApp.getUi();
    try {
      var sheet = SpreadsheetApp.getActiveSheet();
      var range = sheet.getActiveRange();
      if (!range) {
        ui.alert('안내', '변환할 셀 범위를 먼저 드래그로 선택한 뒤, 다시 「SMT」→「자재코드 변환」을 실행하세요.', ui.ButtonSet.OK);
        return;
      }

      var prefixRes = ui.prompt(
        '자재코드 변환',
        '선택한 셀의 코드 앞에 붙일 접두사를 입력하세요.\n' +
          '예: SC  →  J-137 이 SC-J-137 로 바뀝니다.\n' +
          '이미 같은 접두사가 붙은 셀은 건너뜁니다.\n' +
          '비어 있으면 취소됩니다.',
        ui.ButtonSet.OK_CANCEL
      );
      if (prefixRes.getSelectedButton() !== ui.Button.OK) {
        return;
      }
      var prefix = String(prefixRes.getResponseText() || '').trim();
      if (!prefix) {
        ui.alert('안내', '접두사가 비어 있어 중단했습니다.', ui.ButtonSet.OK);
        return;
      }

      var values = range.getValues();
      var out = [];
      var converted = 0;
      var skipped = 0;
      for (var i = 0; i < values.length; i++) {
        out[i] = [];
        for (var j = 0; j < values[i].length; j++) {
          var original = values[i][j];
          var next = convertCellToPrefixedCode_(original, prefix);
          out[i][j] = next;
          if (next !== original) {
            converted++;
          } else if (original !== null && original !== '') {
            skipped++;
          }
        }
      }
      range.setValues(out);
      ui.alert(
        '자재코드 변환 완료',
        '접두사: ' + prefix + '\n' +
          '변환한 셀: ' + converted + '개\n' +
          '그대로 둔 셀: ' + skipped + '개 (비어 있음·이미 접두사 있음)',
        ui.ButtonSet.OK
      );
    } catch (e) {
      ui.alert('오류', '자재코드 변환 중 오류: ' + (e.message || String(e)), ui.ButtonSet.OK);
    }
  }

  /**
   * @param {*} cellValue
   * @param {string} prefix
   * @return {*}
   */
  function convertCellToPrefixedCode_(cellValue, prefix) {
    if (cellValue === null || cellValue === '') {
      return cellValue;
    }
    var text = String(cellValue).trim();
    if (!text) {
      return cellValue;
    }
    var p = String(prefix || '').trim().replace(/-+$/, '');
    if (!p) {
      return cellValue;
    }
    var head = p + '-';
    var lowerHead = head.toLowerCase();
    var lowerText = text.toLowerCase();
    if (lowerText === p.toLowerCase() || lowerText.indexOf(lowerHead) === 0) {
      return text;
    }
    return head + text;
  }

  var MIRAE_CODE_PREFIX_ = 'MS_';
  var MIRAE_CODE_MIN_DIGITS_ = 5;

  /** @param {number} n */
  function _formatMiraeCodeFromNumber_(n) {
    var num = Math.max(1, Math.floor(Number(n) || 1));
    var width = Math.max(MIRAE_CODE_MIN_DIGITS_, String(num).length);
    var zeros = new Array(width + 1).join('0');
    return MIRAE_CODE_PREFIX_ + (zeros + String(num)).slice(-width);
  }

  /** @param {*} code @return {number|null} */
  function _getMiraeCodeSequenceNumber_(code) {
    var t = code == null ? '' : String(code).trim();
    if (!t) return null;
    var m = t.match(/^MS_(\d+)$/i);
    if (!m) return null;
    var n = parseInt(m[1], 10);
    return isNaN(n) ? null : n;
  }

  function _miraeCodeKey_(code) {
    return String(code == null ? '' : code).trim().toUpperCase();
  }

  /** 고객사+CPN 복합 키 (자재등록 유일성) */
  function _materialCustomerCpnKey_(customer, materialCode) {
    var cpn = _miraeCodeKey_(materialCode);
    if (!cpn) return '';
    return String(customer == null ? '' : customer).trim().toLowerCase() + '\x1f' + cpn;
  }

  /** 재고 집계 키 — CPN 있으면 고객사+CPN, 없으면 자재명+규격 */
  function _materialStockKey_(customer, materialCode, materialName, specification) {
    var cc = _materialCustomerCpnKey_(customer, materialCode);
    if (cc) return 'C:' + cc;
    var nm = String(materialName || '').trim().toLowerCase();
    var sp = String(specification || '').trim().toLowerCase();
    return 'NS:' + nm + '\x1f' + sp;
  }

  function _materialStockBucket_(inventoryMap, customer, materialCode, materialName, specification) {
    inventoryMap = inventoryMap || {};
    var key = _materialStockKey_(customer, materialCode, materialName, specification);
    if (!inventoryMap[key]) {
      inventoryMap[key] = {
        stockKey: key,
        customer: String(customer || '').trim(),
        materialCode: String(materialCode || '').trim(),
        materialName: String(materialName || '').trim(),
        specification: String(specification || '').trim(),
        inboundQuantity: 0,
        outboundQuantity: 0,
        directStock: 0
      };
    }
    return inventoryMap[key];
  }

  function _buildMaterialRegisterLookupMaps_(mats) {
    var byNameSpec = {};
    var byCustomerCpn = {};
    var byCpnList = {};
    mats = mats || [];
    for (var i = 0; i < mats.length; i++) {
      var m = mats[i] || {};
      var nm = String(m.materialName || '').trim();
      var sp = String(m.specification || '').trim();
      var cust = String(m.customer || '').trim();
      var cpn = String(m.materialCode || '').trim();
      var nsKey = _mrpMaterialKey_(nm, sp);
      if (nsKey) byNameSpec[nsKey] = m;
      var ccKey = _materialCustomerCpnKey_(cust, cpn);
      if (ccKey && cpn) byCustomerCpn[ccKey] = m;
      if (cpn) {
        var ck = _miraeCodeKey_(cpn);
        if (!byCpnList[ck]) byCpnList[ck] = [];
        byCpnList[ck].push(m);
      }
    }
    return { byNameSpec: byNameSpec, byCustomerCpn: byCustomerCpn, byCpnList: byCpnList };
  }

  function _resolveMaterialStockIdentity_(registerMaps, materialCode, materialName, specification) {
    registerMaps = registerMaps || { byNameSpec: {}, byCustomerCpn: {}, byCpnList: {} };
    var cpn = String(materialCode || '').trim();
    var nm = String(materialName || '').trim();
    var sp = String(specification || '').trim();
    var mat = registerMaps.byNameSpec[_mrpMaterialKey_(nm, sp)] || null;
    if (!mat && cpn) {
      var list = registerMaps.byCpnList[_miraeCodeKey_(cpn)] || [];
      if (list.length === 1) mat = list[0];
      else if (list.length > 1 && nm) {
        for (var i = 0; i < list.length; i++) {
          if (_mrpMaterialKey_(list[i].materialName, list[i].specification) === _mrpMaterialKey_(nm, sp)) {
            mat = list[i];
            break;
          }
        }
      }
    }
    return {
      customer: mat ? String(mat.customer || '').trim() : '',
      materialCode: mat ? String(mat.materialCode || '').trim() || cpn : cpn,
      materialName: nm,
      specification: sp
    };
  }

  /**
   * CPN 스캔 → 자재등록 조회 (불출·입고 보조)
   * @param {string} scanCode
   * @return {{ok:boolean, found?:boolean, materials?:Array, material?:Object, message?:string}}
   */
  function lookupMaterialByCpnForUi(scanCode) {
    try {
      var raw = String(scanCode == null ? '' : scanCode).trim();
      if (!raw) return { ok: false, message: 'CPN을 스캔하세요.' };
      var rawL = raw.toLowerCase();
      var mats = getMaterials() || [];
      var matches = [];
      for (var i = 0; i < mats.length; i++) {
        var m = mats[i] || {};
        var cpn = String(m.materialCode || '').trim();
        if (cpn && (cpn === raw || cpn.toLowerCase() === rawL)) matches.push(m);
      }
      if (!matches.length) {
        return { ok: true, found: false, message: '등록되지 않은 CPN입니다.' };
      }
      return {
        ok: true,
        found: true,
        materials: matches,
        material: matches.length === 1 ? matches[0] : null,
        message: matches.length > 1 ? '동일 CPN이 여러 고객사에 있습니다. 고객사를 확인하세요.' : ''
      };
    } catch (e) {
      Logger.log('lookupMaterialByCpnForUi 오류: ' + e.toString());
      return { ok: false, message: e.message || String(e) };
    }
  }

  /** @return {Object<string, boolean>} */
  function _buildMiraeCodeUsedSet_() {
    var used = {};
    var mats = getMaterials() || [];
    for (var i = 0; i < mats.length; i++) {
      var c = String((mats[i] || {}).materialCode || '').trim();
      if (c) used[_miraeCodeKey_(c)] = true;
    }
    return used;
  }

  /** @param {Object<string, boolean>} usedSet */
  function _getMaxMiraeCodeSequenceNumber_(usedSet) {
    var maxNum = 0;
    var mats = getMaterials() || [];
    for (var i = 0; i < mats.length; i++) {
      var n = _getMiraeCodeSequenceNumber_((mats[i] || {}).materialCode);
      if (n != null && n > maxNum) maxNum = n;
    }
    if (usedSet) {
      for (var k in usedSet) {
        if (!Object.prototype.hasOwnProperty.call(usedSet, k)) continue;
        var n2 = _getMiraeCodeSequenceNumber_(k);
        if (n2 != null && n2 > maxNum) maxNum = n2;
      }
    }
    return maxNum;
  }

  /**
   * @param {Object<string, boolean>} usedSet
   * @return {string|null}
   */
  function _allocateNextMiraeCode_(usedSet) {
    var used = usedSet || _buildMiraeCodeUsedSet_();
    var n = _getMaxMiraeCodeSequenceNumber_(used) + 1;
    for (var guard = 0; guard < 1000000; guard++) {
      var code = _formatMiraeCodeFromNumber_(n);
      var key = _miraeCodeKey_(code);
      if (!used[key]) {
        used[key] = true;
        return code;
      }
      n++;
    }
    return null;
  }

  /**
   * 메뉴: 선택 범위의 빈 셀에 MS_00001 형식 미래코드 부여 (기존 값·중복 코드는 건너뜀)
   */
  function runMiraeCodeGenerateForSelectionMenu() {
    var ui = SpreadsheetApp.getUi();
    try {
      var sheet = SpreadsheetApp.getActiveSheet();
      var range = sheet.getActiveRange();
      if (!range) {
        ui.alert('안내', '미래코드를 넣을 셀 범위를 먼저 선택한 뒤 다시 실행하세요.', ui.ButtonSet.OK);
        return;
      }
      var confirm = ui.alert(
        '미래코드 생성 (선택 셀)',
        '선택 범위의 빈 셀에 ' +
          MIRAE_CODE_PREFIX_ +
          '##### 형식 코드를 채웁니다.\n' +
          '이미 값이 있는 셀은 건너뜁니다.\n' +
          '자재등록에 이미 있는 미래코드와 중복되지 않게 발번합니다.\n\n' +
          '계속할까요?',
        ui.ButtonSet.YES_NO
      );
      if (confirm !== ui.Button.YES) return;

      var used = _buildMiraeCodeUsedSet_();
      var values = range.getValues();
      var out = [];
      var created = 0;
      var skippedFilled = 0;
      for (var i = 0; i < values.length; i++) {
        out[i] = [];
        for (var j = 0; j < values[i].length; j++) {
          var original = values[i][j];
          var cur = original == null ? '' : String(original).trim();
          if (cur) {
            out[i][j] = original;
            skippedFilled++;
            var existKey = _miraeCodeKey_(cur);
            if (!used[existKey]) used[existKey] = true;
            continue;
          }
          var next = _allocateNextMiraeCode_(used);
          if (!next) {
            ui.alert('오류', '사용 가능한 미래코드를 더 이상 만들 수 없습니다.', ui.ButtonSet.OK);
            return;
          }
          out[i][j] = next;
          created++;
        }
      }
      range.setValues(out);
      ui.alert(
        '미래코드 생성 완료',
        '생성: ' + created + '개\n' + '기존 값 유지: ' + skippedFilled + '개\n' + '형식: ' + MIRAE_CODE_PREFIX_ + '00001 …',
        ui.ButtonSet.OK
      );
    } catch (e) {
      ui.alert('오류', '미래코드 생성 중 오류: ' + (e.message || String(e)), ui.ButtonSet.OK);
    }
  }

  /**
   * 메뉴: 자재등록 시트 미래코드 열의 빈 칸에 MS_##### 일괄 부여
   */
  function runMiraeCodeGenerateForRegisterSheetMenu() {
    var ui = SpreadsheetApp.getUi();
    var lock = LockService.getDocumentLock();
    if (!lock.tryLock(15000)) {
      ui.alert('안내', '다른 저장 처리 중입니다. 잠시 후 다시 시도하세요.', ui.ButtonSet.OK);
      return;
    }
    try {
      var sheet = getMaterialRegisterSheet();
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        ui.alert('안내', '자재등록 시트에 데이터 행이 없습니다.', ui.ButtonSet.OK);
        return;
      }
      var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
      var codeCol = _materialRegisterInventoryColumnIndices_(headerRow).codeCol;
      if (codeCol < 0) {
        ui.alert('오류', '자재등록 시트에서 미래코드 열을 찾을 수 없습니다.', ui.ButtonSet.OK);
        return;
      }
      var confirm = ui.alert(
        '미래코드 생성 (자재등록)',
        '「자재등록」 시트의 빈 미래코드에 ' +
          MIRAE_CODE_PREFIX_ +
          '##### 를 부여합니다.\n' +
          '자재명이 있는 행만 대상이며, 이미 코드가 있으면 유지합니다.\n\n' +
          '계속할까요?',
        ui.ButtonSet.YES_NO
      );
      if (confirm !== ui.Button.YES) return;

      var nameCol = _materialRegisterInventoryColumnIndices_(headerRow).nameCol;
      var lastCol = sheet.getLastColumn();
      var data = sheet.getRange(2, 1, lastRow, lastCol).getValues();
      var used = _buildMiraeCodeUsedSet_();
      var created = 0;
      var skippedFilled = 0;
      var skippedEmpty = 0;
      for (var r = 0; r < data.length; r++) {
        var row = data[r] || [];
        var name = nameCol >= 0 ? String(row[nameCol] != null ? row[nameCol] : '').trim() : '';
        if (!name) {
          skippedEmpty++;
          continue;
        }
        var cur = codeCol >= 0 ? _sheetCellToPlainString_(row[codeCol]).trim() : '';
        if (cur) {
          skippedFilled++;
          var ek = _miraeCodeKey_(cur);
          if (!used[ek]) used[ek] = true;
          continue;
        }
        var next = _allocateNextMiraeCode_(used);
        if (!next) {
          ui.alert('오류', '사용 가능한 미래코드를 더 이상 만들 수 없습니다.', ui.ButtonSet.OK);
          return;
        }
        row[codeCol] = next;
        data[r] = row;
        created++;
      }
      if (created > 0) {
        sheet.getRange(2, 1, lastRow, lastCol).setValues(data);
      }
      ui.alert(
        '미래코드 생성 완료',
        '생성: ' +
          created +
          '개\n' +
          '기존 코드 유지: ' +
          skippedFilled +
          '개\n' +
          '자재명 없음(건너뜀): ' +
          skippedEmpty +
          '개',
        ui.ButtonSet.OK
      );
    } catch (e) {
      ui.alert('오류', '미래코드 생성 중 오류: ' + (e.message || String(e)), ui.ButtonSet.OK);
    } finally {
      try {
        lock.releaseLock();
      } catch (rel) {}
    }
  }

  function getUserInfo() {
    try {
      const user = Session.getActiveUser();
      if (user) {
        const email = user.getEmail();
        if (email) {
          return {
            email: email,
            name: email.split('@')[0]
          };
        }
      }
    } catch (error) {
      Logger.log('사용자 정보 가져오기 오류: ' + error.toString());
    }
    
    try {
      const effectiveUser = Session.getEffectiveUser();
      if (effectiveUser) {
        const email = effectiveUser.getEmail();
        if (email) {
          return {
            email: email,
            name: email.split('@')[0]
          };
        }
      }
    } catch (e) {
      Logger.log('EffectiveUser 가져오기 오류: ' + e.toString());
    }
    
    return {
      email: 'guest@example.com',
      name: '게스트'
    };
  }

  function getWebAppUrl() {
    try {
      const service = ScriptApp.getService();
      if (service) {
        const url = service.getUrl();
        if (url) {
          return url;
        }
      }
    } catch (error) {
      Logger.log('웹 앱 URL 가져오기 오류: ' + error.toString());
    }
    
    return '';
  }

  function _smtLineProgressPercent_(status) {
    var s = String(status || '').trim().toLowerCase();
    if (s === 'running') return 100;
    if (s === 'completed') return 100;
    if (s === 'setup') return 55;
    if (s === 'stopped') return 35;
    return 0;
  }

  /**
   * 주문현황·홈 지표 — 주문서 시트 행 그대로 (조립 합침 없음).
   * 후공정·납품출하는 _orderLinesForAssemblyPages_() 사용.
   * @return {{ base:Array, merged:Array, catalog:Array }}
   */
  function _dashboardDisplayOrderLines_() {
    var base = getOrders() || [];
    var i;
    for (i = 0; i < base.length; i++) {
      if (base[i] && !base[i]._countKey) {
        _enrichOrderLineMeta_(base[i], base[i].sheetRow, base[i].orderLineSeq != null ? base[i].orderLineSeq : i);
      }
    }
    return { base: base, merged: base, catalog: [] };
  }

  function _dashboardBaseOrders_() {
    var pkg = _dashboardDisplayOrderLines_();
    return pkg.base && pkg.base.length ? pkg.base : getOrders() || [];
  }

  /**
   * 주문 제품행(수량>0) 기준 출고·SMT·후공정 100% 완료 건수
   * @param {Array} orders
   * @param {{ qtyMap?:Object, postCounts?:Object, outQtyByOrder?:Object, outs?:Array, baseOrders?:Array }} caches
   */
  function _dashboardOrderLineStatusMetrics_(orders, caches) {
    orders = orders || [];
    caches = caches || {};
    var qtyMap = caches.qtyMap;
    if (!qtyMap) {
      try {
        qtyMap = _smtBuildQtySummaryMap_() || {};
      } catch (eQ) {
        qtyMap = {};
      }
    }
    var postCounts = caches.postCounts;
    if (!postCounts) {
      try {
        postCounts = getPostProcessCountsMap_() || {};
      } catch (eP) {
        postCounts = {};
      }
    }
    var shipMap = caches.shipMap;
    if (!shipMap) {
      try {
        shipMap = getOrderShipmentCountsMap_() || {};
      } catch (eSh) {
        shipMap = {};
      }
    }

    var smtByLabel = _dashboardSmtCountsByOrderLabel_(qtyMap);
    var baseOrders =
      caches.baseOrders && caches.baseOrders.length ? caches.baseOrders : _dashboardBaseOrders_();
    var total = 0;
    var orderDone = 0;
    var smtDone = 0;
    var postDone = 0;
    for (var i = 0; i < orders.length; i++) {
      var ord = orders[i] || {};
      var on = String(ord.orderNumber || '').trim();
      var tgt = Number(ord.quantity) || 0;
      if (!on || tgt <= 0) continue;
      total++;
      var smtQty = _dashboardSmtProducedForOrderLine_(qtyMap, ord, smtByLabel, baseOrders);
      if (smtQty >= tgt) smtDone++;
      var postRaw = _dashboardPostCountedForOrderLine_(postCounts, ord);
      if (Math.min(postRaw, tgt) >= tgt) postDone++;
      var shipped = _dashboardShippedForOrderLine_(shipMap, ord);
      if (shipped >= tgt) orderDone++;
    }

    function linePct(done, tot) {
      return tot > 0 ? Math.round((done / tot) * 100) : 0;
    }

    return {
      order: { percent: linePct(orderDone, total), done: orderDone, total: total, label: '출하 완료 행' },
      smt: { percent: linePct(smtDone, total), done: smtDone, total: total, label: 'SMT 완료 행' },
      post: { percent: linePct(postDone, total), done: postDone, total: total, label: '후공정 완료 행' }
    };
  }

  /**
   * 대시보드 생산현황 진행률 요약 (주문 제품행 완료 건수 기준)
   */
  function getDashboardProductionProgress() {
    try {
      var pkg = _dashboardDisplayOrderLines_();
      var orders = pkg.merged || [];
      var maps = _getCachedProductionMaps_();
      return {
        ok: true,
        updatedAt: new Date().toISOString(),
        metrics: _dashboardOrderLineStatusMetrics_(orders, {
          qtyMap: maps.qtyMap,
          postCounts: maps.postCounts,
          shipMap: maps.shipMap,
          baseOrders: pkg.base || []
        })
      };
    } catch (error) {
      Logger.log('getDashboardProductionProgress 오류: ' + error.toString());
      return {
        ok: false,
        error: error.message || String(error),
        metrics: {
          order: { percent: 0, done: 0, total: 0, label: '출하 완료 행' },
          smt: { percent: 0, done: 0, total: 0, label: 'SMT 완료 행' },
          post: { percent: 0, done: 0, total: 0, label: '후공정 완료 행' }
        }
      };
    }
  }

  /** 홈 대시보드: 날짜 문자열 → ms (견적일·주문일 공용) */
  function _homeDateToMs_(dateStr) {
    if (!dateStr) return 0;
    var t = parseQuoteDateForSort(dateStr);
    if (t) return t;
    var d = new Date(dateStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  /** 최근 N일 이내 건수 */
  function _homeCountRecentByDate_(rows, dateField, days) {
    rows = rows || [];
    var cutoff = Date.now() - (days > 0 ? days : 7) * 86400000;
    var n = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      if (_homeDateToMs_(r[dateField]) >= cutoff) n++;
    }
    return n;
  }

  /** 홈용 — 이미 읽은 자재발주 행으로 재고 맵(입고 LOT만) */
  function _homeInventoryMapFromOrderRows_(values, ix, registerMaps) {
    var inventoryMap = {};
    values = values || [];
    registerMaps = registerMaps || _buildMaterialRegisterLookupMaps_(getMaterials() || []);
    for (var i = 1; i < values.length; i++) {
      var row = values[i] || [];
      var materialName = String(_moCell_(row, ix, 'materialName')).trim();
      var specification = String(_moCell_(row, ix, 'spec')).trim();
      if (!materialName) continue;
      var colMc =
        ix.materialCode >= 0 ? String(row[ix.materialCode] != null ? row[ix.materialCode] : '').trim() : '';
      var detailInfo = _moMergeDetailFromRow_(row, ix);
      var codeFromJson = detailInfo.materialCode != null ? String(detailInfo.materialCode).trim() : '';
      var idn = _resolveMaterialStockIdentity_(registerMaps, colMc || codeFromJson, materialName, specification);
      var bucket = _materialStockBucket_(
        inventoryMap,
        idn.customer,
        idn.materialCode,
        idn.materialName,
        idn.specification
      );
      if (detailInfo.lots && Array.isArray(detailInfo.lots)) {
        for (var li = 0; li < detailInfo.lots.length; li++) {
          var lot = detailInfo.lots[li] || {};
          if (lot.quantity) {
            bucket.inboundQuantity +=
              typeof lot.quantity === 'number' ? lot.quantity : parseFloat(lot.quantity) || 0;
          }
        }
      }
    }
    return inventoryMap;
  }

  function _homeApplyOutboundToInventoryMap_(inventoryMap, registerMaps) {
    inventoryMap = inventoryMap || {};
    registerMaps = registerMaps || _buildMaterialRegisterLookupMaps_(getMaterials() || []);
    try {
      var outboundSheet = getSpreadsheet().getSheetByName('자재출고');
      if (!outboundSheet) return inventoryMap;
      var lastRow = outboundSheet.getLastRow();
      if (lastRow < 2) return inventoryMap;
      var width = Math.max(4, outboundSheet.getLastColumn());
      var outboundValues = outboundSheet.getRange(1, 1, lastRow, width).getValues();
      var outboundHeader = outboundValues.length > 0 ? outboundValues[0] : [];
      var outboundMap = _materialOutboundHeaderIndexMap_(outboundHeader);
      for (var j = 1; j < outboundValues.length; j++) {
        var row = outboundValues[j] || [];
        var outboundMaterialCode =
          outboundMap.materialCode >= 0 && row[outboundMap.materialCode] != null
            ? String(row[outboundMap.materialCode]).trim()
            : '';
        var outboundMaterialName =
          outboundMap.materialName >= 0 && row[outboundMap.materialName] != null
            ? String(row[outboundMap.materialName]).trim()
            : '';
        var outboundSpecification =
          outboundMap.specification >= 0 && row[outboundMap.specification] != null
            ? String(row[outboundMap.specification]).trim()
            : '';
        var oqRaw = outboundMap.quantity >= 0 ? row[outboundMap.quantity] : '';
        var outboundQuantity = oqRaw ? (typeof oqRaw === 'number' ? oqRaw : parseFloat(oqRaw) || 0) : 0;
        if (!outboundMaterialName && !outboundMaterialCode) continue;
        var oidn = _resolveMaterialStockIdentity_(
          registerMaps,
          outboundMaterialCode,
          outboundMaterialName,
          outboundSpecification
        );
        var obucket = _materialStockBucket_(
          inventoryMap,
          oidn.customer,
          oidn.materialCode,
          oidn.materialName,
          oidn.specification
        );
        obucket.outboundQuantity += outboundQuantity;
      }
    } catch (e) {
      Logger.log('_homeApplyOutboundToInventoryMap_ 오류: ' + e.toString());
    }
    return inventoryMap;
  }

  function _homeApplyRegisterDirectStockToInventoryMap_(inventoryMap, registerMaps) {
    inventoryMap = inventoryMap || {};
    registerMaps = registerMaps || _buildMaterialRegisterLookupMaps_(getMaterials() || []);
    try {
      var regSheet = getMaterialRegisterSheet();
      var regLastRow = regSheet.getLastRow();
      var regLc = Math.max(regSheet.getLastColumn(), 1);
      if (regLastRow < 2) return inventoryMap;
      var regHeader = regSheet.getRange(1, 1, 1, regLc).getValues()[0] || [];
      var regIx = _materialRegisterInventoryColumnIndices_(regHeader);
      var stCol = _findHeaderIndexByNames_(regHeader, ['재고수량', '직접재고']);
      if (stCol < 0) return inventoryMap;
      var regVals = regSheet.getRange(2, 1, regLastRow, regLc).getValues();
      for (var k = 0; k < regVals.length; k++) {
        var drow = regVals[k] || [];
        var directCustomer =
          regIx.customerCol >= 0 && drow[regIx.customerCol] != null
            ? String(drow[regIx.customerCol]).trim()
            : '';
        var directMaterialName =
          regIx.nameCol >= 0 && drow[regIx.nameCol] != null ? String(drow[regIx.nameCol]).trim() : '';
        var directSpecification =
          regIx.specCol >= 0 && drow[regIx.specCol] != null ? String(drow[regIx.specCol]).trim() : '';
        var directMaterialCode =
          regIx.codeCol >= 0 && drow[regIx.codeCol] != null ? String(drow[regIx.codeCol]).trim() : '';
        var dqRaw = drow[stCol];
        var directQuantity =
          dqRaw !== '' && dqRaw != null
            ? typeof dqRaw === 'number'
              ? dqRaw
              : parseFloat(String(dqRaw).replace(/,/g, '')) || 0
            : 0;
        if (!directMaterialName) continue;
        var didn = _resolveMaterialStockIdentity_(
          registerMaps,
          directMaterialCode,
          directMaterialName,
          directSpecification
        );
        if (directCustomer && !didn.customer) didn.customer = directCustomer;
        var dbucket = _materialStockBucket_(
          inventoryMap,
          didn.customer,
          didn.materialCode,
          didn.materialName,
          didn.specification
        );
        dbucket.directStock = (dbucket.directStock || 0) + directQuantity;
      }
    } catch (e) {
      Logger.log('_homeApplyRegisterDirectStockToInventoryMap_ 오류: ' + e.toString());
    }
    return inventoryMap;
  }

  /** 홈 KPI용 마이너스 재고 건수·상위 목록(최대 10) */
  function _homeNegativeStockPackFromMap_(inventoryMap) {
    var negativeStock = 0;
    var negItems = [];
    inventoryMap = inventoryMap || {};
    for (var key in inventoryMap) {
      if (!Object.prototype.hasOwnProperty.call(inventoryMap, key)) continue;
      var item = inventoryMap[key];
      var raw =
        (item.inboundQuantity || 0) - (item.outboundQuantity || 0) + (item.directStock || 0);
      if (raw >= -1e-9) continue;
      negativeStock++;
      negItems.push({
        materialName: String(item.materialName || '').trim(),
        specification: String(item.specification || '').trim(),
        stock: Math.round(raw * 1000) / 1000
      });
    }
    negItems.sort(function (a, b) {
      return (a.stock || 0) - (b.stock || 0);
    });
    if (negItems.length > 10) negItems = negItems.slice(0, 10);
    return { negativeStock: negativeStock, negItems: negItems };
  }

  /** 미입고 발주·마이너스 재고 상위 목록 */
  function _homeBuildMaterialAlerts_(moIx, ov, negPack) {
    var pendingItems = [];
    var pendingOrderNums = {};
    var materialPendingLines = 0;
    for (var oi = 1; oi < ov.length; oi++) {
      var r = ov[oi] || [];
      var onum = String(_moCell_(r, moIx, 'orderNumber')).trim();
      if (!onum) continue;
      var oname = String(_moCell_(r, moIx, 'materialName')).trim();
      var ospec = String(_moCell_(r, moIx, 'spec')).trim();
      var orderQty = _parseInboundQuantity_(_moCell_(r, moIx, 'quantity'));
      var d = _moMergeDetailFromRow_(r, moIx);
      var inboundQty = _moLotsInboundSum_(d);
      var remain = orderQty - inboundQty;
      if (remain > 1e-9) {
        materialPendingLines++;
        pendingOrderNums[onum] = true;
        pendingItems.push({
          orderNumber: onum,
          materialName: oname,
          specification: ospec,
          remain: Math.round(remain * 1000) / 1000
        });
      }
    }
    pendingItems.sort(function (a, b) {
      return (b.remain || 0) - (a.remain || 0);
    });
    if (pendingItems.length > 10) pendingItems = pendingItems.slice(0, 10);

    negPack = negPack || { negativeStock: 0, negItems: [] };
    var negativeStock = Number(negPack.negativeStock) || 0;
    var negItems = negPack.negItems || [];

    var alerts = [];
    if (pendingItems.length) {
      alerts.push({
        kind: 'pending_inbound',
        nav: 'material-order',
        title: '미입고 발주',
        items: pendingItems.map(function (p) {
          var spec = p.specification ? ' / ' + p.specification : '';
          return {
            primary: p.orderNumber + ' · ' + (p.materialName || '자재') + spec,
            secondary: '미입고 ' + p.remain,
            orderNumber: p.orderNumber,
            materialName: p.materialName,
            specification: p.specification
          };
        })
      });
    }
    if (negItems.length) {
      alerts.push({
        kind: 'negative_stock',
        nav: 'material-inventory',
        title: '재고 마이너스',
        items: negItems.map(function (n) {
          var spec = n.specification ? ' / ' + n.specification : '';
          return {
            primary: (n.materialName || '자재') + spec,
            secondary: '재고 ' + n.stock,
            materialName: n.materialName,
            specification: n.specification
          };
        })
      });
    }
    return {
      materialPendingLines: materialPendingLines,
      materialPendingOrders: Object.keys(pendingOrderNums).length,
      negativeStock: negativeStock,
      alerts: alerts
    };
  }

  /** 생산 미완료·지연 후보 (출고/SMT/후공정 중 하나라도 100% 미만) */
  function _homeBuildProductionBacklog_(orders, limit, cachesOpt) {
    limit = limit > 0 ? limit : 5;
    orders = orders || [];
    cachesOpt = cachesOpt && typeof cachesOpt === 'object' ? cachesOpt : {};
    var qtyMap = cachesOpt.qtyMap;
    if (!qtyMap) {
      try {
        qtyMap = _smtBuildQtySummaryMap_() || {};
      } catch (eQ) {
        qtyMap = {};
      }
    }
    var postCounts = cachesOpt.postCounts;
    if (!postCounts) {
      try {
        postCounts = getPostProcessCountsMap_() || {};
      } catch (eP) {
        postCounts = {};
      }
    }
    var shipMap = cachesOpt.shipMap;
    if (!shipMap) {
      try {
        shipMap = getOrderShipmentCountsMap_() || {};
      } catch (eO) {
        shipMap = {};
      }
    }

    var tz = Session.getScriptTimeZone();
    var todayYmd = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var todayMs = _homeDateToMs_(todayYmd);
    var smtByLabel = _dashboardSmtCountsByOrderLabel_(qtyMap);
    var baseOrders =
      cachesOpt.baseOrders && cachesOpt.baseOrders.length
        ? cachesOpt.baseOrders
        : _dashboardBaseOrders_();
    var rows = [];
    for (var i = 0; i < orders.length; i++) {
      var ord = orders[i] || {};
      var on = String(ord.orderNumber || '').trim();
      var tgt = Number(ord.quantity) || 0;
      if (!on || tgt <= 0) continue;
      var smtQty = _dashboardSmtProducedForOrderLine_(qtyMap, ord, smtByLabel, baseOrders);
      var smtPct = Math.min(100, Math.round((smtQty / tgt) * 100));
      var postRaw = _dashboardPostCountedForOrderLine_(postCounts, ord);
      var postEff = Math.min(postRaw, tgt);
      var postPct = Math.min(100, Math.round((postEff / tgt) * 100));
      var shipped = _dashboardShippedForOrderLine_(shipMap, ord);
      var shipPct = tgt > 0 ? Math.min(100, Math.round((shipped / tgt) * 100)) : shipped > 0 ? 100 : 0;
      if (smtPct >= 100 && postPct >= 100 && shipPct >= 100) continue;
      var minPct = Math.min(smtPct, postPct, shipPct);
      var deliveryMs = _homeDateToMs_(ord.deliveryDate);
      var overdue = deliveryMs > 0 && deliveryMs < todayMs && shipPct < 100;
      rows.push({
        orderNumber: on,
        customer: String(ord.customer || '').trim(),
        productName: String(ord.productName || '').trim(),
        quantity: tgt,
        smtPct: smtPct,
        postPct: postPct,
        shipPct: shipPct,
        minPct: minPct,
        overdue: overdue
      });
    }
    rows.sort(function (a, b) {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return (a.minPct || 0) - (b.minPct || 0);
    });
    var overdueTotal = 0;
    for (var ri = 0; ri < rows.length; ri++) {
      if (rows[ri].overdue) overdueTotal++;
    }
    return {
      items: rows.slice(0, limit),
      incompleteTotal: rows.length,
      overdueTotal: overdueTotal
    };
  }

  /** 출하 미완료 주문 행 수 */
  function _homeShipmentIncompleteCount_(orders, shipMap) {
    orders = orders || [];
    shipMap = shipMap || {};
    var n = 0;
    var i;
    for (i = 0; i < orders.length; i++) {
      var ord = orders[i] || {};
      var on = String(ord.orderNumber || '').trim();
      var tgt = Math.floor(Number(ord.quantity) || 0);
      if (!on || tgt <= 0) continue;
      var shipped = _dashboardShippedForOrderLine_(shipMap, ord);
      if (shipped < tgt) n++;
    }
    return n;
  }

  /** 납기 임박·지연 주문 (출하 미완료만) */
  function _homeBuildDueSoonPack_(orders, shipMap, withinDays, itemLimit) {
    withinDays = withinDays > 0 ? withinDays : 3;
    itemLimit = itemLimit > 0 ? itemLimit : 8;
    orders = orders || [];
    shipMap = shipMap || {};
    var todayYmd = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    var todayMs = _homeDateToMs_(todayYmd);
    var endMs = todayMs + withinDays * 86400000;
    var dueSoon = [];
    var overdue = [];
    var i;
    for (i = 0; i < orders.length; i++) {
      var ord = orders[i] || {};
      var on = String(ord.orderNumber || '').trim();
      var tgt = Math.floor(Number(ord.quantity) || 0);
      if (!on || tgt <= 0) continue;
      var shipped = _dashboardShippedForOrderLine_(shipMap, ord);
      if (shipped >= tgt) continue;
      var deliveryMs = _homeDateToMs_(ord.deliveryDate);
      if (deliveryMs <= 0) continue;
      var pnm = String(ord.productName || '').trim();
      var item = {
        orderNumber: on,
        customer: String(ord.customer || '').trim(),
        productName: pnm,
        deliveryDate: _toYmd_(ord.deliveryDate),
        remaining: Math.max(0, tgt - shipped),
        primary: on + (pnm ? ' · ' + pnm : ''),
        secondary: '납기 ' + _toYmd_(ord.deliveryDate) + ' · 잔량 ' + Math.max(0, tgt - shipped)
      };
      if (deliveryMs < todayMs) overdue.push(item);
      else if (deliveryMs <= endMs) dueSoon.push(item);
    }
    dueSoon.sort(function (a, b) {
      return _homeDateToMs_(a.deliveryDate) - _homeDateToMs_(b.deliveryDate);
    });
    overdue.sort(function (a, b) {
      return _homeDateToMs_(a.deliveryDate) - _homeDateToMs_(b.deliveryDate);
    });
    return {
      dueSoonTotal: dueSoon.length,
      overdueTotal: overdue.length,
      dueSoonItems: dueSoon.slice(0, itemLimit),
      overdueItems: overdue.slice(0, itemLimit)
    };
  }

  function _homeMergeSmtLinePlans_(lines, plansByLine) {
    lines = Array.isArray(lines) ? lines : [];
    plansByLine = plansByLine && typeof plansByLine === 'object' ? plansByLine : {};
    var out = [];
    var i;
    for (i = 0; i < lines.length; i++) {
      var L = lines[i] || {};
      var ln = Math.floor(Number(L.lineNo) || 0) || i + 1;
      var pl = plansByLine[ln] || null;
      out.push({
        lineNo: ln,
        label: L.label || 'L' + ln,
        status: L.status || 'idle',
        statusLabel: L.statusLabel || '대기',
        currentJob: L.currentJob || '',
        orderNumber: L.orderNumber || '',
        matchedOrderLabel: L.matchedOrderLabel || '',
        todayQty: L.todayQty != null ? L.todayQty : 0,
        hasPlanToday: !!(pl && pl.orderNumber),
        planOrderNumber: pl ? String(pl.orderNumber || '') : '',
        planProductDisplay: pl ? String(pl.productDisplayName || pl.productName || '') : '',
        planPcbSide: pl ? String(pl.pcbSide || '') : '',
        planTargetQty: pl && pl.targetQty ? Math.floor(Number(pl.targetQty) || 0) : 0
      });
    }
    return out;
  }

  function _homeBuildDashboardAlertItems_(duePack, backlogPack, noPlanLines) {
    var items = [];
    var dp = duePack || {};
    var bp = backlogPack || {};
    var oi;
    for (oi = 0; oi < (dp.overdueItems || []).length; oi++) {
      var o = dp.overdueItems[oi] || {};
      items.push({
        kind: 'overdue',
        severity: 'danger',
        primary: o.primary || o.orderNumber || '',
        secondary: o.secondary || '',
        nav: 'production-dashboard'
      });
    }
    for (oi = 0; oi < (dp.dueSoonItems || []).length; oi++) {
      var d = dp.dueSoonItems[oi] || {};
      items.push({
        kind: 'due_soon',
        severity: 'warn',
        primary: d.primary || d.orderNumber || '',
        secondary: d.secondary || '',
        nav: 'production-dashboard'
      });
    }
    if (noPlanLines && noPlanLines.length) {
      items.push({
        kind: 'no_plan',
        severity: 'warn',
        primary: '오늘 SMT 계획 없음: L' + noPlanLines.join(', L'),
        secondary: '생산계획 탭에서 오늘·라인별 배정',
        nav: 'production-status'
      });
    }
    var bi;
    for (bi = 0; bi < (bp.items || []).length; bi++) {
      var b = bp.items[bi] || {};
      items.push({
        kind: 'backlog',
        severity: 'warn',
        primary: String(b.orderNumber || '') + ' · ' + String(b.productName || ''),
        secondary: 'SMT ' + (b.smtPct || 0) + '% · 후공정 ' + (b.postPct || 0) + '% · 출하 ' + (b.shipPct || 0) + '%',
        nav: 'production-dashboard'
      });
    }
    return items;
  }

  /** 홈 생산팀 정의 (생산1=SMT, 생산2~4=후공정) */
  function _homeProductionTeamDefs_() {
    return [
      { id: 'team1', name: '생산1팀', kind: 'smt', nav: 'production-status', subLabel: 'SMT' },
      { id: 'team2', name: '생산2팀', kind: 'post', teamLabel: '생산2팀', nav: 'post-process', subLabel: '후공정' },
      { id: 'team3', name: '생산3팀', kind: 'post', teamLabel: '생산3팀', nav: 'post-process', subLabel: '후공정' },
      { id: 'team4', name: '생산4팀', kind: 'post', teamLabel: '생산4팀', nav: 'post-process', subLabel: '후공정' }
    ];
  }

  function _homePostTeamActiveKey_(teamLabel) {
    return 'HOME_PROD_ACTIVE_' + String(teamLabel || '').trim();
  }

  function _homeSetPostTeamActive_(teamLabel, orderNo, productName) {
    var tl = String(teamLabel || '').trim();
    if (!tl) return;
    try {
      var props = PropertiesService.getScriptProperties();
      props.setProperty(
        _homePostTeamActiveKey_(tl),
        JSON.stringify({
          orderNumber: String(orderNo || '').trim(),
          product: String(productName || '').trim(),
          updatedAt: new Date().toISOString()
        })
      );
    } catch (e) {}
  }

  function _homeGetPostTeamActive_(teamLabel) {
    try {
      var raw = PropertiesService.getScriptProperties().getProperty(_homePostTeamActiveKey_(teamLabel));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function _postProcessSheetMeta_() {
    var sheet = getOrCreatePostProcessCountSheet();
    var width = Math.max(4, sheet.getLastColumn());
    var header = sheet.getRange(1, 1, 1, width).getValues()[0] || [];
    var teamCol = _findHeaderIndexByNames_(header, ['팀', '팀명', '생산팀', '부서']);
    return { sheet: sheet, header: header, teamCol: teamCol, hasTeamCol: teamCol >= 0 };
  }

  function _postProcessEnsureTeamColumn_(sheet) {
    if (!sheet) return -1;
    var meta = _postProcessSheetMeta_();
    if (meta.hasTeamCol) return meta.teamCol;
    var lc = sheet.getLastColumn();
    sheet.insertColumnAfter(lc);
    var ncol = lc + 1;
    sheet.getRange(1, ncol).setValue('팀').setFontWeight('bold').setBackground('#ecfdf5');
    return ncol - 1;
  }

  /** 후공정생산기록 — 오늘(KST) 행, teamLabel 있으면 해당 팀만 (maxScanRows: 하단 N행만 스캔) */
  function _postProcessReadTodayRows_(teamLabelFilter, maxRows, maxScanRows) {
    maxRows = maxRows > 0 ? maxRows : 50;
    maxScanRows = maxScanRows > 0 ? maxScanRows : 600;
    var todayKey = Utilities.formatDate(new Date(), POST_PROCESS_RECORD_TIMEZONE, 'yyyy-MM-dd');
    var meta = _postProcessSheetMeta_();
    var sheet = meta.sheet;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { todayKey: todayKey, hasTeamCol: meta.hasTeamCol, rows: [] };
    var width = Math.max(4, sheet.getLastColumn());
    var dataRows = lastRow - 1;
    var scanCount = Math.min(dataRows, maxScanRows);
    var startRow = Math.max(2, lastRow - scanCount + 1);
    scanCount = lastRow - startRow + 1;
    var values = sheet.getRange(startRow, 1, scanCount, width).getValues();
    var wantTeam = teamLabelFilter != null ? String(teamLabelFilter).trim() : '';
    var rows = [];
    var i;
    for (i = values.length - 1; i >= 0; i--) {
      var r = values[i] || [];
      var dateKey = _postProcessWorkLogDateKeyFromTimeCell_(r[0]);
      if (dateKey !== todayKey) continue;
      var orderNo = r[1] != null ? String(r[1]).trim() : '';
      var product = r[2] != null ? String(r[2]).trim() : '';
      var qty = _postProcessCountCellToQty_(r[3]);
      var teamVal = meta.hasTeamCol && meta.teamCol < r.length && r[meta.teamCol] != null ? String(r[meta.teamCol]).trim() : '';
      if (wantTeam && teamVal !== wantTeam) continue;
      if (!orderNo && !product && !qty) continue;
      rows.push({
        orderNumber: orderNo,
        product: product,
        qty: qty,
        team: teamVal,
        time: dateKey
      });
      if (rows.length >= maxRows) break;
    }
    return { todayKey: todayKey, hasTeamCol: meta.hasTeamCol, rows: rows };
  }

  function _homeSmtTodayRecordRows_(maxRows) {
    maxRows = maxRows > 0 ? maxRows : 20;
    var todayKey = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    var out = [];
    try {
      var sheet = _getOrCreateSmtProductionRecordSheet_();
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return out;
      var hm = _getSmtProductionRecordHeaderMap_(sheet);
      var width = Math.max(hm.width || 1, sheet.getLastColumn());
      var values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
      var i;
      for (i = values.length - 1; i >= 0; i--) {
        var r = values[i] || [];
        var ymd = hm.date >= 0 ? _smtSheetCellToYmdKst_(r[hm.date]) : '';
        if (ymd !== todayKey) continue;
        var lineNo = hm.line >= 0 ? Number(r[hm.line]) || 0 : 0;
        var orderNo = hm.orderNo >= 0 && r[hm.orderNo] != null ? String(r[hm.orderNo]).trim() : '';
        var model = hm.model >= 0 && r[hm.model] != null ? String(r[hm.model]).trim() : '';
        var todayQty = hm.qty >= 0 ? Math.max(0, Math.floor(Number(r[hm.qty]) || 0)) : 0;
        if (!orderNo && !model && !todayQty) continue;
        out.push({
          lineNo: lineNo,
          orderNumber: orderNo,
          product: model,
          qty: todayQty,
          time: ymd
        });
        if (out.length >= maxRows) break;
      }
    } catch (e) {
      Logger.log('_homeSmtTodayRecordRows_ 오류: ' + e.toString());
    }
    return out;
  }

  /** 후공정 오늘 행 — 이미 읽은 postMeta에서 팀 필터 */
  function _homeFilterPostTodayRows_(postMeta, teamLabel, maxRows) {
    maxRows = maxRows > 0 ? maxRows : 100;
    var all = (postMeta && postMeta.rows) || [];
    var want = teamLabel != null ? String(teamLabel).trim() : '';
    var rows = all;
    if (want && postMeta && postMeta.hasTeamCol) {
      rows = [];
      for (var i = 0; i < all.length; i++) {
        if (String((all[i] || {}).team || '').trim() === want) rows.push(all[i]);
      }
    } else if (want && postMeta && !postMeta.hasTeamCol) {
      rows = [];
    }
    if (rows.length > maxRows) return rows.slice(0, maxRows);
    return rows;
  }

  /** 홈 대시보드 전용 SMT 요약 — 주문 전체·자동매칭 생략(경량) */
  function _homeBuildSmtHomeSummaryForDashboard_() {
    var props = PropertiesService.getScriptProperties();
    var now = new Date().getTime();
    var qtyMap = {};
    try {
      qtyMap = _smtBuildTodayQtyMapForHome_() || {};
    } catch (eQty) {
      qtyMap = {};
    }
    var todayTotal = 0;
    var items = [];
    var i;
    for (i = 1; i <= 7; i++) {
      var row = {
        lineNo: i,
        label: 'L' + i,
        status: 'idle',
        statusLabel: '대기',
        currentJob: '',
        orderNumber: '',
        matchedOrderLabel: '',
        todayQty: 0
      };
      var st = null;
      try {
        var raw = props.getProperty(_smtLineStateKey(i));
        if (raw) {
          st = JSON.parse(raw);
          row.currentJob = st.currentPcb ? String(st.currentPcb) : '';
          var updatedMs = st.updatedAt ? new Date(st.updatedAt).getTime() : 0;
          var fresh = updatedMs && now - updatedMs < 180000;
          var badge = _mapMachineStatusCodeToBadge(st.machineStatusCode);
          if (badge) {
            row.status = badge.status;
            row.statusLabel = badge.statusLabel;
          } else if (fresh && (row.currentJob || st.pcbCount != null)) {
            row.status = 'running';
            row.statusLabel = '가동';
          } else if (row.currentJob || st.pcbCount != null) {
            row.status = 'setup';
            row.statusLabel = '데이터 있음';
          }
          if (st.manualOrderNumber != null && String(st.manualOrderNumber).trim() !== '') {
            row.orderNumber = String(st.manualOrderNumber).trim();
            row.matchedOrderLabel =
              st.manualOrderLabel != null ? String(st.manualOrderLabel).trim() : row.orderNumber;
          }
        }
      } catch (parseErr) {
        Logger.log('_homeBuildSmtHomeSummaryForDashboard_ 라인 ' + i + ': ' + parseErr.toString());
      }
      var qk = _smtQtyMapKey_(
        i,
        String(row.orderNumber || '').trim(),
        String(row.currentJob || '').trim(),
        0,
        st && st.manualOrderSide != null ? st.manualOrderSide : ''
      );
      var qq = qtyMap[qk];
      if (!qq) {
        qq = qtyMap[
          _smtQtyMapKey_(i, String(row.orderNumber || '').trim(), String(row.currentJob || '').trim(), 0)
        ];
      }
      if (qq) {
        row.todayQty = Math.max(0, Math.floor(Number(qq.todayQty) || 0));
      } else if (st && st.pcbCount != null) {
        var live = Number(st.pcbCount);
        if (isFinite(live) && live > 0) row.todayQty = Math.max(0, Math.floor(live));
      }
      todayTotal += row.todayQty;
      items.push(row);
    }
    return { todayTotal: todayTotal, lines: items };
  }

  function _homeBuildProductionTeamsSummary_(smtHomeOpt) {
    var defs = _homeProductionTeamDefs_();
    var smtHome = smtHomeOpt || _homeBuildSmtHomeSummaryForDashboard_();
    var lines = smtHome.lines || [];
    var postMeta = _postProcessReadTodayRows_(null, 120, 600);
    var teams = [];

    var t1Active = [];
    var t1Running = 0;
    var t1Today = 0;
    var seenJob = {};
    var li;
    for (li = 0; li < lines.length; li++) {
      var L = lines[li] || {};
      t1Today += Math.max(0, Math.floor(Number(L.todayQty) || 0));
      var st = String(L.status || '').toLowerCase();
      if (st === 'running') t1Running++;
      var ord = L.orderNumber != null ? String(L.orderNumber).trim() : '';
      var job = L.currentJob != null ? String(L.currentJob).trim() : '';
      var label = L.matchedOrderLabel != null ? String(L.matchedOrderLabel).trim() : '';
      if (!label && ord) label = ord;
      if (!label && job) label = job;
      var show = st === 'running' || st === 'setup' || label;
      if (!show) continue;
      var key = ord + '\x1f' + label;
      if (seenJob[key]) continue;
      seenJob[key] = true;
      t1Active.push({
        primary: (L.label || '라인 ' + L.lineNo) + (label ? ' · ' + label : ''),
        secondary: L.statusLabel || homeLineStatusLabelFromCode_(st)
      });
    }
    teams.push({
      id: 'team1',
      name: '생산1팀',
      kind: 'smt',
      nav: 'production-status',
      subLabel: 'SMT',
      statusLabel: t1Running > 0 ? '가동 ' + t1Running + '라인' : '대기',
      statusKind: t1Running > 0 ? 'running' : 'idle',
      todayQty: t1Today,
      todayQtyUnit: 'EA',
      activeJobs: t1Active.slice(0, 3),
      activeSummary: t1Active.length ? t1Active[0].primary : '현재 작업 없음'
    });

    var di;
    for (di = 1; di < defs.length; di++) {
      var def = defs[di];
      var tl = def.teamLabel;
      var rows = _homeFilterPostTodayRows_(postMeta, tl, 100);
      if (!rows.length && !postMeta.hasTeamCol && postMeta.rows && postMeta.rows.length && di === 1) {
        rows = postMeta.rows.slice(0, 100);
      }
      var todaySum = 0;
      var activeJobs = [];
      var ri;
      for (ri = 0; ri < rows.length; ri++) todaySum += Number(rows[ri].qty) || 0;
      var active = _homeGetPostTeamActive_(tl);
      if (active && (active.orderNumber || active.product)) {
        var ap = String(active.orderNumber || '').trim();
        var pp = String(active.product || '').trim();
        activeJobs.push({
          primary: (ap ? ap + ' ' : '') + (pp || '—'),
          secondary: '최근 작업'
        });
      } else if (rows.length) {
        var last = rows[0];
        activeJobs.push({
          primary: (last.orderNumber ? last.orderNumber + ' · ' : '') + (last.product || '—'),
          secondary: '최근 입력'
        });
      }
      var uniq = {};
      var aj;
      for (aj = 0; aj < rows.length && activeJobs.length < 3; aj++) {
        var rw = rows[aj];
        var uk = String(rw.orderNumber || '') + '\x1f' + String(rw.product || '');
        if (uniq[uk]) continue;
        uniq[uk] = true;
        if (aj === 0 && activeJobs.length) continue;
        activeJobs.push({
          primary: (rw.orderNumber ? rw.orderNumber + ' · ' : '') + (rw.product || '—'),
          secondary: '오늘 ' + (rw.qty || 0)
        });
      }
      teams.push({
        id: def.id,
        name: def.name,
        kind: 'post',
        nav: def.nav,
        subLabel: '후공정',
        statusLabel: rows.length ? '오늘 ' + rows.length + '건' : '오늘 입력 없음',
        statusKind: rows.length ? 'running' : 'idle',
        todayQty: todaySum,
        todayQtyUnit: 'EA',
        activeJobs: activeJobs.slice(0, 3),
        activeSummary: activeJobs.length ? activeJobs[0].primary : '현재 작업 없음',
        teamColumnHint: !postMeta.hasTeamCol && !rows.length ? '후공정생산기록 시트에 「팀」열을 두고 생산2팀 등을 입력하세요.' : ''
      });
    }
    return { teams: teams, postHasTeamCol: postMeta.hasTeamCol };
  }

  function homeLineStatusLabelFromCode_(st) {
    if (st === 'running') return '생산중';
    if (st === 'setup') return '준비';
    return '대기';
  }

  /**
   * 홈 — 생산팀 카드 상세 (최근 입력·오늘 생산)
   * @param {{teamId:string}} input
   */
  function getHomeProductionTeamDetail(input) {
    try {
      var teamId = input && input.teamId != null ? String(input.teamId).trim() : '';
      var defs = _homeProductionTeamDefs_();
      var def = null;
      for (var i = 0; i < defs.length; i++) {
        if (defs[i].id === teamId) {
          def = defs[i];
          break;
        }
      }
      if (!def) return { ok: false, error: '알 수 없는 팀입니다.' };

      if (def.kind === 'smt') {
        var smtHome = _homeBuildSmtHomeSummary_();
        var lines = smtHome.lines || [];
        var recent = _homeSmtTodayRecordRows_(30);
        var activeLines = [];
        var li;
        for (li = 0; li < lines.length; li++) {
          var L = lines[li] || {};
          var ord = L.orderNumber != null ? String(L.orderNumber).trim() : '';
          var job = L.currentJob != null ? String(L.currentJob).trim() : '';
          activeLines.push({
            line: L.label || '라인 ' + L.lineNo,
            orderNumber: ord,
            product: job,
            status: L.statusLabel || '',
            todayQty: Number(L.todayQty) || 0
          });
        }
        return {
          ok: true,
          team: def,
          todayQty: smtHome.todayTotal || 0,
          todayQtyUnit: 'EA',
          activeLines: activeLines,
          recentRows: recent.map(function (r) {
            return {
              primary: 'L' + r.lineNo + ' · ' + (r.orderNumber || '—'),
              secondary: (r.product || '—') + ' · 오늘 ' + r.qty
            };
          })
        };
      }

      var pack = _postProcessReadTodayRows_(def.teamLabel, 30);
      var rows = pack.rows || [];
      if (!rows.length && !pack.hasTeamCol) {
        var all = _postProcessReadTodayRows_(null, 30);
        if (all.rows && all.rows.length && def.id === 'team2') rows = all.rows;
      }
      var todaySum = 0;
      var ri;
      for (ri = 0; ri < rows.length; ri++) todaySum += Number(rows[ri].qty) || 0;
      return {
        ok: true,
        team: def,
        todayQty: todaySum,
        todayQtyUnit: 'EA',
        activeLines: [],
        recentRows: rows.map(function (r) {
          return {
            primary: (r.orderNumber ? r.orderNumber + ' · ' : '') + (r.product || '—'),
            secondary: '수량 ' + (r.qty || 0) + (r.team ? ' · ' + r.team : '')
          };
        }),
        teamColumnHint: pack.hasTeamCol ? '' : '「팀」열이 없으면 팀별 구분이 되지 않을 수 있습니다.'
      };
    } catch (error) {
      Logger.log('getHomeProductionTeamDetail 오류: ' + error.toString());
      return { ok: false, error: error.message || String(error) };
    }
  }

  /** SMT 7라인 + 오늘 생산량 합 — 홈 대시보드용 */
  function _homeBuildSmtHomeSummary_() {
    var snap = getProductionStatusSnapshot() || { smtLines: [] };
    var lines = snap.smtLines || [];
    var todayTotal = 0;
    var items = lines.map(function (r) {
      var ta = Math.max(0, Math.floor(Number(r.todayQty) || 0));
      todayTotal += ta;
      var st = String((r || {}).status || 'idle').trim().toLowerCase();
      var job = r.currentJob != null ? String(r.currentJob).trim() : '';
      var ord = r.matchedOrderNumber != null ? String(r.matchedOrderNumber).trim() : '';
      return {
        lineNo: r.lineNo,
        label: r.label != null ? String(r.label) : '라인 ' + r.lineNo,
        status: st,
        statusLabel: r.statusLabel != null ? String(r.statusLabel) : st,
        currentJob: job,
        orderNumber: ord,
        todayQty: ta
      };
    });
    return { todayTotal: todayTotal, lines: items };
  }

  /** 주문 제품코드 기준 BOM 부족 자재 종류 수 (상한 있음) */
  function _homeCountMaterialShortageKinds_(orders, maxCodes) {
    maxCodes = maxCodes > 0 ? maxCodes : 12;
    orders = orders || [];
    var seen = {};
    var kindSet = {};
    var checked = 0;
    for (var i = 0; i < orders.length && checked < maxCodes; i++) {
      var ord = orders[i] || {};
      var code = ord.productCode != null ? String(ord.productCode).trim() : '';
      if (!code || seen[code]) continue;
      seen[code] = true;
      checked++;
      try {
        var plan = calculateMaterialPlanForPo({
          productCode: code,
          quantity: Number(ord.quantity) || 0,
          version: ord.version != null ? String(ord.version) : undefined
        });
        if (!plan || !plan.ok || !plan.shortageLines || !plan.shortageLines.length) continue;
        for (var si = 0; si < plan.shortageLines.length; si++) {
          var sl = plan.shortageLines[si] || {};
          var nm = sl.materialName != null ? String(sl.materialName).trim() : '';
          var sp = sl.specification != null ? String(sl.specification).trim() : '';
          if (!nm) continue;
          kindSet[nm + '|' + sp] = true;
        }
      } catch (ePlan) {}
    }
    return Object.keys(kindSet).length;
  }

  /** 홈 자재 알림 목록 (상한) */
  function _homeBuildMaterialFocus_(mat, limit) {
    limit = limit > 0 ? limit : 3;
    var focus = [];
    var alerts = (mat && mat.alerts) || [];
    for (var ai = 0; ai < alerts.length && focus.length < limit; ai++) {
      var g = alerts[ai] || {};
      var items = g.items || [];
      for (var aj = 0; aj < items.length && focus.length < limit; aj++) {
        var it = items[aj] || {};
        focus.push({
          nav: g.nav || '',
          kind: g.kind || '',
          primary: it.primary || '',
          secondary: it.secondary || ''
        });
      }
    }
    return focus;
  }

  var HOME_MATERIAL_CACHE_KEY = 'home_material_v1';
  var HOME_SMT_CORE_CACHE_KEY = 'home_smt_core_v1';
  var HOME_SMT_METRICS_CACHE_KEY = 'home_smt_metrics_v2';
  var HOME_BUNDLE_CACHE_KEY = 'home_dash_bundle_v1';
  var PRODUCTION_STATUS_SNAPSHOT_CACHE_KEY = 'prod_status_snap_v1';
  var PRODUCTION_STATUS_SNAPSHOT_TTL_SEC = 25;

  function _homeBuildMaterialSummaryPack_() {
    var now = new Date();
    var orderSheet = getMaterialOrderSheet();
    var moIx = _getMaterialOrderColumnIndices_(orderSheet);
    var lastRow = orderSheet.getLastRow();
    var lc = Math.max(orderSheet.getLastColumn(), 1);
    var ov = lastRow >= 1 ? orderSheet.getRange(1, 1, lastRow, lc).getValues() : [];
    var registerMaps = _buildMaterialRegisterLookupMaps_(getMaterials() || []);
    var invMap = _homeInventoryMapFromOrderRows_(ov, moIx, registerMaps);
    _homeApplyOutboundToInventoryMap_(invMap, registerMaps);
    _homeApplyRegisterDirectStockToInventoryMap_(invMap, registerMaps);
    var negPack = _homeNegativeStockPackFromMap_(invMap);
    var mat = _homeBuildMaterialAlerts_(moIx, ov, negPack);
    return {
      ok: true,
      part: 'material',
      updatedAt: now.toISOString(),
      counts: {
        materialPending: mat.materialPendingLines,
        materialPendingOrders: mat.materialPendingOrders,
        negativeStock: mat.negativeStock
      },
      focus: _homeBuildMaterialFocus_(mat, 3),
      alerts: mat.alerts || []
    };
  }

  function _homeCachePutJson_(key, obj, ttlSec) {
    try {
      var json = JSON.stringify(obj);
      if (json.length <= 95000) {
        CacheService.getScriptCache().put(key, json, ttlSec > 0 ? ttlSec : PROD_MAPS_CACHE_TTL_SEC);
      }
    } catch (e) {}
  }

  /**
   * 홈 — 자재(미입고·마이너스)만 (빠른 1차 로드)
   */
  function getHomeDashboardMaterialSummary() {
    try {
      var cache = CacheService.getScriptCache();
      var hit = cache.get(HOME_MATERIAL_CACHE_KEY);
      if (hit) {
        try {
          var cached = JSON.parse(hit);
          if (cached && cached.ok) return cached;
        } catch (eHit) {}
      }
      var result = _homeBuildMaterialSummaryPack_();
      _homeCachePutJson_(HOME_MATERIAL_CACHE_KEY, result, PROD_MAPS_CACHE_TTL_SEC);
      return result;
    } catch (error) {
      Logger.log('getHomeDashboardMaterialSummary 오류: ' + error.toString());
      return { ok: false, part: 'material', error: error.message || String(error) };
    }
  }

  function _homeNoPlanLinesFromPlans_(plansByLine) {
    var out = [];
    var ln;
    plansByLine = plansByLine && typeof plansByLine === 'object' ? plansByLine : {};
    for (ln = 1; ln <= 7; ln++) {
      if (!plansByLine[ln]) out.push(ln);
    }
    return out;
  }

  /** 홈용 — 계획 시트만 읽어 라인별 오늘 활성 계획 (미완료 큐 중 1건) */
  function _getSmtActivePlanByLineForDateFast_(dateYmd) {
    return _getSmtActivePlanByLineForDate_(dateYmd);
  }

  function _homeBuildSmtCorePack_() {
    var now = new Date();
    var todayYmd = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd');
    var smtHome = _homeBuildSmtHomeSummaryForDashboard_();
    var plansByLine = _getSmtActivePlanByLineForDateFast_(todayYmd);
    var lines = _homeMergeSmtLinePlans_(smtHome.lines || [], plansByLine);
    var noPlanLines = _homeNoPlanLinesFromPlans_(plansByLine);
    var teamPack = _homeBuildProductionTeamsSummary_(smtHome);
    var smtRunning = 0;
    var i;
    for (i = 0; i < lines.length; i++) {
      if (String((lines[i] || {}).status || '').toLowerCase() === 'running') smtRunning++;
    }
    return {
      updatedAt: now.toISOString(),
      lines: lines,
      noPlanLines: noPlanLines,
      teams: teamPack.teams || [],
      postHasTeamCol: !!teamPack.postHasTeamCol,
      smtRunning: smtRunning
    };
  }

  function _homeBuildSmtMetricsPack_(noPlanLines) {
    var pkg = _dashboardDisplayOrderLines_();
    var orders = pkg.merged || [];
    var maps = _getCachedProductionMaps_();
    var duePack = _homeBuildDueSoonPack_(orders, maps.shipMap, 3, 6);
    var backlogPack = _homeBuildProductionBacklog_(orders, 5, {
      qtyMap: maps.qtyMap,
      postCounts: maps.postCounts,
      shipMap: maps.shipMap,
      baseOrders: pkg.base || []
    });
    return {
      counts: {
        dueSoon: duePack.dueSoonTotal + duePack.overdueTotal,
        overdue: duePack.overdueTotal,
        shipmentIncomplete: _homeShipmentIncompleteCount_(orders, maps.shipMap)
      },
      alertItems: _homeBuildDashboardAlertItems_(duePack, backlogPack, noPlanLines || [])
    };
  }

  function _homePackSmtCoreResponse_(core) {
    core = core || {};
    return {
      ok: true,
      part: 'smt_core',
      updatedAt: core.updatedAt,
      counts: { smtRunning: core.smtRunning, smtTotal: (core.lines || []).length },
      productionTeams: core.teams || [],
      postHasTeamCol: !!core.postHasTeamCol,
      smtLines: core.lines || [],
      noPlanLines: core.noPlanLines || []
    };
  }

  function _homePackSmtMetricsResponse_(metrics, noPlanLines) {
    metrics = metrics || {};
    return {
      ok: true,
      part: 'smt_metrics',
      updatedAt: new Date().toISOString(),
      counts: metrics.counts || {},
      alertItems: metrics.alertItems || [],
      noPlanLines: noPlanLines || []
    };
  }

  /** 홈 — SMT 라인·후공정 팀 (경량, 우선 로드) */
  function getHomeDashboardSmtCore() {
    try {
      var cache = CacheService.getScriptCache();
      var hit = cache.get(HOME_SMT_CORE_CACHE_KEY);
      if (hit) {
        try {
          var cached = JSON.parse(hit);
          if (cached && cached.ok) return cached;
        } catch (eHit) {}
      }
      var result = _homePackSmtCoreResponse_(_homeBuildSmtCorePack_());
      _homeCachePutJson_(HOME_SMT_CORE_CACHE_KEY, result, PROD_MAPS_CACHE_TTL_SEC);
      return result;
    } catch (error) {
      Logger.log('getHomeDashboardSmtCore 오류: ' + error.toString());
      return { ok: false, part: 'smt_core', error: error.message || String(error) };
    }
  }

  /** 홈 — KPI·진행률·알림 (캐시 45초) */
  function getHomeDashboardSmtMetrics() {
    try {
      var cache = CacheService.getScriptCache();
      var hit = cache.get(HOME_SMT_METRICS_CACHE_KEY);
      if (hit) {
        try {
          var cached = JSON.parse(hit);
          if (cached && cached.ok) return cached;
        } catch (eHit) {}
      }
      var todayYmd = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
      var noPlanLines = _homeNoPlanLinesFromPlans_(_getSmtActivePlanByLineForDateFast_(todayYmd));
      var result = _homePackSmtMetricsResponse_(_homeBuildSmtMetricsPack_(noPlanLines), noPlanLines);
      _homeCachePutJson_(HOME_SMT_METRICS_CACHE_KEY, result, PROD_MAPS_CACHE_TTL_SEC);
      return result;
    } catch (error) {
      Logger.log('getHomeDashboardSmtMetrics 오류: ' + error.toString());
      return { ok: false, part: 'smt_metrics', error: error.message || String(error) };
    }
  }

  /**
   * 홈 대시보드 일괄 로드 (1회 서버 실행 — orders/maps 중복 제거)
   */
  function getHomeDashboardBundle() {
    try {
      var cache = CacheService.getScriptCache();
      var hit = cache.get(HOME_BUNDLE_CACHE_KEY);
      if (hit) {
        try {
          var cached = JSON.parse(hit);
          if (cached && cached.ok) return cached;
        } catch (eHit) {}
      }
      var material = _homeBuildMaterialSummaryPack_();
      var corePack = _homeBuildSmtCorePack_();
      var smtCore = _homePackSmtCoreResponse_(corePack);
      var smtMetrics = _homePackSmtMetricsResponse_(
        _homeBuildSmtMetricsPack_(corePack.noPlanLines),
        corePack.noPlanLines
      );
      var result = {
        ok: true,
        part: 'home_bundle',
        updatedAt: corePack.updatedAt || material.updatedAt,
        material: material,
        smtCore: smtCore,
        smtMetrics: smtMetrics
      };
      _homeCachePutJson_(HOME_BUNDLE_CACHE_KEY, result, PROD_MAPS_CACHE_TTL_SEC);
      _homeCachePutJson_(HOME_MATERIAL_CACHE_KEY, material, PROD_MAPS_CACHE_TTL_SEC);
      _homeCachePutJson_(HOME_SMT_CORE_CACHE_KEY, smtCore, PROD_MAPS_CACHE_TTL_SEC);
      _homeCachePutJson_(HOME_SMT_METRICS_CACHE_KEY, smtMetrics, PROD_MAPS_CACHE_TTL_SEC);
      return result;
    } catch (error) {
      Logger.log('getHomeDashboardBundle 오류: ' + error.toString());
      return { ok: false, part: 'home_bundle', error: error.message || String(error) };
    }
  }

  /**
   * 홈 — 생산팀 카드 + SMT 라인 요약 (호환용, 경량 경로)
   */
  function getHomeDashboardSmtSummary() {
    try {
      var core = _homeBuildSmtCorePack_();
      var metrics = _homeBuildSmtMetricsPack_(core.noPlanLines);
      return {
        ok: true,
        part: 'smt',
        updatedAt: core.updatedAt,
        counts: {
          smtRunning: core.smtRunning,
          smtTotal: core.lines.length,
          dueSoon: metrics.counts.dueSoon,
          overdue: metrics.counts.overdue,
          shipmentIncomplete: metrics.counts.shipmentIncomplete
        },
        productionTeams: core.teams,
        postHasTeamCol: core.postHasTeamCol,
        smtLines: core.lines,
        alertItems: metrics.alertItems,
        noPlanLines: core.noPlanLines
      };
    } catch (error) {
      Logger.log('getHomeDashboardSmtSummary 오류: ' + error.toString());
      return { ok: false, part: 'smt', error: error.message || String(error) };
    }
  }

  /**
   * 홈(대시보드) 상황 요약 — 한 번에 (호환용)
   */
  function getHomeDashboardSummary() {
    var m = getHomeDashboardMaterialSummary();
    if (!m || !m.ok) return m;
    var s = getHomeDashboardSmtSummary();
    if (!s || !s.ok) return s;
    return {
      ok: true,
      updatedAt: s.updatedAt || m.updatedAt,
      counts: {
        materialPending: m.counts.materialPending,
        materialPendingOrders: m.counts.materialPendingOrders,
        negativeStock: m.counts.negativeStock,
        smtRunning: s.counts.smtRunning,
        smtTotal: s.counts.smtTotal
      },
      focus: m.focus,
      smtLines: s.smtLines
    };
  }

  /** 생산현황 대시보드 한 행(주문서 시트 1줄 = 제품 1건) 식별키 */
  function _dashboardDetailRowKey_(ord) {
    var o = ord && typeof ord === 'object' ? ord : {};
    return (
      String(o.orderNumber != null ? o.orderNumber : '').trim() +
      '\x1f' +
      String(o.productName != null ? o.productName : '').trim() +
      '\x1f' +
      String(o.productCode != null ? o.productCode : '').trim() +
      '\x1f' +
      String(o.sheetRow != null ? o.sheetRow : '') +
      '\x1f' +
      String(Math.floor(Number(o.quantity) || 0)) +
      '\x1f' +
      String(Math.round(Number(o.unitPrice) || 0))
    );
  }

  var ORDER_DIRECT_PROGRESS_SHEET_NAME_ = '주문직접진행';
  var ORDER_DIRECT_PROGRESS_COL_COUNT_ = 8;
  var __orderDirectProgressMapCache_ = null;

  function getOrderDirectProgressSheet() {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(ORDER_DIRECT_PROGRESS_SHEET_NAME_);
    if (!sheet) {
      sheet = ss.insertSheet(ORDER_DIRECT_PROGRESS_SHEET_NAME_);
      var headers = [
        ['rowKey', '주문번호', '제품명', '제품코드', 'SMT직접', '후공정직접', '납품직접', '수정일시']
      ];
      sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
      sheet.getRange(1, 1, 1, headers[0].length).setFontWeight('bold');
      sheet.getRange(1, 1, 1, headers[0].length).setBackground('#f7fafc');
    }
    return sheet;
  }

  function _parseOrderDirectProgressQty_(value) {
    if (value == null || value === '') return null;
    var n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
    if (isNaN(n) || n < 0) return 0;
    return Math.floor(n);
  }

  function _loadOrderDirectProgressMap_() {
    var map = {};
    try {
      var ss = getSpreadsheet();
      var sheet = ss.getSheetByName(ORDER_DIRECT_PROGRESS_SHEET_NAME_);
      if (!sheet || sheet.getLastRow() < 2) return map;
      var hdr = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
      var keyIx = _findHeaderIndexByNames_(hdr, ['rowKey']);
      var smtIx = _findHeaderIndexByNames_(hdr, ['SMT직접', 'SMT']);
      var postIx = _findHeaderIndexByNames_(hdr, ['후공정직접', '후공정']);
      var shipIx = _findHeaderIndexByNames_(hdr, ['납품직접', '납품', '출하직접']);
      if (keyIx < 0) return map;
      var vals = sheet.getRange(2, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
      var i;
      for (i = 0; i < vals.length; i++) {
        var row = vals[i] || [];
        var rk = String(row[keyIx] != null ? row[keyIx] : '').trim();
        if (!rk) continue;
        map[rk] = {
          smt: smtIx >= 0 ? _parseOrderDirectProgressQty_(row[smtIx]) : null,
          post: postIx >= 0 ? _parseOrderDirectProgressQty_(row[postIx]) : null,
          ship: shipIx >= 0 ? _parseOrderDirectProgressQty_(row[shipIx]) : null
        };
      }
    } catch (eOd) {
      Logger.log('주문직접진행 조회 오류: ' + eOd.toString());
    }
    return map;
  }

  function _getOrderDirectProgressMapCached_() {
    if (__orderDirectProgressMapCache_) return __orderDirectProgressMapCache_;
    __orderDirectProgressMapCache_ = _loadOrderDirectProgressMap_();
    return __orderDirectProgressMapCache_;
  }

  function invalidateOrderDirectProgressCaches_() {
    __orderDirectProgressMapCache_ = null;
    __orderDashboardPageCache_ = null;
    try {
      CacheService.getScriptCache().remove(ORDER_DASHBOARD_PAGE_CACHE_SCRIPT_KEY);
    } catch (eInv) {}
  }

  function _orderDirectProgressEntry_(directMap, ord) {
    directMap = directMap || _getOrderDirectProgressMapCached_();
    var key = _dashboardDetailRowKey_(ord);
    return directMap && directMap[key] ? directMap[key] : null;
  }

  function _effectiveDirectProgressQty_(prodQty, entry, field) {
    prodQty = Math.max(0, Math.floor(Number(prodQty) || 0));
    if (!entry || typeof entry !== 'object') return prodQty;
    var v = entry[field];
    if (v == null || v === '') return prodQty;
    return Math.max(0, Math.floor(Number(v) || 0));
  }

  function _findOrderLineByDashboardRowKey_(rowKey) {
    rowKey = String(rowKey || '').trim();
    if (!rowKey) return null;
    var orders = _dashboardDisplayOrderLines_().merged || [];
    var i;
    for (i = 0; i < orders.length; i++) {
      if (_dashboardDetailRowKey_(orders[i]) === rowKey) return orders[i];
    }
    return null;
  }

  function _findOrderDirectProgressRowIndex_(sheet, rowKey) {
    if (!sheet || sheet.getLastRow() < 2) return -1;
    rowKey = String(rowKey || '').trim();
    if (!rowKey) return -1;
    var hdr = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
    var keyIx = _findHeaderIndexByNames_(hdr, ['rowKey']);
    if (keyIx < 0) return -1;
    var vals = sheet.getRange(2, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
    var i;
    for (i = 0; i < vals.length; i++) {
      if (String(vals[i][keyIx] != null ? vals[i][keyIx] : '').trim() === rowKey) return i + 2;
    }
    return -1;
  }

  function _upsertOrderDirectProgress_(rowKey, ord, smtQty, postQty, shipQty) {
    var sheet = getOrderDirectProgressSheet();
    var values = [
      String(rowKey || '').trim(),
      String(ord.orderNumber || '').trim(),
      String(ord.productName || '').trim(),
      String(ord.productCode || '').trim(),
      smtQty,
      postQty,
      shipQty,
      new Date()
    ];
    var rowNum = _findOrderDirectProgressRowIndex_(sheet, rowKey);
    if (rowNum >= 2) {
      // getRange(row, col, numRows, numCols) — 3번째 인자는 행 개수(1)
      sheet.getRange(rowNum, 1, 1, ORDER_DIRECT_PROGRESS_COL_COUNT_).setValues([values]);
    } else {
      sheet.appendRow(values);
    }
    return true;
  }

  function _deleteOrderDirectProgress_(rowKey) {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(ORDER_DIRECT_PROGRESS_SHEET_NAME_);
    if (!sheet) return false;
    var rowNum = _findOrderDirectProgressRowIndex_(sheet, rowKey);
    if (rowNum < 2) return false;
    sheet.deleteRow(rowNum);
    return true;
  }

  function _orderDashboardProgressPercents_(tgt, smtQty, postQty, shippedQty) {
    tgt = Math.max(0, Math.floor(Number(tgt) || 0));
    smtQty = Math.max(0, Math.floor(Number(smtQty) || 0));
    postQty = Math.max(0, Math.floor(Number(postQty) || 0));
    shippedQty = Math.max(0, Math.floor(Number(shippedQty) || 0));
    var postEff = tgt > 0 ? Math.min(postQty, tgt) : postQty;
    return {
      smtProgressPercent: tgt > 0 ? Math.min(100, Math.round((smtQty / tgt) * 100)) : smtQty > 0 ? 100 : 0,
      postProgressPercent: tgt > 0 ? Math.min(100, Math.round((postEff / tgt) * 100)) : postEff > 0 ? 100 : 0,
      outboundPercent: tgt > 0 ? Math.min(100, Math.round((shippedQty / tgt) * 100)) : shippedQty > 0 ? 100 : 0
    };
  }

  /** SMT생산기록 모델 문자열이 주문 행 제품과 같은 건으로 볼지 */
  function _dashboardSheetModelMatchesOrderLine_(sheetModel, ord) {
    var m = String(sheetModel != null ? sheetModel : '').trim();
    if (!m) return false;
    var o = ord && typeof ord === 'object' ? ord : {};
    var pname = String(o.productName != null ? o.productName : '').trim();
    var pcode = String(o.productCode != null ? o.productCode : '').trim();
    if (pname && m === pname) return true;
    if (pcode && (m === pcode || m.toLowerCase().indexOf(pcode.toLowerCase()) >= 0)) return true;
    if (pname && _scoreBomNameMatch_(m, pname) >= 55) return true;
    try {
      var pm = _smtExtractSideAndBase_(m);
      var pp = _smtExtractSideAndBase_(pname);
      if (pp.base && pm.base && _scoreBomNameMatch_(pm.base, pp.base) >= 55) return true;
    } catch (eM) {}
    return false;
  }

  /**
   * SMT생산기록 → 주문서번호 + 모델(제품라벨)별 누적 합산 맵
   * @param {Object} qtyMap _smtBuildQtySummaryMap_
   * @return {Object<string,number>}
   */
  function _dashboardSmtCountsByOrderLabel_(qtyMap) {
    qtyMap = qtyMap && typeof qtyMap === 'object' ? qtyMap : {};
    var orders = getOrders() || [];
    var out = {};
    var collectCtx = _smtBuildSemiCollectContext_();
    var oi;
    for (oi = 0; oi < orders.length; oi++) {
      var ord = orders[oi] || {};
      var on = String(ord.orderNumber || '').trim();
      if (!on) continue;
      var lk = on + '\x1f' + _smtOrderProductLabel_(ord) + '\x1f' + Math.floor(Number(ord.quantity) || 0);
      out[lk] = _dashboardSmtProducedQtyForOrder_(qtyMap, ord, collectCtx);
    }
    return out;
  }

  /** 같은 주문·짧은 제품명(구 라벨) 행이 1줄뿐일 때만 레거시 매칭 허용 */
  function _dashboardCountOrderLinesWithSmtShortLabel_(orderNo, shortLabel) {
    var on = String(orderNo || '').trim();
    var sl = String(shortLabel || '').trim();
    if (!on || !sl) return 0;
    var n = 0;
    var orders = getOrders() || [];
    var i;
    for (i = 0; i < orders.length; i++) {
      var O = orders[i] || {};
      if (String(O.orderNumber || '').trim() !== on) continue;
      if (_smtOrderProductLabel_(O) === sl) n++;
    }
    return n;
  }

  /**
   * SMT생산기록 → 주문 시트 1행(수량·단가·행번호로 구분) 누적 실적
   * @param {Object} qtyMap
   * @param {Object} ord
   * @param {Object<string,number>=} optByLabel _dashboardSmtCountsByOrderLabel_ 결과(재사용)
   * @return {number}
   */
  function _dashboardSmtProducedForOrderLine_(qtyMap, ord, optByLabel, baseOrdersOpt, skipDirect) {
    ord = ord && typeof ord === 'object' ? ord : {};
    skipDirect = skipDirect === true;
    var prodQty = 0;
    if (ord.detailInfo && ord.detailInfo.source === 'combo-bom') {
      var base = baseOrdersOpt && baseOrdersOpt.length ? baseOrdersOpt : _dashboardBaseOrders_();
      var codes = ord.detailInfo.memberProductCodes || [];
      var sheetRows = ord.detailInfo.memberSheetRows || [];
      var smtVals = [];
      var mi;
      for (mi = 0; mi < codes.length; mi++) {
        var member = _orderShipmentFindMemberOrderLine_(ord.orderNumber, codes[mi], sheetRows[mi], base);
        if (!member) continue;
        smtVals.push(_dashboardSmtProducedForOrderLine_(qtyMap, member, optByLabel, base, skipDirect));
      }
      if (smtVals.length) prodQty = Math.min.apply(null, smtVals);
    } else if (optByLabel) {
      var on0 = String(ord.orderNumber != null ? ord.orderNumber : '').trim();
      var model0 = _smtOrderProductLabel_(ord);
      var tgt0 = Math.floor(Number(ord.quantity) || 0);
      var lk = on0 + '\x1f' + model0 + '\x1f' + tgt0;
      if (optByLabel[lk] != null && optByLabel[lk] !== '') {
        prodQty = Math.max(0, Math.floor(Number(optByLabel[lk]) || 0));
      } else {
        prodQty = _dashboardSmtProducedQtyForOrder_(qtyMap, ord);
      }
    } else {
      prodQty = _dashboardSmtProducedQtyForOrder_(qtyMap, ord);
    }
    if (skipDirect) return prodQty;
    return _effectiveDirectProgressQty_(prodQty, _orderDirectProgressEntry_(null, ord), 'smt');
  }

  /**
   * 후공정 카운트 맵에서 주문+제품 행에 맞는 누적(복합키 우선, 없으면 주문 단독키)
   */
  function _dashboardPostCountedForOrderLine_(postCounts, ord, skipDirect) {
    skipDirect = skipDirect === true;
    if (!postCounts || typeof postCounts !== 'object') postCounts = {};
    ord = ord && typeof ord === 'object' ? ord : {};
    var prodQty = 0;
    var uiKey = _postProcessUiCountKey_(ord);
    if (uiKey && postCounts[uiKey] != null && postCounts[uiKey] !== '') {
      prodQty = Math.max(0, Math.floor(Number(postCounts[uiKey]) || 0));
    } else {
      var on = String(ord.orderNumber != null ? ord.orderNumber : '').trim();
      if (!on) prodQty = 0;
      else {
        var full = String(ord._countProductLabel || _orderCountProductLabel_(ord)).trim();
        if (full && postCounts[on + '\x1f' + full] != null && postCounts[on + '\x1f' + full] !== '') {
          prodQty = Math.max(0, Math.floor(Number(postCounts[on + '\x1f' + full]) || 0));
        } else {
          var pn = String(ord.productName != null ? ord.productName : '').trim();
          if (pn && postCounts[on + '\x1f' + pn] != null && postCounts[on + '\x1f' + pn] !== '') {
            prodQty = Math.max(0, Math.floor(Number(postCounts[on + '\x1f' + pn]) || 0));
          } else {
            var comboQty = _dashboardAssemblyComboCountForMemberLine_(postCounts, ord);
            if (comboQty != null) prodQty = comboQty;
            else prodQty = Math.max(0, Math.floor(Number(postCounts[on]) || 0));
          }
        }
      }
    }
    if (skipDirect) return prodQty;
    return _effectiveDirectProgressQty_(prodQty, _orderDirectProgressEntry_(null, ord), 'post');
  }

  function _orderDashboardRowIsComplete_(row) {
    row = row || {};
    var tgt = Math.floor(Number(row.quantity) || 0);
    if (tgt <= 0) return false;
    var smtPct = Math.min(100, Math.round(Number(row.smtProgressPercent) || 0));
    var postPct = Math.min(100, Math.round(Number(row.postProgressPercent) || 0));
    var shipPct = Math.min(100, Math.round(Number(row.outboundPercent) || 0));
    return smtPct >= 100 && postPct >= 100 && shipPct >= 100;
  }

  function _orderDashboardRowFromOrder_(ord, qtyMap, postCounts, shipMap, smtByLabel, baseOrdersOpt) {
    var on = String(ord.orderNumber || '').trim();
    var tgt = Number(ord.quantity) || 0;
    var baseOrders =
      baseOrdersOpt && baseOrdersOpt.length ? baseOrdersOpt : _dashboardBaseOrders_();
    var directEntry = _orderDirectProgressEntry_(null, ord);
    var smtReg = _dashboardSmtProducedForOrderLine_(qtyMap, ord, smtByLabel, baseOrders, true);
    var postReg = _dashboardPostCountedForOrderLine_(postCounts, ord, true);
    var shipReg = _dashboardShippedForOrderLine_(shipMap, ord, true);
    var smtQty = _effectiveDirectProgressQty_(smtReg, directEntry, 'smt');
    var postRaw = _effectiveDirectProgressQty_(postReg, directEntry, 'post');
    var shipped = _effectiveDirectProgressQty_(shipReg, directEntry, 'ship');
    var pct = _orderDashboardProgressPercents_(tgt, smtQty, postRaw, shipped);
    return {
      rowKey: _dashboardDetailRowKey_(ord),
      orderNumber: on,
      customer: String(ord.customer || '').trim(),
      productName: String(ord.productName || '').trim(),
      productCode: String(ord.productCode || '').trim(),
      quantity: tgt,
      smtProducedQty: smtQty,
      smtRegisteredQty: smtReg,
      smtProgressPercent: pct.smtProgressPercent,
      postCountedQty: postRaw,
      postRegisteredQty: postReg,
      postProgressPercent: pct.postProgressPercent,
      shippedQty: shipped,
      shippedRegisteredQty: shipReg,
      outboundPercent: pct.outboundPercent,
      hasDirectProgress: !!(
        directEntry &&
        (directEntry.smt != null || directEntry.post != null || directEntry.ship != null)
      ),
      materialFlowStatus: ord.materialFlowStatus,
      productionFlowStatus: ord.productionFlowStatus,
      outboundFlowStatus: ord.outboundFlowStatus
    };
  }

  function _buildOrderDashboardDetailRows_() {
    var pkg = _dashboardDisplayOrderLines_();
    var flows = pkg.merged || [];
    var baseOrders = pkg.base || [];
    var maps = _getCachedProductionMaps_();
    var qtyMap = _smtFilterQtyMapForSmtLines_(maps.qtyMap || {});
    var postCounts = maps.postCounts || {};
    var shipMap = maps.shipMap || {};
    var smtByLabel = maps.smtByLabel || _dashboardSmtCountsByOrderLabel_(qtyMap);
    var rows = [];
    var fi;
    for (fi = 0; fi < flows.length; fi++) {
      rows.push(
        _orderDashboardRowFromOrder_(flows[fi], qtyMap, postCounts, shipMap, smtByLabel, baseOrders)
      );
    }
    return { ok: true, kind: 'order', title: '주문현황 · 제품별 진행', updatedAt: new Date().toISOString(), rows: rows };
  }

  function _getOrderDashboardAllRowsCached_() {
    if (
      __orderDashboardPageCache_ &&
      Date.now() - __orderDashboardPageCache_.loadedAt < ORDER_DASHBOARD_PAGE_CACHE_TTL_SEC * 1000
    ) {
      return __orderDashboardPageCache_.data;
    }
    try {
      var cached = CacheService.getScriptCache().get(ORDER_DASHBOARD_PAGE_CACHE_SCRIPT_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed && parsed.ok && parsed.rows) {
          __orderDashboardPageCache_ = { data: parsed, loadedAt: Date.now() };
          return parsed;
        }
      }
    } catch (eCache) {}
    var built = _buildOrderDashboardDetailRows_();
    __orderDashboardPageCache_ = { data: built, loadedAt: Date.now() };
    try {
      var json = JSON.stringify(built);
      if (json.length <= 95000) {
        CacheService.getScriptCache().put(
          ORDER_DASHBOARD_PAGE_CACHE_SCRIPT_KEY,
          json,
          ORDER_DASHBOARD_PAGE_CACHE_TTL_SEC
        );
      }
    } catch (ePut) {}
    return built;
  }

  /**
   * 주문현황 페이지 — 서버 페이지네이션·고객 필터·완료 숨김
   * @param {{page?:number, pageSize?:number, customer?:string, hideCompleted?:boolean}} options
   */
  function getOrderDashboardPageData(options) {
    options = options && typeof options === 'object' ? options : {};
    try {
      var page = Math.max(1, parseInt(options.page, 10) || 1);
      var pageSize = Math.min(50, Math.max(5, parseInt(options.pageSize, 10) || 10));
      var customer = String(options.customer != null ? options.customer : '').trim();
      var hideCompleted = options.hideCompleted !== false;
      var pkg = _getOrderDashboardAllRowsCached_();
      var allRows = Array.isArray(pkg.rows) ? pkg.rows : [];
      var filtered = [];
      var completedHidden = 0;
      var ri;
      for (ri = 0; ri < allRows.length; ri++) {
        var row = allRows[ri] || {};
        if (hideCompleted && _orderDashboardRowIsComplete_(row)) {
          completedHidden++;
          continue;
        }
        filtered.push(row);
      }
      var customers = [];
      var custSeen = {};
      for (ri = 0; ri < filtered.length; ri++) {
        var cust = String(filtered[ri].customer != null ? filtered[ri].customer : '').trim();
        if (!cust || custSeen[cust]) continue;
        custSeen[cust] = true;
        customers.push(cust);
      }
      customers.sort(function (a, b) {
        return a.localeCompare(b, 'ko');
      });
      var active = filtered;
      if (customer) {
        active = [];
        for (ri = 0; ri < filtered.length; ri++) {
          if (String(filtered[ri].customer != null ? filtered[ri].customer : '').trim() === customer) {
            active.push(filtered[ri]);
          }
        }
      }
      var totalRows = active.length;
      var totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
      if (page > totalPages) page = totalPages;
      var start = (page - 1) * pageSize;
      return {
        ok: true,
        kind: 'order',
        title: '주문현황 · 제품별 진행',
        rows: active.slice(start, start + pageSize),
        page: page,
        pageSize: pageSize,
        totalRows: totalRows,
        totalPages: totalPages,
        customers: customers,
        hideCompleted: hideCompleted,
        completedHiddenCount: completedHidden,
        totalAllRows: allRows.length,
        updatedAt: pkg.updatedAt || new Date().toISOString()
      };
    } catch (err) {
      Logger.log('getOrderDashboardPageData 오류: ' + err.toString());
      return {
        ok: false,
        error: err.message || String(err),
        rows: [],
        page: 1,
        pageSize: 10,
        totalRows: 0,
        totalPages: 1,
        customers: []
      };
    }
  }

  /**
   * 생산현황 대시보드: 카드 클릭 시 상세 목록
   * @param {string} kind 'order' | 'smt' | 'post'
   * @return {{ ok:boolean, kind?:string, title?:string, rows?:Array, error?:string }}
   */
  function getDashboardDetail(kind) {
    var k = String(kind || '').trim().toLowerCase();
    try {
      if (k === 'order') {
        return _getOrderDashboardAllRowsCached_();
      }
      if (k === 'smt') {
        var snap = getProductionStatusSnapshot() || { smtLines: [] };
        var smtLines = snap.smtLines || [];
        var smtRows = smtLines.map(function (r) {
          var ls = String((r || {}).status || '').trim().toLowerCase();
          return {
            lineNo: r.lineNo,
            label: r.label != null ? String(r.label) : ('라인 ' + r.lineNo),
            status: r.status,
            statusLabel: r.statusLabel,
            currentJob: r.currentJob != null ? String(r.currentJob) : '',
            matchedOrderNumber: r.matchedOrderNumber != null ? String(r.matchedOrderNumber).trim() : '',
            matchedOrderLabel: r.matchedOrderLabel != null ? String(r.matchedOrderLabel) : '',
            lastPcbCount: r.lastPcbCount,
            progressPercent: _smtLineProgressPercent_(ls)
          };
        });
        return { ok: true, kind: k, title: 'SMT 라인 · 상태', rows: smtRows };
      }
      if (k === 'post') {
        var pkgPost = _dashboardDisplayOrderLines_();
        var ordList = pkgPost.merged || [];
        var postCounts = {};
        try {
          postCounts = getPostProcessCountsMap_() || {};
        } catch (eP) {
          postCounts = {};
        }
        var postRows = [];
        for (var pi = 0; pi < ordList.length; pi++) {
          var po = ordList[pi] || {};
          var pOn = po.orderNumber != null ? String(po.orderNumber).trim() : '';
          if (!pOn) continue;
          var pq = Number(po.quantity) || 0;
          var rawC = _dashboardPostCountedForOrderLine_(postCounts, po);
          var eff = pq > 0 ? Math.min(rawC, pq) : rawC;
          var pct = pq > 0 ? Math.round((eff / pq) * 100) : 0;
          var stLab = pq <= 0 ? '수량없음' : (rawC >= pq ? '목표달성' : (rawC > 0 ? '진행중' : '대기'));
          postRows.push({
            orderNumber: pOn,
            customer: String(po.customer || '').trim(),
            productName: String(po.productName || '').trim(),
            plannedQty: pq,
            countedQty: rawC,
            progressPercent: pct,
            statusLabel: stLab
          });
        }
        return { ok: true, kind: k, title: '후공정 · 주문별 진행', rows: postRows };
      }
      return { ok: false, error: '알 수 없는 구분입니다.', kind: k, rows: [] };
    } catch (err) {
      Logger.log('getDashboardDetail 오류: ' + err.toString());
      return { ok: false, error: err.message || String(err), kind: k, rows: [] };
    }
  }

  /**
   * 생산현황 라인별 저장 키 (브릿지 PC가 doPost로 갱신)
   * 스크립트 속성 SMT_LOG_INGEST_TOKEN 설정 시에만 수신 허용
   */
  function _smtLineStateKey(lineNo) {
    return 'SMT_LINE_STATE_' + lineNo;
  }

  /** 생산등록 — 목표 달성 후 오늘 계획 없음 유지(자동 다음 계획 배정 방지) */
  function _smtLineRegHoldEmptyToday_(lineNo) {
    var no = parseInt(lineNo, 10);
    if (isNaN(no) || no < 1 || no > 7) return false;
    var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    try {
      var raw = PropertiesService.getScriptProperties().getProperty(_smtLineStateKey(no));
      if (!raw) return false;
      var st = JSON.parse(raw);
      return String(st.smtRegHoldEmptyYmd || '').trim() === today;
    } catch (eHold) {
      return false;
    }
  }

  function _smtSetLineRegHoldEmpty_(lineNo, hold) {
    var no = parseInt(lineNo, 10);
    if (isNaN(no) || no < 1 || no > 7) return;
    var props = PropertiesService.getScriptProperties();
    var key = _smtLineStateKey(no);
    var st = {};
    try {
      var raw = props.getProperty(key);
      if (raw) st = JSON.parse(raw);
    } catch (e0) {
      st = {};
    }
    if (hold) {
      st.smtRegHoldEmptyYmd = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    } else {
      delete st.smtRegHoldEmptyYmd;
    }
    props.setProperty(key, JSON.stringify(st));
    __smtPlanLineSyncAt_ = 0;
  }

  /** SMT생산기록 시트 */
  var SMT_PRODUCTION_RECORD_SHEET_NAME = 'SMT생산기록';

  function _getOrCreateSmtProductionRecordSheet_() {
    var ss = getSpreadsheet();
    var sh = ss.getSheetByName(SMT_PRODUCTION_RECORD_SHEET_NAME);
    if (!sh) {
      sh = ss.insertSheet(SMT_PRODUCTION_RECORD_SHEET_NAME);
      var headers = ['기록일자', '라인', '주문서번호', '모델', '면구분', '수량'];
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.getRange(1, 1, 1, headers.length).setBackground('#ecfdf5').setFontWeight('bold');
    } else if (sh.getLastRow() < 1) {
      var h2 = ['기록일자', '라인', '주문서번호', '모델', '면구분', '수량'];
      sh.getRange(1, 1, 1, h2.length).setValues([h2]);
      sh.getRange(1, 1, 1, h2.length).setBackground('#ecfdf5').setFontWeight('bold');
    }
    _ensureSmtProductionRecordSideColumn_(sh);
    return sh;
  }

  /** 기존 시트에 모델 오른쪽 「면구분」열이 없으면 추가 */
  function _ensureSmtProductionRecordSideColumn_(sheet) {
    if (!sheet) return;
    var hm = _getSmtProductionRecordHeaderMap_(sheet);
    if (hm.pcbSide >= 0) return;
    var insertAfter1Based = hm.model >= 0 ? hm.model + 1 : 4;
    sheet.insertColumnAfter(insertAfter1Based);
    sheet.getRange(1, insertAfter1Based + 1).setValue('면구분').setBackground('#ecfdf5').setFontWeight('bold');
  }

  /** SMT생산기록 기록일자 셀 → KST yyyy-MM-dd (문자열·Date 모두) */
  function _smtSheetCellToYmdKst_(v) {
    if (v == null || v === '') return '';
    try {
      if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
        return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
      }
    } catch (e0) {}
    var s = String(v).trim();
    if (!s) return '';
    var m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    try {
      var d = new Date(s);
      if (!isNaN(d.getTime())) return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd');
    } catch (e1) {}
    return '';
  }

  /** SMT생산기록 수량 열 — 신규 「수량」, 구 「누적수량」·「오늘수량」 호환 */
  function _findSmtRecordQtyColumnIndex_(headerRow) {
    var idx = _findHeaderIndexByNames_(headerRow, ['수량']);
    if (idx >= 0) return idx;
    idx = _findHeaderIndexByNames_(headerRow, ['누적수량']);
    if (idx >= 0) return idx;
    return _findHeaderIndexByNames_(headerRow, ['오늘수량', '현재수량']);
  }

  function _getSmtProductionRecordHeaderMap_(sheet) {
    if (!sheet) {
      return {
        date: -1,
        line: -1,
        orderNo: -1,
        model: -1,
        pcbSide: -1,
        qty: -1,
        width: 0
      };
    }
    var width = Math.max(1, sheet.getLastColumn());
    var header = sheet.getRange(1, 1, 1, width).getValues()[0] || [];
    return {
      date: _findHeaderIndexByNames_(header, ['기록일자', '일자', '날짜']),
      line: _findHeaderIndexByNames_(header, ['라인']),
      orderNo: _findHeaderIndexByNames_(header, ['주문서번호', '주문서']),
      model: _findHeaderIndexByNames_(header, ['모델', '제품', '제품명']),
      pcbSide: _findHeaderIndexByNames_(header, [
        '면구분',
        '면 구분',
        'PCB면',
        'PCB 면',
        'SMT면',
        'SMT 면'
      ]),
      qty: _findSmtRecordQtyColumnIndex_(header),
      width: width
    };
  }

  /** 숫자 열이 날짜(1900-01-02 등)로 보이지 않게 한 데이터 행만 서식 고정 */
  function _smtFormatSmtProductionRecordDataRow_(sheet, rowIndex) {
    if (!sheet || rowIndex < 2) return;
    try {
      var hm = _getSmtProductionRecordHeaderMap_(sheet);
      if (hm.date >= 0) sheet.getRange(rowIndex, hm.date + 1).setNumberFormat('@');
      if (hm.orderNo >= 0) sheet.getRange(rowIndex, hm.orderNo + 1).setNumberFormat('@');
      if (hm.model >= 0) sheet.getRange(rowIndex, hm.model + 1).setNumberFormat('@');
      if (hm.pcbSide >= 0) sheet.getRange(rowIndex, hm.pcbSide + 1).setNumberFormat('@');
      if (hm.line >= 0) sheet.getRange(rowIndex, hm.line + 1).setNumberFormat('0');
      if (hm.qty >= 0) sheet.getRange(rowIndex, hm.qty + 1).setNumberFormat('0');
    } catch (e) {
      Logger.log('_smtFormatSmtProductionRecordDataRow_: ' + e.toString());
    }
  }

  function _smtQtyCellForRecord_(pcb) {
    var n = Number(pcb);
    if (!isFinite(n) || n < 0) return '';
    return Math.round(n);
  }

  /** SMT생산기록용 주문번호 — 라인에 배정된 주문만 (자동 매칭 주문은 시트에 쓰지 않음) */
  function _smtResolveOrderNoForRecord_(next) {
    var st = next && typeof next === 'object' ? next : {};
    if (st.manualOrderNumber != null && String(st.manualOrderNumber).trim() !== '') {
      return String(st.manualOrderNumber).trim();
    }
    if (st.manualLotNumber != null && String(st.manualLotNumber).trim() !== '') {
      var leg = String(st.manualLotNumber).trim();
      try {
        var legOrd = getOrderByNumber(leg);
        if (legOrd && legOrd.orderNumber) return String(legOrd.orderNumber).trim();
      } catch (el) {}
    }
    return '';
  }

  function _smtModelCompareKey_(v) {
    var parsed = _smtExtractSideAndBase_(v == null ? '' : String(v));
    var base = String(parsed.base || '').trim();
    if (!base) return '';
    return base.toLowerCase();
  }

  function _smtIsOrderCompatibleWithState_(orderNo, stateObj) {
    var on = String(orderNo || '').trim();
    if (!on) return false;
    var ord = getOrderByNumber(on);
    if (!ord) return false;
    var st = stateObj && typeof stateObj === 'object' ? stateObj : {};
    var cmp = _smtCompareStringsFromJobContext_(st.productionSessionProduct || '', st.currentPcb || '');
    if (!cmp.length) return false;
    var score = _smtScoreOrderAgainstCompareStrings_(cmp, ord);
    return Number(score) >= 45;
  }

  /** 라인현황 카드의「제품」= currentJob(currentPcb)과 동일 우선순위 — 세션키 불일치로 옛 행에 수량이 남는 것 방지 */
  function _smtProductLabelForRecord_(next) {
    if (next.currentPcb != null && String(next.currentPcb).trim() !== '') {
      return String(next.currentPcb).trim();
    }
    if (next.productionSessionProduct != null && String(next.productionSessionProduct).trim() !== '') {
      return String(next.productionSessionProduct).trim();
    }
    return '';
  }

  function _smtPcbSideUiForRecord_(stateObj) {
    var st = stateObj && typeof stateObj === 'object' ? stateObj : {};
    var side = st.manualOrderSide != null ? String(st.manualOrderSide).trim() : '';
    return _smtManualSideUiLabel_(side);
  }

  function _smtNormalizePcbSideUi_(v) {
    var s = String(v != null ? v : '')
      .trim()
      .toUpperCase();
    if (s === 'TOP' || s === 'BOT') return s;
    return 'SINGLE';
  }

  /** 시트 면구분 셀 — 값 없으면 옛 행(모델만 구분)으로 간주해 통과 */
  function _smtRecordSideRowMatches_(rowSideCell, wantSideUi) {
    var rowSide = rowSideCell != null ? String(rowSideCell).trim() : '';
    if (!rowSide) return true;
    return _smtNormalizePcbSideUi_(rowSide) === _smtNormalizePcbSideUi_(wantSideUi);
  }

  function _smtSessionKeyForProductionRecord_(lineNo, orderNo, productLabel, dayKey, pcbSideUi) {
    return (
      String(lineNo) +
      '\x1f' +
      String(orderNo != null ? orderNo : '').trim() +
      '\x1f' +
      String(productLabel != null ? productLabel : '').trim() +
      '\x1f' +
      String(dayKey != null ? dayKey : '').trim() +
      '\x1f' +
      _smtNormalizePcbSideUi_(pcbSideUi)
    );
  }

  /**
   * 시트에서 행 삭제 등으로 smtRecordRow가 깨졌을 때, 같은 주문·제품·라인의 가장 아래 행을 찾음
   * @return {number} 행 번호(1-based) 또는 0
   */
  function _smtFindLatestProductionRecordRow_(sheet, lineNo, orderNo, productLabel, dayKey, pcbSideUi) {
    if (!sheet) return 0;
    var lr = sheet.getLastRow();
    if (lr < 2) return 0;
    var hm = _getSmtProductionRecordHeaderMap_(sheet);
    if (hm.line < 0 || hm.orderNo < 0 || hm.model < 0) return 0;
    var on = String(orderNo != null ? orderNo : '').trim();
    var pn = String(productLabel != null ? productLabel : '').trim();
    var dk = String(dayKey != null ? dayKey : '').trim();
    var sideWant = _smtNormalizePcbSideUi_(pcbSideUi);
    var ln = Number(lineNo);
    if (!isFinite(ln)) return 0;
    var scanMax = 800;
    var from = Math.max(2, lr - scanMax + 1);
    var readWidth = Math.max(hm.width, 6);
    var r;
    for (r = lr; r >= from; r--) {
      try {
        var row = sheet.getRange(r, 1, 1, readWidth).getValues()[0];
        var rLine = Number(row[hm.line]);
        if (!isFinite(rLine) || rLine !== ln) continue;
        var rOn = row[hm.orderNo] != null ? String(row[hm.orderNo]).trim() : '';
        var rPn = row[hm.model] != null ? String(row[hm.model]).trim() : '';
        if (dk !== '' && hm.date >= 0) {
          var rDay = row[hm.date] != null ? String(row[hm.date]).trim() : '';
          if (rDay !== dk) continue;
        }
        if (on !== '' && rOn !== on) continue;
        if (on === '' && rOn !== '') continue;
        if (pn !== '' && rPn !== pn) continue;
        if (pn === '' && rPn !== '') continue;
        if (hm.pcbSide >= 0 && !_smtRecordSideRowMatches_(row[hm.pcbSide], sideWant)) continue;
        return r;
      } catch (e1) {
        continue;
      }
    }
    return 0;
  }

  var PROD_MAPS_CACHE_TTL_SEC = 90;
  var PROD_MAPS_CACHE_SCRIPT_KEY = 'ERP_PROD_MAPS_V2';
  var SMT_QTY_MAP_CACHE_SCRIPT_KEY = 'ERP_SMT_QTY_V2';
  var SMT_MANUAL_OPTIONS_CACHE_SCRIPT_KEY = 'ERP_SMT_MANUAL_OPTS_V5';
  var SMT_MANUAL_OPTIONS_CACHE_TTL_SEC = 120;
  var PRODUCTION_PLAN_PAGE_CACHE_PREFIX = 'ERP_PLAN_PAGE_';
  var PRODUCTION_PLAN_PAGE_CACHE_TTL_SEC = 120;
  var ORDER_DASHBOARD_PAGE_CACHE_SCRIPT_KEY = 'ERP_ORDER_DASHBOARD_V4';
  var ORDER_DASHBOARD_PAGE_CACHE_TTL_SEC = 120;
  var ASSEMBLY_LINES_CACHE_TTL_SEC = 90;
  var COMBO_BOM_CATALOG_CACHE_TTL_SEC = 300;
  var PRODUCT_BOM_SHEET_CACHE_TTL_SEC = 300;
  var POST_PROCESS_PAGE_CACHE_SCRIPT_KEY = 'ERP_POST_PROCESS_PAGE_V1';
  var POST_PROCESS_PAGE_CACHE_TTL_SEC = 90;
  var ORDER_SHIPMENT_PAGE_CACHE_SCRIPT_KEY = 'ERP_ORDER_SHIPMENT_PAGE_V1';
  var ORDER_SHIPMENT_PAGE_CACHE_TTL_SEC = 90;
  /** 라인 상태(1~7) 장비 POST 자동 이력 — false면 생산입력(수동 저장) 위주 */
  var SMT_AUTO_HISTORY_FROM_LINES_ENABLED = false;
  var __prodMapsCache_ = null;
  var __smtQtyMapCache_ = null;
  var __smtManualOptionsCache_ = null;
  var __productionPlanPageCache_ = {};
  var __orderDashboardPageCache_ = null;
  var __assemblyLinesCache_ = null;
  var __comboBomCatalogCache_ = null;
  var __productBomSheetCache_ = null;
  var __postProcessPageCache_ = null;
  var __orderShipmentPageCache_ = null;

  function _productionPlanPageCacheScriptKey_(scope) {
    return PRODUCTION_PLAN_PAGE_CACHE_PREFIX + _normalizePlanScope_(scope);
  }

  function invalidateProductionPlanPageCache_(scope) {
    if (scope != null && String(scope).trim() !== '') {
      var sc = _normalizePlanScope_(scope);
      delete __productionPlanPageCache_[sc];
      try {
        CacheService.getScriptCache().remove(_productionPlanPageCacheScriptKey_(sc));
      } catch (e0) {}
      return;
    }
    __productionPlanPageCache_ = {};
    try {
      var c = CacheService.getScriptCache();
      c.remove(_productionPlanPageCacheScriptKey_('smt'));
      c.remove(_productionPlanPageCacheScriptKey_('post'));
      c.remove(_productionPlanPageCacheScriptKey_('shipment'));
    } catch (e1) {}
  }

  function invalidateAssemblyLinesCache_() {
    __assemblyLinesCache_ = null;
  }

  function invalidatePostProcessPageCache_() {
    __postProcessPageCache_ = null;
    try {
      CacheService.getScriptCache().remove(POST_PROCESS_PAGE_CACHE_SCRIPT_KEY);
    } catch (ePp) {}
  }

  function invalidateOrderShipmentPageCache_() {
    __orderShipmentPageCache_ = null;
    try {
      CacheService.getScriptCache().remove(ORDER_SHIPMENT_PAGE_CACHE_SCRIPT_KEY);
    } catch (eOs) {}
  }

  function invalidateAssemblyPageDataCaches_() {
    invalidateAssemblyLinesCache_();
    invalidatePostProcessPageCache_();
    invalidateOrderShipmentPageCache_();
  }

  /** SMT 생산등록 저장 후 — 수량·스냅샷·계획 동기화 캐시 무효화 */
  function invalidateSmtProductionQtyCaches_() {
    __prodMapsCache_ = null;
    __smtQtyMapCache_ = null;
    __orderDashboardPageCache_ = null;
    __smtPlanLineSyncAt_ = 0;
    invalidateProductionPlanPageCache_();
    invalidateAssemblyPageDataCaches_();
    try {
      var c = CacheService.getScriptCache();
      c.remove(PROD_MAPS_CACHE_SCRIPT_KEY);
      c.remove(SMT_QTY_MAP_CACHE_SCRIPT_KEY);
      c.remove(ORDER_DASHBOARD_PAGE_CACHE_SCRIPT_KEY);
      c.remove(PRODUCTION_STATUS_SNAPSHOT_CACHE_KEY);
    } catch (eInv) {}
  }

  function invalidateProductionMapsCache_() {
    __prodMapsCache_ = null;
    __smtQtyMapCache_ = null;
    __smtManualOptionsCache_ = null;
    __orderDashboardPageCache_ = null;
    invalidateProductionPlanPageCache_();
    invalidateAssemblyPageDataCaches_();
    try {
      var c = CacheService.getScriptCache();
      c.remove(PROD_MAPS_CACHE_SCRIPT_KEY);
      c.remove(SMT_QTY_MAP_CACHE_SCRIPT_KEY);
      c.remove(SMT_MANUAL_OPTIONS_CACHE_SCRIPT_KEY);
      c.remove(ORDER_DASHBOARD_PAGE_CACHE_SCRIPT_KEY);
    } catch (eInv) {}
  }

  /** 출하 등록 후 — shipMap만 갱신(SMT·후공정 전체 재집계 생략) */
  function _patchOrderShipmentCountInCache_(uiKey, counted) {
    uiKey = String(uiKey || '').trim();
    if (!uiKey) return;
    counted = Math.max(0, Math.floor(Number(counted) || 0));
    var maps = __prodMapsCache_;
    if (!maps) {
      try {
        var hit = CacheService.getScriptCache().get(PROD_MAPS_CACHE_SCRIPT_KEY);
        if (hit) maps = JSON.parse(hit);
      } catch (eHit) {
        maps = null;
      }
    }
    if (!maps || typeof maps !== 'object') return;
    if (!maps.shipMap || typeof maps.shipMap !== 'object') maps.shipMap = {};
    maps.shipMap[uiKey] = counted;
    maps.loadedAt = Date.now();
    __prodMapsCache_ = maps;
    __orderDashboardPageCache_ = null;
    invalidateOrderShipmentPageCache_();
    try {
      var json = JSON.stringify({
        qtyMap: maps.qtyMap || {},
        postCounts: maps.postCounts || {},
        shipMap: maps.shipMap,
        smtByLabel: maps.smtByLabel || {}
      });
      if (json.length <= 95000) {
        CacheService.getScriptCache().put(PROD_MAPS_CACHE_SCRIPT_KEY, json, PROD_MAPS_CACHE_TTL_SEC);
      }
      CacheService.getScriptCache().remove(ORDER_DASHBOARD_PAGE_CACHE_SCRIPT_KEY);
    } catch (ePut) {}
  }

  function _smtBuildQtySummaryMapRaw_() {
    var out = {};
    try {
      var sh = _getOrCreateSmtProductionRecordSheet_();
      var lr = sh.getLastRow();
      if (lr < 2) return out;
      var hm = _getSmtProductionRecordHeaderMap_(sh);
      if (hm.line < 0 || hm.orderNo < 0 || hm.model < 0 || hm.qty < 0) return out;
      var vals = sh.getRange(2, 1, lr - 1, hm.width).getValues();
      var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
      var prevMaxByKey = {};
      var todayCumByKey = {};
      for (var i = 0; i < vals.length; i++) {
        var r = vals[i] || [];
        var orderNo = r[hm.orderNo] != null ? String(r[hm.orderNo]).trim() : '';
        var product = r[hm.model] != null ? String(r[hm.model]).trim() : '';
        var rowSideCell = hm.pcbSide >= 0 ? r[hm.pcbSide] : '';
        var normModelSide = _smtNormalizeSheetModelAndSide_(product, rowSideCell);
        var lineNo = Number(r[hm.line]);
        var qtyVal = Number(r[hm.qty]);
        if (!isFinite(lineNo) || !isFinite(qtyVal) || qtyVal < 0) continue;
        var key = _smtQtyMapKey_(lineNo, orderNo, normModelSide.model, 0, normModelSide.side);
        if (!out[key]) out[key] = { todayQty: 0, cumulativeQty: 0 };
        var qf = Math.max(0, Math.floor(qtyVal));
        out[key].cumulativeQty = qf;
        var t = hm.date >= 0 ? _smtSheetCellToYmdKst_(r[hm.date]) : '';
        if (t === today) {
          todayCumByKey[key] = qf;
        } else if (t && t < today) {
          prevMaxByKey[key] = Math.max(prevMaxByKey[key] || 0, qf);
        }
      }
      var keys = Object.keys(out);
      for (var k = 0; k < keys.length; k++) {
        var kk = keys[k];
        if (todayCumByKey[kk] != null) {
          out[kk].todayQty = Math.max(0, todayCumByKey[kk] - (prevMaxByKey[kk] || 0));
        }
      }
    } catch (e) {
      Logger.log('_smtBuildQtySummaryMapRaw_ 오류: ' + e.toString());
    }
    return out;
  }

  function _smtBuildQtySummaryMap_() {
    if (__smtQtyMapCache_ && Date.now() - __smtQtyMapCache_.loadedAt < PROD_MAPS_CACHE_TTL_SEC * 1000) {
      return __smtQtyMapCache_.map;
    }
    try {
      var cached = CacheService.getScriptCache().get(SMT_QTY_MAP_CACHE_SCRIPT_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed && parsed.map) {
          parsed.loadedAt = Date.now();
          __smtQtyMapCache_ = parsed;
          return parsed.map;
        }
      }
    } catch (eCache) {}
    var map = _smtBuildQtySummaryMapRaw_();
    __smtQtyMapCache_ = { map: map, loadedAt: Date.now() };
    __prodMapsCache_ = null;
    try {
      var json = JSON.stringify({ map: map });
      if (json.length <= 95000) {
        CacheService.getScriptCache().put(SMT_QTY_MAP_CACHE_SCRIPT_KEY, json, PROD_MAPS_CACHE_TTL_SEC);
      }
    } catch (ePut) {}
    return map;
  }


  /**
   * 후공정·출하 시트에 조립 완제품명으로만 기록된 경우, 같은 주문의 구성 반제품 행 키에도 실적 전파
   */
  function _propagateAssemblyComboCountsToMembers_(countMap, pkgOpt) {
    if (!countMap || typeof countMap !== 'object') return countMap;
    var pkg =
      pkgOpt && pkgOpt.merged && pkgOpt.base ? pkgOpt : _orderLinesForAssemblyPages_();
    var merged = pkg.merged || [];
    var base = pkg.base || [];
    var ci;
    for (ci = 0; ci < merged.length; ci++) {
      var CO = merged[ci];
      if (!CO || !CO.detailInfo || CO.detailInfo.source !== 'combo-bom') continue;
      var on = String(CO.orderNumber || '').trim();
      var comboKey = _postProcessUiCountKey_(CO);
      var comboQty = null;
      if (comboKey && countMap[comboKey] != null && countMap[comboKey] !== '') {
        comboQty = Math.max(0, Math.floor(Number(countMap[comboKey]) || 0));
      }
      if (comboQty == null) {
        var pn = String(CO.productName || '').trim();
        if (pn && countMap[on + '\x1f' + pn] != null && countMap[on + '\x1f' + pn] !== '') {
          comboQty = Math.max(0, Math.floor(Number(countMap[on + '\x1f' + pn]) || 0));
        }
      }
      if (comboQty == null) continue;
      var codes = CO.detailInfo.memberProductCodes || [];
      var sheetRows = CO.detailInfo.memberSheetRows || [];
      var mi;
      for (mi = 0; mi < codes.length; mi++) {
        var member = _orderShipmentFindMemberOrderLine_(CO.orderNumber, codes[mi], sheetRows[mi], base);
        if (!member) continue;
        var mk = _postProcessUiCountKey_(member);
        if (!mk) continue;
        if (countMap[mk] == null || countMap[mk] === '') countMap[mk] = comboQty;
      }
      if (comboKey && (countMap[comboKey] == null || countMap[comboKey] === '')) {
        countMap[comboKey] = comboQty;
      }
    }
    return countMap;
  }

  /** 주문서 반제품 행 — 동일 주문 조립 완제품 카드에 쌓인 실적 조회 */
  function _dashboardAssemblyComboCountForMemberLine_(countMap, ord, pkgOpt) {
    if (!countMap || typeof countMap !== 'object' || !ord) return null;
    if (ord.detailInfo && ord.detailInfo.source === 'combo-bom') return null;
    var on = String(ord.orderNumber || '').trim();
    if (!on) return null;
    var pkg =
      pkgOpt && pkgOpt.merged ? pkgOpt : _orderLinesForAssemblyPages_();
    var merged = pkg.merged || [];
    var base = pkg.base || [];
    var wantSr = Math.floor(Number(ord.sheetRow) || 0);
    var wantPc = String(ord.productCode || '').trim().toLowerCase();
    var i;
    for (i = 0; i < merged.length; i++) {
      var CO = merged[i];
      if (!CO || !CO.detailInfo || CO.detailInfo.source !== 'combo-bom') continue;
      if (String(CO.orderNumber || '').trim() !== on) continue;
      var codes = CO.detailInfo.memberProductCodes || [];
      var rows = CO.detailInfo.memberSheetRows || [];
      var isMember = false;
      var mi;
      for (mi = 0; mi < codes.length; mi++) {
        var member = _orderShipmentFindMemberOrderLine_(on, codes[mi], rows[mi], base);
        if (!member) continue;
        var mSr = Math.floor(Number(member.sheetRow) || 0);
        var mPc = String(member.productCode || '').trim().toLowerCase();
        if (wantSr >= 2 && mSr === wantSr) {
          isMember = true;
          break;
        }
        if (wantPc && mPc && wantPc === mPc) {
          isMember = true;
          break;
        }
      }
      if (!isMember) continue;
      var ck = _postProcessUiCountKey_(CO);
      if (ck && countMap[ck] != null && countMap[ck] !== '') {
        return Math.max(0, Math.floor(Number(countMap[ck]) || 0));
      }
      var pn = String(CO.productName || '').trim();
      if (pn) {
        var legacy = on + '\x1f' + pn;
        if (countMap[legacy] != null && countMap[legacy] !== '') {
          return Math.max(0, Math.floor(Number(countMap[legacy]) || 0));
        }
      }
    }
    return null;
  }

  function _buildPostProcessSheetIndex_(values) {
    var byOrder = {};
    var i;
    for (i = 1; i < values.length; i++) {
      var ordKey = values[i][1] != null ? String(values[i][1]).trim() : '';
      if (!ordKey) continue;
      if (!byOrder[ordKey]) byOrder[ordKey] = [];
      byOrder[ordKey].push({
        rowIdx: i + 1,
        rPn: values[i][2] != null ? String(values[i][2]).trim() : '',
        qty: _postProcessCountCellToQty_(values[i][3])
      });
    }
    return byOrder;
  }

  /**
   * 후공정 시트 인덱스(주문별 행 목록)에서 수량 조회 — 시트 전체 재스캔 없음
   * @return {number|null}
   */
  function _postProcessFindCountFromSheetIndex_(sheetIndex, orderNo, productNameKey, ord, ordersOpt) {
    sheetIndex = sheetIndex && typeof sheetIndex === 'object' ? sheetIndex : {};
    var on = String(orderNo || '').trim();
    var pl = String(productNameKey || '').trim();
    var rows = sheetIndex[on] || [];
    if (!rows.length) return null;
    var lineIdx = ord ? _postProcessLineIndexAmongDuplicates_(ord, ordersOpt) : 0;
    var fallbackIdx = -1;
    var shortPnCandidates = [];
    var ri;
    for (ri = 0; ri < rows.length; ri++) {
      var ent = rows[ri] || {};
      var rPn = ent.rPn != null ? String(ent.rPn).trim() : '';
      if (!pl) {
        if (!rPn) return ent.qty;
        if (fallbackIdx < 0) fallbackIdx = ent.rowIdx;
        continue;
      }
      if (rPn === pl) return ent.qty;
      if (!ord) continue;
      var full = String(ord._countProductLabel || _orderCountProductLabel_(ord)).trim();
      var pn = String(ord.productName || '').trim();
      if (rPn === full) return ent.qty;
      if (rPn === pn || (pn && rPn.indexOf(pn) === 0 && rPn.length <= pn.length + 2)) {
        shortPnCandidates.push(ent.rowIdx);
      } else if (_postProcessSheetRowMatchesOrderLine_(on, rPn, ord, pl)) {
        shortPnCandidates.push(ent.rowIdx);
      }
    }
    if (shortPnCandidates.length === 1) {
      var pick = shortPnCandidates[0];
      for (ri = 0; ri < rows.length; ri++) {
        if (rows[ri].rowIdx === pick) return rows[ri].qty;
      }
    }
    if (shortPnCandidates.length > 1 && lineIdx < shortPnCandidates.length) {
      pick = shortPnCandidates[lineIdx];
      for (ri = 0; ri < rows.length; ri++) {
        if (rows[ri].rowIdx === pick) return rows[ri].qty;
      }
    }
    if (!pl && fallbackIdx >= 0) {
      for (ri = 0; ri < rows.length; ri++) {
        if (rows[ri].rowIdx === fallbackIdx) return rows[ri].qty;
      }
    }
    return null;
  }

  function _buildPostProcessCountsMapRaw_(assyPkgOpt) {
    var sheet = getOrCreatePostProcessCountSheet();
    var values = sheet.getDataRange().getValues();
    var map = {};
    var sheetIndex = _buildPostProcessSheetIndex_(values);
    var pkgLines =
      assyPkgOpt && assyPkgOpt.merged
        ? assyPkgOpt
        : _orderLinesForAssemblyPages_();
    var orders = pkgLines.base || [];
    var comboMerged = pkgLines.merged || [];
    var oi;
    for (oi = 0; oi < comboMerged.length; oi++) {
      var CO = comboMerged[oi];
      if (!CO) continue;
      var uiKeyC = _postProcessUiCountKey_(CO);
      if (!uiKeyC) continue;
      if (map[uiKeyC] != null) continue;
      var bodyC = String(CO._countProductLabel || _orderCountProductLabel_(CO)).trim();
      var qtyC = _postProcessFindCountFromSheetIndex_(sheetIndex, CO.orderNumber, bodyC, CO, comboMerged);
      if (qtyC == null && CO.detailInfo && CO.detailInfo.source === 'combo-bom') {
        qtyC = _postProcessFindCountFromSheetIndex_(
          sheetIndex,
          CO.orderNumber,
          String(CO.productName || '').trim(),
          CO,
          comboMerged
        );
      }
      if (qtyC != null) map[uiKeyC] = qtyC;
    }
    for (oi = 0; oi < orders.length; oi++) {
      var O = orders[oi];
      if (!O) continue;
      var uiKey = _postProcessUiCountKey_(O);
      if (!uiKey) continue;
      var body = String(O._countProductLabel || _orderCountProductLabel_(O)).trim();
      var qty = _postProcessFindCountFromSheetIndex_(sheetIndex, O.orderNumber, body, O, orders);
      if (qty != null) map[uiKey] = qty;
    }
    var on;
    for (on in sheetIndex) {
      if (!Object.prototype.hasOwnProperty.call(sheetIndex, on)) continue;
      var list = sheetIndex[on] || [];
      var li;
      for (li = 0; li < list.length; li++) {
        var ent = list[li] || {};
        if (ent.rPn) {
          var rawKey = on + '\x1f' + ent.rPn;
          if (map[rawKey] == null) map[rawKey] = ent.qty;
        } else if (map[on] == null) {
          map[on] = ent.qty;
        }
      }
    }
    _propagateAssemblyComboCountsToMembers_(map, pkgLines);
    return map;
  }

  function _buildOrderShipmentCountsMapRaw_(assyPkgOpt) {
    var sheet = getOrCreateOrderShipmentHistorySheet();
    var values = sheet.getDataRange().getValues();
    var map = {};
    var pkg = assyPkgOpt && assyPkgOpt.merged ? assyPkgOpt : _orderLinesForAssemblyPages_();
    var merged = pkg.merged || [];
    var base = pkg.base || [];
    var i;
    for (i = 1; i < values.length; i++) {
      var row = values[i] || [];
      var on = row[1] != null ? String(row[1]).trim() : '';
      if (!on) continue;
      var pn = row[3] != null ? String(row[3]).trim() : '';
      var q = row[4];
      var n = typeof q === 'number' && !isNaN(q) ? Math.max(0, Math.floor(q)) : parseInt(String(q || '').replace(/,/g, ''), 10);
      if (isNaN(n)) n = 0;
      var up = typeof row[5] === 'number' && !isNaN(row[5]) ? Math.round(row[5]) : parseInt(String(row[5] || '').replace(/,/g, ''), 10);
      if (isNaN(up)) up = 0;
      var ord = _orderShipmentFindOrderForHistoryRow_(on, pn, up, null, merged);
      if (!ord) ord = _orderShipmentFindOrderForHistoryRow_(on, pn, up, null, base);
      if (!ord) continue;
      var uiKey = _orderShipmentUiCountKey_(ord);
      if (!uiKey) continue;
      map[uiKey] = (map[uiKey] || 0) + n;
    }
    _propagateAssemblyComboCountsToMembers_(map, pkg);
    return map;
  }

  function _getCachedProductionMaps_() {
    if (__prodMapsCache_ && Date.now() - __prodMapsCache_.loadedAt < PROD_MAPS_CACHE_TTL_SEC * 1000) {
      return __prodMapsCache_;
    }
    try {
      var hit = CacheService.getScriptCache().get(PROD_MAPS_CACHE_SCRIPT_KEY);
      if (hit) {
        var parsed = JSON.parse(hit);
        if (parsed && parsed.postCounts && parsed.shipMap) {
          parsed.loadedAt = Date.now();
          __prodMapsCache_ = parsed;
          return parsed;
        }
      }
    } catch (eHit) {}
    var assyPkg = _orderLinesForAssemblyPages_();
    var qtyMap = {};
    try {
      qtyMap = _smtBuildQtySummaryMap_() || {};
    } catch (eQty) {
      qtyMap = {};
    }
    var postCounts = {};
    var shipMap = {};
    try {
      postCounts = _buildPostProcessCountsMapRaw_(assyPkg) || {};
    } catch (ePost) {
      postCounts = {};
    }
    try {
      shipMap = _buildOrderShipmentCountsMapRaw_(assyPkg) || {};
    } catch (eShip) {
      shipMap = {};
    }
    var smtByLabel = _dashboardSmtCountsByOrderLabel_(qtyMap);
    var pkg = {
      qtyMap: qtyMap,
      postCounts: postCounts,
      shipMap: shipMap,
      smtByLabel: smtByLabel,
      loadedAt: Date.now()
    };
    __prodMapsCache_ = pkg;
    try {
      var json = JSON.stringify({
        qtyMap: qtyMap,
        postCounts: postCounts,
        shipMap: shipMap,
        smtByLabel: smtByLabel
      });
      if (json.length <= 95000) {
        CacheService.getScriptCache().put(PROD_MAPS_CACHE_SCRIPT_KEY, json, PROD_MAPS_CACHE_TTL_SEC);
      }
    } catch (ePut) {}
    return pkg;
  }

  /** 홈 대시보드용 — SMT생산기록 하단(최근) 행만 스캔해 오늘 수량 맵 */
  function _smtBuildTodayQtyMapForHome_() {
    var out = {};
    try {
      var qtyMap = _smtBuildQtySummaryMapRaw_();
      var keys = Object.keys(qtyMap);
      var i;
      for (i = 0; i < keys.length; i++) {
        var k = keys[i];
        var ent = qtyMap[k] || {};
        out[k] = { todayQty: Math.max(0, Math.floor(Number(ent.todayQty) || 0)) };
      }
    } catch (e) {
      Logger.log('_smtBuildTodayQtyMapForHome_ 오류: ' + e.toString());
    }
    return out;
  }

  /**
   * SMT생산기록: 라인에 배정된 주문서번호(manualOrderNumber 등)가 있을 때만 시트에 반영한다.
   * 주문·제품·라인 조합이 같으면 해당 행만 수량·시간 갱신, 바뀌면 새 행 append.
   * 진행 중인 세션도 시트에 한 줄 유지되며 POST마다 수량이 갱신된다.
   * 라인 상태 JSON에 smtRecordSessionKey, smtRecordRow 저장.
   * @param {number} lineNo
   * @param {Object} prev
   * @param {Object} next
   * @param {{forceWrite?:boolean}=} options
   */
  function _syncSmtProductionRecordOnPost_(lineNo, prev, next, options) {
    options = options && typeof options === 'object' ? options : {};
    var forceWrite = options.forceWrite === true;
    if (!SMT_AUTO_HISTORY_FROM_LINES_ENABLED && !forceWrite) {
      return;
    }
    var dayKey = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    var prevKey = prev.smtRecordSessionKey != null ? String(prev.smtRecordSessionKey) : '';
    var prevKeyParts = prevKey ? prevKey.split('\x1f') : [];
    var prevDayKey = prevKeyParts.length >= 4 ? String(prevKeyParts[3] || '').trim() : '';
    var orderNo = _smtResolveOrderNoForRecord_(next);
    if (!orderNo || String(orderNo).trim() === '') {
      delete next.smtRecordSessionKey;
      delete next.smtRecordRow;
      delete next.smtRecordBaseQty;
      Logger.log('[SMT_RECORD][SKIP_NO_ORDER] line=' + String(lineNo));
      return;
    }
    var productLabel = _smtProductLabelForRecord_(next);
    var sideUi = _smtPcbSideUiForRecord_(next);
    var isManualCumulative =
      next.manualCumulativeQty != null &&
      next.manualCumulativeQty !== '' &&
      isFinite(Number(next.manualCumulativeQty));
    var rawQtyNum = isManualCumulative
      ? Math.max(0, Math.floor(Number(next.manualCumulativeQty)))
      : Number(next.pcbCount);
    var hasQtyNum = isManualCumulative ? isFinite(rawQtyNum) && rawQtyNum >= 0 : isFinite(rawQtyNum) && rawQtyNum > 0;
    var hasQty = isFinite(Number(next.pcbCount)) && Number(next.pcbCount) > 0;
    var hasRow = orderNo !== '' || productLabel !== '' || hasQty;
    var dayChanged = prevDayKey !== '' && prevDayKey !== dayKey;
    if (!hasRow) {
      if (forceWrite) {
        // 수동 동기화에서는 값이 비어도 라인별 당일 스냅샷 행을 강제 보장한다.
        next.pcbCount = 0;
        hasRow = true;
      }
      if (!dayChanged && !forceWrite) {
        delete next.smtRecordSessionKey;
        delete next.smtRecordRow;
        delete next.smtRecordBaseQty;
        return;
      }
      Logger.log(
        '[SMT_RECORD][DAY_CHANGE_EMPTY] line=' + String(lineNo) +
        ', prevDay=' + String(prevDayKey) +
        ', day=' + String(dayKey) +
        ', forcing zero-row append/update'
      );
    }
    if (!hasRow && dayChanged) {
      // 날짜 변경 첫 수신은 값이 비어도 0수량 행을 남겨 일자 단위 기록 누락을 방지한다.
      next.pcbCount = 0;
    }
    var sessionKey = _smtSessionKeyForProductionRecord_(lineNo, orderNo, productLabel, dayKey, sideUi);
    Logger.log(
      '[SMT_RECORD][IN] line=' + String(lineNo) +
      ', day=' + dayKey +
      ', order=' + String(orderNo || '') +
      ', model=' + String(productLabel || '') +
      ', side=' + String(sideUi || '') +
      ', pcbCount=' + String(next.pcbCount != null ? next.pcbCount : '')
    );
    var prevBaseRaw = Number(prev.smtRecordBaseQty);
    var baseQty = isFinite(prevBaseRaw) ? prevBaseRaw : NaN;
    if (prevKey !== sessionKey || !isFinite(baseQty)) {
      if (hasQtyNum) baseQty = rawQtyNum - 1;
    }
    var sheet = _getOrCreateSmtProductionRecordSheet_();
    var hm = _getSmtProductionRecordHeaderMap_(sheet);
    var writeWidth = Math.max(hm.width, 6);
    var prevRow = prev.smtRecordRow != null ? parseInt(prev.smtRecordRow, 10) : 0;
    var useUpdate =
      prevKey === sessionKey && isFinite(prevRow) && prevRow >= 2 && sheet.getLastRow() >= prevRow;
    if (useUpdate) {
      try {
        var verify = sheet.getRange(prevRow, 1, 1, writeWidth).getValues()[0];
        var vLine = hm.line >= 0 ? Number(verify[hm.line]) : NaN;
        if (!isFinite(vLine) || vLine !== lineNo) {
          useUpdate = false;
        }
      } catch (ve) {
        useUpdate = false;
      }
    }
    var matchedHistoryCount = 0;
    try {
      var all = sheet.getLastRow() >= 2 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, writeWidth).getValues() : [];
      for (var ai = 0; ai < all.length; ai++) {
        var rowIndex = ai + 2;
        if (useUpdate && rowIndex === prevRow) continue;
        var rr = all[ai] || [];
        var rrLine = hm.line >= 0 ? Number(rr[hm.line]) : NaN;
        if (!isFinite(rrLine) || rrLine !== Number(lineNo)) continue;
        var rrOrder = hm.orderNo >= 0 && rr[hm.orderNo] != null ? String(rr[hm.orderNo]).trim() : '';
        var rrModel = hm.model >= 0 && rr[hm.model] != null ? String(rr[hm.model]).trim() : '';
        if (rrOrder !== String(orderNo || '').trim()) continue;
        if (rrModel !== String(productLabel || '').trim()) continue;
        if (hm.pcbSide >= 0 && !_smtRecordSideRowMatches_(rr[hm.pcbSide], sideUi)) continue;
        matchedHistoryCount++;
      }
    } catch (sumErr) {}
    var recordQty = hasQtyNum ? Math.max(0, Math.floor(rawQtyNum)) : 0;
    if (hasQtyNum && !useUpdate && matchedHistoryCount === 0 && prevKey === sessionKey) {
      recordQty = Math.max(0, Math.floor(rawQtyNum));
      if (!isFinite(baseQty)) baseQty = 0;
    }
    var rowVals = new Array(writeWidth);
    for (var wi = 0; wi < writeWidth; wi++) rowVals[wi] = '';
    if (hm.date >= 0) rowVals[hm.date] = dayKey;
    if (hm.line >= 0) rowVals[hm.line] = Number(lineNo);
    if (hm.orderNo >= 0) rowVals[hm.orderNo] = orderNo;
    if (hm.model >= 0) rowVals[hm.model] = productLabel;
    if (hm.pcbSide >= 0) rowVals[hm.pcbSide] = sideUi;
    if (hm.qty >= 0) rowVals[hm.qty] = recordQty;

    if (useUpdate) {
      sheet.getRange(prevRow, 1, 1, writeWidth).setValues([rowVals]);
      _smtFormatSmtProductionRecordDataRow_(sheet, prevRow);
      Logger.log(
        '[SMT_RECORD][UPDATE] row=' + String(prevRow) +
        ', sessionKey=' + sessionKey +
        ', qty=' + String(recordQty)
      );
      next.smtRecordSessionKey = sessionKey;
      next.smtRecordRow = prevRow;
      if (isFinite(baseQty)) next.smtRecordBaseQty = baseQty;
      else delete next.smtRecordBaseQty;
      return;
    }
    /** 시트에서 행 삭제 후 저장 행번호가 어긋난 경우: 같은 세션이면 최근 일치 행에 다시 묶음 */
    if (prevKey === sessionKey && prevKey !== '') {
      var reboundRow = _smtFindLatestProductionRecordRow_(sheet, lineNo, orderNo, productLabel, dayKey, sideUi);
      if (reboundRow >= 2) {
        sheet.getRange(reboundRow, 1, 1, writeWidth).setValues([rowVals]);
        _smtFormatSmtProductionRecordDataRow_(sheet, reboundRow);
        Logger.log(
          '[SMT_RECORD][REBOUND_UPDATE] row=' + String(reboundRow) +
          ', sessionKey=' + sessionKey +
          ', qty=' + String(recordQty)
        );
        next.smtRecordSessionKey = sessionKey;
        next.smtRecordRow = reboundRow;
        if (isFinite(baseQty)) next.smtRecordBaseQty = baseQty;
        else delete next.smtRecordBaseQty;
        return;
      }
    }
    var destRow = sheet.getLastRow() + 1;
    sheet.getRange(destRow, 1, 1, writeWidth).setValues([rowVals]);
    _smtFormatSmtProductionRecordDataRow_(sheet, destRow);
    Logger.log(
      '[SMT_RECORD][APPEND] row=' + String(destRow) +
      ', sessionKey=' + sessionKey +
      ', qty=' + String(recordQty)
    );
    next.smtRecordSessionKey = sessionKey;
    next.smtRecordRow = destRow;
    if (isFinite(baseQty)) next.smtRecordBaseQty = baseQty;
    else delete next.smtRecordBaseQty;
  }

  /** 완제품 → 반제품·자재 (제품BOM 시트) */
  var PRODUCT_BOM_SHEET_NAME = '제품BOM';

  /**
   * Operate.log [MainFrm::StatusCheck] Machine status is changed : A -> B 의 마지막 B 값
   * 코드 1만 생산중, 그 외는 모두 대기중으로 단순 표시
   * @param {*} code
   * @return {{ status: string, statusLabel: string }|null}
   */
  function _mapMachineStatusCodeToBadge(code) {
    if (code === null || code === undefined || code === '') return null;
    var c = parseInt(code, 10);
    if (isNaN(c)) return null;
    if (c === 1) return { status: 'running', statusLabel: '생산중' };
    return { status: 'idle', statusLabel: '대기중' };
  }

  /**
   * SMT 세션/PCB 문자열에서 OPT 파일명 등 매칭용 후보 문자열 수집
   * @param {string} sessionProduct productionSessionProduct
   * @param {string} currentPcb currentPcb
   * @return {Array<string>}
   */
  function _smtCompareStringsFromJobContext_(sessionProduct, currentPcb) {
    var arr = [];
    function pushUnique(v) {
      if (v == null) return;
      var t = String(v).trim();
      if (!t) return;
      if (arr.indexOf(t) < 0) arr.push(t);
    }
    pushUnique(sessionProduct);
    pushUnique(currentPcb);
    var idx;
    for (idx = 0; idx < arr.length; idx++) {
      var s = arr[idx];
      var re = /\[([^\]\r\n]+\.opt)\]/gi;
      var m;
      while ((m = re.exec(s)) !== null) pushUnique(m[1]);
      var normPath = String(s).replace(/\\/g, '/');
      var parts = normPath.split('/');
      pushUnique(parts[parts.length - 1]);
    }
    for (idx = arr.length - 1; idx >= 0; idx--) {
      pushUnique(String(arr[idx]).replace(/\.opt$/i, '').trim());
    }
    return arr;
  }

  /**
   * SMT 문자열에서 면 정보(TOP/BOT) 및 비교용 기본명 추출
   * @param {string} v
   * @return {{ base:string, side:string }}
   */
  function _smtExtractSideAndBase_(v) {
    var raw = v == null ? '' : String(v);
    var norm = _normalizeBomMatchText_(raw);
    if (!norm) return { base: '', side: '' };
    var side = '';
    if (/(^|[\s()[\]{}\-_/\\|])top($|[\s()[\]{}\-_/\\|])/.test(norm) || /(^|[\s()[\]{}\-_/\\|])상면($|[\s()[\]{}\-_/\\|])/.test(norm)) {
      side = 'TOP';
    } else if (/(^|[\s()[\]{}\-_/\\|])bot($|[\s()[\]{}\-_/\\|])/.test(norm) || /(^|[\s()[\]{}\-_/\\|])bottom($|[\s()[\]{}\-_/\\|])/.test(norm) || /(^|[\s()[\]{}\-_/\\|])하면($|[\s()[\]{}\-_/\\|])/.test(norm)) {
      side = 'BOT';
    }
    var base = norm
      .replace(/(^|[\s()[\]{}\-_/\\|])top($|[\s()[\]{}\-_/\\|])/g, ' ')
      .replace(/(^|[\s()[\]{}\-_/\\|])bot($|[\s()[\]{}\-_/\\|])/g, ' ')
      .replace(/(^|[\s()[\]{}\-_/\\|])bottom($|[\s()[\]{}\-_/\\|])/g, ' ')
      .replace(/(^|[\s()[\]{}\-_/\\|])상면($|[\s()[\]{}\-_/\\|])/g, ' ')
      .replace(/(^|[\s()[\]{}\-_/\\|])하면($|[\s()[\]{}\-_/\\|])/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { base: base, side: side };
  }

  /**
   * SMT 작업 컨텍스트에서 TOP/BOT 힌트 수집
   * @param {Array<string>} compareStrings
   * @return {{top:boolean, bot:boolean}}
   */
  function _smtCollectSideHint_(compareStrings) {
    var hint = { top: false, bot: false };
    if (!compareStrings || !compareStrings.length) return hint;
    for (var i = 0; i < compareStrings.length; i++) {
      var p = _smtExtractSideAndBase_(compareStrings[i]);
      if (p.side === 'TOP') hint.top = true;
      if (p.side === 'BOT') hint.bot = true;
    }
    return hint;
  }

  /**
   * 주문서 제품명·버전·코드 vs OPT/PCB 후보 문자열 유사도 (_scoreBomNameMatch_ 기반)
   */
  function _smtScoreOrderAgainstCompareStrings_(compareStrings, order) {
    if (!compareStrings || !compareStrings.length || !order) return 0;
    var pname = (order.productName || '').trim();
    var ver = (order.version || '').trim();
    var pcode = (order.productCode || '').trim();
    var onum = (order.orderNumber || '').trim();
    var cand = [];
    if (pname) cand.push(pname);
    if (pname && ver) cand.push(pname + ' ' + ver);
    if (pname && ver) cand.push(pname + '(' + ver + ')');
    else if (ver) cand.push(ver);
    if (pcode) cand.push(pcode);
    if (onum) cand.push(onum);
    if (!cand.length) return 0;
    var best = 0;
    var ci;
    for (ci = 0; ci < compareStrings.length; ci++) {
      var job = compareStrings[ci];
      if (!job) continue;
      var parsedJob = _smtExtractSideAndBase_(job);
      var jobBase = parsedJob.base || '';
      var lj;
      for (lj = 0; lj < cand.length; lj++) {
        var c0 = cand[lj];
        var parsedCand = _smtExtractSideAndBase_(c0);
        var candBase = parsedCand.base || '';
        var sc = _scoreBomNameMatch_(job, c0);
        if (jobBase && candBase) {
          var baseScore = _scoreBomNameMatch_(jobBase, candBase);
          if (baseScore > sc) sc = baseScore;
        }
        if (sc > best) best = sc;
      }
    }
    return best;
  }

  /**
   * @param {Array<string>} compareStrings
   * @param {Array<Object>} orders getOrders() 행
   * @return {{ orderNumber: string, label: string, score: number, side: string }|null}
   */
  function _smtPickBestOrderMatch_(compareStrings, orders) {
    if (!compareStrings || !compareStrings.length || !orders || !orders.length) return null;
    var sideHint = _smtCollectSideHint_(compareStrings);
    var bestOrder = null;
    var bestScore = -1;
    var ii;
    for (ii = 0; ii < orders.length; ii++) {
      var ord = orders[ii];
      if (!ord || !ord.orderNumber) continue;
      var sc = _smtScoreOrderAgainstCompareStrings_(compareStrings, ord);
      if (sc > bestScore) {
        bestScore = sc;
        bestOrder = ord;
      } else if (sc === bestScore && sc >= 0 && bestOrder) {
        if (String(ord.orderNumber).localeCompare(String(bestOrder.orderNumber), undefined, { numeric: true }) > 0) {
          bestOrder = ord;
        }
      }
    }
    if (bestScore < 45 || !bestOrder) return null;
    var on = String(bestOrder.orderNumber).trim();
    var cust = (bestOrder.customer || '').trim();
    var pnm = (bestOrder.productName || '').trim();
    var vv = (bestOrder.version || '').trim();
    var label = on + ' · ' + (cust || '—') + ' · ' + (pnm || '—') + (vv ? ' v' + vv : '');
    var side = '';
    if (sideHint.top && !sideHint.bot) side = 'TOP';
    else if (sideHint.bot && !sideHint.top) side = 'BOT';
    return { orderNumber: on, label: label, score: bestScore, side: side };
  }

  /**
   * 생산 현황 화면: SMT 7라인 상태 + 후공정 안내
   * 라인별 로그는 스크립트 속성(SMT_LINE_STATE_1…7)에 doPost로 적재된 값 표시
   * @return {{ ok:boolean, updatedAt?:string, smtLines?:Array, postProcess?:Object, error?:string }}
   */
  function getProductionStatusSnapshot() {
    try {
      var cache = CacheService.getScriptCache();
      var hit = cache.get(PRODUCTION_STATUS_SNAPSHOT_CACHE_KEY);
      if (hit) {
        try {
          var cached = JSON.parse(hit);
          if (cached && cached.ok) return cached;
        } catch (eHit) {}
      }
      var planSync = _maybeSyncSmtLinesFromPlan_();
      var plansByLine = planSync && planSync.linePlans ? planSync.linePlans : {};
      var planMetaByLine = planSync && planSync.linePlanMeta ? planSync.linePlanMeta : {};
      var props = PropertiesService.getScriptProperties();
      var smt = [];
      var now = new Date().getTime();
      var ordersForMatch = [];
      try {
        ordersForMatch = getOrders() || [];
      } catch (ordErr) {
        Logger.log('getProductionStatusSnapshot 주문 목록: ' + ordErr.toString());
        ordersForMatch = [];
      }
      var qtyMap = _smtBuildQtySummaryMap_();
      var orderQtyMap = {};
      for (var oq = 0; oq < ordersForMatch.length; oq++) {
        var oo = ordersForMatch[oq] || {};
        var on = oo.orderNumber != null ? String(oo.orderNumber).trim() : '';
        if (!on) continue;
        orderQtyMap[on] = Number(oo.quantity) || 0;
      }
      for (var i = 1; i <= 7; i++) {
        var row = {
          lineId: String(i),
          lineNo: i,
          label: '라인 ' + i,
          status: 'idle',
          statusLabel: '대기',
          currentJob: '',
          lastPcbCount: null,
          productionStartAt: '',
          productionStopAt: '',
          productionSessionProduct: '',
          matchedOrderNumber: '',
          matchedOrderLabel: '',
          matchedOrderScore: null,
          matchedOrderSide: '',
          matchedBy: '',
          todayQty: null,
          cumulativeQty: null,
          targetQty: null
        };
        try {
          var raw = props.getProperty(_smtLineStateKey(i));
          if (raw) {
            var st = JSON.parse(raw);
            row.currentJob = st.currentPcb ? String(st.currentPcb) : '';
            if (st.pcbCount != null && st.pcbCount !== '') {
              row.lastPcbCount = st.pcbCount;
            }
            if (st.productionStartAt != null && String(st.productionStartAt).trim() !== '') {
              row.productionStartAt = String(st.productionStartAt).trim();
            }
            if (st.productionStopAt != null && String(st.productionStopAt).trim() !== '') {
              row.productionStopAt = String(st.productionStopAt).trim();
            }
            if (st.productionSessionProduct != null && String(st.productionSessionProduct).trim() !== '') {
              row.productionSessionProduct = String(st.productionSessionProduct).trim();
            }
            if (st.manualOrderNumber != null && String(st.manualOrderNumber).trim() !== '') {
              row.matchedOrderNumber = String(st.manualOrderNumber).trim();
              row.matchedOrderLabel = st.manualOrderLabel != null ? String(st.manualOrderLabel).trim() : row.matchedOrderNumber;
              row.matchedOrderScore = null;
              row.matchedOrderSide = st.manualOrderSide != null ? String(st.manualOrderSide).trim() : '';
              row.matchedBy = 'manual';
              if (st.manualProductName != null && String(st.manualProductName).trim() !== '') {
                row.manualProductName = String(st.manualProductName).trim();
              }
              if (st.manualProductDisplayName != null && String(st.manualProductDisplayName).trim() !== '') {
                row.manualProductDisplayName = String(st.manualProductDisplayName).trim();
              }
              if (st.manualVersion != null && String(st.manualVersion).trim() !== '') {
                row.manualVersion = String(st.manualVersion).trim();
              }
              if (st.manualSheetRow != null && !isNaN(Number(st.manualSheetRow))) {
                row.manualSheetRow = Math.floor(Number(st.manualSheetRow));
              }
            } else if (st.manualLotNumber != null && String(st.manualLotNumber).trim() !== '') {
              var leg = String(st.manualLotNumber).trim();
              var legOrd = getOrderByNumber(leg);
              if (legOrd && legOrd.orderNumber) {
                row.matchedOrderNumber = String(legOrd.orderNumber).trim();
                row.matchedOrderLabel = st.manualLotLabel != null ? String(st.manualLotLabel).trim() : row.matchedOrderNumber;
                row.matchedOrderScore = null;
                row.matchedOrderSide = '';
                row.matchedBy = 'manual';
              }
            }
            var updatedMs = st.updatedAt ? new Date(st.updatedAt).getTime() : 0;
            var fresh = updatedMs && now - updatedMs < 180000;
            var badge = _mapMachineStatusCodeToBadge(st.machineStatusCode);
            if (badge) {
              row.status = badge.status;
              row.statusLabel = badge.statusLabel;
            } else if (fresh && (row.currentJob || st.pcbCount != null)) {
              row.status = 'running';
              row.statusLabel = '가동';
            } else if (row.currentJob || st.pcbCount != null) {
              row.status = 'setup';
              row.statusLabel = '데이터 있음';
            }
          }
        } catch (parseErr) {
          Logger.log('getProductionStatusSnapshot 라인 ' + i + ' 파싱: ' + parseErr.toString());
        }
        var cmp = _smtCompareStringsFromJobContext_(row.productionSessionProduct, row.currentJob);
        var pick = _smtPickBestOrderMatch_(cmp, ordersForMatch);
        if (!row.matchedOrderNumber && pick) {
          row.matchedOrderNumber = pick.orderNumber;
          row.matchedOrderLabel = pick.label;
          row.matchedOrderScore = pick.score;
          row.matchedOrderSide = pick.side || '';
          row.matchedBy = 'auto';
        }
        var qk = _smtQtyMapKey_(
          row.lineNo,
          String(row.matchedOrderNumber || '').trim(),
          String(row.currentJob || '').trim(),
          0,
          row.matchedOrderSide || row.manualOrderSide || ''
        );
        var qq = qtyMap[qk];
        if (!qq) {
          qq = qtyMap[
            _smtQtyMapKey_(
              row.lineNo,
              String(row.matchedOrderNumber || '').trim(),
              String(row.currentJob || '').trim(),
              0
            )
          ];
        }
        if (qq) {
          var sheetTodayA = Number(qq.todayQty) || 0;
          var sheetCumA = Number(qq.cumulativeQty) || 0;
          row.todayQty = Math.max(0, Math.floor(sheetTodayA));
          row.cumulativeQty = Math.max(0, Math.floor(sheetCumA));
        } else {
          var live = Number(row.lastPcbCount);
          if (isFinite(live) && live >= 0) {
            row.todayQty = Math.max(0, Math.floor(live));
            row.cumulativeQty = Math.max(0, Math.floor(live));
          } else {
            row.todayQty = 0;
            row.cumulativeQty = 0;
          }
        }
        if (row.matchedOrderNumber && Object.prototype.hasOwnProperty.call(orderQtyMap, row.matchedOrderNumber)) {
          row.targetQty = Number(orderQtyMap[row.matchedOrderNumber]) || 0;
        }
        var linePlan = plansByLine[i] || null;
        if (_smtLineRegHoldEmptyToday_(i)) linePlan = null;
        var lineMeta = planMetaByLine[i] || planMetaByLine[String(i)] || {};
        row.planQueueTotal = Math.max(0, Math.floor(Number(lineMeta.total) || 0));
        row.planQueueDone = Math.max(0, Math.floor(Number(lineMeta.completed) || 0));
        row.planQueuePending = Math.max(0, Math.floor(Number(lineMeta.pending) || 0));
        row.allTodayPlansComplete = !!lineMeta.allComplete;
        if (linePlan) {
          row.planTargetQty = Number(linePlan.targetQty) || 0;
          row.planDate = linePlan.planDate || '';
          row.planEndDate = linePlan.planEndDate || '';
          row.planBound = true;
          var pOrd = linePlan.orderNumber != null ? String(linePlan.orderNumber).trim() : '';
          var pPnm = linePlan.productName != null ? String(linePlan.productName).trim() : '';
          var pDisp =
            linePlan.productDisplayName != null ? String(linePlan.productDisplayName).trim() : pPnm;
          if (pOrd && pPnm) {
            row.matchedOrderNumber = pOrd;
            row.matchedOrderLabel = pOrd + (pDisp ? ' · ' + pDisp : '');
            row.manualProductName = pPnm;
            row.manualProductDisplayName = pDisp;
            row.matchedOrderSide = linePlan.pcbSide != null ? String(linePlan.pcbSide).trim() : '';
            row.manualVersion = linePlan.version != null ? String(linePlan.version).trim() : '';
            row.manualSheetRow =
              linePlan.sheetRow != null && !isNaN(Number(linePlan.sheetRow))
                ? Math.floor(Number(linePlan.sheetRow))
                : 0;
            row.matchedBy = 'plan';
          }
        } else {
          row.planBound = false;
        }
        smt.push(row);
      }
      var availableOrders = [];
      for (var oi = 0; oi < ordersForMatch.length; oi++) {
        var O = ordersForMatch[oi] || {};
        var oNum = O.orderNumber != null ? String(O.orderNumber).trim() : '';
        if (!oNum) continue;
        var cust = O.customer != null ? String(O.customer).trim() : '';
        var pnm = O.productName != null ? String(O.productName).trim() : '';
        var vv = O.version != null ? String(O.version).trim() : '';
        availableOrders.push({
          orderNumber: oNum,
          label: oNum + ' · ' + (cust || '—') + ' · ' + (pnm || '—') + (vv ? ' v' + vv : '')
        });
      }
      var snapResult = {
        ok: true,
        updatedAt: new Date().toISOString(),
        smtLines: smt,
        availableOrders: availableOrders,
        postProcess: {
          message: '후공정 라인 구성·상태는 추후 이 영역에 연동할 수 있습니다.',
          lines: []
        }
      };
      _homeCachePutJson_(PRODUCTION_STATUS_SNAPSHOT_CACHE_KEY, snapResult, PRODUCTION_STATUS_SNAPSHOT_TTL_SEC);
      return snapResult;
    } catch (err) {
      Logger.log('getProductionStatusSnapshot 오류: ' + err.toString());
      return {
        ok: false,
        error: err.message || String(err)
      };
    }
  }

  /**
   * SMT 라인 수동 주문서 지정/해제
   * @param {number|string} lineNo 1~7
   * @param {string} orderNumber '' 이면 해제
   * @return {{ok:boolean, lineNo:number, manualOrderNumber:string}}
   */
  function setSmtLineManualOrder(lineNo, orderNumber) {
    var no = parseInt(lineNo, 10);
    if (isNaN(no) || no < 1 || no > 7) throw new Error('lineNo must be 1-7');
    var ordNo = orderNumber != null ? String(orderNumber).trim() : '';
    var props = PropertiesService.getScriptProperties();
    var key = _smtLineStateKey(no);
    var st = {};
    try {
      var raw = props.getProperty(key);
      if (raw) st = JSON.parse(raw);
    } catch (e) {
      st = {};
    }
    if (!ordNo) {
      delete st.manualOrderNumber;
      delete st.manualOrderLabel;
      delete st.manualOrderUpdatedAt;
      delete st.manualProductName;
      delete st.manualProductDisplayName;
      delete st.manualOrderSide;
      delete st.manualVersion;
      delete st.manualSheetRow;
      delete st.manualCumulativeQty;
      delete st.manualQtyUpdatedAt;
      delete st.manualLotNumber;
      delete st.manualLotLabel;
      delete st.manualLotUpdatedAt;
      delete st.smtSessionNotice;
      props.setProperty(key, JSON.stringify(st));
      return { ok: true, lineNo: no, manualOrderNumber: '' };
    }
    var ord = getOrderByNumber(ordNo);
    if (!ord) throw new Error('주문서를 찾을 수 없습니다: ' + ordNo);
    var cust = ord.customer != null ? String(ord.customer).trim() : '';
    var pnm = ord.productName != null ? String(ord.productName).trim() : '';
    var vv = ord.version != null ? String(ord.version).trim() : '';
    st.manualOrderNumber = ordNo;
    st.manualOrderLabel = ordNo + ' · ' + (cust || '—') + ' · ' + (pnm || '—') + (vv ? ' v' + vv : '');
    st.manualOrderUpdatedAt = new Date().toISOString();
    delete st.manualLotNumber;
    delete st.manualLotLabel;
    delete st.manualLotUpdatedAt;
    props.setProperty(key, JSON.stringify(st));
    return { ok: true, lineNo: no, manualOrderNumber: ordNo };
  }

  function _bomCellPlain_(row, colIdx) {
    if (!row || colIdx < 0 || colIdx >= row.length) return '';
    return _sheetCellToPlainString_(row[colIdx]);
  }

  function _smtPcbSideToken_(pcbSide) {
    var s = String(pcbSide != null ? pcbSide : '')
      .trim()
      .toUpperCase();
    if (s === 'TOP' || s === 'BOT') return s;
    return '';
  }

  function _smtManualSideUiChoice_(pcbSide) {
    return _smtStoredManualSideToUiChoice_(pcbSide);
  }

  /**
   * 수동 입력 면 선택 파싱 — 미선택 시 null
   * @return {{ok:boolean, side?:string, error?:string}}
   */
  function _smtParseManualPcbSideChoice_(pcbSide) {
    var s = String(pcbSide != null ? pcbSide : '')
      .trim()
      .toUpperCase();
    if (!s) {
      return { ok: false, error: '면 구분(SINGLE / TOP / BOT)을 선택하세요.' };
    }
    if (s === 'SINGLE') return { ok: true, side: '' };
    if (s === 'TOP' || s === 'BOT') return { ok: true, side: s };
    return { ok: false, error: '면 구분은 SINGLE, TOP, BOT 중에서 선택하세요.' };
  }

  function _smtManualSideUiLabel_(pcbSide) {
    var t = _smtPcbSideToken_(pcbSide);
    return t || 'SINGLE';
  }

  /** 저장값(''|TOP|BOT) → UI 선택값(SINGLE|TOP|BOT) */
  function _smtStoredManualSideToUiChoice_(storedSide) {
    var t = _smtPcbSideToken_(storedSide);
    return t || 'SINGLE';
  }

  var SMT_PRODUCTION_LINE_MIN = 1;
  var SMT_PRODUCTION_LINE_MAX = 7;

  function _smtIsSmtProductionLineNo_(lineNo) {
    var ln = Number(lineNo);
    return isFinite(ln) && ln >= SMT_PRODUCTION_LINE_MIN && ln <= SMT_PRODUCTION_LINE_MAX;
  }

  /** BOM·자재명 1회 로드 — getSmtManualEntryOptions 등 대량 주문 루프용 */
  function _smtBuildSemiCollectContext_() {
    var semiNameByCode = {};
    try {
      var mats = getMaterials() || [];
      for (var mi = 0; mi < mats.length; mi++) {
        var mm = mats[mi] || {};
        var mCode = mm.materialCode != null ? String(mm.materialCode).trim() : '';
        var mName = mm.materialName != null ? String(mm.materialName).trim() : '';
        if (!mCode || !mName) continue;
        if (!semiNameByCode[mCode]) semiNameByCode[mCode] = mName;
      }
    } catch (eMat0) {}
    var bomSheetData = null;
    try {
      bomSheetData = _readProductBomSheetData_();
    } catch (eBom0) {
      bomSheetData = null;
    }
    return { semiNameByCode: semiNameByCode, bomSheetData: bomSheetData };
  }

  /**
   * 주문 1행 → BOM 반제품 목록
   * @return {{semiMap:Object, semiCodes:Array<string>, version:string, bomParentCode:string, parentProductName:string}}
   */
  function _smtCollectSemiMapForOrder_(ord, collectCtx) {
    ord = ord && typeof ord === 'object' ? ord : {};
    collectCtx = collectCtx && typeof collectCtx === 'object' ? collectCtx : null;
    var parentPnm = ord.productName != null ? String(ord.productName).trim() : '';
    var vv = ord.version != null ? String(ord.version).trim() : '';
    var productCode = ord.productCode != null ? String(ord.productCode).trim() : '';
    var bomParentCode = productCode || parentPnm;
    var semiMap = {};
    function ensureEntry(code, displayName) {
      var c = String(code || '').trim();
      if (!c) return;
      var dn = String(displayName || '').trim();
      if (!semiMap[c]) {
        semiMap[c] = { displayName: dn };
        return;
      }
      if (dn && !semiMap[c].displayName) semiMap[c].displayName = dn;
    }
    var semiNameByCode =
      collectCtx && collectCtx.semiNameByCode && typeof collectCtx.semiNameByCode === 'object'
        ? collectCtx.semiNameByCode
        : {};
    if (!collectCtx) {
      try {
        var mats = getMaterials() || [];
        for (var mi = 0; mi < mats.length; mi++) {
          var mm = mats[mi] || {};
          var mCode = mm.materialCode != null ? String(mm.materialCode).trim() : '';
          var mName = mm.materialName != null ? String(mm.materialName).trim() : '';
          if (!mCode || !mName) continue;
          if (!semiNameByCode[mCode]) semiNameByCode[mCode] = mName;
        }
      } catch (eMat) {}
    }
    var bomSheetData = collectCtx ? collectCtx.bomSheetData : null;
    if (!collectCtx) {
      try {
        bomSheetData = _readProductBomSheetData_();
      } catch (eBom0) {
        bomSheetData = null;
      }
    }
    if (bomSheetData && bomParentCode) {
      try {
        var bomLines = _collectBomLinesForProduct_(bomSheetData, bomParentCode, vv);
        if (!bomLines.length && vv) {
          bomLines = _collectBomLinesForProduct_(bomSheetData, bomParentCode, '');
        }
        for (var bi = 0; bi < bomLines.length; bi++) {
          var bl = bomLines[bi] || {};
          var semi = bl.semi != null ? String(bl.semi).trim() : '';
          if (!semi) continue;
          var bomName = bl.bomName != null ? String(bl.bomName).trim() : '';
          var semiRowName = bl.semiName != null ? String(bl.semiName).trim() : '';
          var disp =
            _resolveSemiDisplayNameFromBom_(bomSheetData, semi, semiNameByCode[semi] || semiRowName || bomName) ||
            semiRowName ||
            bomName ||
            '';
          ensureEntry(semi, disp);
        }
      } catch (eBom1) {}
    }
    if (!Object.keys(semiMap).length && bomSheetData) {
      try {
        var pv = bomSheetData.pv || [];
        var pIdxCode = bomSheetData.pIdxCode;
        var pIdxSemi = bomSheetData.pIdxSemi;
        var pIdxName = bomSheetData.pIdxName;
        var pIdxSemiName = bomSheetData.pIdxSemiName;
        var pIdxVer = bomSheetData.pIdxVer;
        var candA = productCode ? String(productCode).trim() : '';
        var candB = parentPnm ? String(parentPnm).trim() : '';
        var wantVer = vv ? String(vv).trim() : '';
        var cj;
        for (cj = 1; cj < pv.length; cj++) {
          var rr = pv[cj] || [];
          var semi2 = pIdxSemi >= 0 && rr[pIdxSemi] != null ? String(rr[pIdxSemi]).trim() : '';
          if (!semi2) continue;
          var parentCodeCell = pIdxCode >= 0 && rr[pIdxCode] != null ? String(rr[pIdxCode]).trim() : '';
          var nameCell = pIdxName >= 0 && rr[pIdxName] != null ? String(rr[pIdxName]).trim() : '';
          var semiNameCell = pIdxSemiName >= 0 && rr[pIdxSemiName] != null ? String(rr[pIdxSemiName]).trim() : '';
          var rowVer = pIdxVer >= 0 && rr[pIdxVer] != null ? String(rr[pIdxVer]).trim() : '';
          var parentMatch =
            (candA && parentCodeCell === candA) ||
            (candB && parentCodeCell === candB) ||
            (candA && nameCell === candA) ||
            (candB && nameCell === candB);
          if (!parentMatch) continue;
          if (wantVer && rowVer && !_bomVersionsMatch_(rowVer, wantVer)) continue;
          var disp2 =
            _resolveSemiDisplayNameFromBom_(bomSheetData, semi2, semiNameByCode[semi2] || semiNameCell || nameCell) ||
            semiNameCell ||
            nameCell ||
            '';
          ensureEntry(semi2, disp2);
        }
      } catch (eFallback) {}
    }
    var semiKeys = Object.keys(semiMap);
    semiKeys.sort(function (a, b) {
      return String(a).localeCompare(String(b), 'ko', { numeric: true });
    });
    return {
      semiMap: semiMap,
      semiCodes: semiKeys,
      version: vv,
      bomParentCode: bomParentCode,
      parentProductName: parentPnm
    };
  }

  /** 주문·반제품별 SINGLE/TOP/BOT 누적 (라인 1~7 생산기록) */
  function _smtSideCumulativeTotalsForOrder_(qtyMap, ord, collectCtx) {
    ord = ord && typeof ord === 'object' ? ord : {};
    qtyMap = _smtFilterQtyMapForSmtLines_(qtyMap);
    var on = String(ord.orderNumber != null ? ord.orderNumber : '').trim();
    var plan = _smtCollectSemiMapForOrder_(ord, collectCtx);
    var vv = plan.version || '';
    var semiCodes = plan.semiCodes || [];
    var topMax = 0;
    var botMax = 0;
    var singleMax = 0;
    var si;
    if (semiCodes.length) {
      for (si = 0; si < semiCodes.length; si++) {
        var sc = semiCodes[si];
        var semiEnt = (plan.semiMap || {})[sc] || {};
        var semiDisp = semiEnt.displayName != null ? String(semiEnt.displayName).trim() : '';
        singleMax = Math.max(singleMax, _smtSumCumulativeForSheetModel_(qtyMap, on, semiDisp, sc, '', vv));
        topMax = Math.max(topMax, _smtSumCumulativeForSheetModel_(qtyMap, on, semiDisp, sc, 'TOP', vv));
        botMax = Math.max(botMax, _smtSumCumulativeForSheetModel_(qtyMap, on, semiDisp, sc, 'BOT', vv));
      }
    } else {
      var parentLbl = _smtOrderProductLabel_(ord);
      var baseName = plan.parentProductName || parentLbl;
      singleMax = _smtSumCumulativeForSheetModel_(qtyMap, on, baseName, baseName, '', vv);
      topMax = _smtSumCumulativeForSheetModel_(qtyMap, on, baseName, baseName, 'TOP', vv);
      botMax = _smtSumCumulativeForSheetModel_(qtyMap, on, baseName, baseName, 'BOT', vv);
    }
    return { topMax: topMax, botMax: botMax, singleMax: singleMax };
  }

  /** SMT생산기록 qtyMap — 라인 1~7만 (생산입력·장비 라인) */
  function _smtFilterQtyMapForSmtLines_(qtyMap) {
    var src = qtyMap && typeof qtyMap === 'object' ? qtyMap : {};
    var out = {};
    var keys = Object.keys(src);
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var parts = String(k).split('\x1f');
      if (parts.length < 3) continue;
      if (!_smtIsSmtProductionLineNo_(parts[0])) continue;
      out[k] = src[k];
    }
    return out;
  }

  /** 라인 상태 → SMT생산기록 모델 문자열(시트·집계와 동일) */
  function _smtExpectedModelFromLineState_(st) {
    st = st && typeof st === 'object' ? st : {};
    var cur = st.currentPcb != null ? String(st.currentPcb).trim() : '';
    if (cur) return cur;
    var semi = st.manualProductName != null ? String(st.manualProductName).trim() : '';
    var vv = st.manualVersion != null ? String(st.manualVersion).trim() : '';
    var side = st.manualOrderSide != null ? String(st.manualOrderSide).trim() : '';
    return _smtSheetModelLabel_(semi, semi, side, vv);
  }

  /** 주문번호 + 모델라벨(+면) — SMT 라인(1~7) 누적 최대 (옛 라인 중복 합산 방지용 fallback) */
  function _smtMaxCumulativeOnSmtLines_(qtyMap, orderNo, productLabel, pcbSide) {
    if (!qtyMap || typeof qtyMap !== 'object') return 0;
    var on = String(orderNo || '').trim();
    var pl = String(productLabel || '').trim();
    if (!on) return 0;
    var sideWant = _smtNormalizePcbSideUi_(pcbSide);
    var max = 0;
    var keys = Object.keys(qtyMap);
    var ki;
    for (ki = 0; ki < keys.length; ki++) {
      var key = keys[ki];
      var parts = String(key).split('\x1f');
      if (parts.length < 3) continue;
      if (!_smtIsSmtProductionLineNo_(parts[0])) continue;
      if (String(parts[1]).trim() !== on) continue;
      var keySide = parts.length >= 4 ? _smtNormalizePcbSideUi_(parts[3]) : 'SINGLE';
      var keyModel = String(parts[2]).trim();
      if (parts.length < 4 && keyModel) {
        var normLegacy = _smtNormalizeSheetModelAndSide_(keyModel, 'SINGLE');
        if (normLegacy.side !== 'SINGLE') {
          keySide = normLegacy.side;
          keyModel = normLegacy.model;
        }
      }
      if (pl && keyModel !== pl) continue;
      if (sideWant !== 'SINGLE' && keySide !== sideWant) continue;
      if (sideWant === 'SINGLE' && keySide !== 'SINGLE') continue;
      var ent = qtyMap[key];
      var c = ent && isFinite(Number(ent.cumulativeQty)) ? Number(ent.cumulativeQty) : 0;
      max = Math.max(max, Math.max(0, Math.floor(c)));
    }
    return max;
  }

  /**
   * 현재 수동 배정(라인 1~7)에 해당하는 생산기록만 합산 — 배정 해제·재배정 후 옛 라인 이중 집계 방지
   */
  function _smtSumCumulativeOnActiveManualLines_(qtyMap, orderNo, productLabel, pcbSide) {
    if (!qtyMap || typeof qtyMap !== 'object') return 0;
    var on = String(orderNo || '').trim();
    var pl = String(productLabel || '').trim();
    if (!on || !pl) return 0;
    var sideWant = _smtNormalizePcbSideUi_(pcbSide);
    var props = PropertiesService.getScriptProperties();
    var sum = 0;
    var i;
    for (i = SMT_PRODUCTION_LINE_MIN; i <= SMT_PRODUCTION_LINE_MAX; i++) {
      var raw = props.getProperty(_smtLineStateKey(i));
      if (!raw) continue;
      try {
        var st = JSON.parse(raw);
        if (String(st.manualOrderNumber || '').trim() !== on) continue;
        if (_smtExpectedModelFromLineState_(st) !== pl) continue;
        if (sideWant !== _smtNormalizePcbSideUi_(st.manualOrderSide)) continue;
        var key = _smtQtyMapKey_(i, on, pl, 0, sideWant);
        var ent = qtyMap[key];
        if (!ent) ent = qtyMap[_smtQtyMapKey_(i, on, pl, 0)];
        if (!ent && sideWant !== 'SINGLE') {
          ent = qtyMap[_smtQtyMapKey_(i, on, _smtBuildProductLabel_(pl, pcbSide, ''), 0)];
        }
        var c = ent && isFinite(Number(ent.cumulativeQty)) ? Number(ent.cumulativeQty) : 0;
        sum += Math.max(0, Math.floor(c));
      } catch (e0) {}
    }
    return sum;
  }

  /** 활성 배정 우선, 없으면 라인별 최대값(fallback) */
  function _smtSumCumulativeForOrderModel_(qtyMap, orderNo, productLabel, pcbSide) {
    var active = _smtSumCumulativeOnActiveManualLines_(qtyMap, orderNo, productLabel, pcbSide);
    if (active > 0) return active;
    return _smtMaxCumulativeOnSmtLines_(qtyMap, orderNo, productLabel, pcbSide);
  }

  /** 제품명·코드 라벨 모두 조회(옛 생산기록 시트 호환) */
  function _smtSumCumulativeForSheetModel_(qtyMap, orderNo, displayName, semiCode, pcbSide, version) {
    var sc = String(semiCode != null ? semiCode : '').trim();
    var ui = _smtSemiOptionUiText_(displayName, sc);
    var sideTok = _smtPcbSideToken_(pcbSide);
    var plainLbl = _smtSheetModelLabel_(displayName, sc, '', version);
    var labels = [plainLbl];
    var li;
    var legacyPlain = _smtBuildProductLabel_(ui, '', version);
    if (legacyPlain && labels.indexOf(legacyPlain) < 0) labels.push(legacyPlain);
    if (sideTok) {
      var legacySide = _smtBuildProductLabel_(ui, pcbSide, version);
      if (legacySide && labels.indexOf(legacySide) < 0) labels.push(legacySide);
    }
    if (ui === '반제품' && sc) {
      var scLbl = _smtBuildProductLabel_(sc, sideTok ? pcbSide : '', version);
      if (scLbl && labels.indexOf(scLbl) < 0) labels.push(scLbl);
    }
    if (sc && ui !== sc) {
      var scLbl2 = _smtBuildProductLabel_(sc, sideTok ? pcbSide : '', version);
      if (scLbl2 && labels.indexOf(scLbl2) < 0) labels.push(scLbl2);
    }
    var n = 0;
    for (li = 0; li < labels.length; li++) {
      n = Math.max(n, _smtSumCumulativeForOrderModel_(qtyMap, orderNo, labels[li], pcbSide));
    }
    return n;
  }

  /**
   * 주문현황 SMT 실적
   * - 생산등록 SINGLE만 있으면 → SINGLE 누적
   * - TOP 또는 BOT 기록이 있으면 → min(TOP,BOT) (생산계획·등록 면 기준)
   */
  function _dashboardSmtProducedQtyForOrder_(qtyMap, ord, collectCtx) {
    var t = _smtSideCumulativeTotalsForOrder_(qtyMap, ord, collectCtx);
    if (t.topMax > 0 || t.botMax > 0) return Math.min(t.topMax, t.botMax);
    return t.singleMax;
  }

  /**
   * SMT생산기록 시트 모델·면구분 정규화 — 면구분 컬럼 우선, 옛 행(모델 끝 TOP/BOT) 호환
   * @return {{ model:string, side:string }}
   */
  function _smtNormalizeSheetModelAndSide_(modelCell, sideCell) {
    var model = String(modelCell != null ? modelCell : '').trim();
    var side = _smtNormalizePcbSideUi_(sideCell);
    if (side !== 'SINGLE' || !model) return { model: model, side: side };
    var m = model.match(/^(.*)\s+(TOP|BOT)$/i);
    if (m && m[1]) {
      return { model: String(m[1]).trim(), side: String(m[2]).toUpperCase() };
    }
    return { model: model, side: side };
  }

  /** SMT 생산기록·누적 집계용 모델 문자열 (예: 제품명 TOP V1) — 레거시 집계·매칭용 */
  function _smtBuildProductLabel_(nameOrCode, pcbSide, version) {
    var name = String(nameOrCode != null ? nameOrCode : '').trim();
    var side = _smtPcbSideToken_(pcbSide);
    var vv = version != null ? String(version).trim() : '';
    var parts = [];
    if (name) parts.push(name);
    if (side) parts.push(side);
    if (vv) parts.push(vv);
    return parts.join(' ');
  }

  /**
   * SMT 생산기록 시트 모델 — 제품명(+버전)만. 면구분(TOP/BOT)은 면구분 컬럼에 별도 저장.
   * pcbSide 인자는 호출부 호환용이며 모델 문자열에는 포함하지 않는다.
   */
  function _smtSheetModelLabel_(displayName, semiCode, pcbSide, version) {
    var name = _smtSemiOptionUiText_(displayName, semiCode);
    var vv = version != null ? String(version).trim() : '';
    var parts = [];
    if (name) parts.push(name);
    if (vv) parts.push(vv);
    var out = parts.join(' ').trim();
    return out || name || vv || '';
  }

  /** SMT 생산 100% 완료 여부 (목록 제외용 아님 — 표시 색상·뱃지용) */
  function _smtManualOptionIsComplete_(op) {
    op = op || {};
    var qty = Math.max(0, Math.floor(Number(op.orderQty) || Number(op.quantity) || 0));
    if (qty <= 0) return false;
    var remTop = Math.max(0, Math.floor(Number(op.remainingQtyTop) || 0));
    var remBot = Math.max(0, Math.floor(Number(op.remainingQtyBot) || 0));
    var prodTop = Math.max(0, qty - remTop);
    var prodBot = Math.max(0, qty - remBot);
    if (prodTop > 0 || prodBot > 0) {
      return remTop <= 0 && remBot <= 0;
    }
    return Math.max(0, Math.floor(Number(op.remainingQty) || 0)) <= 0;
  }

  /** 수동입력 옵션 → 주문 시트 1행 (반제품 행은 sheetRow·주문번호로 부모 행 매칭) */
  function _smtOrderLineForManualOption_(op) {
    op = op || {};
    var oNum = String(op.orderNumber || '').trim();
    if (!oNum) return null;
    var sr = op.sheetRow != null ? Math.floor(Number(op.sheetRow)) : 0;
    var orders = getOrders() || [];
    var i;
    if (sr >= 2) {
      for (i = 0; i < orders.length; i++) {
        var O = orders[i] || {};
        if (String(O.orderNumber || '').trim() !== oNum) continue;
        if (Math.floor(Number(O.sheetRow) || 0) === sr) return O;
      }
    }
    var pnm = String(op.productName || '').trim();
    return _smtFindOrderForManualEntry_(oNum, pnm, op.version, sr);
  }

  /** 출고(출하) 완료된 주문 행 — 생산등록 드롭다운에서만 제외 */
  function _smtManualOptionIsShippedOut_(op, shipMap) {
    var ord = _smtOrderLineForManualOption_(op);
    if (!ord) return false;
    return _isOrderLineFullyShipped_(ord, shipMap);
  }

  /** 시트에 코드로 저장된 옛 행 + 제품명 신규 행 모두 집계 (면 혼동 방지) */
  function _smtCumFromLookupForSheetModel_(cumLookup, orderNo, displayName, semiCode, pcbSide, version) {
    cumLookup = cumLookup && cumLookup.get ? cumLookup : null;
    if (!cumLookup) return 0;
    var on = String(orderNo || '').trim();
    if (!on) return 0;
    var sc = String(semiCode != null ? semiCode : '').trim();
    var ui = _smtSemiOptionUiText_(displayName, sc);
    var sideTok = _smtPcbSideToken_(pcbSide);
    var plainLbl = _smtSheetModelLabel_(displayName, sc, '', version);
    var labels = [plainLbl];
    var li;
    var legacyPlain = _smtBuildProductLabel_(ui, '', version);
    if (legacyPlain && labels.indexOf(legacyPlain) < 0) labels.push(legacyPlain);
    if (sideTok) {
      var legacySide = _smtBuildProductLabel_(ui, pcbSide, version);
      if (legacySide && labels.indexOf(legacySide) < 0) labels.push(legacySide);
    }
    if (ui === '반제품' && sc) {
      var scLbl = _smtBuildProductLabel_(sc, sideTok ? pcbSide : '', version);
      if (scLbl && labels.indexOf(scLbl) < 0) labels.push(scLbl);
    }
    if (sc && ui !== sc) {
      var scLbl2 = _smtBuildProductLabel_(sc, sideTok ? pcbSide : '', version);
      if (scLbl2 && labels.indexOf(scLbl2) < 0) labels.push(scLbl2);
    }
    var n = 0;
    for (li = 0; li < labels.length; li++) {
      n = Math.max(n, cumLookup.get(on, labels[li], pcbSide));
    }
    return n;
  }

  /** SMT 제품 선택 UI — BOM 반제품명 우선, 없으면 반제품코드(MAIN 등) 사용 */
  function _smtSemiOptionUiText_(displayName, semiCode) {
    var dn = displayName != null ? String(displayName).trim() : '';
    var sc = semiCode != null ? String(semiCode).trim() : '';
    if (dn) return dn;
    if (sc) return sc;
    return '반제품';
  }

  /**
   * 주문+모델라벨 누적 조회 — getSmtManualEntryOptions 대량 루프용 (qtyMap 1회 스캔)
   */
  function _smtBuildOrderProductCumLookup_(qtyMap) {
    var map = _smtFilterQtyMapForSmtLines_(qtyMap || {});
    var maxBy = {};
    var keys = Object.keys(map);
    var ki;
    for (ki = 0; ki < keys.length; ki++) {
      var key = keys[ki];
      var parts = String(key).split('\x1f');
      if (parts.length < 3) continue;
      var on = String(parts[1]).trim();
      var pl = String(parts[2]).trim();
      if (!on) continue;
      var side = parts.length >= 4 ? _smtNormalizePcbSideUi_(parts[3]) : 'SINGLE';
      if (parts.length < 4 && pl) {
        var normLegacy = _smtNormalizeSheetModelAndSide_(pl, 'SINGLE');
        if (normLegacy.side !== 'SINGLE') {
          side = normLegacy.side;
          pl = normLegacy.model;
        }
      }
      var k2 = on + '\x1f' + pl + '\x1f' + side;
      var ent = map[key];
      var c = ent && isFinite(Number(ent.cumulativeQty)) ? Number(ent.cumulativeQty) : 0;
      c = Math.max(0, Math.floor(c));
      if (c > (maxBy[k2] || 0)) maxBy[k2] = c;
      var kLegacy = on + '\x1f' + String(parts[2]).trim();
      if (kLegacy !== k2 && c > (maxBy[kLegacy] || 0)) maxBy[kLegacy] = c;
    }
    var activeBy = {};
    var props = PropertiesService.getScriptProperties();
    var ln;
    for (ln = SMT_PRODUCTION_LINE_MIN; ln <= SMT_PRODUCTION_LINE_MAX; ln++) {
      var raw = props.getProperty(_smtLineStateKey(ln));
      if (!raw) continue;
      try {
        var st = JSON.parse(raw);
        var on2 = String(st.manualOrderNumber || '').trim();
        if (!on2) continue;
        var pl2 = _smtExpectedModelFromLineState_(st);
        if (!pl2) continue;
        var side2 = _smtNormalizePcbSideUi_(st.manualOrderSide);
        var k3 = on2 + '\x1f' + pl2 + '\x1f' + side2;
        var ent2 = map[_smtQtyMapKey_(ln, on2, pl2, 0, side2)];
        if (!ent2) ent2 = map[_smtQtyMapKey_(ln, on2, pl2, 0)];
        if (!ent2 && side2 !== 'SINGLE') {
          ent2 = map[_smtQtyMapKey_(ln, on2, _smtBuildProductLabel_(pl2, st.manualOrderSide, ''), 0)];
        }
        var c2 = ent2 && isFinite(Number(ent2.cumulativeQty)) ? Number(ent2.cumulativeQty) : 0;
        activeBy[k3] = (activeBy[k3] || 0) + Math.max(0, Math.floor(c2));
      } catch (eAct) {}
    }
    return {
      get: function (orderNo, productLabel, pcbSide) {
        var onG = String(orderNo || '').trim();
        var plG = String(productLabel || '').trim();
        if (!onG) return 0;
        var sideG = _smtNormalizePcbSideUi_(pcbSide);
        var candidates = [onG + '\x1f' + plG + '\x1f' + sideG, onG + '\x1f' + plG];
        if (sideG === 'TOP' || sideG === 'BOT') {
          candidates.push(onG + '\x1f' + plG + ' ' + sideG);
          candidates.push(onG + '\x1f' + _smtBuildProductLabel_(plG, pcbSide, ''));
        }
        var best = 0;
        var ci;
        for (ci = 0; ci < candidates.length; ci++) {
          var ck = candidates[ci];
          if ((activeBy[ck] || 0) > best) best = activeBy[ck];
          if ((maxBy[ck] || 0) > best) best = maxBy[ck];
        }
        return best;
      }
    };
  }

  function _smtRebuildManualOptionLabel_(op) {
    op = op || {};
    var cust = op.customer != null ? String(op.customer).trim() : '';
    var oNum = op.orderNumber != null ? String(op.orderNumber).trim() : '';
    var pnm =
      op.productDisplayName != null && String(op.productDisplayName).trim()
        ? String(op.productDisplayName).trim()
        : op.productName != null
          ? String(op.productName).trim()
          : '';
    var vv = op.version != null ? String(op.version).trim() : '';
    var label = (cust || '—') + ' · ' + oNum + ' · ' + pnm;
    if (vv) label += ' v' + vv;
    if (op.pickerSidesHint) label += String(op.pickerSidesHint);
    return label;
  }

  function _buildSmtManualEntryOptions_() {
    function _fmtSmtOptionVersion_(ver) {
      var raw = ver != null ? String(ver).trim() : '';
      if (!raw) return '';
      return ' v' + raw;
    }
    var orders = getOrders() || [];
    var qtyMap = _smtBuildQtySummaryMap_() || {};
    var cumLookup = _smtBuildOrderProductCumLookup_(qtyMap);
    var shipMap = {};
    try {
      shipMap = _getCachedProductionMaps_().shipMap || {};
    } catch (eShip0) {
      shipMap = getOrderShipmentCountsMap_() || {};
    }
    var collectCtx = _smtBuildSemiCollectContext_();
    var semiPlanByKey = {};
    var rows = [];
    var i;
    for (i = 0; i < orders.length; i++) {
      var O = orders[i] || {};
      if (_isOrderLineFullyShipped_(O, shipMap)) continue;
      var oNum = O.orderNumber != null ? String(O.orderNumber).trim() : '';
      if (!oNum) continue;
      var parentPnm = O.productName != null ? String(O.productName).trim() : '';
      if (!parentPnm) continue;
      var vv = O.version != null ? String(O.version).trim() : '';
      var cust = O.customer != null ? String(O.customer).trim() : '';
      var qty = Number(O.quantity) || 0;
      var parentSheetRow = O.sheetRow != null ? Math.floor(Number(O.sheetRow)) : 0;
      var productCode = O.productCode != null ? String(O.productCode).trim() : '';
      var semiKey = (productCode || parentPnm) + '\x1f' + vv;
      var semiPlan = semiPlanByKey[semiKey];
      if (!semiPlan) {
        semiPlan = _smtCollectSemiMapForOrder_(O, collectCtx);
        semiPlanByKey[semiKey] = semiPlan;
      }
      var semiKeys = semiPlan.semiCodes || [];
      if (semiKeys.length) {
        var sk;
        for (sk = 0; sk < semiKeys.length; sk++) {
          var semiCode = semiKeys[sk];
          var semiEnt = (semiPlan.semiMap || {})[semiCode] || {};
          var semiUi = _smtSemiOptionUiText_(semiEnt.displayName, semiCode);
          var cumSingle = _smtCumFromLookupForSheetModel_(cumLookup, oNum, semiEnt.displayName, semiCode, '', vv);
          var cumTop = _smtCumFromLookupForSheetModel_(cumLookup, oNum, semiEnt.displayName, semiCode, 'TOP', vv);
          var cumBot = _smtCumFromLookupForSheetModel_(cumLookup, oNum, semiEnt.displayName, semiCode, 'BOT', vv);
          var rowSemi = {
            orderNumber: oNum,
            customer: cust,
            productName: semiCode,
            productDisplayName: semiUi,
            pcbSide: '',
            version: vv,
            sheetRow: parentSheetRow,
            orderQty: qty,
            producedQty: cumSingle,
            producedQtyTop: cumTop,
            producedQtyBot: cumBot,
            remainingQty: Math.max(0, Math.floor(qty) - cumSingle),
            remainingQtyTop: Math.max(0, Math.floor(qty) - cumTop),
            remainingQtyBot: Math.max(0, Math.floor(qty) - cumBot),
            label: _smtRebuildManualOptionLabel_({
              customer: cust,
              orderNumber: oNum,
              productDisplayName: semiUi,
              productName: semiCode,
              version: vv
            })
          };
          if (!_smtManualOptionIsShippedOut_(rowSemi, shipMap)) rows.push(rowSemi);
        }
      } else {
        var cumP0 = _smtCumFromLookupForSheetModel_(cumLookup, oNum, parentPnm, parentPnm, '', vv);
        var cumP1 = _smtCumFromLookupForSheetModel_(cumLookup, oNum, parentPnm, parentPnm, 'TOP', vv);
        var cumP2 = _smtCumFromLookupForSheetModel_(cumLookup, oNum, parentPnm, parentPnm, 'BOT', vv);
        var rowParent = {
          orderNumber: oNum,
          customer: cust,
          productName: parentPnm,
          version: vv,
          sheetRow: parentSheetRow,
          orderQty: qty,
          producedQty: cumP0,
          producedQtyTop: cumP1,
          producedQtyBot: cumP2,
          remainingQty: Math.max(0, Math.floor(qty) - cumP0),
          remainingQtyTop: Math.max(0, Math.floor(qty) - cumP1),
          remainingQtyBot: Math.max(0, Math.floor(qty) - cumP2),
          label: _smtRebuildManualOptionLabel_({
            customer: cust,
            orderNumber: oNum,
            productDisplayName: parentPnm,
            productName: parentPnm,
            version: vv
          })
        };
        if (!_smtManualOptionIsShippedOut_(rowParent, shipMap)) rows.push(rowParent);
      }
    }
    rows.sort(function (a, b) {
      return String(b.orderNumber).localeCompare(String(a.orderNumber), undefined, { numeric: true });
    });
    return rows;
  }

  /** 캐시된 주문 제품 목록 — SMT 생산기록 기준 잔량·진행색만 갱신(BOM·주문 전체 재조회 생략) */
  function _refreshSmtManualOptionRemainders_(options) {
    options = Array.isArray(options) ? options : [];
    if (!options.length) return options;
    var qtyMap = _smtBuildQtySummaryMap_() || {};
    var cumLookup = _smtBuildOrderProductCumLookup_(qtyMap);
    var shipMap = {};
    try {
      shipMap = _getCachedProductionMaps_().shipMap || {};
    } catch (eShipR0) {
      shipMap = getOrderShipmentCountsMap_() || {};
    }
    var out = [];
    var i;
    for (i = 0; i < options.length; i++) {
      var op = options[i] || {};
      var oNum = String(op.orderNumber || '').trim();
      var semiCode = String(op.productName || '').trim();
      var displayName =
        op.productDisplayName != null ? String(op.productDisplayName).trim() : semiCode;
      var vv = op.version != null ? String(op.version).trim() : '';
      var cust = op.customer != null ? String(op.customer).trim() : '';
      var qty = Math.max(0, Math.floor(Number(op.orderQty) || Number(op.quantity) || 0));
      var sheetRowRef = op.sheetRow != null ? Math.floor(Number(op.sheetRow)) : 0;
      if ((!cust || qty <= 0) && oNum && semiCode) {
        var ordRef = _smtFindOrderForManualEntry_(oNum, semiCode, vv, sheetRowRef);
        if (ordRef) {
          if (!cust) cust = ordRef.customer != null ? String(ordRef.customer).trim() : '';
          if (qty <= 0) qty = Math.max(0, Math.floor(Number(ordRef.quantity) || 0));
        }
      }
      var cumSingle = _smtCumFromLookupForSheetModel_(cumLookup, oNum, displayName, semiCode, '', vv);
      var cumTop = _smtCumFromLookupForSheetModel_(cumLookup, oNum, displayName, semiCode, 'TOP', vv);
      var cumBot = _smtCumFromLookupForSheetModel_(cumLookup, oNum, displayName, semiCode, 'BOT', vv);
      var rowRef = {
        orderNumber: oNum,
        customer: cust,
        productName: semiCode,
        productDisplayName: displayName,
        pcbSide: op.pcbSide != null ? String(op.pcbSide) : '',
        version: vv,
        sheetRow: sheetRowRef,
        orderQty: qty,
        producedQty: cumSingle,
        producedQtyTop: cumTop,
        producedQtyBot: cumBot,
        remainingQty: Math.max(0, qty - cumSingle),
        remainingQtyTop: Math.max(0, qty - cumTop),
        remainingQtyBot: Math.max(0, qty - cumBot),
        pickerSidesHint: op.pickerSidesHint != null ? op.pickerSidesHint : '',
        label: ''
      };
      rowRef.label = _smtRebuildManualOptionLabel_(rowRef);
      if (!_smtManualOptionIsShippedOut_(rowRef, shipMap)) out.push(rowRef);
    }
    return out;
  }

  function _storeSmtManualOptionsCache_(rows) {
    rows = Array.isArray(rows) ? rows : [];
    __smtManualOptionsCache_ = { options: rows, loadedAt: Date.now() };
    try {
      var json = JSON.stringify({ options: rows });
      if (json.length <= 95000) {
        CacheService.getScriptCache().put(
          SMT_MANUAL_OPTIONS_CACHE_SCRIPT_KEY,
          json,
          SMT_MANUAL_OPTIONS_CACHE_TTL_SEC
        );
      }
    } catch (ePut) {}
  }

  /**
   * SMT 수동 입력용 — 주문서 제품(행) 전체 목록
   * @return {{ok:boolean, options?:Array, error?:string}}
   */
  function getSmtManualEntryOptions() {
    try {
      var syncPkg = _maybeSyncSmtLinesFromPlan_();
      var baseOpts = null;
      if (
        __smtManualOptionsCache_ &&
        __smtManualOptionsCache_.options &&
        Date.now() - __smtManualOptionsCache_.loadedAt < SMT_MANUAL_OPTIONS_CACHE_TTL_SEC * 1000
      ) {
        baseOpts = __smtManualOptionsCache_.options;
      }
      if (!baseOpts) {
        try {
          var cached = CacheService.getScriptCache().get(SMT_MANUAL_OPTIONS_CACHE_SCRIPT_KEY);
          if (cached) {
            var parsed = JSON.parse(cached);
            if (parsed && Array.isArray(parsed.options) && parsed.options.length) {
              baseOpts = parsed.options;
            }
          }
        } catch (eCache) {}
      }
      if (baseOpts && baseOpts.length) {
        var refreshed = _refreshSmtManualOptionRemainders_(baseOpts);
        _storeSmtManualOptionsCache_(refreshed);
        return {
          ok: true,
          options: refreshed,
          linePlans: syncPkg && syncPkg.linePlans ? syncPkg.linePlans : {},
          planDate: syncPkg && syncPkg.dateYmd ? syncPkg.dateYmd : ''
        };
      }
      var rows = _buildSmtManualEntryOptions_();
      _storeSmtManualOptionsCache_(rows);
      return {
        ok: true,
        options: rows,
        linePlans: syncPkg && syncPkg.linePlans ? syncPkg.linePlans : {},
        planDate: syncPkg && syncPkg.dateYmd ? syncPkg.dateYmd : ''
      };
    } catch (err) {
      Logger.log('getSmtManualEntryOptions 오류: ' + err.toString());
      return { ok: false, error: err.message || String(err) };
    }
  }

  /**
   * 주문서·제품·누적수량 수동 등록 — 노후 라인 등 장비 연동 없이 입력
   * @param {number|string} lineNo 1~7
   * @param {{orderNumber?:string,productName?:string,version?:string,cumulativeQty?:number}} entry
   * @return {{ok:boolean, lineNo?:number, error?:string}}
   */
  function _smtManualOrderProductKey_(orderNumber, productName, version, sheetRow, pcbSide) {
    var sr =
      sheetRow != null && !isNaN(Number(sheetRow)) && Number(sheetRow) >= 2
        ? String(Math.floor(Number(sheetRow)))
        : '0';
    return (
      String(orderNumber || '').trim() +
      '\x1f' +
      String(productName || '').trim() +
      '\x1f' +
      String(version || '').trim() +
      '\x1f' +
      sr +
      '\x1f' +
      _smtPcbSideToken_(pcbSide)
    );
  }

  function _smtFindOrderForManualEntry_(orderNumber, productName, version, sheetRow) {
    var ordNo = orderNumber != null ? String(orderNumber).trim() : '';
    var pnm = productName != null ? String(productName).trim() : '';
    var ver = version != null ? String(version).trim() : '';
    var sr = sheetRow != null && !isNaN(Number(sheetRow)) ? Math.floor(Number(sheetRow)) : 0;
    if (!ordNo || !pnm) return null;
    var orders = getOrders() || [];
    var i;
    if (sr >= 2) {
      for (i = 0; i < orders.length; i++) {
        var O = orders[i] || {};
        if (String(O.orderNumber || '').trim() !== ordNo) continue;
        if (Math.floor(Number(O.sheetRow) || 0) !== sr) continue;
        if (String(O.productName || '').trim() !== pnm) continue;
        var vv = String(O.version || '').trim();
        if (ver && vv !== ver) continue;
        return O;
      }
    }
    for (i = 0; i < orders.length; i++) {
      var O2 = orders[i] || {};
      if (String(O2.orderNumber || '').trim() !== ordNo) continue;
      if (String(O2.productName || '').trim() !== pnm) continue;
      var vv2 = String(O2.version || '').trim();
      if (ver && vv2 !== ver) continue;
      return O2;
    }
    return null;
  }

  /** 수동 라인(1~7 속성)에 이미 배정된 주문·제품 행 — excludeLineNo 제외 */
  function _smtFindManualLineUsingOrderProduct_(orderNumber, productName, version, sheetRow, pcbSide, excludeLineNo) {
    var ordNo = orderNumber != null ? String(orderNumber).trim() : '';
    var pnm = productName != null ? String(productName).trim() : '';
    var ver = version != null ? String(version).trim() : '';
    var side = _smtPcbSideToken_(pcbSide);
    if (!ordNo || !pnm) return 0;
    var wantKey = _smtManualOrderProductKey_(ordNo, pnm, ver, sheetRow, side);
    var props = PropertiesService.getScriptProperties();
    for (var i = 1; i <= 7; i++) {
      if (excludeLineNo && Number(excludeLineNo) === i) continue;
      var raw = props.getProperty(_smtLineStateKey(i));
      if (!raw) continue;
      try {
        var st = JSON.parse(raw);
        var o = st.manualOrderNumber != null ? String(st.manualOrderNumber).trim() : '';
        var p = st.manualProductName != null ? String(st.manualProductName).trim() : '';
        var v = st.manualVersion != null ? String(st.manualVersion).trim() : '';
        var sr = st.manualSheetRow != null ? Math.floor(Number(st.manualSheetRow)) : 0;
        var stSide = st.manualOrderSide != null ? String(st.manualOrderSide).trim() : '';
        if (!o || !p) continue;
        if (_smtManualOrderProductKey_(o, p, v, sr, stSide) === wantKey) return i;
      } catch (e0) {}
    }
    return 0;
  }

  function setSmtLineManualEntry(lineNo, entry) {
    try {
      var no = parseInt(lineNo, 10);
      if (isNaN(no) || no < 1 || no > 7) {
        return { ok: false, error: 'lineNo must be 1-7' };
      }
      entry = entry && typeof entry === 'object' ? entry : {};
      var ordNo = entry.orderNumber != null ? String(entry.orderNumber).trim() : '';
      if (!ordNo) {
        setSmtLineManualOrder(no, '');
        return { ok: true, lineNo: no, manualOrderNumber: '' };
      }
      var productName = entry.productName != null ? String(entry.productName).trim() : '';
      var version = entry.version != null ? String(entry.version).trim() : '';
      var sheetRow =
        entry.sheetRow != null && entry.sheetRow !== '' && !isNaN(Number(entry.sheetRow))
          ? Math.floor(Number(entry.sheetRow))
          : 0;
      var sidePick = _smtParseManualPcbSideChoice_(entry.pcbSide != null ? entry.pcbSide : entry.side);
      if (!sidePick.ok) {
        return { ok: false, error: sidePick.error };
      }
      var pcbSide = sidePick.side;
      if (!productName) {
        return { ok: false, error: '제품명을 선택하세요.' };
      }

      var dupLine = _smtFindManualLineUsingOrderProduct_(ordNo, productName, version, sheetRow, pcbSide, no);
      if (dupLine > 0) {
        return {
          ok: false,
          error:
            '주문 ' +
            ordNo +
            ' · ' +
            productName +
            (pcbSide ? ' ' + pcbSide : '') +
            (version ? ' v' + version : '') +
            (sheetRow >= 2 ? ' (#행' + sheetRow + ')' : '') +
            ' 은(는) 이미 라인 ' +
            dupLine +
            '에 배정되어 있습니다.'
        };
      }

      var match = _smtFindOrderForManualEntry_(ordNo, productName, version, sheetRow);
      var semiDisplayName = '';
      var semiNameByCode = {};
      try {
        var mats0 = getMaterials() || [];
        for (var mm0 = 0; mm0 < mats0.length; mm0++) {
          var m0 = mats0[mm0] || {};
          var mc0 = m0.materialCode != null ? String(m0.materialCode).trim() : '';
          var mn0 = m0.materialName != null ? String(m0.materialName).trim() : '';
          if (!mc0 || !mn0) continue;
          if (!semiNameByCode[mc0]) semiNameByCode[mc0] = mn0;
        }
      } catch (eMat0) {}
      if (!match) {
        // BOM 기준: 주문서의 "완제품"이지만, SMT 화면에서는 반제품(semi code)을 선택할 수 있음
        // entry.productName(=semi code)로부터 부모 주문행(완제품)을 찾아 매칭합니다.
        try {
          var bomSheetData = _readProductBomSheetData_();
          if (bomSheetData) {
            var ordersAll = getOrders() || [];
            for (var i2 = 0; i2 < ordersAll.length; i2++) {
              var O2 = ordersAll[i2] || {};
              if (String(O2.orderNumber || '').trim() !== ordNo) continue;
              if (sheetRow >= 2) {
                var sr2 = O2.sheetRow != null ? Math.floor(Number(O2.sheetRow)) : 0;
                if (sr2 !== sheetRow) continue;
              }
              var vv2 = O2.version != null ? String(O2.version).trim() : '';
              if (version && vv2 !== version) continue;
              var parentCode = O2.productCode != null ? String(O2.productCode).trim() : '';
              if (!parentCode) parentCode = O2.productName != null ? String(O2.productName).trim() : '';
              if (!parentCode) continue;
              var bomLines2 = _collectBomLinesForProduct_(bomSheetData, parentCode, version || vv2);
              if (!bomLines2.length && (version || vv2)) {
                bomLines2 = _collectBomLinesForProduct_(bomSheetData, parentCode, '');
              }
              for (var bi2 = 0; bi2 < bomLines2.length; bi2++) {
                var bl2 = bomLines2[bi2] || {};
                var semi2 = bl2.semi != null ? String(bl2.semi).trim() : '';
                if (!semi2) continue;
                if (semi2 !== productName) continue;
                match = O2;
                var blSemiName = bl2.semiName != null ? String(bl2.semiName).trim() : '';
                var blBomName = bl2.bomName != null ? String(bl2.bomName).trim() : '';
                semiDisplayName = _resolveSemiDisplayNameFromBom_(
                  bomSheetData,
                  semi2,
                  semiNameByCode[semi2] || blSemiName || blBomName
                );
                break;
              }
              if (match) break;
            }
          }
        } catch (bomFindErr) {}
      }
      if (!match) {
        return { ok: false, error: '주문서에서 해당 제품을 찾을 수 없습니다.' };
      }

      var semiCode = productName;
      var collectCtxEntry = _smtBuildSemiCollectContext_();
      var semiPlanFinal = _smtCollectSemiMapForOrder_(match, collectCtxEntry);
      var semiEntFinal = (semiPlanFinal.semiMap || {})[semiCode] || {};
      if (!semiDisplayName && semiEntFinal.displayName) {
        semiDisplayName = String(semiEntFinal.displayName).trim();
      }

      var props = PropertiesService.getScriptProperties();
      var key = _smtLineStateKey(no);
      var prev = {};
      try {
        var rawPrev = props.getProperty(key);
        if (rawPrev) prev = JSON.parse(rawPrev);
      } catch (e0) {
        prev = {};
      }
      var cust = match.customer != null ? String(match.customer).trim() : '';
      var parentPnm = String(match.productName || '').trim();
      var vv2 = match.version != null ? String(match.version).trim() : '';
      var displayPnm = _smtSemiOptionUiText_(semiDisplayName, semiCode);
      var sheetModelLabel = _smtSheetModelLabel_(semiDisplayName, semiCode, pcbSide, vv2);
      var sideUi = ' ' + _smtManualSideUiLabel_(pcbSide);

      var st = _smtCloneLineStateJson_(prev);
      st.manualOrderNumber = ordNo;
      st.manualOrderLabel =
        ordNo + ' · ' + (cust || '—') + ' · ' + displayPnm + sideUi + (vv2 ? ' v' + vv2 : '');
      st.manualOrderUpdatedAt = new Date().toISOString();
      st.manualProductName = semiCode;
      st.manualProductDisplayName = displayPnm + sideUi;
      st.manualOrderSide = pcbSide;
      st.manualVersion = vv2;
      st.manualSheetRow = match.sheetRow != null ? Math.floor(Number(match.sheetRow)) : 0;
      delete st.smtRegHoldEmptyYmd;
      delete st.manualLotNumber;
      delete st.manualLotLabel;
      delete st.manualLotUpdatedAt;
      st.currentPcb = sheetModelLabel;
      st.productionSessionProduct = semiCode;
      st.updatedAt = new Date().toISOString();

      var cumIn = entry.cumulativeQty != null && entry.cumulativeQty !== '' ? Number(entry.cumulativeQty) : NaN;
      if (isFinite(cumIn) && cumIn >= 0) {
        var maxQty = Math.max(0, Math.floor(Number(match.quantity) || 0));
        var nextCum = Math.max(0, Math.floor(cumIn));
        if (nextCum > maxQty) {
          return { ok: false, error: '누적 수량은 총 수량(' + maxQty + ')을 초과할 수 없습니다.' };
        }
        st.pcbCount = nextCum;
        st.manualCumulativeQty = nextCum;
        st.manualQtyUpdatedAt = new Date().toISOString();
      }

      props.setProperty(key, JSON.stringify(st));
      var hasCumInput = entry.cumulativeQty != null && entry.cumulativeQty !== '';
      if (hasCumInput) {
        _syncSmtProductionRecordOnPost_(no, prev, st, { forceWrite: true });
      }
      invalidateSmtProductionQtyCaches_();

      return { ok: true, lineNo: no, manualOrderNumber: ordNo, productName: semiCode };
    } catch (err) {
      Logger.log('setSmtLineManualEntry 오류: ' + err.toString());
      return { ok: false, error: err.message || String(err) };
    }
  }

  /**
   * 생산등록 카드 — 배정·누적·해제를 한 번에 처리
   * @param {number|string} lineNo
   * @param {{orderNumber:string,productName:string,pcbSide?:string,version?:string,sheetRow?:number,cumulativeQty?:number,clearAfterSave?:boolean}} entry
   */
  function saveSmtInputLineComplete(lineNo, entry) {
    try {
      entry = entry && typeof entry === 'object' ? entry : {};
      var saveRes = setSmtLineManualEntry(lineNo, {
        orderNumber: entry.orderNumber,
        productName: entry.productName,
        pcbSide: entry.pcbSide != null ? entry.pcbSide : entry.side,
        version: entry.version,
        sheetRow: entry.sheetRow,
        cumulativeQty: entry.cumulativeQty
      });
      if (!saveRes || !saveRes.ok) return saveRes;
      if (entry.clearAfterSave === true) {
        var clearRes = setSmtLineManualEntry(lineNo, { orderNumber: '' });
        if (clearRes && clearRes.ok && entry.planTargetComplete === true) {
          _smtSetLineRegHoldEmpty_(lineNo, true);
        }
        return clearRes;
      }
      return saveRes;
    } catch (err) {
      Logger.log('saveSmtInputLineComplete 오류: ' + err.toString());
      return { ok: false, error: err.message || String(err) };
    }
  }

  /**
   * 주문 시트 1행 = 생산입력·후공정·대시보드 구분용 라벨 (동일 제품코드·다른 수량/단가 행 분리)
   */
  function _orderCountProductLabel_(ord) {
    ord = ord && typeof ord === 'object' ? ord : {};
    var pn = String(ord.productName != null ? ord.productName : '').trim();
    var vv = String(ord.version != null ? ord.version : '').trim();
    var base = pn + (vv ? ' ' + vv : '');
    var code = String(ord.productCode != null ? ord.productCode : '').trim();
    var qty = Math.floor(Number(ord.quantity) || 0);
    var up = Number(ord.unitPrice);
    var upStr = isFinite(up) ? String(Math.round(up)) : '0';
    var parts = [];
    if (base) parts.push(base);
    else if (code) parts.push(code);
    if (code && base) parts.push('[' + code + ']');
    parts.push('수량' + qty);
    parts.push('단가' + upStr);
    var sr = ord.sheetRow != null ? Number(ord.sheetRow) : 0;
    if (sr >= 2) parts.push('#행' + Math.floor(sr));
    return parts.join(' · ');
  }

  /** SMT 생산입력·시트 모델용 (제품명 + 버전만) */
  function _smtOrderCountKey_(ord) {
    ord = ord && typeof ord === 'object' ? ord : {};
    var on = String(ord.orderNumber != null ? ord.orderNumber : '').trim();
    var model = _smtOrderProductLabel_(ord);
    var sr = ord.sheetRow != null ? Number(ord.sheetRow) : 0;
    if (!on) return '';
    return model + '\x1e' + (sr >= 2 ? String(Math.floor(sr)) : '0');
  }

  /** getOrders() 반환 객체에 sheetRow·countKey·uiKey 부여 */
  function _enrichOrderLineMeta_(order, sheetRow, lineSeqOnOrder) {
    if (!order || typeof order !== 'object') return order;
    order.sheetRow = sheetRow;
    order.orderLineSeq = lineSeqOnOrder;
    order._countProductLabel = _orderCountProductLabel_(order);
    order._smtSheetModel = _smtOrderProductLabel_(order);
    var on = String(order.orderNumber != null ? order.orderNumber : '').trim();
    order._countKey = on ? on + '\x1f' + order._countProductLabel : '';
    order._smtCountKey = on ? on + '\x1f' + _smtOrderCountKey_(order) : '';
    order._uiKey = on + '\x1e' + String(sheetRow) + '\x1e' + String(lineSeqOnOrder);
    return order;
  }

  function _smtOrderProductLabel_(ord) {
    ord = ord && typeof ord === 'object' ? ord : {};
    var pn = ord.productName != null ? String(ord.productName).trim() : '';
    var vv = ord.version != null ? String(ord.version).trim() : '';
    return pn + (vv ? ' ' + vv : '');
  }

  /** SMT생산기록 qtyMap 키 — 면구분은 4번째 필드(없으면 SINGLE). 옛 3필드 키는 읽기 호환 */
  function _smtQtyMapKey_(lineNo, orderNo, sheetModel, totalQty, pcbSide) {
    var parts = [
      String(lineNo),
      String(orderNo != null ? orderNo : '').trim(),
      String(sheetModel != null ? sheetModel : '').trim()
    ];
    if (pcbSide != null && String(pcbSide).trim() !== '') {
      parts.push(_smtNormalizePcbSideUi_(pcbSide));
    }
    return parts.join('\x1f');
  }

  /**
   * SMT생산기록 시트 — 최근 행 조회 (최신순)
   * @param {number=} optMaxRows 기본 200
   * @return {{ok:boolean, rows?:Array, error?:string}}
   */
  function getSmtProductionWorkLog(optMaxRows) {
    try {
      var maxR = optMaxRows > 0 ? Math.floor(optMaxRows) : 200;
      var sheet = _getOrCreateSmtProductionRecordSheet_();
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return { ok: true, rows: [] };
      var hm = _getSmtProductionRecordHeaderMap_(sheet);
      var width = Math.max(hm.width || 6, 6);
      var values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
      var rows = [];
      var i;
      for (i = values.length - 1; i >= 0 && rows.length < maxR; i--) {
        var r = values[i] || [];
        var recordDate = hm.date >= 0 ? _smtSheetCellToYmdKst_(r[hm.date]) : '';
        var lineRaw = hm.line >= 0 ? r[hm.line] : '';
        var lineNo = lineRaw === '' || lineRaw == null ? '' : lineRaw;
        var orderNumber = hm.orderNo >= 0 ? String(r[hm.orderNo] || '').trim() : '';
        var model = hm.model >= 0 ? String(r[hm.model] || '').trim() : '';
        var pcbSide = hm.pcbSide >= 0 ? _smtNormalizePcbSideUi_(r[hm.pcbSide]) : '';
        var qty = hm.qty >= 0 ? _smtQtyCellForRecord_(r[hm.qty]) : '';
        if (!recordDate && !orderNumber && !model && qty === '') continue;
        rows.push({
          recordDate: recordDate,
          lineNo: lineNo,
          orderNumber: orderNumber,
          model: model,
          pcbSide: pcbSide,
          qty: qty
        });
      }
      return { ok: true, rows: rows };
    } catch (e) {
      Logger.log('getSmtProductionWorkLog 오류: ' + e.toString());
      return { ok: false, error: e.message || String(e), rows: [] };
    }
  }

  /**
   * 편집기에서 이 함수만 선택 후 실행 → 상단 메뉴 「보기」→「로그」(또는 Ctrl+Enter)로 smtLines JSON 확인
   */
  function debugLogProductionStatusSnapshot() {
    var r = getProductionStatusSnapshot();
    Logger.log(JSON.stringify(r, null, 2));
  }

  /**
   * 스크립트 속성 SMT_LINE_STATE_1…7 원문 확인 (POST가 이 프로젝트에 들어왔는지 판별)
   */
  function debugReadSmtLineProperties() {
    var p = PropertiesService.getScriptProperties();
    for (var i = 1; i <= 7; i++) {
      var k = _smtLineStateKey(i);
      var v = p.getProperty(k);
      Logger.log(k + ' => ' + (v ? v.substring(0, 200) + (v.length > 200 ? '...' : '') : '(없음)'));
    }
  }

  /**
   * 라인 상태 JSON 복사 (동기화 시 기존 브릿지 필드 유지)
   * @param {Object} obj
   * @return {Object}
   */
  function _smtCloneLineStateJson_(obj) {
    try {
      return JSON.parse(JSON.stringify(obj && typeof obj === 'object' ? obj : {}));
    } catch (e) {
      return {};
    }
  }

  /**
   * 지금 화면과 동일한 getProductionStatusSnapshot() 기준으로 SMT생산기록 시트를 한 번 맞춥니다.
   * - Apps Script 편집기에서 이 함수 선택 → 실행(▶)
   * - 주문서가 라인에 배정된 경우에만 기록 (미배정 라인은 건너뜀)
   * - 주문·제품·라인 같으면 해당 행 갱신, 다르면 새 행
   * - 각 SMT_LINE_STATE_* 속성에 smtRecordSessionKey / smtRecordRow 반영
   * @param {{forceWrite?:boolean, changedOnly?:boolean}=} options
   * @return {{ ok: boolean, synced?: Array<number>, skipped?: Array<number>, error?: string }}
   */
  function syncSmtProductionRecordFromLineStatusNow(options) {
    options = options && typeof options === 'object' ? options : {};
    var forceWrite = options.forceWrite === true;
    var changedOnly = options.changedOnly === true;
    var props = PropertiesService.getScriptProperties();
    var synced = [];
    var skipped = [];
    try {
      for (var lineNo = 1; lineNo <= 7; lineNo++) {
        var key = _smtLineStateKey(lineNo);
        var prev = {};
        try {
          var raw = props.getProperty(key);
          if (raw) prev = JSON.parse(raw);
        } catch (parseErr) {
          prev = {};
        }
        var next = _smtCloneLineStateJson_(prev);
        var fingerprintKey = _smtRecordSyncFingerprintKey_(lineNo);
        var nextFingerprint = _smtBuildRecordSyncFingerprint_(lineNo, next);
        var prevFingerprint = props.getProperty(fingerprintKey) || '';
        if (changedOnly && !forceWrite && nextFingerprint === prevFingerprint) {
          skipped.push(lineNo);
          continue;
        }
        var beforeSessionKey = next.smtRecordSessionKey != null ? String(next.smtRecordSessionKey) : '';
        var beforeRow = next.smtRecordRow != null ? String(next.smtRecordRow) : '';
        _syncSmtProductionRecordOnPost_(lineNo, prev, next, { forceWrite: forceWrite });
        var afterSessionKey = next.smtRecordSessionKey != null ? String(next.smtRecordSessionKey) : '';
        var afterRow = next.smtRecordRow != null ? String(next.smtRecordRow) : '';
        props.setProperty(key, JSON.stringify(next));
        props.setProperty(fingerprintKey, nextFingerprint);
        if (afterSessionKey || afterRow) {
          synced.push(lineNo);
        } else if (beforeSessionKey || beforeRow) {
          // 기존에 있던 세션키가 정리된 경우도 동기화 실행 대상으로 본다.
          synced.push(lineNo);
        } else {
          skipped.push(lineNo);
        }
      }
      return { ok: true, synced: synced, skipped: skipped };
    } catch (err) {
      Logger.log('syncSmtProductionRecordFromLineStatusNow 오류: ' + err.toString());
      return { ok: false, synced: synced, skipped: skipped, error: err.message || String(err) };
    }
  }

  function _smtRecordSyncFingerprintKey_(lineNo) {
    return 'SMT_RECORD_SYNC_FINGERPRINT_' + String(lineNo);
  }

  function _smtBuildRecordSyncFingerprint_(lineNo, state) {
    var st = state && typeof state === 'object' ? state : {};
    var orderNo = _smtResolveOrderNoForRecord_(st);
    var productLabel = _smtProductLabelForRecord_(st);
    var qtyNum = Number(st.pcbCount);
    var qty = isFinite(qtyNum) ? String(Math.max(0, Math.floor(qtyNum))) : '';
    return String(lineNo) + '\x1f' + String(orderNo || '') + '\x1f' + String(productLabel || '') + '\x1f' + qty;
  }

  function runSmtProductionRecordAutoSyncTick() {
    return syncSmtProductionRecordFromLineStatusNow({ forceWrite: false, changedOnly: true });
  }

  function installSmtProductionRecordAutoSyncEveryMinute() {
    var removed = removeSmtProductionRecordAutoSyncTrigger(true);
    ScriptApp.newTrigger('runSmtProductionRecordAutoSyncTick')
      .timeBased()
      .everyMinutes(1)
      .create();
    SpreadsheetApp.getUi().alert(
      '안내',
      'SMT생산기록 자동동기화(1분)가 설정되었습니다.\n기존 트리거 정리: ' + String(removed) + '건',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }

  function removeSmtProductionRecordAutoSyncTrigger(silent) {
    var n = 0;
    var all = ScriptApp.getProjectTriggers();
    for (var i = 0; i < all.length; i++) {
      var t = all[i];
      if (t.getHandlerFunction && t.getHandlerFunction() === 'runSmtProductionRecordAutoSyncTick') {
        ScriptApp.deleteTrigger(t);
        n++;
      }
    }
    if (!silent) {
      SpreadsheetApp.getUi().alert('안내', 'SMT생산기록 자동동기화 트리거 제거: ' + String(n) + '건', SpreadsheetApp.getUi().ButtonSet.OK);
    }
    return n;
  }

  /**
   * 브릿지 PC(또는 외부)에서 필터링된 Operate.log 요약을 라인별로 전송
   * POST 본문 JSON 예: { token, lineNo, currentPcb, pcbCount, hasWarning, logPreview, machineStatusCode?,
   *   productionStartAt?, productionStopAt?, productionSessionProduct? }
   * machineStatusCode: 로그 Machine status is changed : A -> B 의 마지막 B (1/2/5/9 등)
   * SMT생산기록: 주문서 배정 후에만 반영. 주문·제품·라인이 같으면 해당 행 수량·시간만 갱신
   * 스크립트 편집기 → 프로젝트 설정 → 스크립트 속성: SMT_LOG_INGEST_TOKEN
   */
  function doPost(e) {
    var jsonOut = function (obj) {
      return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
    };
    try {
      if (!e || !e.postData || !e.postData.contents) {
        return jsonOut({ ok: false, error: 'empty body' });
      }
      var props = PropertiesService.getScriptProperties();
      var expected = props.getProperty('SMT_LOG_INGEST_TOKEN');
      if (!expected || String(expected).trim() === '') {
        return jsonOut({ ok: false, error: 'SMT_LOG_INGEST_TOKEN not configured' });
      }
      var payload = JSON.parse(e.postData.contents);
      if (payload.token !== expected) {
        return jsonOut({ ok: false, error: 'unauthorized' });
      }
      var lineNo = parseInt(payload.lineNo, 10);
      if (isNaN(lineNo) || lineNo < 1 || lineNo > 7) {
        return jsonOut({ ok: false, error: 'lineNo must be 1-7' });
      }
      var key = _smtLineStateKey(lineNo);
      var prev = {};
      try {
        var prevRaw = props.getProperty(key);
        if (prevRaw) prev = JSON.parse(prevRaw);
      } catch (pe) {
        prev = {};
      }
      var preview = payload.logPreview != null ? String(payload.logPreview) : (prev.logPreview || '');
      if (preview.length > 8000) {
        preview = preview.substring(preview.length - 8000);
      }
      /** 이전 라인 JSON 전체를 유지한 뒤 덮어쓰기 — smtRecordSessionKey/smtRecordRow 등이 빠져 세션 행이 끊기는 것 방지 */
      var next = _smtCloneLineStateJson_(prev);
      next.updatedAt = new Date().toISOString();
      next.currentPcb =
        payload.currentPcb != null ? String(payload.currentPcb) : next.currentPcb != null ? String(next.currentPcb) : '';
      next.pcbCount = payload.pcbCount != null ? payload.pcbCount : next.pcbCount;
      next.hasWarning = payload.hasWarning === true || payload.hasWarning === 'true';
      next.logPreview = preview;
      if (payload.machineStatusCode !== null && payload.machineStatusCode !== undefined && payload.machineStatusCode !== '') {
        var mc = parseInt(payload.machineStatusCode, 10);
        if (!isNaN(mc)) {
          next.machineStatusCode = mc;
        }
      } else if (prev.machineStatusCode !== null && prev.machineStatusCode !== undefined) {
        next.machineStatusCode = prev.machineStatusCode;
      }
      if (payload.productionStartAt !== undefined && payload.productionStartAt !== null) {
        next.productionStartAt = String(payload.productionStartAt).trim();
      } else if (prev.productionStartAt != null && prev.productionStartAt !== undefined) {
        next.productionStartAt = prev.productionStartAt;
      }
      if (payload.productionStopAt !== undefined && payload.productionStopAt !== null) {
        next.productionStopAt = String(payload.productionStopAt).trim();
      } else if (prev.productionStopAt != null && prev.productionStopAt !== undefined) {
        next.productionStopAt = prev.productionStopAt;
      }
      if (payload.productionSessionProduct !== undefined && payload.productionSessionProduct !== null) {
        next.productionSessionProduct = String(payload.productionSessionProduct).trim();
      } else if (prev.productionSessionProduct != null && prev.productionSessionProduct !== undefined) {
        next.productionSessionProduct = prev.productionSessionProduct;
      }
      if (prev.manualOrderNumber != null && String(prev.manualOrderNumber).trim() !== '') {
        next.manualOrderNumber = String(prev.manualOrderNumber).trim();
      }
      if (prev.manualOrderLabel != null && String(prev.manualOrderLabel).trim() !== '') {
        next.manualOrderLabel = String(prev.manualOrderLabel).trim();
      }
      if (prev.manualOrderUpdatedAt != null && String(prev.manualOrderUpdatedAt).trim() !== '') {
        next.manualOrderUpdatedAt = String(prev.manualOrderUpdatedAt).trim();
      }
      if (!next.manualOrderNumber && prev.manualLotNumber != null && String(prev.manualLotNumber).trim() !== '') {
        var legK = String(prev.manualLotNumber).trim();
        if (getOrderByNumber(legK)) {
          next.manualOrderNumber = legK;
          next.manualOrderLabel = prev.manualLotLabel != null ? String(prev.manualLotLabel).trim() : legK;
          if (prev.manualLotUpdatedAt != null && String(prev.manualLotUpdatedAt).trim() !== '') {
            next.manualOrderUpdatedAt = String(prev.manualLotUpdatedAt).trim();
          }
        }
      }
      var prevModelKey = _smtModelCompareKey_(prev.currentPcb || prev.productionSessionProduct || '');
      var nextModelKey = _smtModelCompareKey_(next.currentPcb || next.productionSessionProduct || '');
      var modelChanged = !!prevModelKey && !!nextModelKey && prevModelKey !== nextModelKey;
      if (modelChanged) {
        // 모델 전환 시 이전 세션 수량/행 바인딩을 끊어, 과거 주문서로 이어쓰기 되는 문제를 방지한다.
        delete next.smtRecordSessionKey;
        delete next.smtRecordRow;
        delete next.smtRecordBaseQty;
        var droppedManualOnModel = false;
        if (next.manualOrderNumber && !_smtIsOrderCompatibleWithState_(next.manualOrderNumber, next)) {
          droppedManualOnModel = true;
          Logger.log(
            '[SMT_ORDER_RESET_ON_MODEL_CHANGE] line=' + String(lineNo) +
            ', prevModel=' + String(prev.currentPcb || prev.productionSessionProduct || '') +
            ', nextModel=' + String(next.currentPcb || next.productionSessionProduct || '') +
            ', droppedManualOrder=' + String(next.manualOrderNumber || '')
          );
          delete next.manualOrderNumber;
          delete next.manualOrderLabel;
          delete next.manualOrderUpdatedAt;
          delete next.manualOrderSide;
          delete next.manualLotNumber;
          delete next.manualLotLabel;
          delete next.manualLotUpdatedAt;
        }
        delete next.smtSessionNotice;
      }
      // SMT생산기록 동기화:
      // - 기준: line + order + product + day(KST)
      // - 동일 기준이면 기존 행 갱신, 기준 변경(일자/라인/모델/주문서)이면 새 행 추가
      _syncSmtProductionRecordOnPost_(lineNo, prev, next);
      props.setProperty(key, JSON.stringify(next));
      return jsonOut({
        ok: true,
        lineNo: lineNo,
        smtRecordSyncDisabled: false,
        serverRevision: 'SMT_SYNC_ON_2026-04-29'
      });
    } catch (err) {
      Logger.log('doPost 오류: ' + err.toString());
      return jsonOut({ ok: false, error: err.message || String(err) });
    }
  }

  /**
   * 운영(정식) Open API 사용 여부 — 기본값 true (정식 URL + ECOUNT_API_KEY 정식 인증키)
   * 스크립트 속성 ECOUNT_USE_PRODUCTION = false / 0 / n / no 일 때만 Test URL(sboapi) — 임시 검증용
   * @return {boolean}
   */
  function ecountUseProductionApi() {
    var v = PropertiesService.getScriptProperties().getProperty('ECOUNT_USE_PRODUCTION');
    if (v == null || String(v).trim() === '') return true;
    v = String(v).trim().toLowerCase();
    if (v === 'false' || v === '0' || v === 'n' || v === 'no') return false;
    return true;
  }

  /**
   * ECOUNT Zone API (OAPI/V2/Zone) — 로그인 API 호출 전 ZONE / DOMAIN 조회
   * 회사코드: 스크립트 속성 ECOUNT_COM_CODE 우선, 없으면 아래 기본값(미래SMT)
   * 테스트 URL: https://sboapi.ecount.com | 운영: https://oapi.ecount.com
   * 동일 IP에서 zone/login 실패 10회↑ 시 차단 가능 — 실패 시 무한 재시도 금지
   *
   * @param {boolean} useProdUrl true면 운영 URL, false면 테스트 URL
   * @return {{ZONE:string, DOMAIN:string, EXPIRE_DATE:string}}
   */
  function ecountFetchZone(useProdUrl) {
    var props = PropertiesService.getScriptProperties();
    var comCode = (props.getProperty('ECOUNT_COM_CODE') || '673654').trim();
    if (!comCode) {
      throw new Error('ECOUNT_COM_CODE(회사코드 6자리)를 스크립트 속성에 설정하세요.');
    }
    var url = useProdUrl
      ? 'https://oapi.ecount.com/OAPI/V2/Zone'
      : 'https://sboapi.ecount.com/OAPI/V2/Zone';
    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ COM_CODE: comCode }),
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(url, options);
    var text = response.getContentText();
    var json;
    try {
      json = JSON.parse(text);
    } catch (e1) {
      throw new Error('Zone 응답 파싱 실패: ' + (text ? text.substring(0, 300) : '(빈 응답)'));
    }
    if (String(json.Status) !== '200' || !json.Data) {
      var msg = (json.Error && json.Error.Message) ? json.Error.Message : text;
      throw new Error('Zone API 실패 (Status ' + json.Status + '): ' + msg);
    }
    return {
      ZONE: json.Data.ZONE,
      DOMAIN: json.Data.DOMAIN,
      EXPIRE_DATE: json.Data.EXPIRE_DATE || ''
    };
  }

  /**
   * 에디터에서 실행: 테스트 URL로 Zone 조회만 확인 (인증키 불필요, 회사코드만)
   * 실행 후 상단 메뉴 「보기」→「로그」(또는 Ctrl+Enter)에서 Logger 출력 확인
   * @return {{ZONE:string, DOMAIN:string, EXPIRE_DATE:string}}
   */
  function testEcountZone() {
    var result = ecountFetchZone(ecountUseProductionApi());
    Logger.log('[ECOUNT Zone OK] ' + JSON.stringify(result));
    return result;
  }

  /**
   * ECOUNT 로그인 API (OAPI/V2/OAPILogin) — SESSION_ID 발급
   * 스크립트 속성: ECOUNT_COM_CODE, ECOUNT_USER_ID(또는 ECOUNT_LOGIN_ID), ECOUNT_API_KEY(ERP「테스트 인증키」— 웹 로그인 비밀번호 아님)
   * Test URL: https://sboapi{ZONE}.ecount.com/OAPI/V2/OAPILogin
   * Request URL: https://oapi{ZONE}.ecount.com/OAPI/V2/OAPILogin
   * 실패 시 무한 재시도 금지 (동일 IP zone/login 실패 10회↑ 차단 가능)
   *
   * @param {boolean} useProdUrl true면 운영 호스트, false면 테스트 호스트
   * @return {{COM_CODE:string, USER_ID:string, SESSION_ID:string, ZONE:string, EXPIRE_DATE:string, NOTICE:string}}
   */
  function ecountOapiLogin(useProdUrl) {
    var props = PropertiesService.getScriptProperties();
    var comCode = (props.getProperty('ECOUNT_COM_CODE') || '673654').trim();
    var userId = (
      props.getProperty('ECOUNT_USER_ID') ||
      props.getProperty('ECOUNT_LOGIN_ID') ||
      ''
    ).trim();
    var apiCertKey = (
      props.getProperty('ECOUNT_API_KEY') ||
      props.getProperty('ECOUNT_API_CERT_KEY') ||
      ''
    ).trim();
    if (!userId) {
      throw new Error(
        '이카운트 로그인 ID가 없습니다. Apps Script 편집기 → 왼쪽 「프로젝트 설정」(톱니바퀴) → 「스크립트 속성」→ ' +
          '「속성 추가」에서 ECOUNT_USER_ID = (테스트 인증키를 발급받은 이카운트 사용자 ID) 를 등록하세요.'
      );
    }
    if (!apiCertKey) {
      throw new Error(
        '테스트 인증키가 없습니다. 같은 「스크립트 속성」에 ECOUNT_API_KEY = (Self-Customizing > API인증현황의 테스트 인증키) 를 등록하세요.'
      );
    }
    var zoneInfo = ecountFetchZone(useProdUrl);
    var zone = String(zoneInfo.ZONE || '').trim();
    if (!zone) {
      throw new Error('Zone 응답에 ZONE 값이 없습니다.');
    }
    var loginUrl = useProdUrl
      ? ('https://oapi' + zone + '.ecount.com/OAPI/V2/OAPILogin')
      : ('https://sboapi' + zone + '.ecount.com/OAPI/V2/OAPILogin');
    var payload = {
      COM_CODE: comCode,
      USER_ID: userId,
      API_CERT_KEY: apiCertKey,
      LAN_TYPE: 'ko-KR',
      ZONE: zone
    };
    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(loginUrl, options);
    var text = response.getContentText();
    var json;
    try {
      json = JSON.parse(text);
    } catch (e2) {
      throw new Error('OAPILogin 응답 파싱 실패: ' + (text ? text.substring(0, 400) : '(빈 응답)'));
    }
    var st = json.Status != null ? String(json.Status) : '';
    if (st !== '200') {
      var msg2 = (json.Error && json.Error.Message) ? json.Error.Message : text;
      throw new Error('OAPILogin 실패 (Status ' + json.Status + '): ' + msg2);
    }
    var rawData = json.Data;
    if (rawData == null) {
      throw new Error('OAPILogin 응답에 Data가 없습니다: ' + (text ? text.substring(0, 600) : ''));
    }
    if (Array.isArray(rawData)) {
      rawData = rawData.length ? rawData[0] : null;
    }
    if (!rawData || typeof rawData !== 'object') {
      throw new Error('OAPILogin Data 형식 오류: ' + (text ? text.substring(0, 600) : ''));
    }
    function pick(d, keys) {
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (d[k] !== undefined && d[k] !== null && String(d[k]).length) {
          return d[k];
        }
      }
      return undefined;
    }
    /** 성공 시 SESSION_ID 등이 Data.Datas 안에 오는 형식 지원 */
    function pickFromLoginData(d, keys) {
      var v = pick(d, keys);
      if (v !== undefined) return v;
      if (d.Datas && typeof d.Datas === 'object') {
        v = pick(d.Datas, keys);
        if (v !== undefined) return v;
      }
      if (d.Data && typeof d.Data === 'object') {
        v = pick(d.Data, keys);
        if (v !== undefined) return v;
      }
      return undefined;
    }
    var sessionId = pickFromLoginData(rawData, ['SESSION_ID', 'SessionId', 'session_id']);
    var comCodeOut = pickFromLoginData(rawData, ['COM_CODE', 'ComCode', 'com_code']);
    var userIdOut = pickFromLoginData(rawData, ['USER_ID', 'UserId', 'user_id']);
    if (!sessionId) {
      var failMsg = pick(rawData, ['Message', 'message']);
      var failCode = pick(rawData, ['Code', 'code']);
      if (failMsg) {
        var plain = String(failMsg).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        throw new Error(
          'OAPILogin 거절 (Data.Code=' + (failCode != null ? failCode : '') + '): ' + plain +
            ' — API는 웹 로그인 비밀번호가 아니라 ERP「API인증현황」의 테스트 인증키(API_CERT_KEY)를 사용합니다. ECOUNT_USER_ID는 그 키를 발급한 이카운트 ID인지 확인하세요.'
        );
      }
      throw new Error(
        'OAPILogin 응답에 SESSION_ID가 없습니다. 원문(앞부분): ' + (text ? text.substring(0, 900) : '')
      );
    }
    return {
      COM_CODE: comCodeOut != null ? String(comCodeOut) : comCode,
      USER_ID: userIdOut != null ? String(userIdOut) : userId,
      SESSION_ID: String(sessionId),
      ZONE: zone,
      EXPIRE_DATE: pickFromLoginData(rawData, ['EXPIRE_DATE', 'ExpireDate', 'expire_date']) || '',
      NOTICE: pickFromLoginData(rawData, ['NOTICE', 'Notice', 'notice']) || ''
    };
  }

  /**
   * GetBasicProductsList 등에서 Data.Result이 JSON 배열 «문자열»로 오는 경우 파싱 (공식 매뉴얼 Example Result 참고)
   * @param {*} result
   * @return {Array}
   */
  function ecountParseOapiResultField(result) {
    if (result == null) return [];
    if (Array.isArray(result)) return result;
    if (typeof result === 'string') {
      var s = result.trim();
      if (!s) return [];
      try {
        var p = JSON.parse(s);
        if (Array.isArray(p)) return p;
        if (p && typeof p === 'object') return [p];
      } catch (e0) {
        return [];
      }
      return [];
    }
    if (typeof result === 'object') return [result];
    return [];
  }

  /**
   * OAPI 목록 응답에서 배열 후보 추출 (Data.Result 문자열/배열, Data.Datas, Data.Data 등)
   * @param {*} json
   * @return {Array}
   */
  function ecountExtractOapiListRows(json) {
    var d = json && json.Data;
    if (d == null) return [];
    if (Array.isArray(d)) return d;
    if (d.Result !== undefined && d.Result !== null) {
      var fromResult = ecountParseOapiResultField(d.Result);
      if (fromResult.length) return fromResult;
    }
    if (Array.isArray(d.Datas)) return d.Datas;
    if (d.Result && Array.isArray(d.Result.Data)) return d.Result.Data;
    if (Array.isArray(d.Data)) return d.Data;
    if (d.Datas && typeof d.Datas === 'object' && !Array.isArray(d.Datas)) {
      var keys = Object.keys(d.Datas);
      if (keys.length && Array.isArray(d.Datas[keys[0]])) return d.Datas[keys[0]];
    }
    return [];
  }

  /**
   * 품목 기본 조회 (OAPI/V2/InventoryBasic/GetBasicProductsList) — ERP 품목 가져오기
   * Test: https://sboapi{ZONE}.ecount.com/.../GetBasicProductsList?SESSION_ID={SESSION_ID}
   *
   * @param {boolean} useProdUrl
   * @param {{PROD_CD?:string, COMMA_FLAG?:string, PROD_TYPE?:string, FROM_PROD_CD?:string, TO_PROD_CD?:string}} params
   * @return {{raw:Object, products:Array, login:Object}}
   */
  function ecountGetBasicProductsList(useProdUrl, params) {
    params = params || {};
    var login = ecountOapiLogin(useProdUrl);
    var zone = login.ZONE;
    var sessionId = login.SESSION_ID;
    var host = useProdUrl ? 'https://oapi' : 'https://sboapi';
    var apiUrl =
      host +
      zone +
      '.ecount.com/OAPI/V2/InventoryBasic/GetBasicProductsList?SESSION_ID=' +
      encodeURIComponent(sessionId);

    var body = {
      COMMA_FLAG: params.COMMA_FLAG && params.COMMA_FLAG !== '' ? params.COMMA_FLAG : 'N'
    };
    if (params.PROD_CD !== undefined && params.PROD_CD !== null && String(params.PROD_CD).length) {
      body.PROD_CD = String(params.PROD_CD);
    }
    if (params.PROD_TYPE !== undefined && params.PROD_TYPE !== null && String(params.PROD_TYPE).length) {
      body.PROD_TYPE = String(params.PROD_TYPE);
    }
    if (params.FROM_PROD_CD !== undefined && params.FROM_PROD_CD !== null && String(params.FROM_PROD_CD).length) {
      body.FROM_PROD_CD = String(params.FROM_PROD_CD);
    }
    if (params.TO_PROD_CD !== undefined && params.TO_PROD_CD !== null && String(params.TO_PROD_CD).length) {
      body.TO_PROD_CD = String(params.TO_PROD_CD);
    }

    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(apiUrl, options);
    var text = response.getContentText();
    var json;
    try {
      json = JSON.parse(text);
    } catch (e3) {
      throw new Error('GetBasicProductsList 응답 파싱 실패: ' + (text ? text.substring(0, 400) : ''));
    }
    var st = json.Status != null ? String(json.Status) : '';
    if (st !== '200') {
      var em = (json.Error && json.Error.Message) ? json.Error.Message : text;
      throw new Error('GetBasicProductsList 실패 (Status ' + json.Status + '): ' + em);
    }
    var dataBlock = json.Data;
    if (dataBlock && typeof dataBlock === 'object') {
      var c = dataBlock.Code != null ? String(dataBlock.Code) : '';
      if (c && c !== '0' && c !== '00' && dataBlock.Message) {
        var plain2 = String(dataBlock.Message).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        throw new Error('GetBasicProductsList 거절 (Code ' + c + '): ' + plain2);
      }
    }
    var products = ecountExtractOapiListRows(json);
    return {
      raw: json,
      products: products,
      login: { ZONE: login.ZONE, COM_CODE: login.COM_CODE }
    };
  }

  /**
   * 에디터 실행: 테스트 호스트로 품목 기본 조회(조건 없음=전체 범위는 이카운트 정책 따름) — 보기→로그
   */
  function testEcountGetBasicProductsList() {
    var r = ecountGetBasicProductsList(ecountUseProductionApi(), {});
    Logger.log(
      '[ECOUNT GetBasicProductsList] 건수=' +
        (r.products ? r.products.length : 0) +
        ' (로그 길이 제한으로 일부만 출력)'
    );
    var sample = (r.products || []).slice(0, 3);
    Logger.log('[ECOUNT 샘플(최대 3건)] ' + JSON.stringify(sample));
    return r;
  }

  /**
   * 웹앱 등에서 호출: 이카운트 품목 기본 목록 조회 — ECOUNT_USE_PRODUCTION 에 따라 테스트/운영 호스트
   * @param {{PROD_CD?:string, COMMA_FLAG?:string, PROD_TYPE?:string, FROM_PROD_CD?:string, TO_PROD_CD?:string}} filterParams
   * @return {{ok:boolean, products?:Array, count?:number, truncated?:boolean, zone?:string, error?:string}}
   */
  function apiGetEcountProductsForMaster(filterParams) {
    try {
      filterParams = filterParams || {};
      var result = ecountGetBasicProductsList(ecountUseProductionApi(), filterParams);
      var rows = result.products || [];
      var MAX = 4000;
      var truncated = rows.length > MAX;
      if (truncated) {
        rows = rows.slice(0, MAX);
      }
      return {
        ok: true,
        products: rows,
        count: rows.length,
        truncated: truncated,
        zone: result.login && result.login.ZONE ? String(result.login.ZONE) : ''
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message || String(err),
        products: []
      };
    }
  }

  /**
   * 에디터에서 실행: 테스트 호스트로 OAPILogin → SESSION_ID 확인 (보기→로그)
   */
  function testEcountLogin() {
    var result = ecountOapiLogin(ecountUseProductionApi());
    Logger.log('[ECOUNT Login OK] COM_CODE=' + result.COM_CODE + ' SESSION_ID=' + result.SESSION_ID);
    if (result.NOTICE) Logger.log('[ECOUNT NOTICE] ' + result.NOTICE);
    return result;
  }

  /**
   * 스프레드시트 가져오기
   * @return {Spreadsheet} 스프레드시트 객체
   */
  function getSpreadsheet() {
    try {
      return SpreadsheetApp.getActiveSpreadsheet();
    } catch (error) {
      Logger.log('스프레드시트 가져오기 오류: ' + error.toString());
      throw error;
    }
  }

  /** 버전 컬럼 제거 시 제품명에 버전 문자열 병합(이미 포함 시 유지) */
  function _mergeVersionIntoProductName_(productName, version) {
    var name = String(productName != null ? productName : '').trim();
    var ver = String(version != null ? version : '').trim();
    if (!ver) return name;
    if (!name) return ver;
    var nl = name.toLowerCase();
    var vl = ver.toLowerCase();
    if (nl === vl || nl.indexOf(vl) >= 0) return name;
    return name + ' ' + ver;
  }

  function getQuoteSheet() {
    try {
      const ss = getSpreadsheet();
      let sheet = ss.getSheetByName('견적서');
      var newHeaders = ['견적일', '견적서번호', '고객사', '제품명', '수량', '견적금액', '상세정보'];

      if (!sheet) {
        sheet = ss.insertSheet('견적서');
        sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
        sheet.getRange(1, 1, 1, newHeaders.length)
          .setBackground('#f7fafc')
          .setFontColor('#4a5568')
          .setFontWeight('bold');
        return sheet;
      }

      try {
        var lr = sheet.getLastRow();
        var lc = Math.max(7, sheet.getLastColumn());
        var oldHeader = sheet.getRange(1, 1, 1, lc).getValues()[0] || [];
        var qh4 = String(oldHeader[4] || '').trim();
        var isNew7 = qh4 === '수량';
        var isOld8 = qh4 === '버전';
        if (!isNew7 && isOld8 && lr >= 1) {
          var all8 = sheet.getRange(1, 1, lr, Math.max(8, lc)).getValues();
          var out7 = [newHeaders];
          for (var mi = 1; mi < all8.length; mi++) {
            var rr = all8[mi] || [];
            out7.push([
              rr[0] || '',
              rr[1] || '',
              rr[2] || '',
              _mergeVersionIntoProductName_(rr[3], rr[4]),
              rr[5] != null ? rr[5] : 0,
              rr[6] != null ? rr[6] : 0,
              rr[7] || ''
            ]);
          }
          sheet.clearContents();
          if (out7.length > 0) sheet.getRange(1, 1, out7.length, 7).setValues(out7);
          sheet.getRange(1, 1, 1, 7).setBackground('#f7fafc').setFontColor('#4a5568').setFontWeight('bold');
        } else if (!isNew7 && !isOld8 && lr >= 1) {
          sheet.getRange(1, 1, 1, 7).setValues([newHeaders]);
          sheet.getRange(1, 1, 1, 7).setBackground('#f7fafc').setFontColor('#4a5568').setFontWeight('bold');
        }
      } catch (eQ) {
        Logger.log('견적서 헤더/마이그레이션 오류: ' + eQ.toString());
      }

      return sheet;
    } catch (error) {
      Logger.log('견적서 시트 가져오기 오류: ' + error.toString());
      throw error;
    }
  }

  const QUOTES_CACHE_KEY = 'quotes:list:v3';
  /** 서버 ScriptCache — 목록 조회 부하 감소 (초 단위) */
  const QUOTES_CACHE_TTL_SECONDS = 300;

  function clearQuotesCache() {
    try {
      CacheService.getScriptCache().remove(QUOTES_CACHE_KEY);
    } catch (error) {
      Logger.log('견적서 캐시 삭제 오류: ' + error.toString());
    }
  }

  /** 견적일 문자열을 정렬용 타임스탬프로 변환 */
  function parseQuoteDateForSort(quoteDateStr) {
    if (!quoteDateStr) return 0;
    var s = quoteDateStr.toString();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)).getTime();
    }
    var t = Date.parse(s);
    return isNaN(t) ? 0 : t;
  }

  /** 목록 표시: 최신 견적일 우선, 같은 날짜는 견적서번호 내림차순 */
  function sortQuotesNewestFirst(quotes) {
    return quotes.slice().sort(function (a, b) {
      var db = parseQuoteDateForSort(b.quoteDate);
      var da = parseQuoteDateForSort(a.quoteDate);
      if (db !== da) return db - da;
      return (b.quoteNumber || '').localeCompare(a.quoteNumber || '', undefined, { numeric: true });
    });
  }

  /** 시트 한 행(견적일~상세정보 7열) → 목록/상세용 객체 */
  function quoteFromRowValues(row) {
    if (!row || row.length < 1) return null;
    if (!row[1] || row[1].toString().trim() === '') {
      return null;
    }
    var boardQty = row[4] ? (typeof row[4] === 'number' ? row[4] : parseFloat(row[4]) || 0) : 0;
    var totalAmount = row[5] ? (typeof row[5] === 'number' ? row[5] : parseFloat(row[5]) || 0) : 0;
    var detailInfo = {};
    var smt = 0, dip = 0, assembly = 0, test = 0, packing = 0, materialCost = 0, setupCost = 0;
    if (row[6] && row[6].toString().trim() !== '') {
      try {
        detailInfo = JSON.parse(row[6].toString());
        if (detailInfo.amounts) {
          smt = detailInfo.amounts.smt || 0;
          dip = detailInfo.amounts.dip || 0;
          assembly = detailInfo.amounts.assembly || 0;
          test = detailInfo.amounts.test || 0;
          packing = detailInfo.amounts.packing || 0;
          materialCost = detailInfo.amounts.materialCost || 0;
          setupCost = detailInfo.amounts.setupCost || 0;
        }
      } catch (e) {
        Logger.log('JSON 파싱 오류: ' + e.toString());
      }
    }
    return {
      quoteNumber: row[1] ? row[1].toString() : '',
      quoteDate: row[0] ? (row[0] instanceof Date ?
        Utilities.formatDate(row[0], Session.getScriptTimeZone(), 'yyyy-MM-dd') :
        row[0].toString()) : '',
      customer: row[2] ? row[2].toString() : '',
      productName: row[3] ? row[3].toString() : '',
      version: '',
      boardQty: boardQty,
      smt: smt,
      dip: dip,
      assembly: assembly,
      test: test,
      packing: packing,
      materialCost: materialCost,
      setupCost: setupCost,
      totalAmount: totalAmount,
      detailInfo: detailInfo,
      quoteType: getQuoteTypeFromQuote_({ detailInfo: detailInfo, quoteNumber: row[1] ? row[1].toString() : '' })
    };
  }

  function getQuotes() {
    try {
      const cache = CacheService.getScriptCache();
      const cached = cache.get(QUOTES_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }

      const sheet = getQuoteSheet();
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      if (values.length <= 1) {
        return [];
      }
      
      const quotes = [];
      
      for (var i = 1; i < values.length; i++) {
        var q = quoteFromRowValues(values[i]);
        if (q) quotes.push(q);
      }
      
      var sorted = sortQuotesNewestFirst(quotes);
      cache.put(QUOTES_CACHE_KEY, JSON.stringify(sorted), QUOTES_CACHE_TTL_SECONDS);
      return sorted;
    } catch (error) {
      Logger.log('견적서 목록 가져오기 오류: ' + error.toString());
      return [];
    }
  }

  function getConfirmedQuotes() {
    try {
      const quotes = getQuotes();
      // 상태가 "확정"인 견적서만 필터링
      return quotes.filter(quote => {
        const status = (quote.detailInfo && quote.detailInfo.status) || '확정';
        return status === '확정';
      });
    } catch (error) {
      Logger.log('확정된 견적서 목록 가져오기 오류: ' + error.toString());
      return [];
    }
  }

  function getQuoteTypeFromQuote_(quote) {
    var settings = quote && quote.detailInfo && quote.detailInfo.settings;
    if (settings && settings.quoteType) {
      return settings.quoteType === 'domestic' ? 'domestic' : 'export';
    }
    if (quote && quote.quoteType) {
      return quote.quoteType === 'domestic' ? 'domestic' : 'export';
    }
    var no = String(quote && quote.quoteNumber || '');
    if (no.indexOf('MSK') === 0) return 'domestic';
    return 'export';
  }

  function generateQuoteNumber(quoteType) {
    try {
      const sheet = getQuoteSheet();
      const today = new Date();
      const year = today.getFullYear();
      const yearShort = year.toString().substring(2); // YY 형식 (예: 26)
      
      const prefix = (quoteType === 'domestic' ? 'MSK' : 'MSQ') + yearShort;
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      let maxNumber = 0;
      
      for (var i = 1; i < values.length; i++) {
        var quoteNumber = values[i][1];
        
        if (quoteNumber && typeof quoteNumber === 'string' && quoteNumber.startsWith(prefix)) {
          const numberPart = quoteNumber.substring(prefix.length);
          const num = parseInt(numberPart, 10);
          
          if (!isNaN(num) && num > maxNumber) {
            maxNumber = num;
          }
        }
      }
      
      const nextNumber = maxNumber + 1;
      const formattedNumber = String(nextNumber).padStart(4, '0');
      
      return `${prefix}${formattedNumber}`;
    } catch (error) {
      Logger.log('견적서번호 생성 오류: ' + error.toString());
      const today = new Date();
      const y = today.getFullYear().toString().substring(2);
      return (quoteType === 'domestic' ? 'MSK' : 'MSQ') + y + '0001';
    }
  }

  function scaleLaborLineItems_(items, targetTotal, getBase) {
    if (!items.length) return [];
    var bases = items.map(function(i) { return getBase(i); });
    var baseTotal = bases.reduce(function(s, v) { return s + v; }, 0);
    targetTotal = Math.round(targetTotal);
    if (baseTotal <= 0 || targetTotal <= 0) {
      return items.map(function(i, idx) {
        var amt = bases[idx];
        var cnt = i.cnt || 1;
        return Object.assign({}, i, {
          displayAmount: amt,
          displayUnit: i.unit != null ? i.unit : (cnt > 0 ? Math.round(amt / cnt) : amt)
        });
      });
    }
    if (targetTotal === baseTotal) {
      return items.map(function(i, idx) {
        var amt = bases[idx];
        return Object.assign({}, i, {
          displayAmount: amt,
          displayUnit: i.unit != null ? i.unit : (i.cnt > 0 ? Math.round(amt / i.cnt) : amt)
        });
      });
    }
    var scaled = [];
    var sum = 0;
    for (var i = 0; i < items.length; i++) {
      var amt = i === items.length - 1
        ? targetTotal - sum
        : Math.round(bases[i] * targetTotal / baseTotal);
      sum += amt;
      var cnt = items[i].cnt || 1;
      scaled.push(Object.assign({}, items[i], {
        displayAmount: amt,
        displayUnit: cnt > 0 ? Math.round(amt / cnt) : (items[i].unit || amt)
      }));
    }
    return scaled;
  }

  function scalePostDisplayItems_(postItems, targetPerUnit) {
    var active = postItems.filter(function(i) { return i.min > 0; });
    var scaled = scaleLaborLineItems_(active, targetPerUnit, function(i) { return i.min * 540; });
    return scaled.map(function(i) { return { label: i.label, value: i.displayAmount, min: i.min }; });
  }

  var SMT_SETUP_RATE = 50000;
  var SMT_SETUP_MIN = 500000;
  var SMT_UNIT_CHIP = 15;
  var SMT_UNIT_IC_SMALL = 400;
  var SMT_UNIT_IC_MEDIUM = 750;
  var SMT_UNIT_IC_LARGE = 1200;
  var SMT_UNIT_BGA_SMALL = 2800;
  var SMT_UNIT_BGA_MEDIUM = 4500;
  var SMT_UNIT_BGA_LARGE = 7000;
  var SMT_UNIT_ODD = 50;
  var SMT_UNIT_SPECIAL = 120;
  var SMT_UNIT_IC_PIN = 10;
  var SMT_UNIT_BGA_BALL = 12;

  function usesSmtTierPricing_(input) {
    if ((Number(input.icPin) || 0) + (Number(input.bga) || 0) > 0) return false;
    return (Number(input.icSmall) || 0) + (Number(input.icMedium) || 0) + (Number(input.icLarge) || 0)
      + (Number(input.bgaSmall) || 0) + (Number(input.bgaMedium) || 0) + (Number(input.bgaLarge) || 0) > 0;
  }

  function computeSmtChipTotal_(input) {
    var chip = Number(input.chip) || 0;
    var smtOdd = Number(input.smtOdd) || 0;
    var smtSpecial = Number(input.smtSpecial) || 0;
    var total = chip * SMT_UNIT_CHIP + smtOdd * SMT_UNIT_ODD + smtSpecial * SMT_UNIT_SPECIAL;
    if (usesSmtTierPricing_(input)) {
      return total
        + (Number(input.icSmall) || 0) * SMT_UNIT_IC_SMALL
        + (Number(input.icMedium) || 0) * SMT_UNIT_IC_MEDIUM
        + (Number(input.icLarge) || 0) * SMT_UNIT_IC_LARGE
        + (Number(input.bgaSmall) || 0) * SMT_UNIT_BGA_SMALL
        + (Number(input.bgaMedium) || 0) * SMT_UNIT_BGA_MEDIUM
        + (Number(input.bgaLarge) || 0) * SMT_UNIT_BGA_LARGE;
    }
    return total
      + (Number(input.icPin) || 0) * SMT_UNIT_IC_PIN
      + (Number(input.bga) || 0) * SMT_UNIT_BGA_BALL;
  }

  function hasSmtComponentInputs_(input) {
    var base = (Number(input.chip) || 0) + (Number(input.smtOdd) || 0) + (Number(input.smtSpecial) || 0);
    if (usesSmtTierPricing_(input)) {
      return base + (Number(input.icSmall) || 0) + (Number(input.icMedium) || 0) + (Number(input.icLarge) || 0)
        + (Number(input.bgaSmall) || 0) + (Number(input.bgaMedium) || 0) + (Number(input.bgaLarge) || 0) > 0;
    }
    return base + (Number(input.icPin) || 0) + (Number(input.bga) || 0) > 0;
  }

  function buildSmtComponentRows_(bd, lang) {
    lang = lang || 'ko';
    var L = getQuoteExportLabels_(lang);
    var rows = [];
    if (bd.chip > 0) rows.push({ label: 'CHIP', unit: SMT_UNIT_CHIP, cnt: bd.chip });
    if (usesSmtTierPricing_(bd)) {
      if (bd.icSmall > 0) rows.push({ label: 'IC (1~16PIN)', unit: SMT_UNIT_IC_SMALL, cnt: bd.icSmall });
      if (bd.icMedium > 0) rows.push({ label: 'IC (17~48PIN)', unit: SMT_UNIT_IC_MEDIUM, cnt: bd.icMedium });
      if (bd.icLarge > 0) rows.push({ label: 'IC (49PIN+)', unit: SMT_UNIT_IC_LARGE, cnt: bd.icLarge });
      if (bd.bgaSmall > 0) rows.push({ label: L.bgaSmall, unit: SMT_UNIT_BGA_SMALL, cnt: bd.bgaSmall });
      if (bd.bgaMedium > 0) rows.push({ label: L.bgaMedium, unit: SMT_UNIT_BGA_MEDIUM, cnt: bd.bgaMedium });
      if (bd.bgaLarge > 0) rows.push({ label: L.bgaLarge, unit: SMT_UNIT_BGA_LARGE, cnt: bd.bgaLarge });
    } else {
      if (bd.icPin > 0) rows.push({ label: 'IC PIN', unit: SMT_UNIT_IC_PIN, cnt: bd.icPin });
      if (bd.bga > 0) rows.push({ label: 'BGA BALL', unit: SMT_UNIT_BGA_BALL, cnt: bd.bga });
    }
    if (bd.smtOdd > 0) rows.push({ label: L.oddParts, unit: SMT_UNIT_ODD, cnt: bd.smtOdd });
    if (bd.smtSpecial > 0) rows.push({ label: L.specialModule, unit: SMT_UNIT_SPECIAL, cnt: bd.smtSpecial });
    return rows;
  }

  function readSmtBoardComponentFields_(b) {
    return {
      chip: Number(b.chip) || 0,
      icSmall: Number(b.icSmall) || 0,
      icMedium: Number(b.icMedium) || 0,
      icLarge: Number(b.icLarge) || 0,
      bgaSmall: Number(b.bgaSmall) || 0,
      bgaMedium: Number(b.bgaMedium) || 0,
      bgaLarge: Number(b.bgaLarge) || 0,
      icPin: Number(b.icPin) || 0,
      bga: Number(b.bga) || 0,
      smtOdd: Number(b.smtOdd) || 0,
      smtSpecial: Number(b.smtSpecial) || 0
    };
  }

  /** SMT 라인 SET-UP: 종당 50,000, 최소 500,000 — 종수 0이면 0 */
  function computeSmtSetupAmount_(setupPartCount) {
    var count = Math.max(0, Math.floor(Number(setupPartCount) || 0));
    if (count <= 0) return 0;
    return Math.max(SMT_SETUP_MIN, count * SMT_SETUP_RATE);
  }

  /** SMT 실装 공임(SET-UP 제외): CHIP·IC·BGA·AOI·세척 합, 최소 3,000/대 */
  function computeSmtLaborPerUnit_(input) {
    var SMT_LABOR_MIN_PER_UNIT = 3000;
    var AOI_UNIT_PRICE_SINGLE = 100;
    var AOI_UNIT_PRICE_DOUBLE = 200;
    var PCB_WASH_UNIT_PRICE = 100;
    var chipTotal = computeSmtChipTotal_(input);
    var smtSide = (input.smtSide === 'double') ? 'double' : 'single';
    var aoiEnabled = input.aoiEnabled === true || String(input.aoiEnabled) === 'true';
    var pcbWashEnabled = input.pcbWashEnabled === true || String(input.pcbWashEnabled) === 'true';
    var aoiUnit = aoiEnabled ? (smtSide === 'double' ? AOI_UNIT_PRICE_DOUBLE : AOI_UNIT_PRICE_SINGLE) : 0;
    var pcbWashUnit = pcbWashEnabled ? PCB_WASH_UNIT_PRICE : 0;
    var smtLaborRaw = chipTotal + aoiUnit + pcbWashUnit;
    var hasSmtLabor = smtLaborRaw > 0 || hasSmtComponentInputs_(input) || aoiEnabled || pcbWashEnabled;
    var smtLaborUnit = hasSmtLabor ? Math.max(SMT_LABOR_MIN_PER_UNIT, smtLaborRaw) : 0;
    var smtLaborMinApplied = hasSmtLabor && smtLaborUnit > smtLaborRaw;
    return {
      smtLaborUnit: smtLaborUnit,
      smtLaborRaw: smtLaborRaw,
      smtLaborMinApplied: smtLaborMinApplied,
      smtLaborMinAdjustment: smtLaborMinApplied ? smtLaborUnit - smtLaborRaw : 0,
      chipTotal: chipTotal,
      aoiUnit: aoiUnit,
      pcbWashUnit: pcbWashUnit
    };
  }

  /** 견적 입력 → PCB 보드 배열 (구형 단일 필드 호환) */
  function normalizeSmtPcbBoards_(data) {
    var src = (data && data.pcbBoards && data.pcbBoards.length) ? data.pcbBoards : null;
    if (src) {
      return src.map(function(b, i) {
        var comp = readSmtBoardComponentFields_(b);
        return Object.assign({
          pcbName: String(b.pcbName || ('PCB ' + (i + 1))).trim() || ('PCB ' + (i + 1)),
          smtSide: (b.smtSide === 'double') ? 'double' : 'single',
          aoiEnabled: b.aoiEnabled === true || String(b.aoiEnabled) === 'true',
          pcbWashEnabled: b.pcbWashEnabled === true || String(b.pcbWashEnabled) === 'true',
          smtTopCount: Number(b.smtTopCount) || 0,
          smtBotCount: Number(b.smtBotCount) || 0
        }, comp);
      });
    }
    return [Object.assign({
      pcbName: 'PCB 1',
      smtSide: (data.smtSide === 'double') ? 'double' : 'single',
      aoiEnabled: data.aoiEnabled === true || String(data.aoiEnabled) === 'true',
      pcbWashEnabled: data.pcbWashEnabled === true || String(data.pcbWashEnabled) === 'true',
      smtTopCount: Number(data.smtTopCount) || 0,
      smtBotCount: Number(data.smtBotCount) || 0
    }, readSmtBoardComponentFields_(data))];
  }

  /** PCB별 실装·SET-UP 합산 (완제품 1대당) */
  function aggregateSmtFromPcbBoards_(pcbBoards) {
    var laborUnit = 0;
    var laborRaw = 0;
    var laborMinAdj = 0;
    var anyLaborMin = false;
    var setupTotal = 0;
    var setupPartCountTotal = 0;
    var boardDetails = [];
    (pcbBoards || []).forEach(function(b) {
      var lab = computeSmtLaborPerUnit_(b);
      laborUnit += lab.smtLaborUnit;
      laborRaw += lab.smtLaborRaw;
      laborMinAdj += lab.smtLaborMinAdjustment;
      if (lab.smtLaborMinApplied) anyLaborMin = true;
      var side = b.smtSide === 'double' ? 'double' : 'single';
      var top = Number(b.smtTopCount) || 0;
      var bot = Number(b.smtBotCount) || 0;
      var partCnt = top + (side === 'double' ? bot : 0);
      setupPartCountTotal += partCnt;
      var setupAmt = computeSmtSetupAmount_(partCnt);
      setupTotal += setupAmt;
      boardDetails.push(Object.assign({
        pcbName: b.pcbName,
        smtSide: side,
        smtTopCount: top,
        smtBotCount: bot,
        setupPartCount: partCnt,
        setupAmount: setupAmt,
        laborUnit: lab.smtLaborUnit,
        laborRaw: lab.smtLaborRaw,
        laborMinApplied: lab.smtLaborMinApplied,
        laborMinAdjustment: lab.smtLaborMinAdjustment,
        chipTotal: lab.chipTotal,
        aoiUnit: lab.aoiUnit,
        pcbWashUnit: lab.pcbWashUnit,
        aoiEnabled: b.aoiEnabled === true || String(b.aoiEnabled) === 'true',
        pcbWashEnabled: b.pcbWashEnabled === true || String(b.pcbWashEnabled) === 'true'
      }, readSmtBoardComponentFields_(b)));
    });
    return {
      smtLaborUnit: laborUnit,
      smtLaborRaw: laborRaw,
      smtLaborMinApplied: anyLaborMin,
      smtLaborMinAdjustment: laborMinAdj,
      smtSetupAmount: setupTotal,
      setupPartCount: setupPartCountTotal,
      boardDetails: boardDetails
    };
  }

  /** 견적 입력 → 납땜 PCB 보드 배열 (구형 단일 필드 호환) */
  function normalizeDipPcbBoards_(data) {
    var src = (data && data.dipBoards && data.dipBoards.length) ? data.dipBoards : null;
    if (!src && data && data.inputs && data.inputs.dip && data.inputs.dip.dipBoards && data.inputs.dip.dipBoards.length) {
      src = data.inputs.dip.dipBoards;
    }
    if (src) {
      return src.map(function(b, i) {
        return {
          pcbName: String(b.pcbName || ('PCB ' + (i + 1))).trim() || ('PCB ' + (i + 1)),
          dipGeneral: Number(b.dipGeneral) || 0,
          dipConnector: Number(b.dipConnector) || 0,
          dipWire: Number(b.dipWire) || 0,
          waveGeneral: Number(b.waveGeneral) || 0,
          waveConnector: Number(b.waveConnector) || 0,
          waveWire: Number(b.waveWire) || 0
        };
      });
    }
    return [{
      pcbName: 'PCB 1',
      dipGeneral: Number(data.dipGeneral) || 0,
      dipConnector: Number(data.dipConnector) || 0,
      dipWire: Number(data.dipWire) || 0,
      waveGeneral: Number(data.waveGeneral) || 0,
      waveConnector: Number(data.waveConnector) || 0,
      waveWire: Number(data.waveWire) || 0
    }];
  }

  function computeDipBoardUnit_(b) {
    return (Number(b.dipGeneral) || 0) * 400 + (Number(b.dipConnector) || 0) * 450 + (Number(b.dipWire) || 0) * 500
      + (Number(b.waveGeneral) || 0) * 300 + (Number(b.waveConnector) || 0) * 350 + (Number(b.waveWire) || 0) * 400;
  }

  /** PCB별 납땜 합산 (완제품 1대당) */
  function aggregateDipFromPcbBoards_(dipBoards) {
    var unit = 0;
    var boardDetails = [];
    (dipBoards || []).forEach(function(b) {
      var boardUnit = computeDipBoardUnit_(b);
      unit += boardUnit;
      boardDetails.push({
        pcbName: b.pcbName,
        dipGeneral: Number(b.dipGeneral) || 0,
        dipConnector: Number(b.dipConnector) || 0,
        dipWire: Number(b.dipWire) || 0,
        waveGeneral: Number(b.waveGeneral) || 0,
        waveConnector: Number(b.waveConnector) || 0,
        waveWire: Number(b.waveWire) || 0,
        boardUnit: boardUnit
      });
    });
    return { dipUnit: unit, boardDetails: boardDetails };
  }

  function calculateEstimate(data) {
    const qty = Number(data.boardQty) || 0;
    const today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
    // 수정 모달에서 재계산 시 기존 번호 사용(전체 시트 스캔하는 generateQuoteNumber 생략)
    var quoteNumber;
    if (data && data.existingQuoteNumber) {
      quoteNumber = String(data.existingQuoteNumber);
    } else {
      quoteNumber = generateQuoteNumber(data && data.quoteType);
    }
    
    var pcbBoards = normalizeSmtPcbBoards_(data);
    var smtAgg = aggregateSmtFromPcbBoards_(pcbBoards);
    const smtUnit = smtAgg.smtLaborUnit;
    const smtSetupAmount = smtAgg.smtSetupAmount;
    const setupPartCount = smtAgg.setupPartCount;
    const smtLabor = {
      smtLaborUnit: smtAgg.smtLaborUnit,
      smtLaborRaw: smtAgg.smtLaborRaw,
      smtLaborMinApplied: smtAgg.smtLaborMinApplied,
      smtLaborMinAdjustment: smtAgg.smtLaborMinAdjustment
    };
    const dipBoards = normalizeDipPcbBoards_(data);
    const dipAgg = aggregateDipFromPcbBoards_(dipBoards);
    const dipUnit = dipAgg.dipUnit;
    // 후공정 3종: 조립, 테스트, 포장 - 각 분당 540원
    const POST_RATE = 540;
    const postAssembly = Number(data.postAssembly) || 0;
    const postTest = Number(data.postTest) || 0;
    const postPacking = Number(data.postPacking) || 0;
    const postProcessUnit = (postAssembly + postTest + postPacking) * POST_RATE;
    const matUnit = (Number(data.materialCost) || 0);
    
    const laborTotalRaw = (smtUnit + dipUnit + postProcessUnit) * qty;
    const matTotalRaw = matUnit * qty;

    const smtTotalBase = Math.floor(smtUnit * qty) + smtSetupAmount;
    const dipTotalBase = Math.floor(dipUnit * qty);
    const postProcessTotalBase = Math.floor(postProcessUnit * qty);
    const smtTotal = smtTotalBase;
    const dipTotal = dipTotalBase;
    const postProcessTotal = postProcessTotalBase;
    const laborMarkupTotal = 0;
    const laborFinal = smtTotal + dipTotal + postProcessTotal;
    // 부자재: (SMT+납땜+후공정) 합계의 10%
    const subMaterialTotal = Math.round(laborFinal * 0.10);

    const subtotalBeforeDiscount = laborFinal + matTotalRaw + subMaterialTotal;
    var specialDiscount = Math.max(0, Math.round(Number(data.specialDiscount) || 0));
    if (specialDiscount > subtotalBeforeDiscount) specialDiscount = subtotalBeforeDiscount;
    const grandTotal = subtotalBeforeDiscount - specialDiscount;

    return {
      estNo: quoteNumber,
      date: today,
      qty: qty,
      internal: {
        smt: (smtUnit * qty).toLocaleString(),
        dip: (dipUnit * qty).toLocaleString(),
        postProcess: (postProcessUnit * qty).toLocaleString()
      },
      client: {
        smt: smtTotal.toLocaleString(),
        dip: dipTotal.toLocaleString(),
        postProcess: postProcessTotal.toLocaleString()
      },
      common: {
        mat: matTotalRaw.toLocaleString(),
        setup: '0',
        smtSetup: smtSetupAmount,
        smtSetupPartCount: setupPartCount,
        smtLaborPerUnit: smtLabor.smtLaborUnit,
        smtLaborRawPerUnit: smtLabor.smtLaborRaw,
        smtLaborMinApplied: smtLabor.smtLaborMinApplied,
        smtLaborMinAdjustment: smtLabor.smtLaborMinAdjustment,
        pcbBoardCount: Number(data.pcbBoardCount) || pcbBoards.length,
        pcbBoardDetails: smtAgg.boardDetails,
        dipBoardDetails: dipAgg.boardDetails,
        subMaterial: subMaterialTotal,
        laborMarkupPercent: 0,
        laborMarkup: '0',
        laborMarkupPerUnit: qty > 0 ? Math.round(laborMarkupTotal / qty) : 0,
        specialDiscount: specialDiscount,
        subtotalBeforeDiscount: subtotalBeforeDiscount,
        unitTotal: Math.floor(grandTotal / (qty || 1)).toLocaleString(),
        grandTotal: Math.floor(grandTotal).toLocaleString()
      },
      values: {
        smt: smtTotal,
        dip: dipTotal,
        postProcess: postProcessTotal,
        assy: postProcessTotal,
        laborMarkup: laborMarkupTotal,
        specialDiscount: specialDiscount,
        subtotalBeforeDiscount: subtotalBeforeDiscount,
        grandTotal: Math.floor(grandTotal)
      }
    };
  }

  function saveQuote(quoteData) {
    try {
      const sheet = getQuoteSheet();
      // 헤더 확인 및 컬럼 구조 업데이트
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const expectedHeaders = ['견적일', '견적서번호', '고객사', '제품명', '수량', '견적금액', '상세정보'];
      
      // 헤더가 다르면 업데이트
      if (headers.length !== expectedHeaders.length || headers.join(',') !== expectedHeaders.join(',')) {
        sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
        sheet.getRange(1, 1, 1, expectedHeaders.length)
          .setBackground('#f7fafc')
          .setFontColor('#4a5568')
          .setFontWeight('bold');
      }
      
      // 상세정보 JSON 생성
      const detailInfo = {
        amounts: {
          smt: quoteData.smt || 0,
          dip: quoteData.dip || 0,
          assembly: quoteData.assembly || 0,
          test: quoteData.test || 0,
          packing: quoteData.packing || 0,
          materialCost: quoteData.materialCost || 0,
          setupCost: quoteData.setupCost || 0
        },
        inputs: quoteData.inputs || {},
        settings: quoteData.settings || {}
      };
      
      var quoteProductName = _mergeVersionIntoProductName_(
        quoteData.productName || '',
        quoteData.version || ''
      );
      const rowData = [
        quoteData.quoteDate || '',
        quoteData.quoteNumber || '',
        quoteData.customer || '',
        quoteProductName,
        quoteData.boardQty || 0,
        quoteData.totalAmount || 0,
        JSON.stringify(detailInfo)
      ];
      
      // 최신 행이 위에 오도록 헤더(1행) 바로 아래에 삽입
      sheet.insertRowBefore(2);
      // getRange(시작행, 시작열, 행개수, 열개수) — 2행짜리로 잡으면 setValues 1행과 불일치 오류 발생
      sheet.getRange(2, 1, 1, rowData.length).setValues([rowData]);
      clearQuotesCache();
      
      return {
        success: true,
        message: '견적서가 성공적으로 저장되었습니다.',
        quotes: getQuotes()
      };
    } catch (error) {
      Logger.log('견적서 저장 오류: ' + error.toString());
      return {
        success: false,
        message: '견적서 저장 중 오류가 발생했습니다: ' + error.toString()
      };
    }
  }

  function updateQuote(quoteData) {
    try {
      const sheet = getQuoteSheet();
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      // 견적서번호로 행 찾기
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        if (row[1] && row[1].toString() === quoteData.quoteNumber) {
          // 상세정보 JSON 생성
          const detailInfo = {
            amounts: {
              smt: quoteData.smt || 0,
              dip: quoteData.dip || 0,
              assembly: quoteData.assembly || 0,
              test: quoteData.test || 0,
              packing: quoteData.packing || 0,
              materialCost: quoteData.materialCost || 0,
              setupCost: quoteData.setupCost || 0
            },
            inputs: quoteData.inputs || {},
            settings: quoteData.settings || {}
          };
          
          // 해당 행 업데이트
          var updProductName = _mergeVersionIntoProductName_(
            quoteData.productName || '',
            quoteData.version || ''
          );
          sheet.getRange(i + 1, 1, 1, 7).setValues([[
            quoteData.quoteDate || row[0],
            quoteData.quoteNumber || '',
            quoteData.customer || '',
            updProductName,
            quoteData.boardQty || 0,
            quoteData.totalAmount || 0,
            JSON.stringify(detailInfo)
          ]]);
          
          clearQuotesCache();
          return {
            success: true,
            message: '견적서가 성공적으로 수정되었습니다.',
            quotes: getQuotes()
          };
        }
      }
      
      return {
        success: false,
        message: '견적서를 찾을 수 없습니다.'
      };
    } catch (error) {
      Logger.log('견적서 수정 오류: ' + error.toString());
      return {
        success: false,
        message: '견적서 수정 중 오류가 발생했습니다: ' + error.toString()
      };
    }
  }

  function getQuoteByNumber(quoteNumber) {
    try {
      if (!quoteNumber) return null;
      const sheet = getQuoteSheet();
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return null;

      var row = null;
      var foundCell = sheet.getRange(2, 2, lastRow, 2).createTextFinder(String(quoteNumber)).matchEntireCell(true).findNext();
      if (foundCell) {
        var r = foundCell.getRow();
        row = sheet.getRange(r, 1, r, 7).getValues()[0];
      } else {
        var values = sheet.getDataRange().getValues();
        for (var i = 1; i < values.length; i++) {
          if (values[i][1] && values[i][1].toString() === quoteNumber.toString()) {
            row = values[i];
            break;
          }
        }
      }
      if (!row) return null;
      return quoteFromRowValues(row);
    } catch (error) {
      Logger.log('견적서 조회 오류: ' + error.toString());
      return null;
    }
  }

  function deleteQuote(quoteNumber) {
    try {
      const sheet = getQuoteSheet();
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      // 견적서번호로 행 찾기
      for (var i = 1; i < values.length; i++) {
        if (values[i][1] && values[i][1].toString() === quoteNumber) {
          // 행 삭제 (헤더 제외하므로 i+1)
          sheet.deleteRow(i + 1);
          clearQuotesCache();
          return true;
        }
      }
      
      return false;
    } catch (error) {
      Logger.log('견적서 삭제 오류: ' + error.toString());
      throw error;
    }
  }

  function setQuoteStatus(quoteNumber, status) {
    try {
      const sheet = getQuoteSheet();
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      // 견적서번호로 행 찾기
      for (var i = 1; i < values.length; i++) {
        if (values[i][1] && values[i][1].toString() === quoteNumber) {
          // 상세정보 JSON 가져오기
          let detailInfo = {};
          if (values[i][7] && values[i][7].toString().trim() !== '') {
            try {
              detailInfo = JSON.parse(values[i][7].toString());
            } catch (e) {
              Logger.log('JSON 파싱 오류: ' + e.toString());
            }
          }
          
          // 상태 업데이트
          detailInfo.status = status;
          
          // 상세정보 업데이트
          sheet.getRange(i + 1, 8).setValue(JSON.stringify(detailInfo));
          clearQuotesCache();
          
          return true;
        }
      }
      
      return false;
    } catch (error) {
      Logger.log('견적서 상태 변경 오류: ' + error.toString());
      throw error;
    }
  }

  // ========== 주문서 관련 함수 ==========

  function getOrderSheet() {
    try {
      const ss = getSpreadsheet();
      let sheet = ss.getSheetByName('주문서');

      var newHeaders = ['주문일', '주문서번호', '고객사', '제품코드', '제품명', '수량', '단가', '주문금액', '구분', '납기일'];

      if (!sheet) {
        sheet = ss.insertSheet('주문서');
        sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
        sheet.getRange(1, 1, 1, newHeaders.length)
          .setBackground('#f7fafc')
          .setFontColor('#4a5568')
          .setFontWeight('bold');
        return sheet;
      }

      try {
        var lr = sheet.getLastRow();
        var lc = Math.max(10, sheet.getLastColumn());
        var oldHeader = sheet.getRange(1, 1, 1, lc).getValues()[0] || [];
        var h0 = String(oldHeader[0] || '').trim();
        var h1 = String(oldHeader[1] || '').trim();
        var h2 = String(oldHeader[2] || '').trim();
        var h5 = String(oldHeader[5] || '').trim();
        var h8 = String(oldHeader[8] || '').trim();
        var h9 = String(oldHeader[9] || '').trim();
        var isNew10 = h0 === '주문일' && h1 === '주문서번호' && h2 === '고객사' && h5 === '수량' && h9 === '납기일';
        var isNew11 = h0 === '주문일' && h1 === '주문서번호' && h2 === '고객사' && h5 === '버전';
        if (!isNew10 && isNew11 && lr >= 1) {
          var all11 = sheet.getRange(1, 1, lr, Math.max(11, lc)).getValues();
          var out10 = [newHeaders];
          for (var mi = 1; mi < all11.length; mi++) {
            var rr = all11[mi] || [];
            var pName = _mergeVersionIntoProductName_(rr[4], rr[5]);
            out10.push([
              rr[0] || '',
              rr[1] || '',
              rr[2] || '',
              rr[3] || '',
              pName,
              rr[6] != null ? rr[6] : 0,
              rr[7] != null ? rr[7] : 0,
              rr[8] != null ? rr[8] : 0,
              rr[9] != null ? String(rr[9]) : '',
              rr[10] || ''
            ]);
          }
          sheet.clearContents();
          if (out10.length > 0) sheet.getRange(1, 1, out10.length, 10).setValues(out10);
          sheet.getRange(1, 1, 1, 10).setBackground('#f7fafc').setFontColor('#4a5568').setFontWeight('bold');
        } else if (!isNew10 && !isNew11) {
          var all = lr >= 1 ? sheet.getRange(1, 1, lr, lc).getValues() : [];
          var out = [newHeaders];
          for (var i = 1; i < all.length; i++) {
            var r = all[i] || [];
            var detail = {};
            if (r[9] && String(r[9]).trim() !== '') {
              try {
                detail = JSON.parse(String(r[9]));
              } catch (e0) {
                detail = {};
              }
            }
            var orderDate = r[0] || '';
            var orderNo = r[1] || '';
            var deliveryDate = r[2] || '';
            var customer = r[3] || '';
            var productCode = r[4] || '';
            var productName = r[5] || '';
            var quantity = r[7] || 0;
            var orderAmount = r[8] || 0;
            var unitPrice = 0;
            var qn = Number(quantity) || 0;
            var an = Number(orderAmount) || 0;
            if (qn > 0 && an > 0) unitPrice = Math.round(an / qn);
            var version = r[6] != null ? String(r[6]).trim() : '';
            var category = detail && detail.status ? String(detail.status) : '확정';
            out.push([
              orderDate,
              orderNo,
              customer,
              productCode,
              _mergeVersionIntoProductName_(productName, version),
              quantity,
              unitPrice,
              orderAmount,
              category,
              deliveryDate
            ]);
          }
          sheet.clearContents();
          if (out.length > 0) sheet.getRange(1, 1, out.length, 10).setValues(out);
          sheet.getRange(1, 1, 1, 10).setBackground('#f7fafc').setFontColor('#4a5568').setFontWeight('bold');
        }
      } catch (e) {
        Logger.log('주문서 헤더/마이그레이션 오류: ' + e.toString());
      }

      return sheet;
    } catch (error) {
      Logger.log('주문서 시트 가져오기 오류: ' + error.toString());
      throw error;
    }
  }

  /** 주문서 구분 정규화 (양산·샘플·자재) */
  function _normalizeOrderCategory_(cat) {
    var c = cat != null ? String(cat).trim() : '';
    if (c === '양산' || c === '샘플' || c === '자재') return c;
    if (c === '확정') return '양산';
    return c || '양산';
  }

  /** 시트 한 행 → 주문 객체 (주문일~납기일 10열) */
  function orderFromRowValues(row) {
    if (!row || row.length < 2) return null;
    if (!row[1] || row[1].toString().trim() === '') return null;
    var quantity = row[5] ? (typeof row[5] === 'number' ? row[5] : parseFloat(row[5]) || 0) : 0;
    var unitPrice = row[6] ? (typeof row[6] === 'number' ? row[6] : parseFloat(row[6]) || 0) : 0;
    var orderAmount = row[7] ? (typeof row[7] === 'number' ? row[7] : parseFloat(row[7]) || 0) : 0;
    var category = _normalizeOrderCategory_(row[8]);
    var detailInfo = { status: category, source: 'manual', productCode: row[3] ? String(row[3]) : '' };
    return {
      orderNumber: row[1] ? row[1].toString() : '',
      orderDate: row[0] ? (row[0] instanceof Date ?
        Utilities.formatDate(row[0], Session.getScriptTimeZone(), 'yyyy-MM-dd') :
        row[0].toString()) : '',
      deliveryDate: row[9] ? (row[9] instanceof Date ?
        Utilities.formatDate(row[9], Session.getScriptTimeZone(), 'yyyy-MM-dd') :
        row[9].toString()) : '',
      customer: row[2] ? row[2].toString() : '',
      productCode: row[3] ? row[3].toString() : '',
      productName: row[4] ? row[4].toString() : '',
      version: '',
      quantity: quantity,
      unitPrice: unitPrice,
      orderAmount: orderAmount,
      category: category,
      detailInfo: detailInfo
    };
  }

  function generateOrderNumber() {
    try {
      const sheet = getOrderSheet();
      const today = new Date();
      const yearShort = String(today.getFullYear()).slice(-2); // YY (예: 26)
      const month = String(today.getMonth() + 1).padStart(2, '0'); // MM (예: 04)
      const yymm = yearShort + month;
      const prefix = `MRO${yymm}`; // 예: MRO2604
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      let maxNumber = 0;

      for (var i = 1; i < values.length; i++) {
        var raw = values[i][1];
        var orderNumber = raw != null ? String(raw).trim() : '';
        if (!orderNumber) continue;

        // 신규 규칙: MRO + YYMM + 3자리 순번
        if (orderNumber.indexOf(prefix) === 0) {
          var m = orderNumber.match(/^MRO(\d{4})(\d{3})$/);
          if (m && m[1] === yymm) {
            var num = parseInt(m[2], 10) || 0;
            if (num > maxNumber) maxNumber = num;
          }
        }
      }

      // 새 번호 생성 (월별 3자리 순번)
      const newNumber = String(maxNumber + 1).padStart(3, '0');
      return prefix + newNumber;
    } catch (error) {
      Logger.log('주문서번호 생성 오류: ' + error.toString());
      throw error;
    }
  }

  function _isOrderNumberExists_(orderNumber) {
    var no = orderNumber != null ? String(orderNumber).trim() : '';
    if (!no) return false;
    var sheet = getOrderSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return false;
    var values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (var i = 0; i < values.length; i++) {
      var cur = values[i] && values[i][0] != null ? String(values[i][0]).trim() : '';
      if (cur === no) return true;
    }
    return false;
  }

  /**
   * 주문서 제품 검증 — 제품명 필수. 제품코드는 선택(있으면 제품BOM 코드·명 일치 확인).
   */
  function _validateOrderProductAgainstProductBom_(productCode, productName) {
    var code = productCode != null ? String(productCode).trim() : '';
    var name = productName != null ? String(productName).trim() : '';
    if (!name) return { ok: false, message: '제품명을 입력하세요.' };
    if (!code) {
      return { ok: true, matched: { productCode: '', productName: name, version: '' } };
    }
    var sheet = getProductBomSheet();
    if (!sheet || sheet.getLastRow() < 2) {
      return {
        ok: false,
        message: '「제품BOM」시트가 없거나 데이터가 없습니다. 주문 제품을 쓰려면 제품BOM에 부모 제품 행을 추가하세요.'
      };
    }
    var values = sheet.getDataRange().getValues();
    var header = values[0] || [];
    var iCode = _findHeaderIndexByNames_(header, ['제품코드']);
    var iName = _findHeaderIndexByNames_(header, ['제품명']);
    if (iCode < 0) return { ok: false, message: '제품BOM에 제품코드 열이 없습니다.' };
    for (var i = 1; i < values.length; i++) {
      var r = values[i] || [];
      var rc = r[iCode] != null ? String(r[iCode]).trim() : '';
      if (rc !== code) continue;
      if (iName < 0) return { ok: true, matched: { productCode: code, productName: name, version: '' } };
      var rn = r[iName] != null ? String(r[iName]).trim() : '';
      if (rn === name) return { ok: true, matched: { productCode: code, productName: name, version: '' } };
    }
    return {
      ok: false,
      message: '입력한 제품코드/제품명은 제품BOM에 등록된 조합과 일치해야 합니다.'
    };
  }

  /** 주문 시트 읽기 캐시 TTL(초) — 동일 실행·짧은 간격 getOrders() 반복 방지 */
  var ORDERS_CACHE_TTL_SEC = 90;
  var ORDERS_CACHE_SCRIPT_KEY = 'ERP_ORDERS_PKG_V1';
  var __ordersCachePkg_ = null;

  function invalidateOrdersCache_() {
    __ordersCachePkg_ = null;
    __orderDashboardPageCache_ = null;
    __smtManualOptionsCache_ = null;
    invalidateProductionPlanPageCache_();
    invalidateAssemblyPageDataCaches_();
    try {
      var c = CacheService.getScriptCache();
      c.remove(ORDERS_CACHE_SCRIPT_KEY);
      c.remove(ORDER_DASHBOARD_PAGE_CACHE_SCRIPT_KEY);
      c.remove(SMT_MANUAL_OPTIONS_CACHE_SCRIPT_KEY);
    } catch (eInv) {}
  }

  function _loadOrdersFromSheetRaw_() {
    const sheet = getOrderSheet();
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    if (values.length <= 1) {
      return [];
    }
    const orders = [];
    var lineSeqByOrder = {};
    for (var i = 1; i < values.length; i++) {
      var o = orderFromRowValues(values[i]);
      if (!o) continue;
      var on = String(o.orderNumber != null ? o.orderNumber : '').trim();
      var seq = lineSeqByOrder[on] || 0;
      lineSeqByOrder[on] = seq + 1;
      _enrichOrderLineMeta_(o, i + 1, seq);
      orders.push(o);
    }
    return orders;
  }

  function _buildOrdersCachePkg_(orders) {
    var byNumber = {};
    for (var i = 0; i < orders.length; i++) {
      var o = orders[i];
      if (!o) continue;
      var on = String(o.orderNumber != null ? o.orderNumber : '').trim();
      if (!on) continue;
      if (!byNumber[on]) byNumber[on] = [];
      byNumber[on].push(o);
    }
    return { list: orders, byNumber: byNumber, loadedAt: Date.now() };
  }

  function _getOrdersCachePkg_() {
    if (
      __ordersCachePkg_ &&
      __ordersCachePkg_.list &&
      Date.now() - __ordersCachePkg_.loadedAt < ORDERS_CACHE_TTL_SEC * 1000
    ) {
      return __ordersCachePkg_;
    }
    try {
      var cached = CacheService.getScriptCache().get(ORDERS_CACHE_SCRIPT_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed && parsed.list && parsed.byNumber) {
          parsed.loadedAt = Date.now();
          __ordersCachePkg_ = parsed;
          return parsed;
        }
      }
    } catch (eCache) {}
    var fresh = _buildOrdersCachePkg_(_loadOrdersFromSheetRaw_());
    __ordersCachePkg_ = fresh;
    try {
      var json = JSON.stringify({ list: fresh.list, byNumber: fresh.byNumber });
      if (json.length <= 95000) {
        CacheService.getScriptCache().put(ORDERS_CACHE_SCRIPT_KEY, json, ORDERS_CACHE_TTL_SEC);
      }
    } catch (ePut) {}
    return fresh;
  }

  function getOrders() {
    try {
      return _getOrdersCachePkg_().list;
    } catch (error) {
      Logger.log('주문서 목록 가져오기 오류: ' + error.toString());
      return [];
    }
  }

  var PRODUCTION_PLAN_SHEET_NAME = '생산계획';

  function _normalizePlanScope_(scope) {
    var s = String(scope || '').trim().toLowerCase();
    if (s === 'post' || s === 'post-process' || s === '후공정') return 'post';
    if (s === 'shipment' || s === 'ship' || s === 'outbound' || s === '출하' || s === '출하계획') return 'shipment';
    return 'smt';
  }

  function _productionPlanSheetNameByScope_(scope) {
    var sc = _normalizePlanScope_(scope);
    if (sc === 'post') return '후공정계획';
    if (sc === 'shipment') return '출하계획';
    return PRODUCTION_PLAN_SHEET_NAME;
  }

  function getOrCreateProductionPlanSheet(scope) {
    var sheetName = _productionPlanSheetNameByScope_(scope);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      var headers = ['계획일', '계획종료일', '라인', '주문서번호', '고객사', '제품명', '수량', '구분', '납기일', '목표수량', '수정시각'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setBackground('#f7fafc').setFontWeight('bold');
    } else {
      var lastCol = Math.max(1, sheet.getLastColumn());
      var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
      var idxPlan = _findHeaderIndexByNames_(header, ['계획일']);
      var idxEnd = _findHeaderIndexByNames_(header, ['계획종료일', '종료일', '계획 종료일']);
      if (idxPlan >= 0 && idxEnd < 0) {
        sheet.insertColumnAfter(idxPlan + 1);
        sheet
          .getRange(1, idxPlan + 2)
          .setValue('계획종료일')
          .setBackground('#f7fafc')
          .setFontWeight('bold');
      }
      header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
      if (sheetName === PRODUCTION_PLAN_SHEET_NAME) {
        var idxLine = _findHeaderIndexByNames_(header, ['라인', 'SMT라인', 'Line']);
        if (idxLine < 0) {
          var idxEndCol = _findHeaderIndexByNames_(header, ['계획종료일', '종료일', '계획 종료일']);
          var insertAfter = idxEndCol >= 0 ? idxEndCol + 1 : 2;
          sheet.insertColumnAfter(insertAfter);
          sheet
            .getRange(1, insertAfter + 1)
            .setValue('라인')
            .setBackground('#f7fafc')
            .setFontWeight('bold');
        }
      }
      header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
      var idxTarget = _findHeaderIndexByNames_(header, ['목표수량']);
      if (idxTarget < 0) {
        sheet.insertColumnAfter(sheet.getLastColumn());
        sheet.getRange(1, sheet.getLastColumn()).setValue('목표수량').setBackground('#f7fafc').setFontWeight('bold');
      }
      header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
      var idxUpdated = _findHeaderIndexByNames_(header, ['수정시각']);
      if (idxUpdated < 0) {
        sheet.insertColumnAfter(sheet.getLastColumn());
        sheet.getRange(1, sheet.getLastColumn()).setValue('수정시각').setBackground('#f7fafc').setFontWeight('bold');
      }
    }
    return sheet;
  }

  /** 계획 시작·종료일 정규화 — 종료 미입력 시 시작일과 동일 */
  function _normalizePlanDateRange_(planStart, planEnd) {
    var ps = _toYmd_(planStart);
    if (!ps) return { ok: false, error: '시작일을 선택하세요. (yyyy-MM-dd)' };
    var pe = _toYmd_(planEnd);
    if (!pe) pe = ps;
    if (pe < ps) return { ok: false, error: '종료일은 시작일보다 빠를 수 없습니다.' };
    return { ok: true, planDate: ps, planEndDate: pe };
  }

  function _toYmd_(v) {
    if (v == null || String(v).trim() === '') return '';
    if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
      return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    return s;
  }

  function _getProducedOrderNumberSet_() {
    var out = {};
    try {
      var ss = getSpreadsheet();
      var sh = ss.getSheetByName(SMT_PRODUCTION_RECORD_SHEET_NAME);
      if (!sh) return out;
      var lr = sh.getLastRow();
      if (lr < 2) return out;
      var hm = _getSmtProductionRecordHeaderMap_(sh);
      if (hm.orderNo < 0 || hm.qty < 0) return out;
      var vals = sh.getRange(2, 1, lr - 1, hm.width).getValues();
      for (var i = 0; i < vals.length; i++) {
        var r = vals[i] || [];
        var no = r[hm.orderNo] != null ? String(r[hm.orderNo]).trim() : '';
        var q = Number(r[hm.qty]);
        if (!no) continue;
        if (!isFinite(q) || q <= 0) continue;
        out[no] = true;
      }
    } catch (e) {
      Logger.log('_getProducedOrderNumberSet_ 오류: ' + e.toString());
    }
    return out;
  }

  function _getProductionPlanHeaderMap_(sheet) {
    var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
    return {
      planDate: _findHeaderIndexByNames_(header, ['계획일']),
      planEndDate: _findHeaderIndexByNames_(header, ['계획종료일', '종료일', '계획 종료일']),
      line: _findHeaderIndexByNames_(header, ['라인', 'SMT라인', 'Line']),
      orderNo: _findHeaderIndexByNames_(header, ['주문서번호']),
      customer: _findHeaderIndexByNames_(header, ['고객사']),
      product: _findHeaderIndexByNames_(header, ['제품명']),
      quantity: _findHeaderIndexByNames_(header, ['수량']),
      category: _findHeaderIndexByNames_(header, ['구분']),
      deliveryDate: _findHeaderIndexByNames_(header, ['납기일']),
      targetQty: _findHeaderIndexByNames_(header, ['목표수량']),
      updatedAt: _findHeaderIndexByNames_(header, ['수정시각']),
      width: header.length
    };
  }

  function _normalizeSmtPlanLineNo_(lineNo) {
    var ln = Math.floor(Number(lineNo) || 0);
    if (ln < 1 || ln > 7) return 0;
    return ln;
  }

  function _smtPlanRowLineFromCell_(row, hm) {
    if (!hm || hm.line < 0) return 1;
    var ln = Math.floor(Number(row[hm.line]) || 0);
    if (ln < 1 || ln > 7) return 1;
    return ln;
  }

  function _planDateRangesOverlap_(startA, endA, startB, endB) {
    var sa = _toYmd_(startA);
    var sb = _toYmd_(startB);
    if (!sa || !sb) return false;
    var ea = _toYmd_(endA) || sa;
    var eb = _toYmd_(endB) || sb;
    if (ea < sa) ea = sa;
    if (eb < sb) eb = sb;
    return sa <= eb && sb <= ea;
  }

  /** 동일 주문·반제품 작업인지 (TOP/BOT 등 면이 달라도 같은 카드) */
  function _smtPlanRowsShareSameJob_(row, hm, orderNo, product, planDisplay) {
    hm = hm || {};
    var curNo = row[hm.orderNo] != null ? String(row[hm.orderNo]).trim() : '';
    if (curNo !== String(orderNo || '').trim()) return false;
    var curPn = hm.product >= 0 && row[hm.product] != null ? String(row[hm.product]).trim() : '';
    if (!product && !planDisplay) return true;
    if (product && curPn === product) return true;
    if (planDisplay && curPn === planDisplay) return true;
    return false;
  }

  /**
   * SMT 생산계획 행 — 목표(계획) 수량 대비 생산등록 누적이 충족됐는지
   */
  function _smtPlanRowIsProductionComplete_(row, hm, cumLookup, smtLookup) {
    if (!row || !hm) return false;
    var ordNo = row[hm.orderNo] != null ? String(row[hm.orderNo]).trim() : '';
    if (!ordNo) return false;
    var prodName = hm.product >= 0 && row[hm.product] != null ? String(row[hm.product]).trim() : '';
    var sideCell = hm.category >= 0 && row[hm.category] != null ? String(row[hm.category]).trim() : '';
    var sideUi = _smtStoredManualSideToUiChoice_(sideCell);
    var target = hm.targetQty >= 0 ? Math.floor(Number(row[hm.targetQty]) || 0) : 0;
    var card = smtLookup ? _findSmtPlanCardFromLookup_(smtLookup, ordNo, prodName, sideCell) : null;
    var orderQty = card
      ? Math.max(0, Math.floor(Number(card.orderQty) || Number(card.quantity) || 0))
      : hm.quantity >= 0
        ? Math.max(0, Math.floor(Number(row[hm.quantity]) || 0))
        : 0;
    if (target <= 0) target = orderQty;
    if (target <= 0) return false;
    var semiCode = card && card.productName != null ? String(card.productName).trim() : prodName;
    var displayName =
      card && card.productDisplayName != null ? String(card.productDisplayName).trim() : prodName;
    var version = card && card.version != null ? String(card.version).trim() : '';
    var sideArg = sideUi === 'SINGLE' ? '' : sideUi;
    var produced = _smtCumFromLookupForSheetModel_(cumLookup, ordNo, displayName, semiCode, sideArg, version);
    return produced >= target;
  }

  /** 같은 라인·겹치는 기간의 생산완료 계획 행 제거 (새 배정 전 슬롯 비움) */
  function _purgeCompletedSmtPlanRowsOnLineRange_(sheet, hm, lineNo, planStart, planEnd, cumLookup, smtLookup) {
    if (!sheet || !hm || lineNo < 1) return;
    var lr = sheet.getLastRow();
    if (lr < 2) return;
    var values = sheet.getRange(2, 1, lr - 1, hm.width).getValues();
    var delRows = [];
    var i;
    for (i = 0; i < values.length; i++) {
      var row = values[i] || [];
      if (_smtPlanRowLineFromCell_(row, hm) !== lineNo) continue;
      var start = _toYmd_(row[hm.planDate]);
      var end = hm.planEndDate >= 0 ? _toYmd_(row[hm.planEndDate]) : start;
      if (!end) end = start;
      if (!_planDateRangesOverlap_(planStart, planEnd, start, end)) continue;
      if (!_smtPlanRowIsProductionComplete_(row, hm, cumLookup, smtLookup)) continue;
      delRows.push(i + 2);
    }
    delRows.sort(function (a, b) {
      return b - a;
    });
    for (i = 0; i < delRows.length; i++) {
      sheet.deleteRow(delRows[i]);
    }
  }

  /**
   * 같은 라인·겹치는 기간에 다른 주문이 이미 있는지 (생산완료 계획은 제외)
   * @return {{orderNumber:string, productName:string, pcbSide:string, planDate:string, planEndDate:string}|null}
   */
  function _findSmtPlanLineDateConflict_(sheet, hm, lineNo, planStart, planEnd, orderNo, product, planDisplay, cumLookup, smtLookup) {
    if (!sheet || !hm || lineNo < 1) return null;
    if (!cumLookup) {
      var qtyMap = _smtBuildQtySummaryMap_() || {};
      cumLookup = _smtBuildOrderProductCumLookup_(qtyMap);
    }
    if (!smtLookup) {
      smtLookup = _buildSmtPlanCardLookup_(_buildSmtProductionPlanCards_());
    }
    var lr = sheet.getLastRow();
    if (lr < 2) return null;
    var values = sheet.getRange(2, 1, lr - 1, hm.width).getValues();
    var i;
    for (i = 0; i < values.length; i++) {
      var row = values[i] || [];
      if (_smtPlanRowLineFromCell_(row, hm) !== lineNo) continue;
      var start = _toYmd_(row[hm.planDate]);
      var end = hm.planEndDate >= 0 ? _toYmd_(row[hm.planEndDate]) : start;
      if (!end) end = start;
      if (!_planDateRangesOverlap_(planStart, planEnd, start, end)) continue;
      if (_smtPlanRowsShareSameJob_(row, hm, orderNo, product, planDisplay)) continue;
      if (_smtPlanRowIsProductionComplete_(row, hm, cumLookup, smtLookup)) continue;
      var conflictOrd = row[hm.orderNo] != null ? String(row[hm.orderNo]).trim() : '';
      var conflictProd = hm.product >= 0 && row[hm.product] != null ? String(row[hm.product]).trim() : '';
      var conflictSide = hm.category >= 0 && row[hm.category] != null ? String(row[hm.category]).trim() : '';
      return {
        orderNumber: conflictOrd,
        productName: conflictProd,
        pcbSide: _smtStoredManualSideToUiChoice_(conflictSide),
        planDate: start,
        planEndDate: end
      };
    }
    return null;
  }

  function _smtPlanRowMatchesCard_(row, hm, orderNo, product, sidePick, planDisplay, lineNo) {
    hm = hm || {};
    var curNo = row[hm.orderNo] != null ? String(row[hm.orderNo]).trim() : '';
    if (curNo !== String(orderNo || '').trim()) return false;
    if (lineNo > 0 && _smtPlanRowLineFromCell_(row, hm) !== lineNo) return false;
    var curPn = hm.product >= 0 && row[hm.product] != null ? String(row[hm.product]).trim() : '';
    var curSide = hm.category >= 0 && row[hm.category] != null ? String(row[hm.category]).trim() : '';
    var sidePickUi = sidePick ? _smtStoredManualSideToUiChoice_(sidePick) : '';
    var curSideUi = _smtStoredManualSideToUiChoice_(curSide);
    if (sidePickUi && curSideUi !== sidePickUi) return false;
    if (!product) return true;
    return curPn === product || (planDisplay && curPn === planDisplay);
  }

  /** 동일 주문·제품·면이 다른 라인에 이미 배정됐는지 */
  function _findSmtPlanSideOnOtherLine_(sheet, hm, orderNo, product, sidePick, planDisplay, exceptLine) {
    if (!sheet || !hm) return 0;
    var lr = sheet.getLastRow();
    if (lr < 2) return 0;
    var values = sheet.getRange(2, 1, lr - 1, hm.width).getValues();
    var i;
    for (i = 0; i < values.length; i++) {
      var row = values[i] || [];
      if (!_smtPlanRowMatchesCard_(row, hm, orderNo, product, sidePick, planDisplay, 0)) continue;
      var rowLine = _smtPlanRowLineFromCell_(row, hm);
      if (exceptLine > 0 && rowLine === exceptLine) continue;
      return rowLine;
    }
    return 0;
  }

  /** 주문·제품에 대한 기존 계획 면 집계 (편집 중인 라인·면 제외) */
  function _getSmtPlannedSidesForOrderProduct_(sheet, hm, orderNo, product, planDisplay, exceptLine, exceptSide) {
    var out = { single: false, top: false, bot: false };
    if (!sheet || !hm) return out;
    var lr = sheet.getLastRow();
    if (lr < 2) return out;
    var exceptSideUi = exceptSide ? _smtStoredManualSideToUiChoice_(exceptSide) : '';
    var values = sheet.getRange(2, 1, lr - 1, hm.width).getValues();
    var i;
    for (i = 0; i < values.length; i++) {
      var row = values[i] || [];
      var curNo = row[hm.orderNo] != null ? String(row[hm.orderNo]).trim() : '';
      if (curNo !== String(orderNo || '').trim()) continue;
      var curPn = hm.product >= 0 && row[hm.product] != null ? String(row[hm.product]).trim() : '';
      if (product && curPn !== product && !(planDisplay && curPn === planDisplay)) continue;
      var rowLine = _smtPlanRowLineFromCell_(row, hm);
      var curSide = hm.category >= 0 && row[hm.category] != null ? String(row[hm.category]).trim() : '';
      var curSideUi = _smtStoredManualSideToUiChoice_(curSide);
      if (exceptLine > 0 && rowLine === exceptLine && curSideUi === exceptSideUi) continue;
      if (curSideUi === 'TOP') out.top = true;
      else if (curSideUi === 'BOT') out.bot = true;
      else if (curSideUi === 'SINGLE') out.single = true;
    }
    return out;
  }

  function _deleteSmtPlanRowsForCard_(sheet, hm, orderNo, product, sidePick, planDisplay, exceptLine) {
    if (!sheet || !hm) return;
    var lr = sheet.getLastRow();
    if (lr < 2) return;
    var values = sheet.getRange(2, 1, lr - 1, hm.width).getValues();
    var delRows = [];
    var i;
    for (i = 0; i < values.length; i++) {
      var row = values[i] || [];
      if (!_smtPlanRowMatchesCard_(row, hm, orderNo, product, sidePick, planDisplay, 0)) continue;
      var rowLine = _smtPlanRowLineFromCell_(row, hm);
      if (exceptLine > 0 && rowLine === exceptLine) continue;
      delRows.push(i + 2);
    }
    delRows.sort(function (a, b) {
      return b - a;
    });
    for (i = 0; i < delRows.length; i++) {
      sheet.deleteRow(delRows[i]);
    }
  }

  function _productionPlanCardKey_(orderNo, productName) {
    return String(orderNo != null ? orderNo : '').trim() + '\x1f' + String(productName != null ? productName : '').trim();
  }

  /** SMT 생산계획 카드 키 — 주문·반제품코드·면·버전·시트행 */
  function _productionPlanCardKeySmt_(orderNo, semiCode, pcbSide, version, sheetRow) {
    var sr =
      sheetRow != null && !isNaN(Number(sheetRow)) && Number(sheetRow) >= 2
        ? String(Math.floor(Number(sheetRow)))
        : '0';
    return (
      String(orderNo != null ? orderNo : '').trim() +
      '\x1f' +
      String(semiCode != null ? semiCode : '').trim() +
      '\x1f' +
      String(pcbSide != null ? pcbSide : '').trim().toUpperCase() +
      '\x1f' +
      String(version != null ? version : '').trim() +
      '\x1f' +
      sr
    );
  }

  function _smtPlanSideProgressState_(orderQty, remainingOnSide) {
    var total = Math.max(0, Math.floor(Number(orderQty) || 0));
    var rem = Math.max(0, Math.floor(Number(remainingOnSide) || 0));
    var produced = Math.max(0, total - rem);
    if (produced <= 0) return 'none';
    if (total > 0 && produced >= total) return 'full';
    return 'progress';
  }

  function _smtPlanRemainForSide_(opt, side) {
    opt = opt || {};
    var raw = String(side != null ? side : '').trim().toUpperCase();
    var qty = Math.max(0, Math.floor(Number(opt.orderQty) || 0));
    if (raw === 'TOP') return Math.max(0, Math.floor(Number(opt.remainingQtyTop) || 0));
    if (raw === 'BOT') return Math.max(0, Math.floor(Number(opt.remainingQtyBot) || 0));
    if (raw === 'SINGLE') return Math.max(0, Math.floor(Number(opt.remainingQty) || 0));
    return qty;
  }

  /** SMT 생산계획 — 생산등록과 동일 주문·반제품·면·진행률, 출하완료 제외 */
  function _buildSmtProductionPlanCards_() {
    var orders = getOrders() || [];
    var shipMap = getOrderShipmentCountsMap_() || {};
    var qtyMap = _smtBuildQtySummaryMap_() || {};
    var cumLookup = _smtBuildOrderProductCumLookup_(qtyMap);
    var collectCtx = _smtBuildSemiCollectContext_();
    var semiPlanByKey = {};
    var cards = [];
    var i;
    for (i = 0; i < orders.length; i++) {
      var O = orders[i] || {};
      if (_isOrderLineFullyShipped_(O, shipMap)) continue;
      var oNum = O.orderNumber != null ? String(O.orderNumber).trim() : '';
      if (!oNum) continue;
      var parentPnm = O.productName != null ? String(O.productName).trim() : '';
      if (!parentPnm) continue;
      var vv = O.version != null ? String(O.version).trim() : '';
      var qty = Number(O.quantity) || 0;
      var parentSheetRow = O.sheetRow != null ? Math.floor(Number(O.sheetRow)) : 0;
      var productCode = O.productCode != null ? String(O.productCode).trim() : '';
      var semiKey = (productCode || parentPnm) + '\x1f' + vv;
      var semiPlan = semiPlanByKey[semiKey];
      if (!semiPlan) {
        semiPlan = _smtCollectSemiMapForOrder_(O, collectCtx);
        semiPlanByKey[semiKey] = semiPlan;
      }
      var baseOpts = [];
      var semiKeys = semiPlan.semiCodes || [];
      if (semiKeys.length) {
        var sk;
        for (sk = 0; sk < semiKeys.length; sk++) {
          var semiCode = semiKeys[sk];
          var semiEnt = (semiPlan.semiMap || {})[semiCode] || {};
          var semiUi = _smtSemiOptionUiText_(semiEnt.displayName, semiCode);
          baseOpts.push({
            orderNumber: oNum,
            productName: semiCode,
            productDisplayName: semiUi,
            version: vv,
            sheetRow: parentSheetRow,
            orderQty: qty,
            remainingQty: Math.max(
              0,
              qty - _smtCumFromLookupForSheetModel_(cumLookup, oNum, semiEnt.displayName, semiCode, '', vv)
            ),
            remainingQtyTop: Math.max(
              0,
              qty - _smtCumFromLookupForSheetModel_(cumLookup, oNum, semiEnt.displayName, semiCode, 'TOP', vv)
            ),
            remainingQtyBot: Math.max(
              0,
              qty - _smtCumFromLookupForSheetModel_(cumLookup, oNum, semiEnt.displayName, semiCode, 'BOT', vv)
            )
          });
        }
      } else {
        baseOpts.push({
          orderNumber: oNum,
          productName: parentPnm,
          productDisplayName: parentPnm,
          version: vv,
          sheetRow: parentSheetRow,
          orderQty: qty,
          remainingQty: Math.max(0, qty - _smtCumFromLookupForSheetModel_(cumLookup, oNum, parentPnm, parentPnm, '', vv)),
          remainingQtyTop: Math.max(0, qty - _smtCumFromLookupForSheetModel_(cumLookup, oNum, parentPnm, parentPnm, 'TOP', vv)),
          remainingQtyBot: Math.max(0, qty - _smtCumFromLookupForSheetModel_(cumLookup, oNum, parentPnm, parentPnm, 'BOT', vv))
        });
      }
      var bi;
      for (bi = 0; bi < baseOpts.length; bi++) {
        var bo = baseOpts[bi] || {};
        var remS = _smtPlanRemainForSide_(bo, '');
        var remT = _smtPlanRemainForSide_(bo, 'TOP');
        var remB = _smtPlanRemainForSide_(bo, 'BOT');
        var remainAgg = Math.max(remS, remT, remB);
        var producedAny =
          Math.max(0, bo.orderQty - remS) > 0 ||
          Math.max(0, bo.orderQty - remT) > 0 ||
          Math.max(0, bo.orderQty - remB) > 0;
        cards.push({
          cardKey: _productionPlanCardKeySmt_(bo.orderNumber, bo.productName, '', bo.version, bo.sheetRow),
          orderNumber: bo.orderNumber,
          customer: O.customer != null ? String(O.customer) : '',
          productName: bo.productName,
          productDisplayName: bo.productDisplayName || bo.productName,
          pcbSide: '',
          version: bo.version || '',
          sheetRow: bo.sheetRow,
          quantity: bo.orderQty,
          remainingQty: remainAgg,
          remainingQtySingle: remS,
          remainingQtyTop: remT,
          remainingQtyBot: remB,
          orderQty: bo.orderQty,
          progressState: _smtPlanSideProgressState_(bo.orderQty, remainAgg),
          category: '',
          deliveryDate: _toYmd_(O.deliveryDate),
          hasProduction: producedAny
        });
      }
    }
    cards.sort(function (a, b) {
      return String(a.orderNumber).localeCompare(String(b.orderNumber), 'ko', { numeric: true });
    });
    return cards;
  }

  function _findSmtPlanCardBySheetRow_(cards, ordNo, productCell, sideCell) {
    var lookup = _buildSmtPlanCardLookup_(cards);
    return _findSmtPlanCardFromLookup_(lookup, ordNo, productCell, sideCell);
  }

  /** SMT 생산계획 시트 행 → 카드 O(1) 매칭용 */
  function _buildSmtPlanCardLookup_(cards) {
    var map = {};
    cards = Array.isArray(cards) ? cards : [];
    var i;
    for (i = 0; i < cards.length; i++) {
      var c = cards[i] || {};
      var on = String(c.orderNumber || '').trim();
      if (!on) continue;
      var pn = String(c.productName || '').trim();
      var pd = String(c.productDisplayName || '').trim();
      if (pn) map[on + '\x1f' + pn] = c;
      if (pd && pd !== pn) map[on + '\x1f' + pd] = c;
    }
    return map;
  }

  function _findSmtPlanCardFromLookup_(lookup, ordNo, productCell, sideCell) {
    lookup = lookup && typeof lookup === 'object' ? lookup : {};
    var on = String(ordNo || '').trim();
    var pn = String(productCell || '').trim();
    if (!on) return null;
    if (pn) {
      var hit = lookup[on + '\x1f' + pn];
      if (hit) return hit;
      var pnLow = pn.toLowerCase();
      var keys = Object.keys(lookup);
      var ki;
      for (ki = 0; ki < keys.length; ki++) {
        var k = keys[ki];
        if (k.indexOf(on + '\x1f') !== 0) continue;
        var c = lookup[k];
        if (!c) continue;
        var pName = String(c.productName || '').trim().toLowerCase();
        var pDisp = String(c.productDisplayName || '').trim().toLowerCase();
        if (pnLow === pName || pnLow === pDisp) return c;
        if (pDisp && (pnLow.indexOf(pDisp) >= 0 || pDisp.indexOf(pnLow) >= 0)) return c;
      }
    }
    return null;
  }

  function _buildProductionPlanPageData_(scope) {
    var sc = _normalizePlanScope_(scope);
    var orderByCardKey = {};
    var cards = [];
    var smtLookup = null;
    if (sc === 'smt') {
      cards = _buildSmtProductionPlanCards_();
      smtLookup = _buildSmtPlanCardLookup_(cards);
      for (var ci = 0; ci < cards.length; ci++) {
        var ck = String(cards[ci].cardKey || '');
        if (ck) orderByCardKey[ck] = cards[ci];
      }
    } else {
        var orders = getOrders() || [];
        var produced = _getProducedOrderNumberSet_();
        var postCounts = {};
        try {
          postCounts = getPostProcessCountsMap_() || {};
        } catch (pcErr) {
          postCounts = {};
        }
        for (var i = 0; i < orders.length; i++) {
          var o = orders[i] || {};
          var no = o.orderNumber != null ? String(o.orderNumber).trim() : '';
          var pn = o.productName != null ? String(o.productName).trim() : '';
          if (!no) continue;
          var cardKey = _productionPlanCardKey_(no, pn);
          orderByCardKey[cardKey] = o;
          cards.push({
            cardKey: cardKey,
            orderNumber: no,
            customer: o.customer != null ? String(o.customer) : '',
            productName: pn,
            quantity: Number(o.quantity) || 0,
            remainingQty: Math.max(0, (Number(o.quantity) || 0) - (Number(postCounts[no]) || 0)),
            category: o.category != null ? String(o.category) : '',
            deliveryDate: _toYmd_(o.deliveryDate),
            hasProduction: !!produced[no]
          });
        }
        cards.sort(function (a, b) {
          return String(a.orderNumber).localeCompare(String(b.orderNumber), 'ko', { numeric: true });
        });
      }

      var plans = [];
      var sheet = getOrCreateProductionPlanSheet(sc);
      var hm = _getProductionPlanHeaderMap_(sheet);
      if (hm.planDate < 0 || hm.orderNo < 0) {
        return { ok: false, error: '생산계획 시트 헤더가 올바르지 않습니다.', cards: cards, plans: [] };
      }
      var lr = sheet.getLastRow();
      if (lr > 1) {
        var values = sheet.getRange(2, 1, lr - 1, hm.width).getValues();
        for (var r = 0; r < values.length; r++) {
          var row = values[r] || [];
          var dateYmd = _toYmd_(row[hm.planDate]);
          var dateEndYmd =
            hm.planEndDate >= 0 ? _toYmd_(row[hm.planEndDate]) : '';
          if (!dateEndYmd) dateEndYmd = dateYmd;
          var ordNo = row[hm.orderNo] != null ? String(row[hm.orderNo]).trim() : '';
          var prodName = hm.product >= 0 && row[hm.product] != null ? String(row[hm.product]).trim() : '';
          var sideCell = hm.category >= 0 && row[hm.category] != null ? String(row[hm.category]).trim() : '';
          var cardKey = '';
          if (sc === 'smt') {
            var smtCard = _findSmtPlanCardFromLookup_(smtLookup, ordNo, prodName, sideCell);
            if (!smtCard) continue;
            cardKey = String(smtCard.cardKey || '');
          } else {
            cardKey = _productionPlanCardKey_(ordNo, prodName);
          }
          if (!dateYmd || !ordNo) continue;
          if (!cardKey || !orderByCardKey[cardKey]) continue;
          var tq = hm.targetQty >= 0 ? Number(row[hm.targetQty]) : 0;
          var planLineNo = sc === 'smt' ? _smtPlanRowLineFromCell_(row, hm) : 0;
          var planSideUi = sc === 'smt' ? _smtStoredManualSideToUiChoice_(sideCell) : '';
          plans.push({
            cardKey: cardKey,
            orderNumber: ordNo,
            productName: prodName,
            lineNo: planLineNo,
            planDate: dateYmd,
            planEndDate: dateEndYmd,
            targetQty: isFinite(tq) && tq > 0 ? tq : 0,
            pcbSide: planSideUi
          });
        }
      }
    return { ok: true, scope: sc, cards: cards, plans: plans, updatedAt: new Date().toISOString() };
  }

  /**
   * 생산계획 페이지 데이터
   * @return {{ok:boolean, cards:Array, plans:Array, updatedAt:string}}
   */
  /**
   * 후공정·출하 등록 이력 — 캘린더 칩용
   * @param {string} scope 'post' | 'shipment'
   * @param {number=} optMaxRows
   * @return {{ok:boolean, scope?:string, events?:Array, error?:string}}
   */
  function getProductionHistoryCalendarData(scope, optMaxRows) {
    try {
      var sc = _normalizePlanScope_(scope);
      var maxR = optMaxRows > 0 ? Math.floor(optMaxRows) : 500;
      if (sc === 'shipment') {
        var shipHist = getOrderShipmentHistory(maxR);
        if (!shipHist || !shipHist.ok) {
          return { ok: false, error: (shipHist && shipHist.error) || '출하 이력을 불러오지 못했습니다.', events: [] };
        }
        var shipEvents = [];
        var si;
        for (si = 0; si < (shipHist.rows || []).length; si++) {
          var sr = shipHist.rows[si] || {};
          var sDay = _toYmd_(sr.shipDate);
          if (!sDay) continue;
          var sOn = sr.orderNumber != null ? String(sr.orderNumber).trim() : '';
          var sPn = sr.productName != null ? String(sr.productName).trim() : '';
          var sQty = Math.max(0, Math.floor(Number(sr.qty != null ? sr.qty : sr.qtyThis) || 0));
          if (!sOn && !sPn && !sQty) continue;
          shipEvents.push({
            eventKey: sDay + '\x1e' + sOn + '\x1e' + sPn + '\x1e' + si,
            dateYmd: sDay,
            orderNumber: sOn,
            productName: sPn,
            productDisplayName: sPn,
            customer: sr.customer != null ? String(sr.customer).trim() : '',
            qty: sQty,
            qtyLabel: '출하',
            kind: 'shipment',
            unitPrice: Number(sr.unitPrice) || 0,
            supplyAmount: Number(sr.supplyAmount) || 0
          });
        }
        return { ok: true, scope: sc, events: shipEvents };
      }
      if (sc === 'post') {
        var postHist = getPostProcessWorkLog(maxR);
        if (!postHist || !postHist.ok) {
          return { ok: false, error: (postHist && postHist.error) || '후공정 이력을 불러오지 못했습니다.', events: [] };
        }
        var postEvents = [];
        var pi;
        for (pi = 0; pi < (postHist.rows || []).length; pi++) {
          var pr = postHist.rows[pi] || {};
          var pDay = _toYmd_(pr.time);
          if (!pDay) continue;
          var pOn = pr.orderNumber != null ? String(pr.orderNumber).trim() : '';
          var pPn = pr.product != null ? String(pr.product).trim() : '';
          var pQty = Math.max(0, Math.floor(Number(pr.qty) || 0));
          if (!pOn && !pPn && !pQty) continue;
          postEvents.push({
            eventKey: pDay + '\x1e' + pOn + '\x1e' + pPn + '\x1e' + pi,
            dateYmd: pDay,
            orderNumber: pOn,
            productName: pPn,
            productDisplayName: pPn,
            customer: '',
            qty: pQty,
            qtyLabel: '누적',
            kind: 'post',
            timeNote: pr.time != null ? String(pr.time).trim() : ''
          });
        }
        return { ok: true, scope: sc, events: postEvents };
      }
      return { ok: false, error: '지원하지 않는 이력 scope: ' + sc, events: [] };
    } catch (e) {
      Logger.log('getProductionHistoryCalendarData 오류: ' + e.toString());
      return { ok: false, error: e.message || String(e), events: [] };
    }
  }

  function getProductionPlanPageData(scope) {
    try {
      var sc = _normalizePlanScope_(scope);
      var mem = __productionPlanPageCache_[sc];
      if (mem && Date.now() - mem.loadedAt < PRODUCTION_PLAN_PAGE_CACHE_TTL_SEC * 1000) {
        return mem.data;
      }
      try {
        var cached = CacheService.getScriptCache().get(_productionPlanPageCacheScriptKey_(sc));
        if (cached) {
          var parsed = JSON.parse(cached);
          if (parsed && parsed.ok) {
            __productionPlanPageCache_[sc] = { data: parsed, loadedAt: Date.now() };
            return parsed;
          }
        }
      } catch (eCache) {}
      var built = _buildProductionPlanPageData_(sc);
      __productionPlanPageCache_[sc] = { data: built, loadedAt: Date.now() };
      try {
        var json = JSON.stringify(built);
        if (json.length <= 95000) {
          CacheService.getScriptCache().put(
            _productionPlanPageCacheScriptKey_(sc),
            json,
            PRODUCTION_PLAN_PAGE_CACHE_TTL_SEC
          );
        }
      } catch (ePut) {}
      return built;
    } catch (e) {
      Logger.log('getProductionPlanPageData 오류: ' + e.toString());
      return { ok: false, error: e.message || String(e), cards: [], plans: [] };
    }
  }

  /**
   * 생산계획 배정/해제
   * @param {string} orderNumber
   * @param {string} planDate yyyy-MM-dd 시작일, 빈값이면 해제
   * @param {number|string} [targetQty]
   * @param {string} [planEndDate] yyyy-MM-dd 종료일(비우면 시작일과 동일)
   */
  function setProductionPlanDate(
    orderNumber,
    planDate,
    targetQty,
    scope,
    productName,
    pcbSide,
    version,
    sheetRow,
    productDisplayName,
    planEndDate,
    lineNo
  ) {
    try {
      var sc = _normalizePlanScope_(scope);
      var no = orderNumber != null ? String(orderNumber).trim() : '';
      var product = productName != null ? String(productName).trim() : '';
      var planLine = sc === 'smt' ? _normalizeSmtPlanLineNo_(lineNo) : 0;
      var planVer = version != null ? String(version).trim() : '';
      var planSr =
        sheetRow != null && sheetRow !== '' && !isNaN(Number(sheetRow)) ? Math.floor(Number(sheetRow)) : 0;
      var planDisplay = productDisplayName != null ? String(productDisplayName).trim() : '';
      var pd = planDate != null ? String(planDate).trim() : '';
      var tqRaw = targetQty != null ? Number(targetQty) : 0;
      var tq = isFinite(tqRaw) ? Math.max(0, Math.floor(tqRaw)) : 0;
      var sidePick = '';
      if (sc === 'smt') {
        if (pd) {
          var sideParse = _smtParseManualPcbSideChoice_(pcbSide);
          if (!sideParse.ok) return { ok: false, error: sideParse.error };
          sidePick = sideParse.side === '' ? 'SINGLE' : sideParse.side;
        } else if (pcbSide != null && String(pcbSide).trim() !== '') {
          var sideUn = _smtParseManualPcbSideChoice_(pcbSide);
          if (sideUn.ok) sidePick = sideUn.side === '' ? 'SINGLE' : sideUn.side;
        }
      }
      if (!no) return { ok: false, error: '주문서번호가 필요합니다.' };
      var ord = null;
      if (product) ord = _smtFindOrderForManualEntry_(no, product, planVer, planSr);
      if (!ord && product) ord = _postProcessFindOrderByOrderAndProduct_(no, product);
      if (!ord) ord = getOrderByNumber(no);
      if (!ord) return { ok: false, error: '주문서를 찾을 수 없습니다: ' + no };
      if (sc === 'smt' && !planLine) return { ok: false, error: 'SMT 계획은 라인(1~7)을 선택하세요.' };

      var sheet = getOrCreateProductionPlanSheet(sc);
      var hm = _getProductionPlanHeaderMap_(sheet);
      if (hm.orderNo < 0) return { ok: false, error: '생산계획 시트에 주문서번호 헤더가 필요합니다.' };
      if (pd && sc === 'smt') {
        var dupOtherLine = _findSmtPlanSideOnOtherLine_(sheet, hm, no, product, sidePick, planDisplay, planLine);
        if (dupOtherLine > 0) {
          return {
            ok: false,
            error:
              sidePick +
              ' 면은 이미 라인 ' +
              dupOtherLine +
              '에 배정되어 있습니다. 같은 면은 한 번만 배정하세요.'
          };
        }
        var existSides = _getSmtPlannedSidesForOrderProduct_(sheet, hm, no, product, planDisplay, planLine, sidePick);
        if (sidePick === 'SINGLE' && (existSides.top || existSides.bot)) {
          return {
            ok: false,
            error: '이미 TOP/BOT 계획이 있습니다. 양면 제품은 TOP·BOT 각각 별도 배정하세요.'
          };
        }
        if ((sidePick === 'TOP' || sidePick === 'BOT') && existSides.single) {
          return {
            ok: false,
            error: '이미 SINGLE 계획이 있습니다. 단면·양면 계획은 함께 쓸 수 없습니다.'
          };
        }
      }
      var lr = sheet.getLastRow();
      var rowIdx = -1;
      if (lr > 1) {
        var values = sheet.getRange(2, 1, lr - 1, hm.width).getValues();
        for (var i = 0; i < values.length; i++) {
          var row = values[i] || [];
          if (sc === 'smt') {
            if (!_smtPlanRowMatchesCard_(row, hm, no, product, sidePick, planDisplay, planLine)) continue;
            rowIdx = i + 2;
            break;
          }
          var curNo = row[hm.orderNo] != null ? String(row[hm.orderNo]).trim() : '';
          if (curNo !== no) continue;
          var curPn = hm.product >= 0 && row[hm.product] != null ? String(row[hm.product]).trim() : '';
          if (!product || curPn === product) {
            rowIdx = i + 2;
            break;
          }
        }
      }

      if (!pd) {
        if (rowIdx > 1) sheet.deleteRow(rowIdx);
        invalidateProductionPlanPageCache_(sc);
        if (sc === 'smt') __smtPlanLineSyncAt_ = 0;
        return {
          ok: true,
          scope: sc,
          orderNumber: no,
          productName: product || String(ord.productName || ''),
          lineNo: planLine,
          planDate: '',
          planEndDate: '',
          targetQty: 0
        };
      }
      var rangeNorm = _normalizePlanDateRange_(pd, planEndDate);
      if (!rangeNorm.ok) return { ok: false, error: rangeNorm.error };
      pd = rangeNorm.planDate;
      var pdEnd = rangeNorm.planEndDate;

      if (sc === 'smt') {
        var qtyMapPlan = _smtBuildQtySummaryMap_() || {};
        var cumLookupPlan = _smtBuildOrderProductCumLookup_(qtyMapPlan);
        var smtLookupPlan = _buildSmtPlanCardLookup_(_buildSmtProductionPlanCards_());
        _purgeCompletedSmtPlanRowsOnLineRange_(sheet, hm, planLine, pd, pdEnd, cumLookupPlan, smtLookupPlan);
        var lineConflict = _findSmtPlanLineDateConflict_(
          sheet,
          hm,
          planLine,
          pd,
          pdEnd,
          no,
          product,
          planDisplay,
          cumLookupPlan,
          smtLookupPlan
        );
        if (lineConflict) {
          var conflictRange =
            lineConflict.planDate === lineConflict.planEndDate
              ? lineConflict.planDate
              : lineConflict.planDate + ' ~ ' + lineConflict.planEndDate;
          return {
            ok: false,
            error:
              '라인 ' +
              planLine +
              ' · ' +
              pd +
              (pdEnd !== pd ? '~' + pdEnd : '') +
              '에는 이미 다른 주문이 배정되어 있습니다.\n' +
              '기존: ' +
              lineConflict.orderNumber +
              ' · ' +
              lineConflict.productName +
              (lineConflict.pcbSide ? ' · ' + lineConflict.pcbSide : '') +
              ' (' +
              conflictRange +
              ')\n' +
              '같은 라인·기간에는 주문 1건만 배정할 수 있습니다. (같은 주문의 TOP/BOT은 가능)'
          };
        }
      }

      var out = [];
      for (var c = 0; c < hm.width; c++) out.push('');
      if (hm.planDate >= 0) out[hm.planDate] = pd;
      if (hm.planEndDate >= 0) out[hm.planEndDate] = pdEnd;
      if (sc === 'smt' && hm.line >= 0) out[hm.line] = planLine;
      if (hm.orderNo >= 0) out[hm.orderNo] = no;
      if (hm.customer >= 0) out[hm.customer] = ord.customer != null ? String(ord.customer) : '';
      if (hm.product >= 0) {
        if (sc === 'smt') {
          out[hm.product] = planDisplay || _smtSemiOptionUiText_('', product) || product || '';
        } else {
          out[hm.product] = product || (ord.productName != null ? String(ord.productName) : '');
        }
      }
      if (hm.quantity >= 0) out[hm.quantity] = Number(ord.quantity) || 0;
      if (hm.category >= 0) {
        out[hm.category] = sc === 'smt' ? sidePick || 'SINGLE' : ord.category != null ? String(ord.category) : '';
      }
      if (hm.deliveryDate >= 0) out[hm.deliveryDate] = _toYmd_(ord.deliveryDate);
      if (hm.targetQty >= 0) out[hm.targetQty] = tq;
      if (hm.updatedAt >= 0) out[hm.updatedAt] = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      if (sc === 'smt') {
        _deleteSmtPlanRowsForCard_(sheet, hm, no, product, sidePick, planDisplay, planLine);
        lr = sheet.getLastRow();
        rowIdx = -1;
        if (lr > 1) {
          var valuesAfter = sheet.getRange(2, 1, lr - 1, hm.width).getValues();
          for (var ri = 0; ri < valuesAfter.length; ri++) {
            if (_smtPlanRowMatchesCard_(valuesAfter[ri] || [], hm, no, product, sidePick, planDisplay, planLine)) {
              rowIdx = ri + 2;
              break;
            }
          }
        }
      }
      if (rowIdx > 1) {
        sheet.getRange(rowIdx, 1, 1, hm.width).setValues([out]);
      } else {
        sheet.appendRow(out);
      }
      invalidateProductionPlanPageCache_(sc);
      if (sc === 'smt') {
        __smtPlanLineSyncAt_ = 0;
        if (pd && planLine > 0) _smtSetLineRegHoldEmpty_(planLine, false);
      }
      var pairReminder = '';
      if (sc === 'smt' && pd) {
        if (sidePick === 'TOP') {
          var afterTop = _getSmtPlannedSidesForOrderProduct_(sheet, hm, no, product, planDisplay, 0, '');
          if (!afterTop.bot) pairReminder = 'BOT';
        } else if (sidePick === 'BOT') {
          var afterBot = _getSmtPlannedSidesForOrderProduct_(sheet, hm, no, product, planDisplay, 0, '');
          if (!afterBot.top) pairReminder = 'TOP';
        }
      }
      return {
        ok: true,
        scope: sc,
        orderNumber: no,
        productName: product || String(ord.productName || ''),
        lineNo: planLine,
        planDate: pd,
        planEndDate: pdEnd,
        targetQty: tq,
        pcbSide: sc === 'smt' ? sidePick : '',
        pairSideReminder: pairReminder
      };
    } catch (e) {
      Logger.log('setProductionPlanDate 오류: ' + e.toString());
      return { ok: false, error: e.message || String(e) };
    }
  }

  /** 오늘(또는 지정일) 라인별 SMT 계획 큐 정렬 — 같은 주문은 TOP → SINGLE → BOT */
  function _smtPlanQueueSort_(a, b) {
    var ea = a.entry || {};
    var eb = b.entry || {};
    var sameJob =
      String(ea.orderNumber || '').trim() === String(eb.orderNumber || '').trim() &&
      String(ea.productName || '').trim() === String(eb.productName || '').trim();
    if (sameJob) {
      var sideOrder = { TOP: 0, SINGLE: 1, BOT: 2 };
      var sa = sideOrder[String(ea.pcbSide || '').trim().toUpperCase()];
      var sb = sideOrder[String(eb.pcbSide || '').trim().toUpperCase()];
      if (sa == null) sa = 1;
      if (sb == null) sb = 1;
      if (sa !== sb) return sa - sb;
    }
    return (a.rowIndex || 0) - (b.rowIndex || 0);
  }

  function _smtPlanEntryFromRow_(row, hm, lineNo, start, end, smtCard) {
    var ordNo = row[hm.orderNo] != null ? String(row[hm.orderNo]).trim() : '';
    var prodName = hm.product >= 0 && row[hm.product] != null ? String(row[hm.product]).trim() : '';
    var sideCell = hm.category >= 0 && row[hm.category] != null ? String(row[hm.category]).trim() : '';
    var tq = hm.targetQty >= 0 ? Number(row[hm.targetQty]) : 0;
    return {
      lineNo: lineNo,
      cardKey: smtCard ? String(smtCard.cardKey || '') : '',
      orderNumber: ordNo,
      productName: smtCard ? String(smtCard.productName || '').trim() : prodName,
      productDisplayName: smtCard
        ? String(smtCard.productDisplayName || smtCard.productName || '').trim()
        : prodName,
      pcbSide: _smtStoredManualSideToUiChoice_(sideCell),
      version: smtCard ? String(smtCard.version || '').trim() : '',
      sheetRow: smtCard && smtCard.sheetRow != null ? Math.floor(Number(smtCard.sheetRow)) : 0,
      planDate: start,
      planEndDate: end,
      targetQty: isFinite(tq) && tq > 0 ? Math.floor(tq) : 0
    };
  }

  /**
   * 지정일 라인별 SMT 계획 — 미완료 건 중 첫 번째를 활성(active)으로 선택
   * @return {{ activeByLine:Object, metaByLine:Object }}
   */
  function _buildSmtActivePlanPackageForDate_(dateYmd) {
    var day = _toYmd_(dateYmd);
    if (!day) day = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    var activeByLine = {};
    var metaByLine = {};
    var sheet = getOrCreateProductionPlanSheet('smt');
    var hm = _getProductionPlanHeaderMap_(sheet);
    if (hm.planDate < 0 || hm.orderNo < 0) return { activeByLine: activeByLine, metaByLine: metaByLine };
    var cards = _buildSmtProductionPlanCards_();
    var lookup = _buildSmtPlanCardLookup_(cards);
    var qtyMap = _smtBuildQtySummaryMap_() || {};
    var cumLookup = _smtBuildOrderProductCumLookup_(qtyMap);
    var lr = sheet.getLastRow();
    if (lr < 2) return { activeByLine: activeByLine, metaByLine: metaByLine };
    var values = sheet.getRange(2, 1, lr - 1, hm.width).getValues();
    var byLine = {};
    var r;
    for (r = 0; r < values.length; r++) {
      var row = values[r] || [];
      var start = _toYmd_(row[hm.planDate]);
      var end = hm.planEndDate >= 0 ? _toYmd_(row[hm.planEndDate]) : start;
      if (!end) end = start;
      if (!start || day < start || day > end) continue;
      var ordNo = row[hm.orderNo] != null ? String(row[hm.orderNo]).trim() : '';
      if (!ordNo) continue;
      var lineNo = _smtPlanRowLineFromCell_(row, hm);
      if (lineNo < 1) continue;
      var prodName = hm.product >= 0 && row[hm.product] != null ? String(row[hm.product]).trim() : '';
      var sideCell = hm.category >= 0 && row[hm.category] != null ? String(row[hm.category]).trim() : '';
      var smtCard = _findSmtPlanCardFromLookup_(lookup, ordNo, prodName, sideCell);
      if (!smtCard && !prodName) continue;
      if (!byLine[lineNo]) byLine[lineNo] = [];
      byLine[lineNo].push({
        row: row,
        rowIndex: r,
        entry: _smtPlanEntryFromRow_(row, hm, lineNo, start, end, smtCard)
      });
    }
    var ln;
    for (ln in byLine) {
      if (!Object.prototype.hasOwnProperty.call(byLine, ln)) continue;
      var list = byLine[ln];
      list.sort(_smtPlanQueueSort_);
      var total = list.length;
      var completed = 0;
      var active = null;
      var j;
      for (j = 0; j < list.length; j++) {
        if (_smtPlanRowIsProductionComplete_(list[j].row, hm, cumLookup, lookup)) {
          completed++;
        } else if (!active) {
          active = list[j].entry;
        }
      }
      metaByLine[ln] = {
        total: total,
        completed: completed,
        pending: Math.max(0, total - completed),
        allComplete: total > 0 && completed >= total
      };
      if (active) activeByLine[ln] = active;
    }
    return { activeByLine: activeByLine, metaByLine: metaByLine };
  }

  /** 오늘(또는 지정일) 라인별 활성 SMT 생산계획 — lineNo → 배정 정보 (미완료 큐 중 1건) */
  function _getSmtActivePlanByLineForDate_(dateYmd) {
    return _buildSmtActivePlanPackageForDate_(dateYmd).activeByLine;
  }

  function _smtLineStateMatchesPlan_(st, plan) {
    st = st && typeof st === 'object' ? st : {};
    plan = plan && typeof plan === 'object' ? plan : {};
    if (String(st.manualOrderNumber || '').trim() !== String(plan.orderNumber || '').trim()) return false;
    if (String(st.manualProductName || '').trim() !== String(plan.productName || '').trim()) return false;
    if (
      String(st.manualOrderSide || '')
        .trim()
        .toUpperCase() !== String(plan.pcbSide || '').trim().toUpperCase()
    ) {
      return false;
    }
    if (String(st.manualVersion || '').trim() !== String(plan.version || '').trim()) return false;
    var stSr = st.manualSheetRow != null ? Math.floor(Number(st.manualSheetRow)) : 0;
    var plSr = plan.sheetRow != null ? Math.floor(Number(plan.sheetRow)) : 0;
    return stSr === plSr;
  }

  var __smtPlanLineSyncDay_ = '';
  var __smtPlanLineSyncAt_ = 0;

  /** 생산계획(오늘) → SMT 라인 1~7 수동 배정 동기화 */
  function syncSmtLinesFromProductionPlan_(dateYmd) {
    var day = _toYmd_(dateYmd);
    if (!day) day = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    var planPkg = _buildSmtActivePlanPackageForDate_(day);
    var plansByLine = planPkg.activeByLine || {};
    var props = PropertiesService.getScriptProperties();
    var line;
    for (line = 1; line <= 7; line++) {
      var plan = plansByLine[line] || null;
      var key = _smtLineStateKey(line);
      var prev = {};
      try {
        var raw = props.getProperty(key);
        if (raw) prev = JSON.parse(raw);
      } catch (ePrev) {
        prev = {};
      }
      if (plan) {
        if (_smtLineRegHoldEmptyToday_(line)) continue;
        if (_smtLineStateMatchesPlan_(prev, plan)) continue;
        var setRes = setSmtLineManualEntry(line, {
          orderNumber: plan.orderNumber,
          productName: plan.productName,
          pcbSide: plan.pcbSide,
          version: plan.version,
          sheetRow: plan.sheetRow
        });
        if (!setRes || !setRes.ok) {
          Logger.log(
            'syncSmtLinesFromProductionPlan_ L' +
              line +
              ': ' +
              (setRes && setRes.error ? setRes.error : '배정 동기화 실패')
          );
        }
      } else if (String(prev.manualOrderNumber || '').trim() !== '') {
        setSmtLineManualEntry(line, { orderNumber: '' });
      }
    }
    return { ok: true, dateYmd: day, linePlans: plansByLine, linePlanMeta: planPkg.metaByLine || {} };
  }

  function _maybeSyncSmtLinesFromPlan_() {
    var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    if (__smtPlanLineSyncAt_ > 0 && __smtPlanLineSyncDay_ === today && Date.now() - __smtPlanLineSyncAt_ < 20000) {
      var cachedPkg = _buildSmtActivePlanPackageForDate_(today);
      return {
        ok: true,
        dateYmd: today,
        linePlans: cachedPkg.activeByLine,
        linePlanMeta: cachedPkg.metaByLine
      };
    }
    var res = syncSmtLinesFromProductionPlan_(today);
    __smtPlanLineSyncDay_ = today;
    __smtPlanLineSyncAt_ = Date.now();
    return res;
  }

  function getOrderByNumber(orderNumber) {
    try {
      var bundle = getOrdersByNumber(orderNumber);
      if (!bundle || !bundle.items || !bundle.items.length) return null;
      return bundle.items[0];
    } catch (error) {
      Logger.log('주문서 조회 오류: ' + error.toString());
      return null;
    }
  }

  /**
   * 동일 주문서번호의 모든 제품 행 조회
   * @return {{orderNumber:string,orderDate?:string,deliveryDate?:string,customer?:string,category?:string,items:Array}|null}
   */
  function getOrdersByNumber(orderNumber) {
    try {
      var no = orderNumber != null ? String(orderNumber).trim() : '';
      if (!no) return null;
      var items = (_getOrdersCachePkg_().byNumber[no] || []).slice();
      if (!items.length) return null;
      var head = items[0];
      return {
        orderNumber: no,
        orderDate: head.orderDate || '',
        deliveryDate: head.deliveryDate || '',
        customer: head.customer || '',
        category: head.category || '',
        items: items
      };
    } catch (error) {
      Logger.log('getOrdersByNumber 오류: ' + error.toString());
      return null;
    }
  }

  /**
   * 출고 처리 탭 — 주문서번호 선택 + 제품 목록 (getOrders와 동일 데이터)
   * @return {{ok:boolean, orders?:Array, error?:string}}
   */
  function getOutboundOrderSelectOptions() {
    try {
      var rows = getOrders() || [];
      var byNum = {};
      var i;
      for (i = 0; i < rows.length; i++) {
        var o = rows[i] || {};
        var on = String(o.orderNumber != null ? o.orderNumber : '').trim();
        if (!on) continue;
        if (!byNum[on]) {
          byNum[on] = {
            orderNumber: on,
            customer: String(o.customer != null ? o.customer : '').trim(),
            orderDate: String(o.orderDate != null ? o.orderDate : '').trim(),
            products: []
          };
        }
        var pn = String(o.productName != null ? o.productName : '').trim();
        if (!pn) continue;
        byNum[on].products.push({
          productCode: String(o.productCode != null ? o.productCode : '').trim(),
          productName: pn,
          version: String(o.version != null ? o.version : '').trim(),
          quantity: Number(o.quantity) || 0
        });
      }
      var list = [];
      var keys = Object.keys(byNum);
      for (i = 0; i < keys.length; i++) list.push(byNum[keys[i]]);
      list.sort(function (a, b) {
        return String(b.orderNumber).localeCompare(String(a.orderNumber), undefined, { numeric: true });
      });
      return { ok: true, orders: list };
    } catch (err) {
      Logger.log('getOutboundOrderSelectOptions 오류: ' + err.toString());
      return { ok: false, error: err.message || String(err), orders: [] };
    }
  }

  function saveOrder(orderData) {
    try {
      const sheet = getOrderSheet();
      var verify = _validateOrderProductAgainstProductBom_(orderData.productCode, orderData.productName);
      if (!verify.ok) {
        throw new Error(verify.message || '제품BOM 검증 실패');
      }
      var requested = orderData && orderData.orderNumber != null ? String(orderData.orderNumber).trim() : '';
      var orderNumber = requested || generateOrderNumber();
      if (_isOrderNumberExists_(orderNumber)) {
        throw new Error('이미 존재하는 주문서번호입니다: ' + orderNumber);
      }
      
      // 오늘 날짜
      const today = new Date();
      const orderDate = orderData.orderDate || Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      
      // 행 데이터: 주문일, 주문서번호, 고객사, 제품코드, 제품명, 수량, 단가, 주문금액, 구분, 납기일
      var qty = Number(orderData.quantity) || 0;
      var amt = Number(orderData.orderAmount) || 0;
      var unitPrice = orderData.unitPrice != null ? (Number(orderData.unitPrice) || 0) : (qty > 0 ? Math.round(amt / qty) : 0);
      var category = _normalizeOrderCategory_(orderData.category);
      var productName = _mergeVersionIntoProductName_(orderData.productName || '', orderData.version);
      const rowData = [
        orderDate,
        orderNumber,
        orderData.customer || '',
        orderData.productCode || '',
        productName,
        qty,
        unitPrice,
        amt,
        category,
        orderData.deliveryDate || ''
      ];
      
      // 시트에 추가
      sheet.appendRow(rowData);
      invalidateOrdersCache_();
      return true;
    } catch (error) {
      Logger.log('주문서 저장 오류: ' + error.toString());
      throw error;
    }
  }

  /**
   * 주문서 일괄 저장 (동일 주문번호로 여러 제품 행 추가)
   * @param {{orderNumber?:string,orderDate?:string,deliveryDate?:string,customer?:string,sourceQuoteNumber?:string,source?:string,items:Array<{productCode:string,productName:string,version?:string,quantity:number,orderAmount?:number,unitPrice?:number,category?:string}>}} payload
   * @return {{ok:boolean, orderNumber?:string, inserted?:number, error?:string}}
   */
  function saveOrderBatch(payload) {
    var lock = LockService.getDocumentLock();
    if (!lock.tryLock(20000)) {
      return { ok: false, error: '다른 저장 처리 중입니다. 잠시 후 다시 시도하세요.' };
    }
    try {
      payload = payload && typeof payload === 'object' ? payload : {};
      var items = Array.isArray(payload.items) ? payload.items : [];
      if (!items.length) return { ok: false, error: '제품 항목을 1개 이상 입력하세요.' };
      var sheet = getOrderSheet();
      var requested = payload.orderNumber != null ? String(payload.orderNumber).trim() : '';
      var orderNumber = requested || generateOrderNumber();
      if (_isOrderNumberExists_(orderNumber)) {
        return { ok: false, error: '이미 존재하는 주문서번호입니다: ' + orderNumber };
      }
      var today = new Date();
      var orderDate = payload.orderDate || Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      var deliveryDate = payload.deliveryDate || '';
      var customer = payload.customer || '';
      var source = payload.source != null ? String(payload.source) : 'manual';
      var rows = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i] || {};
        var code = it.productCode != null ? String(it.productCode).trim() : '';
        var name = _mergeVersionIntoProductName_(it.productName != null ? String(it.productName).trim() : '', it.version);
        var verify = _validateOrderProductAgainstProductBom_(code, name);
        if (!verify.ok) return { ok: false, error: (i + 1) + '행: ' + (verify.message || '제품BOM 검증 실패') };
        var qty = Number(it.quantity) || 0;
        if (qty <= 0) return { ok: false, error: (i + 1) + '행: 수량은 0보다 커야 합니다.' };
        var amt = Number(it.orderAmount) || 0;
        var unitPrice = it.unitPrice != null ? (Number(it.unitPrice) || 0) : (qty > 0 ? Math.round(amt / qty) : 0);
        var category = _normalizeOrderCategory_(it.category != null ? it.category : payload.category);
        rows.push([orderDate, orderNumber, customer, code, name, qty, unitPrice, amt, category, deliveryDate]);
      }
      if (!rows.length) return { ok: false, error: '저장할 제품 항목이 없습니다.' };
      _sheetAppendRows_(sheet, rows, 10);
      invalidateOrdersCache_();
      return { ok: true, orderNumber: orderNumber, inserted: rows.length };
    } catch (error) {
      Logger.log('주문서 일괄 저장 오류: ' + error.toString());
      return { ok: false, error: error.message || String(error) };
    } finally {
      try {
        lock.releaseLock();
      } catch (rel) {}
    }
  }

  /**
   * 주문서 수정 (동일 주문번호 전체 행 교체)
   * @param {{orderNumber:string,orderDate?:string,deliveryDate?:string,customer?:string,items:Array}} payload
   */
  function updateOrderBatch(payload) {
    try {
      payload = payload && typeof payload === 'object' ? payload : {};
      var orderNumber = payload.orderNumber != null ? String(payload.orderNumber).trim() : '';
      if (!orderNumber) return { ok: false, error: '주문서번호가 없습니다.' };
      var items = Array.isArray(payload.items) ? payload.items : [];
      if (!items.length) return { ok: false, error: '제품 항목을 1개 이상 입력하세요.' };

      var sheet = getOrderSheet();
      var values = sheet.getDataRange().getValues();
      var rowsToDelete = [];
      for (var i = values.length - 1; i >= 1; i--) {
        var cur = values[i][1] != null ? String(values[i][1]).trim() : '';
        if (cur === orderNumber) rowsToDelete.push(i + 1);
      }
      if (!rowsToDelete.length) return { ok: false, error: '주문서를 찾을 수 없습니다: ' + orderNumber };

      for (var d = 0; d < rowsToDelete.length; d++) {
        sheet.deleteRow(rowsToDelete[d]);
      }

      var orderDate = payload.orderDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      var deliveryDate = payload.deliveryDate || '';
      var customer = payload.customer || '';
      var rows = [];
      for (var j = 0; j < items.length; j++) {
        var it = items[j] || {};
        var code = it.productCode != null ? String(it.productCode).trim() : '';
        var name = _mergeVersionIntoProductName_(it.productName != null ? String(it.productName).trim() : '', it.version);
        var verify = _validateOrderProductAgainstProductBom_(code, name);
        if (!verify.ok) return { ok: false, error: (j + 1) + '행: ' + (verify.message || '제품BOM 검증 실패') };
        var qty = Number(it.quantity) || 0;
        if (qty <= 0) return { ok: false, error: (j + 1) + '행: 수량은 0보다 커야 합니다.' };
        var amt = Number(it.orderAmount) || 0;
        var unitPrice = it.unitPrice != null ? (Number(it.unitPrice) || 0) : (qty > 0 ? Math.round(amt / qty) : 0);
        var category = _normalizeOrderCategory_(it.category != null ? it.category : payload.category);
        rows.push([orderDate, orderNumber, customer, code, name, qty, unitPrice, amt, category, deliveryDate]);
      }
      _sheetAppendRows_(sheet, rows, 10);
      invalidateOrdersCache_();
      return { ok: true, orderNumber: orderNumber, updated: rows.length };
    } catch (error) {
      Logger.log('updateOrderBatch 오류: ' + error.toString());
      return { ok: false, error: error.message || String(error) };
    }
  }

  function updateOrder(orderData) {
    try {
      const sheet = getOrderSheet();
      var verify = _validateOrderProductAgainstProductBom_(orderData.productCode, orderData.productName);
      if (!verify.ok) {
        throw new Error(verify.message || '제품BOM 검증 실패');
      }
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      // 주문서번호로 행 찾기 (B열) — 첫 행만 (레거시 단일 제품 수정)
      for (var i = 1; i < values.length; i++) {
        if (values[i][1] && values[i][1].toString() === orderData.orderNumber) {
          var qty = orderData.quantity != null ? (Number(orderData.quantity) || 0) : (Number(values[i][5]) || 0);
          var amt = orderData.orderAmount != null ? (Number(orderData.orderAmount) || 0) : (Number(values[i][7]) || 0);
          var unitPrice = orderData.unitPrice != null ? (Number(orderData.unitPrice) || 0) : (Number(values[i][6]) || (qty > 0 ? Math.round(amt / qty) : 0));
          var category = orderData.category != null ? String(orderData.category) : (values[i][8] != null ? String(values[i][8]) : '확정');
          var productName = _mergeVersionIntoProductName_(
            orderData.productName || values[i][4] || '',
            orderData.version
          );
          sheet.getRange(i + 1, 1, 1, 10).setValues([[
            orderData.orderDate || values[i][0],
            orderData.orderNumber || '',
            orderData.customer || values[i][2] || '',
            orderData.productCode != null ? String(orderData.productCode) : (values[i][3] || ''),
            productName,
            qty,
            unitPrice,
            amt,
            category,
            orderData.deliveryDate || values[i][9] || ''
          ]]);
          invalidateOrdersCache_();
          return true;
        }
      }
      
      return false;
    } catch (error) {
      Logger.log('주문서 수정 오류: ' + error.toString());
      throw error;
    }
  }

  function deleteOrder(orderNumber) {
    try {
      const sheet = getOrderSheet();
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      var no = orderNumber != null ? String(orderNumber).trim() : '';
      if (!no) return false;

      var rowsToDelete = [];
      for (var i = values.length - 1; i >= 1; i--) {
        if (values[i][1] && String(values[i][1]).trim() === no) {
          rowsToDelete.push(i + 1);
        }
      }
      if (!rowsToDelete.length) return false;
      for (var d = 0; d < rowsToDelete.length; d++) {
        sheet.deleteRow(rowsToDelete[d]);
      }
      invalidateOrdersCache_();
      return true;
    } catch (error) {
      Logger.log('주문서 삭제 오류: ' + error.toString());
      throw error;
    }
  }

  function setOrderStatus(orderNumber, status) {
    try {
      const sheet = getOrderSheet();
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      var no = orderNumber != null ? String(orderNumber).trim() : '';
      if (!no) return false;
      var updated = false;

      // 동일 주문서번호 모든 행의 구분(상태) 갱신
      for (var i = 1; i < values.length; i++) {
        if (values[i][1] && String(values[i][1]).trim() === no) {
          sheet.getRange(i + 1, 10).setValue(status);
          updated = true;
        }
      }

      if (updated) invalidateOrdersCache_();
      return updated;
    } catch (error) {
      Logger.log('주문서 상태 변경 오류: ' + error.toString());
      throw error;
    }
  }

  /**
   * 주문서 진행 상태(자재/생산/출고) 포함 목록
   */
  function getOrdersWithFlowStatus() {
    try {
      var orders = getOrders() || [];
      if (!orders.length) return [];

      var shipMap = {};
      try {
        shipMap = getOrderShipmentCountsMap_() || {};
      } catch (eSh) {
        shipMap = {};
      }
      var postCounts = {};
      try {
        postCounts = getPostProcessCountsMap_() || {};
      } catch (ePc) {
        postCounts = {};
      }

      function materialStatus(order) {
        var productCode = String(order.productCode || '').trim();
        var qty = Number(order.quantity) || 0;
        if (!productCode || qty <= 0) return '부족';
        var ver = String(order.version || '').trim();
        var plan = calculateMaterialPlanForPo({
          productCode: productCode,
          quantity: qty,
          version: ver || undefined
        });
        if (!plan || !plan.ok) return '부족';
        return (plan.shortageLines && plan.shortageLines.length > 0) ? '부족' : '여유';
      }

      function productionStatus(orderNo, orderQty) {
        var pq = Number(orderQty) || 0;
        var pc = Number(postCounts[orderNo]) || 0;
        if (pq > 0 && pc >= pq) return '완료';
        if (pc > 0) return '생산중';
        return '대기';
      }

      return orders.map(function (ord) {
        var on = String(ord.orderNumber || '');
        var shipped = _dashboardShippedForOrderLine_(shipMap, ord);
        return Object.assign({}, ord, {
          materialFlowStatus: materialStatus(ord),
          productionFlowStatus: productionStatus(on, ord.quantity),
          outboundFlowStatus: _orderShipmentStatusForLine_(shipped, ord.quantity),
          shippedQty: shipped
        });
      });
    } catch (error) {
      Logger.log('getOrdersWithFlowStatus 오류: ' + error.toString());
      return getOrders() || [];
    }
  }

  // ========== 후공정 생산 기록 (주문서별 누적 수량, 후공정 화면과 연동) ==========

  var POST_PROCESS_COUNT_SHEET_NAME = '후공정생산기록';
  /** 예전 배포·수동 생성 시트명 — 있으면 새 이름으로 자동 변경 */
  var POST_PROCESS_COUNT_SHEET_NAME_LEGACY = '후공정카운트';

  /** 후공정생산기록「기록일자」열 — 스프레드시트 표준시간대와 무관하게 한국 표준시(KST)로 통일 */
  var POST_PROCESS_RECORD_TIMEZONE = 'Asia/Seoul';

  function _postProcessCountNowString_() {
    return Utilities.formatDate(new Date(), POST_PROCESS_RECORD_TIMEZONE, 'yyyy-MM-dd');
  }

  function _postProcessCountHeaders_() {
    return ['기록일자', '주문서', '제품', '수량'];
  }

  /**
   * 수량 열이 '날짜' 서식이면 1·2가 1900-01-02처럼 보임 — getValues()가 Date로 올 때 복구
   * @param {*} v
   * @return {number}
   */
  function _postProcessCountCellToQty_(v) {
    if (v === '' || v == null) return 0;
    if (typeof v === 'number' && !isNaN(v)) return Math.max(0, Math.floor(v));
    if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
      var y = v.getFullYear();
      if (y < 1950) {
        var origin = new Date(1899, 11, 30);
        var days = Math.round((v.getTime() - origin.getTime()) / 86400000);
        if (days >= 0 && days < 1000000) return days;
      }
      return 0;
    }
    var n = parseFloat(String(v).replace(/,/g, ''));
    if (isNaN(n)) return 0;
    return Math.max(0, Math.floor(n));
  }

  /** 데이터 행(1-based)의 수량 열 표시 서식 고정 */
  function _postProcessCountFormatQtyTimeRow_(sheet, rowIdx) {
    if (!sheet || rowIdx < 2) return;
    try {
      sheet.getRange(rowIdx, 4).setNumberFormat('0');
    } catch (fe) {
      Logger.log('_postProcessCountFormatQtyTimeRow_ 오류: ' + fe.toString());
    }
  }

  /** 기존 시트 전체 수량 열 서식(캐시로 6시간에 한 번만 일괄 적용) */
  function _postProcessCountMaybeBulkFormatColumns_(sheet) {
    if (!sheet || sheet.getLastRow() < 2) return;
    try {
      var cache = CacheService.getScriptCache();
      if (cache.get('postProcessQtyColFmt')) return;
      var lr = sheet.getLastRow();
      sheet.getRange(2, 4, lr - 1, 1).setNumberFormat('0');
      cache.put('postProcessQtyColFmt', '1', 21600);
    } catch (e) {
      Logger.log('_postProcessCountMaybeBulkFormatColumns_ 오류: ' + e.toString());
    }
  }

  /**
   * 예전 시트(1열=LOT번호) → 주문서번호 기준으로 합산 후 갱신
   */
  function _migratePostProcessCountSheetLotToOrder_(sheet) {
    if (!sheet) return;
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      var emptyHeaders = _postProcessCountHeaders_();
      sheet.getRange(1, 1, 1, emptyHeaders.length).setValues([emptyHeaders]);
      sheet.getRange(1, 1, 1, emptyHeaders.length).setBackground('#ecfdf5').setFontWeight('bold');
      return;
    }
    var agg = {};
    for (var i = 1; i < values.length; i++) {
      var key = values[i][0] != null ? String(values[i][0]).trim() : '';
      if (!key) continue;
      var q = values[i][1];
      var n = typeof q === 'number' ? q : parseFloat(String(q));
      if (isNaN(n)) n = 0;
      n = Math.max(0, Math.floor(n));
      var orderNo = '';
      var ordM = getOrderByNumber(key);
      if (ordM && ordM.orderNumber) orderNo = String(ordM.orderNumber).trim();
      if (!orderNo) continue;
      agg[orderNo] = (agg[orderNo] || 0) + n;
    }
    var lr = sheet.getLastRow();
    var lc = Math.max(4, sheet.getLastColumn());
    if (lr > 1) sheet.getRange(2, 1, lr - 1, lc).clearContent();
    var headers = _postProcessCountHeaders_();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#ecfdf5').setFontWeight('bold');
    var now = _postProcessCountNowString_();
    var keys = Object.keys(agg);
    for (var k = 0; k < keys.length; k++) {
      var o = getOrderByNumber(keys[k]);
      var p = o && o.productName != null ? String(o.productName).trim() : '';
      sheet.appendRow([now, keys[k], p, agg[keys[k]]]);
      _postProcessCountFormatQtyTimeRow_(sheet, sheet.getLastRow());
    }
  }

  function getOrCreatePostProcessCountSheet() {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(POST_PROCESS_COUNT_SHEET_NAME);
    if (!sheet) {
      var legacy = ss.getSheetByName(POST_PROCESS_COUNT_SHEET_NAME_LEGACY);
      if (legacy) {
        legacy.setName(POST_PROCESS_COUNT_SHEET_NAME);
        sheet = legacy;
      }
    }
    if (!sheet) {
      sheet = ss.insertSheet(POST_PROCESS_COUNT_SHEET_NAME);
      var headers = _postProcessCountHeaders_();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setBackground('#ecfdf5').setFontWeight('bold');
      var maxRowsFmt = sheet.getMaxRows();
      if (maxRowsFmt > 1) {
        sheet.getRange(2, 4, maxRowsFmt - 1, 1).setNumberFormat('0');
      }
    } else {
      var h0 = String(sheet.getRange(1, 1).getDisplayValue() || '').trim();
      var h1 = String(sheet.getRange(1, 2).getDisplayValue() || '').trim();
      if (h0 === 'LOT번호') {
        _migratePostProcessCountSheetLotToOrder_(sheet);
      } else if (h0 === '주문서번호' || h0 === '주문서' || h0 === '기록일자') {
        // 구버전(주문서/제품/수량/시간/비고) 포함 -> 신버전(기록일자/주문서/제품/수량) 정규화
        var vals = sheet.getDataRange().getValues();
        var out = [_postProcessCountHeaders_()];
        for (var i = 1; i < vals.length; i++) {
          var row = vals[i] || [];
          var key = '';
          var prod = '';
          var n = 0;
          var dkey = _postProcessCountNowString_();
          if (h0 === '기록일자') {
            dkey = _postProcessWorkLogDateKeyFromTimeCell_(row[0]) || _postProcessCountNowString_();
            key = row[1] != null ? String(row[1]).trim() : '';
            prod = row[2] != null ? String(row[2]).trim() : '';
            n = _postProcessCountCellToQty_(row[3]);
          } else {
            key = row[0] != null ? String(row[0]).trim() : '';
            prod = row[1] != null ? String(row[1]).trim() : '';
            n = _postProcessCountCellToQty_(row[2]);
            dkey = _postProcessWorkLogDateKeyFromTimeCell_(row[3]) || _postProcessCountNowString_();
          }
          if (!key) continue;
          if (!prod) {
            var ord = getOrderByNumber(key);
            prod = ord && ord.productName != null ? String(ord.productName).trim() : '';
          }
          out.push([dkey, key, prod, n]);
        }
        sheet.clearContents();
        sheet.getRange(1, 1, out.length, 4).setValues(out);
        sheet.getRange(1, 1, 1, 4).setBackground('#ecfdf5').setFontWeight('bold');
        if (out.length > 1) {
          sheet.getRange(2, 4, out.length - 1, 1).setNumberFormat('0');
        }
      } else if (h0 !== '기록일자' || h1 !== '주문서') {
        var stdHeaders = _postProcessCountHeaders_();
        sheet.getRange(1, 1, 1, stdHeaders.length).setValues([stdHeaders]);
        sheet.getRange(1, 1, 1, stdHeaders.length).setBackground('#ecfdf5').setFontWeight('bold');
      }
    }
    _postProcessCountMaybeBulkFormatColumns_(sheet);
    return sheet;
  }

  /** 후공정생산기록「제품」열 — 제품명만 (수량·단가·#행 등 미표시) */
  function _postProcessSheetProductColumn_(ord) {
    if (!ord) return '';
    return String(ord.productName != null ? ord.productName : '').trim();
  }

  /** UI·일일입력용 복합키 (주문서 + 행 구분 라벨) */
  function _postProcessUiCountKey_(ord) {
    if (!ord) return '';
    var existing = String(ord._countKey != null ? ord._countKey : '').trim();
    if (existing.indexOf('\x1f') >= 0) return existing;
    var on = String(ord.orderNumber != null ? ord.orderNumber : '').trim();
    var lbl = String(ord._countProductLabel || _orderCountProductLabel_(ord)).trim();
    return lbl ? on + '\x1f' + lbl : on;
  }

  /** 동일 주문·동일 제품명 여러 행일 때 n번째 줄 인덱스(0-based) */
  function _postProcessLineIndexAmongDuplicates_(ord, ordersOpt) {
    if (!ord) return 0;
    var on = String(ord.orderNumber != null ? ord.orderNumber : '').trim();
    var pn = String(ord.productName != null ? ord.productName : '').trim();
    if (!on || !pn) return 0;
    var orders = ordersOpt && ordersOpt.length ? ordersOpt : getOrders() || [];
    var lines = [];
    var i;
    for (i = 0; i < orders.length; i++) {
      var o = orders[i] || {};
      if (String(o.orderNumber || '').trim() !== on) continue;
      if (String(o.productName || '').trim() !== pn) continue;
      lines.push(o);
    }
    if (lines.length <= 1) return 0;
    lines.sort(function (a, b) {
      return (Number(a.sheetRow) || 0) - (Number(b.sheetRow) || 0);
    });
    var want = Number(ord.sheetRow) || 0;
    for (i = 0; i < lines.length; i++) {
      if (Number(lines[i].sheetRow) === want) return i;
    }
    return 0;
  }

  function getPostProcessCountsMap_() {
    return _getCachedProductionMaps_().postCounts;
  }

  /** _countProductLabel 내 #행N 추출 */
  function _postProcessSheetRowFromLabel_(productLabel) {
    var m = String(productLabel || '').match(/#행\s*(\d+)/);
    if (!m) return 0;
    var r = parseInt(m[1], 10);
    return isNaN(r) ? 0 : r;
  }

  /** 후공정 시트 행(주문서·제품열)이 주문 1행과 일치하는지 */
  function _postProcessSheetRowMatchesOrderLine_(rOn, rPn, ord, productNameKey) {
    if (!ord) return false;
    var on = String(ord.orderNumber != null ? ord.orderNumber : '').trim();
    if (String(rOn || '').trim() !== on) return false;
    var pl = String(productNameKey || '').trim();
    var full = String(ord._countProductLabel || _orderCountProductLabel_(ord)).trim();
    var pn = String(ord.productName != null ? ord.productName : '').trim();
    var rp = String(rPn != null ? rPn : '').trim();
    if (!pl) return !rp || rp === pn || rp === full;
    if (rp === pl || rp === full) return true;
    var wantRow = _postProcessSheetRowFromLabel_(pl);
    if (wantRow >= 2 && Number(ord.sheetRow) === wantRow) {
      return !rp || rp === pn || rp === full;
    }
    return false;
  }

  function _postProcessParseOrderModelKey_(rawKey) {
    var s = rawKey != null ? String(rawKey) : '';
    var p = s.split('\x1f');
    var orderNo = p[0] != null ? String(p[0]).trim() : '';
    var productName = p.length > 1 && p[1] != null ? String(p[1]).trim() : '';
    return { orderNo: orderNo, productName: productName };
  }

  function _postProcessFindOrderByOrderAndProduct_(orderNo, productLabel) {
    var resolved = _postProcessResolveOrderLine_(orderNo, productLabel);
    if (resolved) return resolved;
    var orders = [];
    try {
      orders = getOrders() || [];
    } catch (e) {
      orders = [];
    }
    var on = String(orderNo || '').trim();
    var pl = String(productLabel || '').trim();
    if (!on) return null;
    var wantRow = _postProcessSheetRowFromLabel_(pl);
    var legacy = null;
    var legacyCount = 0;
    for (var i = 0; i < orders.length; i++) {
      var o = orders[i] || {};
      if (String(o.orderNumber || '').trim() !== on) continue;
      if (!pl) return o;
      var full = String(o._countProductLabel || _orderCountProductLabel_(o)).trim();
      if (full === pl) return o;
      if (wantRow >= 2 && Number(o.sheetRow) === wantRow) return o;
      var pn = String(o.productName || '').trim();
      if (pn === pl) {
        legacy = o;
        legacyCount++;
      }
    }
    if (legacyCount === 1) return legacy;
    return null;
  }

  /** 후공정생산기록에서 주문+제품(행)에 해당하는 데이터 행 인덱스(1-based), 없으면 -1 */
  function _postProcessFindCountSheetRow_(values, orderNo, productNameKey) {
    var ord =
      _postProcessFindOrderByOrderAndProduct_(orderNo, productNameKey) ||
      getOrderByNumber(orderNo);
    var pl = String(productNameKey || '').trim();
    var on = String(orderNo || '').trim();
    var i;
    var fallbackIdx = -1;
    var shortPnCandidates = [];
    var lineIdx = ord ? _postProcessLineIndexAmongDuplicates_(ord) : 0;
    for (i = 1; i < values.length; i++) {
      var rOn = values[i][1] != null ? String(values[i][1]).trim() : '';
      var rPn = values[i][2] != null ? String(values[i][2]).trim() : '';
      if (rOn !== on) continue;
      if (!pl) {
        if (!rPn) return i + 1;
        if (fallbackIdx < 0) fallbackIdx = i + 1;
        continue;
      }
      if (rPn === pl) return i + 1;
      if (!ord) continue;
      var full = String(ord._countProductLabel || _orderCountProductLabel_(ord)).trim();
      var pn = String(ord.productName || '').trim();
      if (rPn === full) return i + 1;
      if (rPn === pn || (pn && rPn.indexOf(pn) === 0 && rPn.length <= pn.length + 2)) {
        shortPnCandidates.push(i + 1);
      } else if (_postProcessSheetRowMatchesOrderLine_(rOn, rPn, ord, pl)) {
        shortPnCandidates.push(i + 1);
      }
    }
    if (shortPnCandidates.length === 1) return shortPnCandidates[0];
    if (shortPnCandidates.length > 1 && lineIdx < shortPnCandidates.length) {
      return shortPnCandidates[lineIdx];
    }
    if (!pl && fallbackIdx >= 0) return fallbackIdx;
    return -1;
  }

  function _postProcessBomNorm_(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, ' ')
      .trim();
  }

  function _postProcessBomMemberMatch_(orderProductOrCode, memberAlias) {
    var rawP = String(orderProductOrCode || '').trim();
    var rawM = String(memberAlias || '').trim();
    if (!rawP || !rawM) return false;
    if (rawP.toLowerCase() === rawM.toLowerCase()) return true;
    var pn = _postProcessBomNorm_(rawP);
    var mk = _postProcessBomNorm_(rawM);
    if (!pn || !mk) return false;
    if (pn.indexOf(mk) >= 0 || mk.indexOf(pn) >= 0) return true;
    var pTok = pn.split(/\s+/).filter(function (x) {
      return x.length >= 2;
    });
    var mTok = mk.split(/\s+/).filter(function (x) {
      return x.length >= 2;
    });
    if (!pTok.length || !mTok.length) return false;
    var overlap = 0;
    for (var ti = 0; ti < pTok.length; ti++) {
      if (mTok.indexOf(pTok[ti]) >= 0) overlap++;
    }
    var need = Math.min(pTok.length, mTok.length, 2);
    return overlap >= need;
  }

  /** 주문 한 줄이 별칭 목록과 맞는지 (후공정 표시명 보조) */
  function _postProcessOrderMatchesBomAliases_(o, aliases) {
    var pn = String((o && o.productName) || '').trim();
    var pc = String((o && o.productCode) || '').trim();
    var ai;
    for (ai = 0; ai < (aliases || []).length; ai++) {
      var al = String(aliases[ai] || '').trim();
      if (!al) continue;
      if (pc && (al === pc || _postProcessBomMemberMatch_(pc, al))) return true;
      if (pn && _postProcessBomMemberMatch_(pn, al)) return true;
    }
    return false;
  }

  /** 별칭 문자열 → 부모 표시명 (첫 매칭 우선) */
  function _postProcessExactAliasToParentMap_(byParent) {
    var map = {};
    var pkeys = Object.keys(byParent || {});
    var pi;
    for (pi = 0; pi < pkeys.length; pi++) {
      var pname = pkeys[pi];
      var members = byParent[pname] || [];
      var mj;
      for (mj = 0; mj < members.length; mj++) {
        var als = (members[mj] && members[mj].aliases) || [];
        var ai;
        for (ai = 0; ai < als.length; ai++) {
          var t = String(als[ai] || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
          if (t.length && map[t] == null) map[t] = pname;
        }
      }
    }
    return map;
  }

  /**
   * 후공정 UI용 표시명(postProcessDisplayName). byParent가 비면 주문의 productName과 동일.
   * @param {Array} orders
   * @param {Object<string, Array<{aliases: string[]}>>} byParent
   * @return {Array}
   */
  function _postProcessAttachParentDisplayNames_(orders, byParent) {
    var list = orders || [];
    var bp = byParent && typeof byParent === 'object' ? byParent : {};
    var parentKeys = Object.keys(bp);
    var exactMap = _postProcessExactAliasToParentMap_(bp);
    var ri;
    for (ri = 0; ri < list.length; ri++) {
      var o = list[ri];
      if (!o) continue;
      if (o.detailInfo && o.detailInfo.source === 'combo-bom') {
        o.postProcessDisplayName = String(o.productName || '').trim();
        o.postProcessLabel = o.postProcessDisplayName;
        continue;
      }
      var child = String(o.productName || '').trim();
      var pc = String(o.productCode || '').trim();
      var disp = '';
      var childKey = child
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      var pcKey = pc
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      if (childKey && exactMap[childKey]) disp = exactMap[childKey];
      else if (pcKey && exactMap[pcKey]) disp = exactMap[pcKey];
      else {
        var pi;
        for (pi = 0; pi < parentKeys.length; pi++) {
          var pname = parentKeys[pi];
          var members = bp[pname] || [];
          var mj;
          for (mj = 0; mj < members.length; mj++) {
            var al = (members[mj] && members[mj].aliases) || [];
            if (_postProcessOrderMatchesBomAliases_(o, al)) {
              disp = pname;
              break;
            }
          }
          if (disp) break;
        }
      }
      o.postProcessDisplayName = disp || child;
      o.postProcessLabel = o.postProcessDisplayName;
    }
    return list;
  }

  /** 제품BOM — 부모 제품코드의 제품명 */
  function _postProcessBomParentName_(sheetData, parentCode) {
    if (!sheetData || !parentCode) return String(parentCode || '').trim();
    var pv = sheetData.pv || [];
    var pIdxCode = sheetData.pIdxCode;
    var pIdxProductName = sheetData.pIdxProductName;
    var want = String(parentCode).trim();
    var i;
    for (i = 1; i < pv.length; i++) {
      var rr = pv[i] || [];
      if (String(rr[pIdxCode] || '').trim() !== want) continue;
      var nm = pIdxProductName >= 0 && rr[pIdxProductName] != null ? String(rr[pIdxProductName]).trim() : '';
      if (nm) return nm;
    }
    return want;
  }

  /**
   * 조립 완제품 카탈로그 — 부모 제품의 반제품코드가 제품BOM에 또 다른 부모(반제품)로 등록된 경우
   * @return {Array<{parentCode:string, parentName:string, members:Array}>}
   */
  function _postProcessBuildComboBomCatalog_() {
    if (
      __comboBomCatalogCache_ &&
      Date.now() - __comboBomCatalogCache_.loadedAt < COMBO_BOM_CATALOG_CACHE_TTL_SEC * 1000
    ) {
      return __comboBomCatalogCache_.data || [];
    }
    try {
      var sheetData = _readProductBomSheetData_();
      if (!sheetData) return [];
      var pv = sheetData.pv || [];
      if (pv.length < 2) return [];
      var pIdxCode = sheetData.pIdxCode;
      var pIdxSemi = sheetData.pIdxSemi;
      var pIdxMat = sheetData.pIdxMat;
      if (pIdxCode < 0) return [];

      var parentCodes = {};
      var pi;
      for (pi = 1; pi < pv.length; pi++) {
        var pc0 = String((pv[pi] || [])[pIdxCode] || '').trim();
        if (pc0) parentCodes[pc0] = true;
      }

      var parentSemis = {};
      for (pi = 1; pi < pv.length; pi++) {
        var pr = pv[pi] || [];
        var pcode = String(pr[pIdxCode] || '').trim();
        var semi = pIdxSemi >= 0 ? String(pr[pIdxSemi] || '').trim() : '';
        if (!semi && pIdxMat >= 0) {
          var matAsSemi = String(pr[pIdxMat] || '').trim();
          if (matAsSemi && parentCodes[matAsSemi]) semi = matAsSemi;
        }
        if (!pcode || !semi || semi === pcode) continue;
        if (!parentSemis[pcode]) parentSemis[pcode] = [];
        if (parentSemis[pcode].indexOf(semi) < 0) parentSemis[pcode].push(semi);
      }

      var catalog = [];
      var pkeys = Object.keys(parentSemis);
      var pk;
      for (pk = 0; pk < pkeys.length; pk++) {
        var parentCode = pkeys[pk];
        var semiList = parentSemis[parentCode] || [];
        var members = [];
        var si;
        for (si = 0; si < semiList.length; si++) {
          var semiCode = semiList[si];
          if (!parentCodes[semiCode]) continue;
          var semiName = _postProcessBomParentName_(sheetData, semiCode);
          var aliases = [semiCode];
          if (semiName && aliases.indexOf(semiName) < 0) aliases.push(semiName);
          members.push({ code: semiCode, name: semiName, aliases: aliases });
        }
        if (members.length < 2) continue;
        members.sort(function (a, b) {
          return String(a.code).localeCompare(String(b.code), 'ko', { numeric: true });
        });
        catalog.push({
          parentCode: parentCode,
          parentName: _postProcessBomParentName_(sheetData, parentCode),
          members: members
        });
      }
      catalog.sort(function (a, b) {
        return String(a.parentCode).localeCompare(String(b.parentCode), 'ko', { numeric: true });
      });
      __comboBomCatalogCache_ = { data: catalog, loadedAt: Date.now() };
      return catalog;
    } catch (eCat) {
      Logger.log('_postProcessBuildComboBomCatalog_ 오류: ' + eCat.toString());
      return [];
    }
  }

  /** 조립 구성품 매칭 — 제품코드(또는 제품명) 정확 일치만 (유사어 매칭 금지) */
  function _postProcessOrderLineMatchesComboMember_(orderLine, member) {
    orderLine = orderLine || {};
    member = member || {};
    var mc = String(member.code || '').trim();
    var mn = String(member.name || '').trim();
    if (!mc) return false;
    var pc = String(orderLine.productCode || '').trim();
    var pn = String(orderLine.productName || '').trim();
    if (pc && pc.toLowerCase() === mc.toLowerCase()) return true;
    if (pn && mn && pn.toLowerCase() === mn.toLowerCase()) return true;
    if (pn && mc && pn.toLowerCase() === mc.toLowerCase()) return true;
    var dpc =
      orderLine.detailInfo && orderLine.detailInfo.productCode != null
        ? String(orderLine.detailInfo.productCode).trim()
        : '';
    if (dpc && dpc.toLowerCase() === mc.toLowerCase()) return true;
    return false;
  }

  /** 같은 주문번호 안에서 조립 구성품 1세트씩 매칭 */
  function _postProcessPickComboMemberLines_(lineEntries, combo) {
    lineEntries = lineEntries || [];
    combo = combo || {};
    var members = combo.members || [];
    if (members.length < 2) return null;
    var picked = [];
    var mi;
    for (mi = 0; mi < members.length; mi++) {
      var member = members[mi];
      var found = null;
      var li;
      for (li = 0; li < lineEntries.length; li++) {
        var ent = lineEntries[li];
        if (!ent || ent.used) continue;
        if (_postProcessOrderLineMatchesComboMember_(ent.order, member)) {
          found = ent;
          break;
        }
      }
      if (!found) return null;
      picked.push(found);
    }
    var seenRow = {};
    var si;
    for (si = 0; si < picked.length; si++) {
      var sr = Math.floor(Number((picked[si].order || {}).sheetRow) || 0);
      var rowKey =
        sr >= 2
          ? 'r' + sr
          : 'pc:' + String((picked[si].order || {}).productCode || '') + '|' + String((picked[si].order || {}).productName || '');
      if (seenRow[rowKey]) return null;
      seenRow[rowKey] = true;
    }
    for (si = 0; si < picked.length; si++) {
      var sj;
      for (sj = si + 1; sj < picked.length; sj++) {
        if (picked[si] === picked[sj]) return null;
      }
    }
    return picked;
  }

  function _postProcessCloneOrderLineWithQty_(src, qty, uiSuffix) {
    src = src && typeof src === 'object' ? src : {};
    var o = {};
    var k;
    for (k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) o[k] = src[k];
    }
    o.quantity = Math.max(0, Math.floor(Number(qty) || 0));
    delete o._countKey;
    delete o._countProductLabel;
    delete o._uiKey;
    delete o.postProcessDisplayName;
    delete o.postProcessLabel;
    delete o.detailInfo;
    var sr = src.sheetRow != null ? Math.floor(Number(src.sheetRow)) : 0;
    var seq = src.orderLineSeq != null ? Math.floor(Number(src.orderLineSeq)) : 0;
    _enrichOrderLineMeta_(o, sr, seq);
    var on = String(o.orderNumber || '').trim();
    o._uiKey = on + '\x1e' + String(sr) + '\x1e' + String(uiSuffix || 'rem');
    return o;
  }

  /** 조립 완제품 가상 주문 1행 — 수량은 구성품 min */
  function _postProcessBuildComboOrderLine_(orderNo, combo, pickedEntries) {
    combo = combo || {};
    pickedEntries = pickedEntries || [];
    var qtys = [];
    var pi;
    for (pi = 0; pi < pickedEntries.length; pi++) {
      qtys.push(Math.max(0, Math.floor(Number((pickedEntries[pi].order || {}).quantity) || 0)));
    }
    var minQty = qtys.length ? Math.min.apply(null, qtys) : 0;
    var first = (pickedEntries[0] && pickedEntries[0].order) || {};
    var parentCode = String(combo.parentCode || '').trim();
    var parentName = String(combo.parentName || parentCode).trim();
    var memberSheetRows = [];
    var memberProductCodes = [];
    for (pi = 0; pi < pickedEntries.length; pi++) {
      var po = pickedEntries[pi].order || {};
      if (po.sheetRow != null) memberSheetRows.push(Math.floor(Number(po.sheetRow)));
      var mpc = String(po.productCode || '').trim();
      if (!mpc) mpc = String(combo.members[pi] && combo.members[pi].code ? combo.members[pi].code : '').trim();
      memberProductCodes.push(mpc);
    }
    var comboOrd = {
      orderNumber: orderNo,
      customer: first.customer != null ? first.customer : '',
      productCode: parentCode,
      productName: parentName,
      quantity: minQty,
      unitPrice: first.unitPrice != null ? first.unitPrice : 0,
      version: '',
      sheetRow: 0,
      detailInfo: {
        source: 'combo-bom',
        parentCode: parentCode,
        memberSheetRows: memberSheetRows,
        memberProductCodes: memberProductCodes
      }
    };
    _enrichOrderLineMeta_(comboOrd, 0, 0);
    comboOrd._uiKey = orderNo + '\x1e' + 'combo\x1e' + parentCode;
    comboOrd.postProcessDisplayName = parentName;
    comboOrd.postProcessLabel = parentName;
    return comboOrd;
  }

  /**
   * 주문번호별 — BOM 조립 구성품(SC_001+SC_002)을 완제품(SC_F001) 카드 1장으로 합침.
   * 주문번호가 다르면 각각 별도 카드. 구성품이 일부만 있으면 해당 행만 단독 카드.
   * @param {Array} orders getOrders() 원본
   * @param {Array=} catalogOpt
   * @return {Array}
   */
  function _postProcessApplyComboBomOrders_(orders, catalogOpt) {
    orders = orders || [];
    var catalog = catalogOpt && catalogOpt.length ? catalogOpt : _postProcessBuildComboBomCatalog_();
    if (!catalog.length) return orders.slice();

    var enriched = [];
    var i;
    for (i = 0; i < orders.length; i++) {
      var o0 = orders[i];
      if (!o0) continue;
      if (!o0._countKey) {
        _enrichOrderLineMeta_(o0, o0.sheetRow != null ? o0.sheetRow : i + 2, o0.orderLineSeq != null ? o0.orderLineSeq : i);
      }
      enriched.push(o0);
    }

    var byOrder = {};
    for (i = 0; i < enriched.length; i++) {
      var o1 = enriched[i];
      var on1 = String(o1.orderNumber || '').trim();
      if (!on1) continue;
      if (!byOrder[on1]) byOrder[on1] = [];
      byOrder[on1].push({ order: o1, used: false });
    }

    var out = [];
    var noOrderLines = [];
    for (i = 0; i < enriched.length; i++) {
      if (!String(enriched[i].orderNumber || '').trim()) noOrderLines.push(enriched[i]);
    }

    var orderNums = Object.keys(byOrder);
    orderNums.sort(function (a, b) {
      return String(b).localeCompare(String(a), undefined, { numeric: true });
    });

    var oi;
    for (oi = 0; oi < orderNums.length; oi++) {
      var oNum = orderNums[oi];
      var lineEntries = byOrder[oNum];
      var combos = catalog.slice().sort(function (a, b) {
        return (b.members || []).length - (a.members || []).length;
      });
      var ci;
      for (ci = 0; ci < combos.length; ci++) {
        var combo = combos[ci];
        while (true) {
          var picked = _postProcessPickComboMemberLines_(lineEntries, combo);
          if (!picked) break;
          var qtys = [];
          var pj;
          for (pj = 0; pj < picked.length; pj++) {
            qtys.push(Math.max(0, Math.floor(Number((picked[pj].order || {}).quantity) || 0)));
          }
          var minQty = qtys.length ? Math.min.apply(null, qtys) : 0;
          if (minQty <= 0) break;
          var comboOrd = _postProcessBuildComboOrderLine_(oNum, combo, picked);
          out.push(comboOrd);
          for (pj = 0; pj < picked.length; pj++) {
            picked[pj].used = true;
            if (qtys[pj] > minQty) {
              out.push(
                _postProcessCloneOrderLineWithQty_(
                  picked[pj].order,
                  qtys[pj] - minQty,
                  'rem-' + String((picked[pj].order || {}).productCode || pj)
                )
              );
            }
          }
        }
      }
      for (i = 0; i < lineEntries.length; i++) {
        if (!lineEntries[i].used) out.push(lineEntries[i].order);
      }
    }

    for (i = 0; i < noOrderLines.length; i++) out.push(noOrderLines[i]);
    return out;
  }

  /** 후공정 저장·조회 — 조립 완제품 가상 행 복원 */
  function _postProcessResolveOrderLine_(orderNo, productLabel, ordersOpt) {
    var on = String(orderNo || '').trim();
    var pl = String(productLabel || '').trim();
    if (!on) return null;
    var orders = ordersOpt && ordersOpt.length ? ordersOpt : getOrders() || [];
    var i;
    for (i = 0; i < orders.length; i++) {
      var o = orders[i] || {};
      if (String(o.orderNumber || '').trim() !== on) continue;
      if (!pl) return o;
      var full = String(o._countProductLabel || _orderCountProductLabel_(o)).trim();
      if (full === pl) return o;
      var wantRow = _postProcessSheetRowFromLabel_(pl);
      if (wantRow >= 2 && Math.floor(Number(o.sheetRow) || 0) === wantRow) return o;
      var pn = String(o.productName || '').trim();
      if (pn === pl) return o;
    }
    var merged = _postProcessApplyComboBomOrders_(orders);
    for (i = 0; i < merged.length; i++) {
      var m = merged[i] || {};
      if (String(m.orderNumber || '').trim() !== on) continue;
      if (!pl) return m;
      var fullM = String(m._countProductLabel || _orderCountProductLabel_(m)).trim();
      if (fullM === pl || m._countKey === on + '\x1f' + pl) return m;
      var pnM = String(m.productName || '').trim();
      if (pnM === pl) return m;
    }
    return null;
  }

  /** 후공정 카드 뱃지 — 반제품 / 완제품 */
  function _postProcessAttachProductKind_(orders, catalog) {
    orders = orders || [];
    catalog = catalog || [];
    var finished = {};
    var ci;
    for (ci = 0; ci < catalog.length; ci++) {
      var pc = String((catalog[ci] || {}).parentCode || '').trim();
      if (pc) finished[pc.toLowerCase()] = true;
    }
    var i;
    for (i = 0; i < orders.length; i++) {
      var o = orders[i];
      if (!o) continue;
      var kind = 'semi';
      if (o.detailInfo && o.detailInfo.source === 'combo-bom') {
        kind = 'finished';
      } else {
        var code = String(o.productCode || '').trim();
        if (code && finished[code.toLowerCase()]) kind = 'finished';
      }
      o.postProcessKind = kind;
      o.postProcessKindLabel = kind === 'finished' ? '완제품' : '반제품';
    }
    return orders;
  }

  /**
   * 후공정 화면: 주문서 목록 + 주문별 누적 카운트(시트)
   * 생산 완료(●) 건은 유지 — 출고(출하) 완료된 주문 행만 목록에서 제외
   * @return {{ ok:boolean, orders?:Array, counts?:Object, error?:string }}
   */
  function _buildPostProcessPageData_() {
    var pkg = _orderLinesForAssemblyPages_();
    var merged = pkg.merged || [];
    var maps = _getCachedProductionMaps_();
    var shipMap = maps.shipMap || {};
    var visible = [];
    var ri;
    for (ri = 0; ri < merged.length; ri++) {
      if (_isOrderLineFullyShipped_(merged[ri], shipMap)) continue;
      visible.push(merged[ri]);
    }
    return {
      ok: true,
      orders: visible,
      counts: maps.postCounts || {}
    };
  }

  function _getPostProcessPageDataCached_() {
    if (
      __postProcessPageCache_ &&
      Date.now() - __postProcessPageCache_.loadedAt < POST_PROCESS_PAGE_CACHE_TTL_SEC * 1000
    ) {
      var hitMem = __postProcessPageCache_.data;
      if (hitMem && hitMem.ok) {
        hitMem.dailyInputs = _postProcessGetDailyInputMap_();
        return hitMem;
      }
    }
    try {
      var cached = CacheService.getScriptCache().get(POST_PROCESS_PAGE_CACHE_SCRIPT_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed && parsed.ok) {
          parsed.dailyInputs = _postProcessGetDailyInputMap_();
          __postProcessPageCache_ = { data: parsed, loadedAt: Date.now() };
          return parsed;
        }
      }
    } catch (eCache) {}
    var built = _buildPostProcessPageData_();
    built.dailyInputs = _postProcessGetDailyInputMap_();
    __postProcessPageCache_ = { data: built, loadedAt: Date.now() };
    try {
      var toStore = {
        ok: built.ok,
        orders: built.orders,
        counts: built.counts
      };
      var json = JSON.stringify(toStore);
      if (json.length <= 95000) {
        CacheService.getScriptCache().put(
          POST_PROCESS_PAGE_CACHE_SCRIPT_KEY,
          json,
          POST_PROCESS_PAGE_CACHE_TTL_SEC
        );
      }
    } catch (ePut) {}
    return built;
  }

  function getPostProcessPageData() {
    try {
      return _getPostProcessPageDataCached_();
    } catch (e) {
      Logger.log('getPostProcessPageData 오류: ' + e.toString());
      return { ok: false, error: e.message || String(e), orders: [], counts: {} };
    }
  }

  /**
   * 「시간」열 값에서 KST 기준 날짜 키(yyyy-MM-dd) 추출 (문자열·Date)
   * @param {*} v
   * @return {string}
   */
  function _postProcessWorkLogDateKeyFromTimeCell_(v) {
    if (v === '' || v == null) return '';
    if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
      return Utilities.formatDate(v, POST_PROCESS_RECORD_TIMEZONE, 'yyyy-MM-dd');
    }
    var m = String(v).trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    return '';
  }

  function _postProcessDailyInputDateKey_() {
    return Utilities.formatDate(new Date(), POST_PROCESS_RECORD_TIMEZONE, 'yyyy-MM-dd');
  }

  function _postProcessDailyInputPropKey_(dateKey) {
    return 'POST_PROCESS_DAILY_INPUT_' + String(dateKey || '').trim();
  }

  function _postProcessGetDailyInputMap_() {
    try {
      var props = PropertiesService.getScriptProperties();
      var key = _postProcessDailyInputPropKey_(_postProcessDailyInputDateKey_());
      var raw = props.getProperty(key);
      if (!raw) return {};
      var obj = JSON.parse(raw);
      return obj && typeof obj === 'object' ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function _postProcessSetDailyInputMap_(mapObj) {
    try {
      var props = PropertiesService.getScriptProperties();
      var key = _postProcessDailyInputPropKey_(_postProcessDailyInputDateKey_());
      props.setProperty(key, JSON.stringify(mapObj || {}));
    } catch (e) {}
  }

  /**
   * 후공정생산기록 — 최근 행 조회 (최신순, 기본 200건)
   * @param {number=} optMaxRows
   * @return {{ok:boolean, rows?:Array, journalDate?:string, error?:string}}
   */
  function getPostProcessWorkLog(optMaxRows) {
    try {
      var todayKey = Utilities.formatDate(new Date(), POST_PROCESS_RECORD_TIMEZONE, 'yyyy-MM-dd');
      var maxR = optMaxRows > 0 ? Math.floor(optMaxRows) : 200;
      var sheet = getOrCreatePostProcessCountSheet();
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return { ok: true, rows: [], journalDate: todayKey };
      var values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
      var rows = [];
      var i;
      for (i = values.length - 1; i >= 0 && rows.length < maxR; i--) {
        var r = values[i] || [];
        var dateKey = _postProcessWorkLogDateKeyFromTimeCell_(r[0]);
        var orderNo = r[1] != null ? String(r[1]).trim() : '';
        var product = r[2] != null ? String(r[2]).trim() : '';
        var qty = _postProcessCountCellToQty_(r[3]);
        if (!orderNo && !product && !qty) continue;
        rows.push({
          orderNumber: orderNo,
          product: product,
          qty: qty,
          time: dateKey,
          note: ''
        });
      }
      return { ok: true, rows: rows, journalDate: todayKey };
    } catch (e) {
      Logger.log('getPostProcessWorkLog 오류: ' + e.toString());
      return {
        ok: false,
        error: e.message || String(e),
        rows: [],
        journalDate: Utilities.formatDate(new Date(), POST_PROCESS_RECORD_TIMEZONE, 'yyyy-MM-dd')
      };
    }
  }

  /**
   * 누적 수량 직접 설정 (0 이상 정수) — 키: 주문서번호
   */
  function postProcessSetCount(orderNumber, newCount) {
    var lock = LockService.getDocumentLock();
    if (!lock.tryLock(20000)) {
      return { ok: false, message: '다른 저장 처리 중입니다. 잠시 후 다시 시도하세요.' };
    }
    try {
      var key = String(orderNumber || '').trim();
      var parsed = _postProcessParseOrderModelKey_(key);
      var orderNo = parsed.orderNo;
      var productNameKey = parsed.productName;
      if (!orderNo) return { ok: false, message: '주문서를 선택하세요.' };
      var ord = _postProcessFindOrderByOrderAndProduct_(orderNo, productNameKey) || getOrderByNumber(orderNo);
      if (!ord) return { ok: false, message: '주문서를 찾을 수 없습니다.' };
      var n = parseInt(newCount, 10);
      if (isNaN(n)) n = 0;
      n = Math.max(0, n);
      var sheet = getOrCreatePostProcessCountSheet();
      var values = sheet.getDataRange().getValues();
      var rowIdx = _postProcessFindCountSheetRow_(values, orderNo, productNameKey);
      var now = _postProcessCountNowString_();
      var sheetProduct = _postProcessSheetProductColumn_(ord);
      var current = 0;
      if (rowIdx >= 0) {
        var q0 = values[rowIdx - 1][3];
        current = _postProcessCountCellToQty_(q0);
      }
      if (rowIdx < 0) {
        sheet.appendRow([now, orderNo, sheetProduct, n]);
        _postProcessCountFormatQtyTimeRow_(sheet, sheet.getLastRow());
      } else {
        sheet.getRange(rowIdx, 1, 1, 4).setValues([[now, orderNo, sheetProduct, n]]);
        _postProcessCountFormatQtyTimeRow_(sheet, rowIdx);
      }
      var planned = Number(ord.quantity) || 0;
      var countKey = _postProcessUiCountKey_(ord);
      var dm = _postProcessGetDailyInputMap_();
      var prevToday = Number(dm[countKey]) || 0;
      dm[countKey] = Math.max(0, prevToday + (n - current));
      _postProcessSetDailyInputMap_(dm);
      var teamOpt = arguments.length > 2 && arguments[2] && arguments[2].team != null ? String(arguments[2].team).trim() : '';
      if (teamOpt) _homeSetPostTeamActive_(teamOpt, orderNo, sheetProduct);
      invalidateProductionMapsCache_();
      return { ok: true, orderNumber: countKey, counted: n, planned: planned, todayInput: dm[countKey] };
    } catch (e) {
      Logger.log('postProcessSetCount 오류: ' + e.toString());
      return { ok: false, message: e.message || String(e) };
    } finally {
      try {
        lock.releaseLock();
      } catch (rel) {}
    }
  }

  /**
   * @param {string} orderNumber 주문서번호
   * @param {number} delta 예: +1, -1
   */
  function postProcessAdjustCount(orderNumber, delta) {
    var lock = LockService.getDocumentLock();
    if (!lock.tryLock(20000)) {
      return { ok: false, message: '다른 저장 처리 중입니다. 잠시 후 다시 시도하세요.' };
    }
    try {
      var key = String(orderNumber || '').trim();
      var parsed = _postProcessParseOrderModelKey_(key);
      var orderNo = parsed.orderNo;
      var productNameKey = parsed.productName;
      if (!orderNo) return { ok: false, message: '주문서를 선택하세요.' };
      var ord = _postProcessFindOrderByOrderAndProduct_(orderNo, productNameKey) || getOrderByNumber(orderNo);
      if (!ord) return { ok: false, message: '주문서를 찾을 수 없습니다.' };
      var d = parseInt(delta, 10);
      if (isNaN(d)) d = 0;
      var sheet = getOrCreatePostProcessCountSheet();
      var values = sheet.getDataRange().getValues();
      var rowIdx = _postProcessFindCountSheetRow_(values, orderNo, productNameKey);
      var current = 0;
      if (rowIdx >= 0) {
        var qq = values[rowIdx - 1][3];
        current = _postProcessCountCellToQty_(qq);
      }
      var next = Math.max(0, Math.floor(current) + d);
      var now = _postProcessCountNowString_();
      var sheetProduct = _postProcessSheetProductColumn_(ord);
      if (rowIdx < 0) {
        sheet.appendRow([now, orderNo, sheetProduct, next]);
        _postProcessCountFormatQtyTimeRow_(sheet, sheet.getLastRow());
      } else {
        sheet.getRange(rowIdx, 1, 1, 4).setValues([[now, orderNo, sheetProduct, next]]);
        _postProcessCountFormatQtyTimeRow_(sheet, rowIdx);
      }
      var planned = Number(ord.quantity) || 0;
      var countKey = _postProcessUiCountKey_(ord);
      var dm = _postProcessGetDailyInputMap_();
      var prevToday = Number(dm[countKey]) || 0;
      dm[countKey] = Math.max(0, prevToday + (next - current));
      _postProcessSetDailyInputMap_(dm);
      var teamOpt = arguments.length > 2 && arguments[2] && arguments[2].team != null ? String(arguments[2].team).trim() : '';
      if (teamOpt) _homeSetPostTeamActive_(teamOpt, orderNo, sheetProduct);
      invalidateProductionMapsCache_();
      return { ok: true, orderNumber: countKey, counted: next, planned: planned, todayInput: dm[countKey] };
    } catch (e) {
      Logger.log('postProcessAdjustCount 오류: ' + e.toString());
      return { ok: false, message: e.message || String(e) };
    } finally {
      try {
        lock.releaseLock();
      } catch (rel) {}
    }
  }

  function postProcessResetCount(orderNumber) {
    return postProcessSetCount(orderNumber, 0);
  }

  // ========== 주문 출하 (완제품 대수 · 자재 재고와 분리) ==========

  var ORDER_SHIPMENT_HISTORY_SHEET = '주문출하이력';
  var ORDER_SHIPMENT_TZ = 'Asia/Seoul';

  function _orderShipmentUiCountKey_(ord) {
    return _postProcessUiCountKey_(ord);
  }

  function _orderShipmentParseCountKey_(rawKey) {
    return _postProcessParseOrderModelKey_(rawKey);
  }

  function _orderShipmentFindOrderByCountKey_(orderNo, productLabel) {
    return _postProcessResolveOrderLine_(orderNo, productLabel);
  }

  function _orderShipmentHeaders_() {
    return ['출하일', '주문서번호', '고객사', '제품명', '수량', '단가', '공급가액'];
  }

  function _orderShipmentIsNewHistoryHeader_(headerRow) {
    var h = headerRow || [];
    return String(h[2] || '').trim() === '고객사' && String(h[4] || '').trim() === '수량';
  }

  function _orderShipmentFormatHistorySheet_(sheet) {
    if (!sheet || sheet.getLastRow() < 2) return;
    var lr = sheet.getLastRow();
    sheet.getRange(2, 5, lr, 1).setNumberFormat('0');
    sheet.getRange(2, 6, lr, 2).setNumberFormat('#,##0');
  }

  /** 이력 행 → 주문 1행 (단가·구 sheetRow로 구분) */
  function _orderShipmentFindOrderForHistoryRow_(orderNo, productName, unitPriceOpt, sheetRowOpt, ordersOpt) {
    var on = String(orderNo || '').trim();
    var pn = String(productName || '').trim();
    if (!on) return null;
    var upW = unitPriceOpt != null && !isNaN(unitPriceOpt) ? Math.round(Number(unitPriceOpt)) : null;
    var srW = sheetRowOpt != null && !isNaN(sheetRowOpt) && sheetRowOpt >= 2 ? Math.floor(sheetRowOpt) : null;
    var orders = ordersOpt && ordersOpt.length ? ordersOpt : getOrders() || [];
    var fallback = null;
    var i;
    for (i = 0; i < orders.length; i++) {
      var O = orders[i] || {};
      if (String(O.orderNumber || '').trim() !== on) continue;
      if (pn && String(O.productName || '').trim() !== pn) continue;
      if (srW >= 2) {
        var sr = O.sheetRow != null ? Math.floor(Number(O.sheetRow)) : 0;
        if (sr === srW) return O;
      }
      if (upW != null) {
        var up = Math.round(Number(O.unitPrice) || 0);
        if (up === upW) return O;
      }
      if (!fallback) fallback = O;
    }
    return fallback;
  }

  function _migrateOrderShipmentHistorySheetIfNeeded_(sheet) {
    if (!sheet) return;
    var std = _orderShipmentHeaders_();
    var lastCol = Math.max(sheet.getLastColumn(), std.length);
    var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
    if (_orderShipmentIsNewHistoryHeader_(header)) {
      _orderShipmentFormatHistorySheet_(sheet);
      return;
    }
    var values = sheet.getDataRange().getValues();
    var out = [std];
    var isOld =
      String(header[3] || '').trim() === 'sheetRow' ||
      String(header[4] || '').trim() === '이번수량' ||
      (values.length > 1 && values[1].length >= 5 && String(header[2] || '').trim() === '제품명');
    var i;
    for (i = 1; i < values.length; i++) {
      var row = values[i] || [];
      var shipDate = _toYmd_(row[0]) || String(row[0] != null ? row[0] : '').trim();
      var on = '';
      var pn = '';
      var qty = 0;
      var cust = '';
      var up = 0;
      var supply = 0;
      if (isOld) {
        on = String(row[1] != null ? row[1] : '').trim();
        pn = String(row[2] != null ? row[2] : '').trim();
        var srOld = parseInt(row[3], 10);
        if (isNaN(srOld)) srOld = 0;
        qty = typeof row[4] === 'number' && !isNaN(row[4]) ? Math.max(0, Math.floor(row[4])) : parseInt(String(row[4] || '').replace(/,/g, ''), 10);
        if (isNaN(qty)) qty = 0;
        var ordOld = _orderShipmentFindOrderForHistoryRow_(on, pn, null, srOld);
        cust = ordOld && ordOld.customer != null ? String(ordOld.customer).trim() : '';
        up = ordOld ? Math.round(Number(ordOld.unitPrice) || 0) : 0;
      } else {
        on = String(row[1] != null ? row[1] : '').trim();
        cust = String(row[2] != null ? row[2] : '').trim();
        pn = String(row[3] != null ? row[3] : '').trim();
        qty = typeof row[4] === 'number' && !isNaN(row[4]) ? Math.max(0, Math.floor(row[4])) : parseInt(String(row[4] || '').replace(/,/g, ''), 10);
        if (isNaN(qty)) qty = 0;
        up = typeof row[5] === 'number' && !isNaN(row[5]) ? Math.round(row[5]) : parseInt(String(row[5] || '').replace(/,/g, ''), 10);
        if (isNaN(up)) up = 0;
        supply = typeof row[6] === 'number' && !isNaN(row[6]) ? Math.round(row[6]) : parseInt(String(row[6] || '').replace(/,/g, ''), 10);
        if (isNaN(supply)) supply = 0;
      }
      if (!on && !pn && !qty) continue;
      if (!supply) supply = Math.round(qty * up);
      out.push([shipDate, on, cust, pn, qty, up, supply]);
    }
    sheet.clearContents();
    sheet.getRange(1, 1, out.length, std.length).setValues(out);
    sheet.getRange(1, 1, 1, std.length).setBackground('#fff7ed').setFontWeight('bold');
    _orderShipmentFormatHistorySheet_(sheet);
  }

  function getOrCreateOrderShipmentHistorySheet() {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(ORDER_SHIPMENT_HISTORY_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(ORDER_SHIPMENT_HISTORY_SHEET);
      var h = _orderShipmentHeaders_();
      sheet.getRange(1, 1, 1, h.length).setValues([h]);
      sheet.getRange(1, 1, 1, h.length).setBackground('#fff7ed').setFontWeight('bold');
    } else {
      var h0 = String(sheet.getRange(1, 1).getDisplayValue() || '').trim();
      if (h0 !== '출하일') {
        var std = _orderShipmentHeaders_();
        sheet.getRange(1, 1, 1, std.length).setValues([std]);
        sheet.getRange(1, 1, 1, std.length).setBackground('#fff7ed').setFontWeight('bold');
      }
      _migrateOrderShipmentHistorySheetIfNeeded_(sheet);
    }
    return sheet;
  }

  /** 주문 시트 1행별 누적 출하 대수 */
  function getOrderShipmentCountsMap_() {
    return _getCachedProductionMaps_().shipMap;
  }

  function _dashboardShippedForOrderLine_(shipMap, ord, skipDirect) {
    skipDirect = skipDirect === true;
    if (!shipMap || typeof shipMap !== 'object') shipMap = {};
    var prodQty = 0;
    var key = _orderShipmentUiCountKey_(ord);
    if (key && shipMap[key] != null && shipMap[key] !== '') {
      prodQty = Math.max(0, Math.floor(Number(shipMap[key]) || 0));
    } else {
      var comboQty = _dashboardAssemblyComboCountForMemberLine_(shipMap, ord);
      if (comboQty != null) prodQty = comboQty;
    }
    if (skipDirect) return prodQty;
    return _effectiveDirectProgressQty_(prodQty, _orderDirectProgressEntry_(null, ord), 'ship');
  }

  /** 주문 1행 — 주문 수량만큼 출하(출고) 완료 여부 */
  function _isOrderLineFullyShipped_(ord, shipMap) {
    ord = ord && typeof ord === 'object' ? ord : {};
    var tgt = Math.max(0, Math.floor(Number(ord.quantity) || 0));
    if (tgt <= 0) return false;
    if (!shipMap || typeof shipMap !== 'object') {
      try {
        shipMap = getOrderShipmentCountsMap_();
      } catch (eShip) {
        shipMap = {};
      }
    }
    return _dashboardShippedForOrderLine_(shipMap, ord) >= tgt;
  }

  function _orderShipmentStatusForLine_(shipped, targetQty) {
    var tgt = Math.floor(Number(targetQty) || 0);
    var q = Math.max(0, Math.floor(Number(shipped) || 0));
    if (q <= 0) return '대기';
    if (tgt > 0 && q >= tgt) return '출하완료';
    return '부분출하';
  }

  /** SMT·후공정 실적 기준 출하 상한 (둘 다 있으면 작은 값) */
  function _orderShipmentProductionCap_(smtQty, postQty) {
    var s = Math.max(0, Math.floor(Number(smtQty) || 0));
    var p = Math.max(0, Math.floor(Number(postQty) || 0));
    if (s <= 0 && p <= 0) return 0;
    if (s <= 0) return p;
    if (p <= 0) return s;
    return Math.min(s, p);
  }

  /** 출하·후공정 공통 — 주문 목록 + 조립 완제품 합침 */
  function _orderLinesForAssemblyPages_(baseOpt) {
    var base = baseOpt && baseOpt.length ? baseOpt : getOrders() || [];
    if (!baseOpt) {
      var ordersPkg = _getOrdersCachePkg_();
      var ordersRev = ordersPkg && ordersPkg.loadedAt ? ordersPkg.loadedAt : 0;
      if (
        __assemblyLinesCache_ &&
        __assemblyLinesCache_.ordersRev === ordersRev &&
        Date.now() - __assemblyLinesCache_.loadedAt < ASSEMBLY_LINES_CACHE_TTL_SEC * 1000
      ) {
        return __assemblyLinesCache_.data;
      }
    }
    var i;
    for (i = 0; i < base.length; i++) {
      if (base[i] && !base[i]._countKey) {
        _enrichOrderLineMeta_(base[i], base[i].sheetRow, base[i].orderLineSeq != null ? base[i].orderLineSeq : i);
      }
    }
    var catalog = _postProcessBuildComboBomCatalog_();
    var merged = _postProcessApplyComboBomOrders_(base, catalog);
    _postProcessAttachProductKind_(merged, catalog);
    var result = { base: base, merged: merged, catalog: catalog };
    if (!baseOpt) {
      var pkgRev = _getOrdersCachePkg_();
      __assemblyLinesCache_ = {
        data: result,
        loadedAt: Date.now(),
        ordersRev: pkgRev && pkgRev.loadedAt ? pkgRev.loadedAt : Date.now()
      };
    }
    return result;
  }

  function _orderShipmentFindMemberOrderLine_(orderNo, productCode, sheetRow, orders) {
    orders = orders || [];
    var on = String(orderNo || '').trim();
    var pc = String(productCode || '').trim();
    var sr = sheetRow != null ? Math.floor(Number(sheetRow)) : 0;
    var i;
    for (i = 0; i < orders.length; i++) {
      var O = orders[i] || {};
      if (String(O.orderNumber || '').trim() !== on) continue;
      if (pc && String(O.productCode || '').trim().toLowerCase() !== pc.toLowerCase()) continue;
      if (sr >= 2 && Math.floor(Number(O.sheetRow) || 0) !== sr) continue;
      return O;
    }
    return null;
  }

  /** 주문 1행 — SMT·후공정 생산 참고 및 출하 상한 */
  function _orderShipmentProdRefForOrder_(ord, qtyMap, postCounts, smtByLabel, ordersOpt) {
    ord = ord && typeof ord === 'object' ? ord : {};
    if (ord.detailInfo && ord.detailInfo.source === 'combo-bom') {
      var postQty = _dashboardPostCountedForOrderLine_(postCounts || {}, ord);
      var base = ordersOpt && ordersOpt.length ? ordersOpt : getOrders() || [];
      var codes = ord.detailInfo.memberProductCodes || [];
      var sheetRows = ord.detailInfo.memberSheetRows || [];
      var smtVals = [];
      var mi;
      for (mi = 0; mi < codes.length; mi++) {
        var member = _orderShipmentFindMemberOrderLine_(
          ord.orderNumber,
          codes[mi],
          sheetRows[mi],
          base
        );
        if (!member) continue;
        smtVals.push(_dashboardSmtProducedForOrderLine_(qtyMap || {}, member, smtByLabel));
      }
      var smtMin = 0;
      if (smtVals.length) smtMin = Math.min.apply(null, smtVals);
      var cap = _orderShipmentProductionCap_(smtMin, postQty);
      return { smtQty: smtMin, postQty: postQty, cap: cap };
    }
    var smtQty = _dashboardSmtProducedForOrderLine_(qtyMap || {}, ord, smtByLabel);
    var postQty2 = _dashboardPostCountedForOrderLine_(postCounts || {}, ord);
    var cap2 = _orderShipmentProductionCap_(smtQty, postQty2);
    return { smtQty: smtQty, postQty: postQty2, cap: cap2 };
  }

  /**
   * @param {{ shipDate?:string, countKey?:string, qty?:number, note?:string }} payload
   */
  function addOrderShipmentRecord(payload) {
    var lock = LockService.getDocumentLock();
    if (!lock.tryLock(20000)) {
      return { ok: false, message: '다른 저장 처리 중입니다. 잠시 후 다시 시도하세요.' };
    }
    try {
      payload = payload || {};
      var parsed = _orderShipmentParseCountKey_(payload.countKey);
      var orderNo = parsed.orderNo;
      var productLabel = parsed.productName;
      if (!orderNo) return { ok: false, message: '주문 행을 선택하세요.' };
      var ord = _orderShipmentFindOrderByCountKey_(orderNo, productLabel) || getOrderByNumber(orderNo);
      if (!ord) return { ok: false, message: '주문을 찾을 수 없습니다.' };
      var qtyThis = parseInt(payload.qty, 10);
      if (isNaN(qtyThis) || qtyThis <= 0) {
        return { ok: false, message: '이번 출하 수량은 1 이상이어야 합니다.' };
      }
      var target = Math.floor(Number(ord.quantity) || 0);
      var maps = _getCachedProductionMaps_() || {};
      var shipMap = maps.shipMap || {};
      var qtyMap = maps.qtyMap || {};
      var postCounts = maps.postCounts || {};
      var smtByLabel = maps.smtByLabel || _dashboardSmtCountsByOrderLabel_(qtyMap);
      var pkg = _orderLinesForAssemblyPages_();
      var uiKey = _orderShipmentUiCountKey_(ord);
      var prev = Math.max(0, Math.floor(Number(shipMap[uiKey]) || 0));
      var remain = target > 0 ? Math.max(0, target - prev) : 0;
      if (target > 0 && qtyThis > remain) {
        return {
          ok: false,
          message: '잔량(' + remain + ')을 초과할 수 없습니다. (주문 ' + target + ' · 이미 출하 ' + prev + ')'
        };
      }
      var prod = _orderShipmentProdRefForOrder_(ord, qtyMap, postCounts, smtByLabel, pkg.base);
      if (prod.cap <= 0) {
        return {
          ok: false,
          message:
            '생산 실적이 없어 출하할 수 없습니다. (SMT ' +
            prod.smtQty +
            ' · 후공정 ' +
            prod.postQty +
            ')'
        };
      }
      if (prev + qtyThis > prod.cap) {
        return {
          ok: false,
          message:
            '생산 참고 수량을 초과합니다. 누적 출하 ' +
            (prev + qtyThis) +
            ' > 한도 ' +
            prod.cap +
            ' (SMT ' +
            prod.smtQty +
            ' · 후공정 ' +
            prod.postQty +
            ')'
        };
      }
      var d = payload.shipDate
        ? String(payload.shipDate).trim()
        : Utilities.formatDate(new Date(), ORDER_SHIPMENT_TZ, 'yyyy-MM-dd');
      var sheet = getOrCreateOrderShipmentHistorySheet();
      var pn = String(ord.productName != null ? ord.productName : '').trim();
      var cust = String(ord.customer != null ? ord.customer : '').trim();
      var unitPrice = Math.round(Number(ord.unitPrice) || 0);
      var supplyAmount = Math.round(qtyThis * unitPrice);
      var note = payload.note != null ? String(payload.note).trim() : '';
      sheet.appendRow([d, orderNo, cust, pn, qtyThis, unitPrice, supplyAmount]);
      var last = sheet.getLastRow();
      if (last >= 2) {
        sheet.getRange(last, 5).setNumberFormat('0');
        sheet.getRange(last, 6, last, 2).setNumberFormat('#,##0');
      }
      var counted = prev + qtyThis;
      _patchOrderShipmentCountInCache_(uiKey, counted);
      return {
        ok: true,
        countKey: uiKey,
        counted: counted,
        qtyThis: qtyThis,
        planned: target,
        remaining: target > 0 ? Math.max(0, target - counted) : 0,
        status: _orderShipmentStatusForLine_(counted, target),
        shipPdf: {
          countKey: uiKey,
          shipDate: d,
          qty: qtyThis,
          unitPrice: unitPrice,
          supplyAmount: supplyAmount,
          note: note
        }
      };
    } catch (e) {
      Logger.log('addOrderShipmentRecord 오류: ' + e.toString());
      return { ok: false, message: e.message || String(e) };
    } finally {
      try {
        lock.releaseLock();
      } catch (rel) {}
    }
  }

  function getOrderShipmentHistory(optMaxRows, pkgOpt) {
    try {
      var maxR = optMaxRows > 0 ? Math.floor(optMaxRows) : 200;
      var sheet = getOrCreateOrderShipmentHistorySheet();
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return { ok: true, rows: [] };
      var pkgHist = pkgOpt && pkgOpt.merged ? pkgOpt : _orderLinesForAssemblyPages_();
      var mergedHist = pkgHist.merged || [];
      var baseHist = pkgHist.base || [];
      var colW = Math.max(7, sheet.getLastColumn());
      var values = sheet.getRange(2, 1, lastRow - 1, colW).getValues();
      var rows = [];
      var tz = Session.getScriptTimeZone();
      var i;
      for (i = values.length - 1; i >= 0 && rows.length < maxR; i--) {
        var r = values[i] || [];
        var d0 = r[0];
        var dateStr = '';
        if (d0 instanceof Date && !isNaN(d0.getTime())) {
          dateStr = Utilities.formatDate(d0, tz, 'yyyy-MM-dd');
        } else {
          dateStr = d0 ? String(d0).trim() : '';
        }
        var on = r[1] != null ? String(r[1]).trim() : '';
        var cust = r[2] != null ? String(r[2]).trim() : '';
        var pn = r[3] != null ? String(r[3]).trim() : '';
        var q = r[4];
        var qty = typeof q === 'number' && !isNaN(q) ? Math.floor(q) : parseInt(String(q || '').replace(/,/g, ''), 10);
        if (isNaN(qty)) qty = 0;
        var up = typeof r[5] === 'number' && !isNaN(r[5]) ? Math.round(r[5]) : parseInt(String(r[5] || '').replace(/,/g, ''), 10);
        if (isNaN(up)) up = 0;
        var supply = typeof r[6] === 'number' && !isNaN(r[6]) ? Math.round(r[6]) : parseInt(String(r[6] || '').replace(/,/g, ''), 10);
        if (isNaN(supply)) supply = Math.round(qty * up);
        if (!on && !pn && !qty) continue;
        var ordH = _orderShipmentFindOrderForHistoryRow_(on, pn, up, null, mergedHist);
        if (!ordH) ordH = _orderShipmentFindOrderForHistoryRow_(on, pn, up, null, baseHist);
        var countKey = ordH ? _orderShipmentUiCountKey_(ordH) : '';
        rows.push({
          shipDate: dateStr,
          orderNumber: on,
          customer: cust,
          productName: pn,
          qty: qty,
          qtyThis: qty,
          unitPrice: up,
          supplyAmount: supply,
          countKey: countKey
        });
      }
      return { ok: true, rows: rows };
    } catch (e) {
      Logger.log('getOrderShipmentHistory 오류: ' + e.toString());
      return { ok: false, error: e.message || String(e), rows: [] };
    }
  }

  function _buildOrderShipmentPageData_() {
    var pkg = _orderLinesForAssemblyPages_();
    var orders = pkg.merged || [];
    var baseOrders = pkg.base || [];
    var maps = _getCachedProductionMaps_();
    var shipMap = maps.shipMap || {};
    var qtyMap = maps.qtyMap || {};
    var postCounts = maps.postCounts || {};
    var smtByLabel = maps.smtByLabel || _dashboardSmtCountsByOrderLabel_(qtyMap);
    var productionRef = {};
    var incomplete = [];
    var i;
    for (i = 0; i < orders.length; i++) {
      var O = orders[i] || {};
      var on = String(O.orderNumber || '').trim();
      var tgt = Math.floor(Number(O.quantity) || 0);
      if (!on || tgt <= 0) continue;
      var ref = _orderShipmentProdRefForOrder_(O, qtyMap, postCounts, smtByLabel, baseOrders);
      var uiKey = _orderShipmentUiCountKey_(O);
      if (uiKey) productionRef[uiKey] = ref;
      var shipped = _dashboardShippedForOrderLine_(shipMap, O);
      if (shipped >= tgt) continue;
      var orderRem = Math.max(0, tgt - shipped);
      var shipAvail = 0;
      if (ref.cap > 0) shipAvail = Math.min(orderRem, Math.max(0, ref.cap - shipped));
      incomplete.push({
        _uiKey: O._uiKey,
        _countKey: _orderShipmentUiCountKey_(O),
        orderNumber: on,
        customer: String(O.customer || '').trim(),
        productName: String(O.productName || '').trim(),
        productCode: String(O.productCode || '').trim(),
        version: String(O.version || '').trim(),
        quantity: tgt,
        shipped: shipped,
        remaining: orderRem,
        shipAvailable: shipAvail,
        unitPrice: O.unitPrice,
        prodCap: ref.cap,
        postProcessKind: O.postProcessKind || '',
        postProcessKindLabel: O.postProcessKindLabel || '',
        detailInfo: O.detailInfo || null,
        status: _orderShipmentStatusForLine_(shipped, tgt)
      });
    }
    incomplete.sort(function (a, b) {
      return String(a.orderNumber).localeCompare(String(b.orderNumber), 'ko', { numeric: true });
    });
    var hist = getOrderShipmentHistory(30, pkg);
    return {
      ok: true,
      orders: orders,
      counts: shipMap,
      productionRef: productionRef,
      incomplete: incomplete,
      recentHistory: hist.ok ? hist.rows : []
    };
  }

  function _getOrderShipmentPageDataCached_() {
    if (
      __orderShipmentPageCache_ &&
      Date.now() - __orderShipmentPageCache_.loadedAt < ORDER_SHIPMENT_PAGE_CACHE_TTL_SEC * 1000
    ) {
      return __orderShipmentPageCache_.data;
    }
    try {
      var cached = CacheService.getScriptCache().get(ORDER_SHIPMENT_PAGE_CACHE_SCRIPT_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed && parsed.ok) {
          __orderShipmentPageCache_ = { data: parsed, loadedAt: Date.now() };
          return parsed;
        }
      }
    } catch (eCache) {}
    var built = _buildOrderShipmentPageData_();
    __orderShipmentPageCache_ = { data: built, loadedAt: Date.now() };
    try {
      var json = JSON.stringify(built);
      if (json.length <= 95000) {
        CacheService.getScriptCache().put(
          ORDER_SHIPMENT_PAGE_CACHE_SCRIPT_KEY,
          json,
          ORDER_SHIPMENT_PAGE_CACHE_TTL_SEC
        );
      }
    } catch (ePut) {}
    return built;
  }

  function getOrderShipmentPageData() {
    try {
      return _getOrderShipmentPageDataCached_();
    } catch (e) {
      Logger.log('getOrderShipmentPageData 오류: ' + e.toString());
      return { ok: false, error: e.message || String(e), orders: [], counts: {}, incomplete: [], recentHistory: [] };
    }
  }

  /**
   * 출하 거래명세서 HTML (인쇄 → PDF 저장)
   */
  function _buildOrderShipmentStatementPdfHtml_(data) {
    var esc = _moPdfEscapeHtml_;
    var fmt = _moPdfFormatNumber_;
    var d = data || {};
    var shipDate = esc(d.shipDate || '');
    var orderNo = esc(d.orderNumber || '');
    var customer = esc(d.customer || '');
    var productName = esc(d.productName || '');
    var productCode = esc(d.productCode || '');
    var qty = Math.max(0, Math.floor(Number(d.qty) || 0));
    var unitPrice = Math.max(0, Math.round(Number(d.unitPrice) || 0));
    var supply =
      d.supplyAmount != null && !isNaN(Number(d.supplyAmount))
        ? Math.round(Number(d.supplyAmount))
        : Math.round(qty * unitPrice);
    var noteRaw = d.note != null ? String(d.note).trim() : '';
    var note = esc(noteRaw);
    var issuedAt = Utilities.formatDate(new Date(), ORDER_SHIPMENT_TZ, 'yyyy-MM-dd');
    var docNo = esc(d.docNo || shipDate + '-' + orderNo);

    return (
      '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">' +
      '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">' +
      '<title>거래명세서 ' +
      orderNo +
      '</title><style>' +
      '@page { size: A4; margin: 14mm 12mm; }' +
      'html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
      'body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; margin: 0; padding: 28px 32px 36px; color: #0f172a; background: #fff; font-size: 13px; line-height: 1.45; }' +
      '.top-stripe { height: 6px; background: linear-gradient(90deg, #ea580c 0%, #f97316 55%, #fdba74 100%); margin: -28px -32px 22px; }' +
      '.letterhead { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 22px; padding-bottom: 18px; border-bottom: 2px solid #e2e8f0; }' +
      '.issuer .brand { font-size: 22px; font-weight: 800; color: #c2410c; letter-spacing: -0.5px; }' +
      '.issuer .sub { font-size: 12px; color: #64748b; margin-top: 4px; }' +
      '.doc-title { text-align: right; }' +
      '.doc-title .en { font-size: 11px; font-weight: 700; color: #ea580c; letter-spacing: 0.12em; }' +
      '.doc-title h1 { margin: 4px 0 0; font-size: 26px; font-weight: 800; color: #9a3412; letter-spacing: 0.35em; }' +
      '.doc-title .no { margin-top: 8px; font-size: 14px; font-weight: 700; color: #334155; }' +
      '.party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }' +
      '.party-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 16px; background: #f8fafc; }' +
      '.party-box.to { border-color: #fdba74; background: #fff7ed; }' +
      '.party-box .label { font-size: 11px; font-weight: 700; color: #c2410c; letter-spacing: 0.06em; margin-bottom: 8px; }' +
      '.party-box .name { font-size: 16px; font-weight: 700; color: #0f172a; }' +
      '.party-box .meta { font-size: 12px; color: #475569; margin-top: 6px; }' +
      '.meta-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; font-size: 12px; }' +
      '.meta-bar .cell { background: #fff7ed; border-radius: 6px; padding: 10px 12px; border: 1px solid #ffedd5; }' +
      '.meta-bar .cell strong { display: block; color: #9a3412; font-size: 10px; margin-bottom: 4px; }' +
      '.items { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }' +
      '.items th { background: #9a3412; color: #fff; padding: 10px 8px; text-align: left; font-weight: 600; border: 1px solid #c2410c; }' +
      '.items th.num, .items td.num { text-align: right; }' +
      '.items td { padding: 9px 8px; border: 1px solid #e2e8f0; vertical-align: top; }' +
      '.items td.c-no, .items th.c-no { text-align: center; width: 36px; }' +
      '.items td.amt { font-weight: 700; color: #c2410c; }' +
      '.totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 20px; }' +
      '.totals { width: 340px; border: 2px solid #ea580c; border-radius: 8px; overflow: hidden; }' +
      '.totals .row { display: flex; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #ffedd5; font-size: 13px; }' +
      '.totals .row:last-child { border-bottom: none; background: #fff7ed; font-size: 16px; font-weight: 800; color: #9a3412; }' +
      '.totals .row .val { font-variant-numeric: tabular-nums; }' +
      '.notes { border-left: 4px solid #ea580c; padding: 12px 14px; background: #f8fafc; font-size: 11px; color: #475569; line-height: 1.6; }' +
      '.notes strong { color: #9a3412; }' +
      '.no-print { margin-bottom: 12px; font-size: 12px; color: #64748b; }' +
      '@media print { .no-print { display: none; } body { padding: 0; } .top-stripe { margin: 0 0 18px; } }' +
      '</style><script>window.onload=function(){setTimeout(function(){window.print();},500);};</script></head><body>' +
      '<div class="top-stripe"></div>' +
      '<div class="no-print">인쇄 대화상자에서 「PDF로 저장」을 선택하세요. <button type="button" onclick="window.print()" style="margin-left:8px;padding:6px 12px;border-radius:6px;border:1px solid #fdba74;background:#fff7ed;font-weight:700;cursor:pointer;">PDF로 저장</button></div>' +
      '<div class="letterhead"><div class="issuer"><div class="brand">미래SMT</div><div class="sub">완제품 출하 · Delivery Statement</div></div>' +
      '<div class="doc-title"><div class="en">TRANSACTION STATEMENT</div><h1>거래명세서</h1><div class="no">문서번호 ' +
      docNo +
      '</div></div></div>' +
      '<div class="party-grid">' +
      '<div class="party-box"><div class="label">공급자 Supplier</div><div class="name">미래SMT</div><div class="meta">출하일: ' +
      shipDate +
      '<br>작성일: ' +
      issuedAt +
      '</div></div>' +
      '<div class="party-box to"><div class="label">공급받는자 Buyer</div><div class="name">' +
      customer +
      '</div><div class="meta">주문서번호: ' +
      orderNo +
      '</div></div></div>' +
      '<div class="meta-bar">' +
      '<div class="cell"><strong>출하일</strong>' +
      shipDate +
      '</div>' +
      '<div class="cell"><strong>주문서번호</strong>' +
      orderNo +
      '</div>' +
      '<div class="cell"><strong>품목코드</strong>' +
      productCode +
      '</div>' +
      '<div class="cell"><strong>출하수량</strong>' +
      fmt(qty) +
      ' 대</div></div>' +
      '<table class="items"><thead><tr>' +
      '<th class="c-no">No</th><th>품명</th><th class="num">수량</th><th class="num">단가</th><th class="num">공급가액</th>' +
      '</tr></thead><tbody><tr>' +
      '<td class="c-no">1</td><td>' +
      productName +
      '</td><td class="num">' +
      fmt(qty) +
      '</td><td class="num">₩' +
      fmt(unitPrice) +
      '</td><td class="num amt">₩' +
      fmt(supply) +
      '</td></tr></tbody></table>' +
      '<div class="totals-wrap"><div class="totals">' +
      '<div class="row"><span>공급가액 합계</span><span class="val">₩' +
      fmt(supply) +
      '</span></div></div></div>' +
      (noteRaw
        ? '<div class="notes"><strong>비고</strong><br>' + note + '</div>'
        : '<div class="notes"><strong>안내</strong><br>· 본 명세는 출하일 ' +
          shipDate +
          ' · 수량 ' +
          fmt(qty) +
          '대 기준입니다.</div>') +
      '</body></html>'
    );
  }

  /**
   * 출하 거래명세서 PDF(인쇄용 HTML) 생성
   * @param {string} countKey
   * @param {string} shipDate yyyy-MM-dd
   * @param {number|string} qty 이번 출하 수량
   * @param {string=} note
   */
  function generateOrderShipmentStatementPDF(
    countKey,
    shipDate,
    qty,
    note,
    unitPriceOpt,
    supplyAmountOpt,
    orderNoOpt,
    productNameOpt,
    customerOpt
  ) {
    try {
      var key = countKey != null ? String(countKey).trim() : '';
      var orderNoAlt = orderNoOpt != null ? String(orderNoOpt).trim() : '';
      var productAlt = productNameOpt != null ? String(productNameOpt).trim() : '';
      var customerAlt = customerOpt != null ? String(customerOpt).trim() : '';
      var ord = null;
      if (key) {
        var parsed = _orderShipmentParseCountKey_(key);
        ord =
          _orderShipmentFindOrderByCountKey_(parsed.orderNo, parsed.productName) ||
          getOrderByNumber(parsed.orderNo);
      }
      if (!ord && orderNoAlt) {
        var upGuess =
          unitPriceOpt != null && String(unitPriceOpt).trim() !== '' && !isNaN(Number(unitPriceOpt))
            ? Math.round(Number(unitPriceOpt))
            : null;
        var pkgPdf = _orderLinesForAssemblyPages_();
        ord = _orderShipmentFindOrderForHistoryRow_(orderNoAlt, productAlt, upGuess, null, pkgPdf.merged || []);
        if (!ord) ord = _orderShipmentFindOrderForHistoryRow_(orderNoAlt, productAlt, upGuess, null, pkgPdf.base || []);
      }
      if (!ord && orderNoAlt) {
        ord = {
          orderNumber: orderNoAlt,
          customer: customerAlt,
          productName: productAlt,
          productCode: '',
          unitPrice: unitPriceOpt
        };
      }
      if (!ord) {
        return HtmlService.createHtmlOutput(
          '<html><body><h1>오류</h1><p>주문을 찾을 수 없습니다.</p></body></html>'
        );
      }
      var qtyN = parseInt(qty, 10);
      if (isNaN(qtyN) || qtyN <= 0) {
        return HtmlService.createHtmlOutput(
          '<html><body><h1>오류</h1><p>출하 수량이 올바르지 않습니다.</p></body></html>'
        );
      }
      var shipDateStr = shipDate ? String(shipDate).trim() : '';
      if (!shipDateStr) {
        shipDateStr = Utilities.formatDate(new Date(), ORDER_SHIPMENT_TZ, 'yyyy-MM-dd');
      }
      var pn = String(ord.productName != null ? ord.productName : productAlt || '').trim();
      var custName = String(ord.customer != null ? ord.customer : customerAlt || '').trim();
      var unitPrice = Math.round(Number(ord.unitPrice) || 0);
      if (unitPriceOpt != null && String(unitPriceOpt).trim() !== '' && !isNaN(Number(unitPriceOpt))) {
        unitPrice = Math.round(Number(unitPriceOpt));
      }
      var supplyAmount = Math.round(qtyN * unitPrice);
      if (supplyAmountOpt != null && String(supplyAmountOpt).trim() !== '' && !isNaN(Number(supplyAmountOpt))) {
        supplyAmount = Math.round(Number(supplyAmountOpt));
      }
      var html = _buildOrderShipmentStatementPdfHtml_({
        shipDate: shipDateStr,
        orderNumber: String(ord.orderNumber || '').trim(),
        customer: custName,
        productName: pn,
        productCode: String(ord.productCode || '').trim(),
        qty: qtyN,
        unitPrice: unitPrice,
        supplyAmount: supplyAmount,
        note: note != null ? String(note).trim() : '',
        docNo: shipDateStr + '-' + String(ord.orderNumber || '').trim() + '-' + String(qtyN)
      });
      return HtmlService.createHtmlOutput(html)
        .setTitle('거래명세서 - ' + String(ord.orderNumber || ''))
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (e) {
      Logger.log('generateOrderShipmentStatementPDF 오류: ' + e.toString());
      return HtmlService.createHtmlOutput(
        '<html><body><h1>거래명세서 생성 오류</h1><p>' + (e.message || String(e)) + '</p></body></html>'
      ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
  }

  // ========== 자재 발주 관련 함수 ==========

  /** 신규 자재발주 시트 헤더(입고 LOT만 JSON, 나머지는 열) */
  function _materialOrderNewSheetHeaders_() {
    return [
      '발주번호',
      '발주일',
      '납기일',
      '고객사',
      'CPN',
      '자재명',
      '규격',
      'Part No.',
      '수량',
      '단가',
      '주문금액',
      '상태',
      '입고내역'
    ];
  }

  /**
   * 자재발주 1행 헤더로 열 인덱스(0-based) 해석. 구형(상세정보·자재명 4열) / 신형(자재코드·입고내역) 겸용.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   */
  function _getMaterialOrderColumnIndices_(sheet) {
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
    var find = function(names) {
      return _findHeaderIndexByNames_(headerRow, names);
    };
    var ix = {
      orderNumber: find(['발주번호']),
      orderDate: find(['발주일']),
      deliveryDate: find(['납기일']),
      customer: find(['고객사', '공급업체']),
      materialCode: find([
        'CPN',
        '고객 CPN',
        '고객품목코드',
        '고객 품목코드',
        '자재코드',
        '품목코드'
      ]),
      materialName: find(['자재명']),
      spec: find(['규격', '규격/사양']),
      partNo: find(['Part No.', 'Part No', 'PartNo', 'PART NO', 'MPN1', 'MPN', 'P/N', 'PN']),
      quantity: find(['수량']),
      unitPrice: find(['단가']),
      amount: find(['주문금액', '발주금액']),
      status: find(['상태']),
      detailJson: find(['입고내역', '상세정보'])
    };
    var hasOldDetail = find(['상세정보']) >= 0;
    var hasNewCode = find(['자재코드']) >= 0;
    ix.isLegacy = hasOldDetail && !hasNewCode;
    if (ix.orderNumber < 0) {
      ix.isLegacy = true;
      ix.orderNumber = 0;
      ix.orderDate = 1;
      ix.deliveryDate = 2;
      ix.customer = 3;
      ix.materialCode = -1;
      ix.materialName = 4;
      ix.spec = 5;
      ix.partNo = -1;
      ix.quantity = 6;
      ix.unitPrice = 7;
      ix.amount = 8;
      ix.status = -1;
      ix.detailJson = 9;
    }
    // '상세정보' 헤더가 비어 있어도 A~I가 구형 순서이면 J열(10번째)을 JSON 열로 본다 (신형은 자재명이 5열이라 materialName===4와 배타적)
    if (
      !ix.isLegacy &&
      !hasNewCode &&
      ix.materialCode < 0 &&
      ix.orderNumber === 0 &&
      ix.orderDate === 1 &&
      ix.deliveryDate === 2 &&
      ix.customer === 3 &&
      ix.materialName === 4 &&
      ix.spec === 5 &&
      ix.quantity === 6 &&
      ix.unitPrice === 7 &&
      ix.amount === 8 &&
      lastCol >= 10
    ) {
      ix.detailJson = 9;
      ix.partNo = -1;
      ix.status = -1;
      ix.isLegacy = true;
    }
    return ix;
  }

  function _moCell_(row, ix, key) {
    var c = ix[key];
    if (c == null || c < 0 || !row) return '';
    var v = row[c];
    return v != null && v !== '' ? v : '';
  }

  function _moMergeDetailFromRow_(row, ix) {
    var detail = {};
    var raw = ix.detailJson >= 0 && row[ix.detailJson] ? String(row[ix.detailJson]).trim() : '';
    if (raw) {
      try {
        detail = JSON.parse(raw);
      } catch (e) {
        detail = {};
      }
    }
    if (!ix.isLegacy) {
      var mc = ix.materialCode >= 0 ? String(row[ix.materialCode] != null ? row[ix.materialCode] : '').trim() : '';
      if (mc) {
        detail.productCode = mc;
        detail.materialCode = mc;
      }
      var pn = ix.partNo >= 0 ? String(row[ix.partNo] != null ? row[ix.partNo] : '').trim() : '';
      if (pn) detail.partNo = pn;
      var st = ix.status >= 0 ? String(row[ix.status] != null ? row[ix.status] : '').trim() : '';
      if (st) detail.status = st;
    }
    if (!detail.status) detail.status = '발주';
    return detail;
  }

  /** 신규 레이아웃: 입고 LOT·누적 등만 JSON (짧게 유지) */
  function _moMinimalInboundJson_(detail) {
    var d = detail || {};
    var out = {
      lots: d.lots && Array.isArray(d.lots) ? d.lots : []
    };
    if (d.inboundQuantity != null && d.inboundQuantity !== '') out.inboundQuantity = d.inboundQuantity;
    if (d.inboundDate) out.inboundDate = d.inboundDate;
    if (d.sourceOrderNumber != null) out.sourceOrderNumber = d.sourceOrderNumber;
    if (d.barcode) out.barcode = d.barcode;
    return JSON.stringify(out);
  }

  function _moRowWidth_(ix) {
    return ix.isLegacy ? 10 : 13;
  }

  /**
   * 자재발주 행 배열 생성 (append/setValues용)
   * @param {*} ix _getMaterialOrderColumnIndices_
   * @param {{ orderNumber:string, orderDate:*, deliveryDate:*, customer:string, materialCode?:string, materialName:string, spec:string, partNo?:string, quantity:number, unitPrice:number, orderAmount:number, detailInfo:Object }} o
   */
  function _moBuildRowValues_(ix, o) {
    var detail = o.detailInfo || {};
    var jsonStr = ix.isLegacy ? JSON.stringify(detail) : _moMinimalInboundJson_(detail);
    var st =
      detail.status != null && String(detail.status).trim() !== ''
        ? String(detail.status).trim()
        : o.status != null && String(o.status).trim() !== ''
          ? String(o.status).trim()
          : '발주';
    var mc =
      o.materialCode != null && String(o.materialCode).trim() !== ''
        ? String(o.materialCode).trim()
        : detail.productCode != null
          ? String(detail.productCode).trim()
          : '';
    var pn =
      o.partNo != null && String(o.partNo).trim() !== ''
        ? String(o.partNo).trim()
        : detail.partNo != null
          ? String(detail.partNo).trim()
          : '';
    if (ix.isLegacy) {
      return [
        o.orderNumber,
        o.orderDate,
        o.deliveryDate,
        o.customer,
        o.materialName,
        o.spec,
        o.quantity,
        o.unitPrice,
        o.orderAmount,
        jsonStr
      ];
    }
    return [
      o.orderNumber,
      o.orderDate,
      o.deliveryDate,
      o.customer,
      mc,
      o.materialName,
      o.spec,
      pn,
      o.quantity,
      o.unitPrice,
      o.orderAmount,
      st,
      jsonStr
    ];
  }

  /** 입고·상태 반영 후 상세 JSON 열(및 신형 상태 열)만 갱신 */
  function _moPersistDetailJson_(sheet, rowIndex1Based, ix, detailInfo) {
    if (ix.detailJson < 0) return;
    if (ix.isLegacy) {
      sheet.getRange(rowIndex1Based, ix.detailJson + 1).setValue(JSON.stringify(detailInfo || {}));
    } else {
      var st = detailInfo && detailInfo.status != null ? String(detailInfo.status).trim() : '';
      if (ix.status >= 0 && st) {
        sheet.getRange(rowIndex1Based, ix.status + 1).setValue(st);
      }
      sheet.getRange(rowIndex1Based, ix.detailJson + 1).setValue(_moMinimalInboundJson_(detailInfo || {}));
    }
  }

  function _moLotsInboundSum_(detailInfo) {
    var d = detailInfo || {};
    if (!d.lots || !Array.isArray(d.lots)) return 0;
    var s = 0;
    for (var i = 0; i < d.lots.length; i++) {
      s += _parseInboundQuantity_(d.lots[i] && d.lots[i].quantity);
    }
    return s;
  }

  /** 입고 LOT·상태가 있으면 발주 행 수정·삭제 불가 */
  function _moLineHasInbound_(detailInfo) {
    var d = detailInfo || {};
    var st = d.status != null ? String(d.status).trim() : '';
    if (st === '입고완료' || st === '부분입고') return true;
    if (_moLotsInboundSum_(d) > 1e-9) return true;
    var iq = d.inboundQuantity != null ? Number(d.inboundQuantity) : 0;
    if (isFinite(iq) && iq > 1e-9) return true;
    return false;
  }

  /** 미입고 발주 잔량(입고예정) — 자재명|규격 키 */
  function _mrpBuildPendingInboundMap_() {
    var pendingMap = {};
    var orderSheet = getMaterialOrderSheet();
    var moIx = _getMaterialOrderColumnIndices_(orderSheet);
    var ov = orderSheet.getDataRange().getValues();
    for (var oi = 1; oi < ov.length; oi++) {
      var r = ov[oi] || [];
      var oname = String(_moCell_(r, moIx, 'materialName')).trim();
      var ospec = String(_moCell_(r, moIx, 'spec')).trim();
      if (!oname) continue;
      var okey = _mrpMaterialKey_(oname, ospec);
      var orderQty = _parseInboundQuantity_(_moCell_(r, moIx, 'quantity'));
      var d = _moMergeDetailFromRow_(r, moIx);
      var inboundQty = _moLotsInboundSum_(d);
      var remain = orderQty - inboundQty;
      if (remain > 0) {
        pendingMap[okey] = (pendingMap[okey] || 0) + remain;
      }
    }
    return pendingMap;
  }

  /**
   * 구형 자재발주 시트(상세정보 열에 통 JSON) → 신형(열 분리 + 입고내역 짧은 JSON) 일괄 변환.
   * 실행 전 스프레드시트에서 「자재발주」 시트를 복제해 두는 것을 권장합니다.
   * @return {{ ok:boolean, migratedRows?:number, message?:string, error?:string }}
   */
  function migrateMaterialOrderSheetToNewLayout() {
    try {
      var ss = getSpreadsheet();
      var sheet = ss.getSheetByName('자재발주');
      if (!sheet) {
        return { ok: false, error: '자재발주 시트가 없습니다.' };
      }
      var legacyIx = _getMaterialOrderColumnIndices_(sheet);
      if (!legacyIx.isLegacy) {
        return {
          ok: false,
          message:
            '구형(상세정보 O, 자재코드 열 X)으로 인식되지 않습니다. 이미 신형이거나 1행 헤더가 다를 수 있습니다.'
        };
      }
      var values = sheet.getDataRange().getValues();
      var oldLastRow = values.length;
      var oldLastCol = Math.max(sheet.getLastColumn(), 1);
      var newIxForBuild = { isLegacy: false };
      var out = [_materialOrderNewSheetHeaders_()];
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        var orderNumber = String(_moCell_(row, legacyIx, 'orderNumber')).trim();
        if (!orderNumber) {
          continue;
        }
        var detail = _moMergeDetailFromRow_(row, legacyIx);
        var mc = '';
        if (detail.productCode != null && String(detail.productCode).trim() !== '') {
          mc = String(detail.productCode).trim();
        } else if (detail.materialCode != null && String(detail.materialCode).trim() !== '') {
          mc = String(detail.materialCode).trim();
        }
        var pn = detail.partNo != null ? String(detail.partNo).trim() : '';
        out.push(
          _moBuildRowValues_(newIxForBuild, {
            orderNumber: orderNumber,
            orderDate: _moCell_(row, legacyIx, 'orderDate'),
            deliveryDate: _moCell_(row, legacyIx, 'deliveryDate'),
            customer: String(_moCell_(row, legacyIx, 'customer')),
            materialCode: mc,
            materialName: String(_moCell_(row, legacyIx, 'materialName')),
            spec: String(_moCell_(row, legacyIx, 'spec')),
            partNo: pn,
            quantity: _parseInboundQuantity_(_moCell_(row, legacyIx, 'quantity')),
            unitPrice: _parseInboundQuantity_(_moCell_(row, legacyIx, 'unitPrice')),
            orderAmount: _parseInboundQuantity_(_moCell_(row, legacyIx, 'amount')),
            detailInfo: detail
          })
        );
      }
      sheet.getRange(1, 1, out.length, 13).setValues(out);
      if (oldLastRow > out.length) {
        sheet
          .getRange(out.length + 1, 1, oldLastRow, Math.max(oldLastCol, 13))
          .clearContent();
      }
      if (oldLastCol > 13) {
        sheet.deleteColumns(14, oldLastCol - 13);
      }
      sheet
        .getRange(1, 1, 1, 13)
        .setBackground('#f7fafc')
        .setFontColor('#4a5568')
        .setFontWeight('bold');
      return {
        ok: true,
        migratedRows: out.length - 1,
        message: 'JSON의 품목·Part·상태·LOT·입고누적 등은 행 단위로 열/입고내역에 옮겼습니다. 원본 시트는 복제본으로 보관했는지 확인하세요.'
      };
    } catch (e) {
      Logger.log('migrateMaterialOrderSheetToNewLayout: ' + e.toString());
      return { ok: false, error: e.message || String(e) };
    }
  }

  function getMaterialOrderSheet() {
    try {
      const ss = getSpreadsheet();
      let sheet = ss.getSheetByName('자재발주');
      
      if (!sheet) {
        sheet = ss.insertSheet('자재발주');
        const headers = _materialOrderNewSheetHeaders_();
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length)
          .setBackground('#f7fafc')
          .setFontColor('#4a5568')
          .setFontWeight('bold');
      }
      
      return sheet;
    } catch (error) {
      Logger.log('자재 발주 시트 가져오기 오류: ' + error.toString());
      throw error;
    }
  }

  function generateMaterialOrderNumber() {
    try {
      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      const today = new Date();
      const yearShort = today.getFullYear().toString().slice(-2); // YY
      const month2 = String(today.getMonth() + 1).padStart(2, '0'); // MM
      const day2 = String(today.getDate()).padStart(2, '0'); // DD
      const prefix = `MSP${yearShort}${month2}${day2}`; // MSPYYMMDD
      const todayYmd = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      let hasBaseNoSuffix = false;
      let maxSuffix = 0; // prefix 뒤에 붙는 2자리 순번(예: MSP26052701)
      
      for (var i = 1; i < values.length; i++) {
        // 오늘 날짜 발주만 대상으로 중복 계산
        const rowOrderDate = _moCell_(values[i], ix, 'orderDate');
        let rowYmd = '';
        if (rowOrderDate instanceof Date) {
          rowYmd = Utilities.formatDate(rowOrderDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else {
          rowYmd = String(rowOrderDate || '').trim();
        }
        if (!rowYmd || rowYmd !== todayYmd) continue;

        var orderNumber = String(_moCell_(values[i], ix, 'orderNumber')).trim();
        if (!orderNumber) continue;
        // MSPYYMMDD 또는 MSPYYMMDD + 2자리 순번
        var m = orderNumber.match(/^MSP(\d{2})(\d{2})(\d{2})(\d{2})?$/);
        if (!m) continue;

        if (m[1] !== yearShort || m[2] !== month2 || m[3] !== day2) continue;

        if (m[4] == null || String(m[4]).trim() === '') {
          hasBaseNoSuffix = true; // MSPYYMMDD 형태 존재
        } else {
          var suf = parseInt(m[4], 10);
          if (!isNaN(suf) && suf > maxSuffix) maxSuffix = suf;
        }
      }
      
      // 조건:
      // - 같은 날짜에 MSPYYMMDD(무접미) 가 없으면: MSPYYMMDD 그대로 반환
      // - 이미 존재하면: MSPYYMMDD + 01, 02 ...
      if (!hasBaseNoSuffix && maxSuffix === 0) return prefix;
      const nextSuffix = maxSuffix + 1;
      return `${prefix}${String(nextSuffix).padStart(2, '0')}`; // 예: MSP26052701
    } catch (error) {
      Logger.log('자재 발주번호 생성 오류: ' + error.toString());
      const today = new Date();
      const yearShort = today.getFullYear().toString().slice(-2);
      const month2 = String(today.getMonth() + 1).padStart(2, '0');
      const day2 = String(today.getDate()).padStart(2, '0');
      return `MSP${yearShort}${month2}${day2}`;
    }
  }

  function getMaterialOrders() {
    try {
      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      if (values.length <= 1) {
        return [];
      }
      
      const orders = [];
      
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        
        if (!_moCell_(row, ix, 'orderNumber') || String(_moCell_(row, ix, 'orderNumber')).trim() === '') {
          continue;
        }
        
        const quantity = _parseInboundQuantity_(_moCell_(row, ix, 'quantity'));
        const unitPrice = _parseInboundQuantity_(_moCell_(row, ix, 'unitPrice'));
        const orderAmount = _parseInboundQuantity_(_moCell_(row, ix, 'amount'));
        const detailInfo = _moMergeDetailFromRow_(row, ix);
        var colCpn =
          ix.materialCode >= 0 ? String(row[ix.materialCode] != null ? row[ix.materialCode] : '').trim() : '';
        
        orders.push({
          orderNumber: String(_moCell_(row, ix, 'orderNumber')).trim(),
          orderDate: _moCell_(row, ix, 'orderDate') instanceof Date ?
            Utilities.formatDate(_moCell_(row, ix, 'orderDate'), Session.getScriptTimeZone(), 'yyyy-MM-dd') :
            String(_moCell_(row, ix, 'orderDate') || ''),
          deliveryDate: _moCell_(row, ix, 'deliveryDate') instanceof Date ?
            Utilities.formatDate(_moCell_(row, ix, 'deliveryDate'), Session.getScriptTimeZone(), 'yyyy-MM-dd') :
            String(_moCell_(row, ix, 'deliveryDate') || ''),
          supplier: String(_moCell_(row, ix, 'customer')).trim(),
          productCode:
            colCpn ||
            (detailInfo.productCode != null ? String(detailInfo.productCode).trim() : ''),
          partNo:
            detailInfo.partNo != null && String(detailInfo.partNo).trim() !== ''
              ? String(detailInfo.partNo)
              : (detailInfo.barcode != null ? String(detailInfo.barcode) : ''),
          materialName: String(_moCell_(row, ix, 'materialName')).trim(),
          specification: String(_moCell_(row, ix, 'spec')).trim(),
          quantity: quantity,
          unitPrice: unitPrice,
          orderAmount: orderAmount,
          detailInfo: detailInfo
        });
      }
      
      return orders;
    } catch (error) {
      Logger.log('자재 발주 목록 가져오기 오류: ' + error.toString());
      return [];
    }
  }

  function getMaterialOrderByNumber(orderNumber) {
    try {
      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        if (String(_moCell_(row, ix, 'orderNumber')).trim() === String(orderNumber).trim()) {
          const quantity = _parseInboundQuantity_(_moCell_(row, ix, 'quantity'));
          const unitPrice = _parseInboundQuantity_(_moCell_(row, ix, 'unitPrice'));
          const orderAmount = _parseInboundQuantity_(_moCell_(row, ix, 'amount'));
          const detailInfo = _moMergeDetailFromRow_(row, ix);
          var colCpn =
            ix.materialCode >= 0 ? String(row[ix.materialCode] != null ? row[ix.materialCode] : '').trim() : '';
          
          return {
            orderNumber: String(_moCell_(row, ix, 'orderNumber')).trim(),
            orderDate: _moCell_(row, ix, 'orderDate') instanceof Date ?
              Utilities.formatDate(_moCell_(row, ix, 'orderDate'), Session.getScriptTimeZone(), 'yyyy-MM-dd') :
              String(_moCell_(row, ix, 'orderDate') || ''),
            deliveryDate: _moCell_(row, ix, 'deliveryDate') instanceof Date ?
              Utilities.formatDate(_moCell_(row, ix, 'deliveryDate'), Session.getScriptTimeZone(), 'yyyy-MM-dd') :
              String(_moCell_(row, ix, 'deliveryDate') || ''),
            supplier: String(_moCell_(row, ix, 'customer')).trim(),
            productCode:
              colCpn ||
              (detailInfo.productCode != null ? String(detailInfo.productCode).trim() : ''),
            partNo:
              detailInfo.partNo != null && String(detailInfo.partNo).trim() !== ''
                ? String(detailInfo.partNo)
                : (detailInfo.barcode != null ? String(detailInfo.barcode) : ''),
            materialName: String(_moCell_(row, ix, 'materialName')).trim(),
            specification: String(_moCell_(row, ix, 'spec')).trim(),
            quantity: quantity,
            unitPrice: unitPrice,
            orderAmount: orderAmount,
            detailInfo: detailInfo
          };
        }
      }
      
      return null;
    } catch (error) {
      Logger.log('자재 발주 조회 오류: ' + error.toString());
      return null;
    }
  }

  function saveMaterialOrder(orderData) {
    try {
      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      
      // 발주번호 생성
      const orderNumber = generateMaterialOrderNumber();
      
      // 오늘 날짜
      const today = new Date();
      const orderDate = orderData.orderDate || Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      
      const detailInfo = {
        status: '발주',
        sourceOrderNumber: orderData.orderNumber || null,
        partNo: orderData.partNo != null ? String(orderData.partNo).trim() : '',
        productCode: orderData.productCode != null ? String(orderData.productCode).trim() : ''
      };
      
      const rowData = _moBuildRowValues_(ix, {
        orderNumber: orderNumber,
        orderDate: orderDate,
        deliveryDate: orderData.deliveryDate || '',
        customer: orderData.supplier || '',
        materialCode: orderData.productCode != null ? String(orderData.productCode).trim() : '',
        materialName: orderData.materialName || '',
        spec: orderData.specification || '',
        partNo: orderData.partNo != null ? String(orderData.partNo).trim() : '',
        quantity: orderData.quantity || 0,
        unitPrice: orderData.unitPrice || 0,
        orderAmount: orderData.orderAmount || 0,
        detailInfo: detailInfo
      });
      
      sheet.appendRow(rowData);
      
      return { success: true, orderNumber: orderNumber };
    } catch (error) {
      Logger.log('자재 발주 저장 오류: ' + error.toString());
      throw error;
    }
  }

  function saveMaterialOrders(orderData) {
    try {
      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      const today = new Date();
      const orderDate = orderData.orderDate || Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const deliveryDate = orderData.deliveryDate || '';
      const sourceOrderNumber = orderData.orderNumber || null;
      const supplierHeader =
        orderData.supplier != null && String(orderData.supplier).trim() !== ''
          ? String(orderData.supplier).trim()
          : '';
      
      const orderNumber = generateMaterialOrderNumber();
      
      const rowDataArray = [];
      
      for (var i = 0; i < orderData.materials.length; i++) {
        const material = orderData.materials[i];
        var lineSupplier = '';
        if (material.supplier != null && String(material.supplier).trim() !== '') {
          lineSupplier = String(material.supplier).trim();
        } else if (supplierHeader) {
          lineSupplier = supplierHeader;
        }

        const detailInfo = {
          status: '발주',
          sourceOrderNumber: sourceOrderNumber,
          productCode: material.productCode != null ? String(material.productCode).trim() : '',
          partNo: material.partNo != null ? String(material.partNo).trim() : '',
          barcode: material.barcode || ''
        };
        
        rowDataArray.push(
          _moBuildRowValues_(ix, {
            orderNumber: orderNumber,
            orderDate: orderDate,
            deliveryDate: deliveryDate,
            customer: lineSupplier || '미정',
            materialCode: material.productCode != null ? String(material.productCode).trim() : '',
            materialName: material.materialName || '',
            spec: material.specification || '',
            partNo: material.partNo != null ? String(material.partNo).trim() : '',
            quantity: material.quantity || 0,
            unitPrice: material.unitPrice || 0,
            orderAmount: material.orderAmount || 0,
            detailInfo: detailInfo
          })
        );
      }
      
      if (rowDataArray.length > 0) {
        _sheetAppendRows_(sheet, rowDataArray, rowDataArray[0].length);
      }
      
      return { success: true, orderNumber: orderNumber };
    } catch (error) {
      Logger.log('자재 발주 일괄 저장 오류: ' + error.toString());
      throw error;
    }
  }

  /**
   * 자재 발주 한 행 수정 (동일 발주번호에 여러 품목일 때 발주번호+자재명+규격으로 식별)
   */
  function updateMaterialOrderLine(orderData) {
    try {
      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      const onum = orderData.orderNumber != null ? String(orderData.orderNumber) : '';
      const name = orderData.materialName != null ? String(orderData.materialName) : '';
      const spec = orderData.specification != null ? String(orderData.specification) : '';
      const findName =
        orderData.originalMaterialName !== undefined && orderData.originalMaterialName !== null
          ? String(orderData.originalMaterialName)
          : name;
      const findSpec =
        orderData.originalSpecification !== undefined && orderData.originalSpecification !== null
          ? String(orderData.originalSpecification)
          : spec;
      
      for (var i = 1; i < values.length; i++) {
        const row = values[i];
        const r0 = String(_moCell_(row, ix, 'orderNumber')).trim();
        const r4 = String(_moCell_(row, ix, 'materialName')).trim();
        const r5 = String(_moCell_(row, ix, 'spec')).trim();
        if (r0 === onum && r4 === findName && r5 === findSpec) {
          let detailInfo = _moMergeDetailFromRow_(row, ix);
          if (_moLineHasInbound_(detailInfo)) {
            return {
              success: false,
              message:
                '입고·LOT가 있는 발주는 수정할 수 없습니다. 입고 취소 후 다시 시도하거나, 미입고 품목만 별도 발주로 관리하세요.'
            };
          }
          if (!detailInfo.status) {
            detailInfo.status = '발주';
          }
          if (orderData.productCode !== undefined) {
            detailInfo.productCode =
              orderData.productCode != null ? String(orderData.productCode).trim() : '';
          }
          if (orderData.partNo !== undefined) {
            detailInfo.partNo =
              orderData.partNo != null ? String(orderData.partNo).trim() : '';
          }
          var q = orderData.quantity != null ? Number(orderData.quantity) : 0;
          var up = orderData.unitPrice != null ? Number(orderData.unitPrice) : 0;
          var oa = orderData.orderAmount != null ? Number(orderData.orderAmount) : Math.round(q * up * 10000) / 10000;
          var od = orderData.orderDate;
          if (od instanceof Date) {
            od = Utilities.formatDate(od, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          } else if (od != null) {
            od = String(od);
          } else {
            od = _moCell_(row, ix, 'orderDate');
            if (od instanceof Date) {
              od = Utilities.formatDate(od, Session.getScriptTimeZone(), 'yyyy-MM-dd');
            } else {
              od = od ? String(od) : '';
            }
          }
          var dd = orderData.deliveryDate;
          if (dd instanceof Date) {
            dd = Utilities.formatDate(dd, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          } else if (dd !== undefined && dd !== null) {
            dd = String(dd);
          } else {
            dd = _moCell_(row, ix, 'deliveryDate');
            if (dd instanceof Date) {
              dd = Utilities.formatDate(dd, Session.getScriptTimeZone(), 'yyyy-MM-dd');
            } else {
              dd = dd ? String(dd) : '';
            }
          }
          var sup =
            orderData.supplier !== undefined && orderData.supplier !== null
              ? String(orderData.supplier)
              : String(_moCell_(row, ix, 'customer'));
          var mc =
            orderData.productCode !== undefined
              ? orderData.productCode != null
                ? String(orderData.productCode).trim()
                : ''
              : String(detailInfo.productCode != null ? detailInfo.productCode : '').trim();
          var pn =
            orderData.partNo !== undefined
              ? orderData.partNo != null
                ? String(orderData.partNo).trim()
                : ''
              : String(detailInfo.partNo != null ? detailInfo.partNo : '').trim();
          var w = _moRowWidth_(ix);
          sheet.getRange(i + 1, 1, 1, w).setValues([
            _moBuildRowValues_(ix, {
              orderNumber: onum,
              orderDate: od,
              deliveryDate: dd,
              customer: sup,
              materialCode: mc,
              materialName: name,
              spec: spec,
              partNo: pn,
              quantity: q,
              unitPrice: up,
              orderAmount: oa,
              detailInfo: detailInfo
            })
          ]);
          return { success: true };
        }
      }
      return { success: false, message: '해당 발주 행을 찾을 수 없습니다.' };
    } catch (error) {
      Logger.log('자재 발주 행 수정 오류: ' + error.toString());
      throw error;
    }
  }

  /**
   * 자재 발주 여러 행 일괄 수정 (검증 후 순차 반영, 실패 시 중단·메시지 반환)
   * @param {Array<Object>} lines updateMaterialOrderLine과 동일한 객체 배열
   * @return {{ success:boolean, updated?:number, message?:string, failedIndex?:number }}
   */
  function updateMaterialOrderLinesBatch(lines) {
    try {
      var list = Array.isArray(lines) ? lines : [];
      if (!list.length) {
        return { success: false, message: '저장할 항목이 없습니다.' };
      }
      var updated = 0;
      for (var i = 0; i < list.length; i++) {
        var res = updateMaterialOrderLine(list[i]);
        if (!res || !res.success) {
          return {
            success: false,
            updated: updated,
            failedIndex: i,
            message: (res && res.message) ? res.message : '저장에 실패했습니다. (' + (i + 1) + '번째 품목)'
          };
        }
        updated++;
      }
      return { success: true, updated: updated };
    } catch (error) {
      Logger.log('updateMaterialOrderLinesBatch 오류: ' + error.toString());
      throw error;
    }
  }

  /**
   * 자재 발주 한 행 삭제
   */
  function deleteMaterialOrderLine(orderNumber, materialName, specification) {
    try {
      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      const onum = orderNumber != null ? String(orderNumber) : '';
      const name = materialName != null ? String(materialName) : '';
      const spec = specification != null ? String(specification) : '';
      for (var i = 1; i < values.length; i++) {
        const row = values[i];
        const r0 = String(_moCell_(row, ix, 'orderNumber')).trim();
        const r4 = String(_moCell_(row, ix, 'materialName')).trim();
        const r5 = String(_moCell_(row, ix, 'spec')).trim();
        if (r0 === onum && r4 === name && r5 === spec) {
          var detailInfo = _moMergeDetailFromRow_(row, ix);
          if (_moLineHasInbound_(detailInfo)) {
            return {
              success: false,
              message: '입고·LOT가 있는 발주 행은 삭제할 수 없습니다. 먼저 입고를 취소하세요.'
            };
          }
          sheet.deleteRow(i + 1);
          return { success: true };
        }
      }
      return { success: false, message: '해당 발주 행을 찾을 수 없습니다.' };
    } catch (error) {
      Logger.log('자재 발주 행 삭제 오류: ' + error.toString());
      throw error;
    }
  }

  /**
   * 자재 발주 화면: 자재등록 기준 CPN·명·규격·단가·공급업체 자동완성 (선택 시 행에 반영)
   * @return {{ ok:boolean, products?:Array, materials?:Array, error?:string, zone?:string }}
   */
  function getMaterialOrderAutocompleteSources() {
    try {
      var mats = getMaterials();
      var products = (mats || []).map(function (m) {
        var bp = m.basePrice;
        var up =
          bp !== undefined && bp !== null && bp !== ''
            ? typeof bp === 'number'
              ? bp
              : parseFloat(String(bp).replace(/,/g, '')) || 0
            : 0;
        return {
          PROD_CD: _materialCpn_(m),
          CPN: _materialCpn_(m),
          PROD_DES: m.materialName || '',
          SIZE_DES: m.specification || '',
          PART_NO: _materialMpn_(m),
          PROD_TYPE: '0',
          UNIT_PRICE: up,
          SUPPLIER: m.supplier || '',
          MOQ: m.moq != null && m.moq !== '' ? Number(m.moq) || 0 : 0
        };
      });
      return {
        ok: true,
        products: products,
        materials: [],
        zone: ''
      };
    } catch (err) {
      Logger.log('getMaterialOrderAutocompleteSources 오류: ' + err.toString());
      return {
        ok: false,
        error: err.message || String(err),
        products: [],
        materials: []
      };
    }
  }

  /**
   * 공급업체 마스터 목록(새 자재 발주 모달 공급업체 검색용)
   * 시트명: 공급업체
   * 헤더 예: 공급업체명, 담당자, 전화번호, 이메일 ...
   */
  function getSupplierMasterOptions() {
    try {
      var ss = getSpreadsheet();
      var sh = ss.getSheetByName('공급업체');
      if (!sh || sh.getLastRow() < 2) {
        return { ok: true, rows: [] };
      }
      var lastCol = Math.max(1, sh.getLastColumn());
      var header = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];
      var ixName = _findHeaderIndexByNames_(header, ['공급업체명', '거래처명', '업체명', '공급업체']);
      var ixContact = _findHeaderIndexByNames_(header, ['담당자', '담당자명']);
      var ixPhone = _findHeaderIndexByNames_(header, ['전화번호', '연락처', '대표전화']);
      var ixEmail = _findHeaderIndexByNames_(header, ['이메일', '메일', 'email']);
      if (ixName < 0) return { ok: true, rows: [] };

      var vals = sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).getValues();
      var rows = [];
      for (var i = 0; i < vals.length; i++) {
        var r = vals[i] || [];
        var name = r[ixName] != null ? String(r[ixName]).trim() : '';
        if (!name) continue;
        rows.push({
          name: name,
          contact: ixContact >= 0 && r[ixContact] != null ? String(r[ixContact]).trim() : '',
          phone: ixPhone >= 0 && r[ixPhone] != null ? String(r[ixPhone]).trim() : '',
          email: ixEmail >= 0 && r[ixEmail] != null ? String(r[ixEmail]).trim() : ''
        });
      }
      rows.sort(function (a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
      });
      return { ok: true, rows: rows };
    } catch (err) {
      Logger.log('getSupplierMasterOptions 오류: ' + err.toString());
      return { ok: false, error: err.message || String(err), rows: [] };
    }
  }

  function updateMaterialOrder(orderData) {
    try {
      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      for (var i = 1; i < values.length; i++) {
        const row = values[i];
        if (String(_moCell_(row, ix, 'orderNumber')).trim() === String(orderData.orderNumber).trim()) {
          let detailInfo = _moMergeDetailFromRow_(row, ix);
          
          if (!detailInfo.status) {
            detailInfo.status = '발주';
          }
          
          var w = _moRowWidth_(ix);
          var od = orderData.orderDate != null ? orderData.orderDate : _moCell_(row, ix, 'orderDate');
          if (od instanceof Date) {
            od = Utilities.formatDate(od, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          } else {
            od = od ? String(od) : '';
          }
          var mc =
            orderData.productCode !== undefined
              ? orderData.productCode != null
                ? String(orderData.productCode).trim()
                : ''
              : String(detailInfo.productCode != null ? detailInfo.productCode : '').trim();
          var pn =
            orderData.partNo !== undefined
              ? orderData.partNo != null
                ? String(orderData.partNo).trim()
                : ''
              : String(detailInfo.partNo != null ? detailInfo.partNo : '').trim();
          sheet.getRange(i + 1, 1, 1, w).setValues([
            _moBuildRowValues_(ix, {
              orderNumber: orderData.orderNumber || '',
              orderDate: od,
              deliveryDate: orderData.deliveryDate != null ? orderData.deliveryDate : _moCell_(row, ix, 'deliveryDate'),
              customer: orderData.supplier != null ? String(orderData.supplier) : String(_moCell_(row, ix, 'customer')),
              materialCode: mc,
              materialName: orderData.materialName != null ? orderData.materialName : String(_moCell_(row, ix, 'materialName')),
              spec: orderData.specification != null ? orderData.specification : String(_moCell_(row, ix, 'spec')),
              partNo: pn,
              quantity: orderData.quantity != null ? orderData.quantity : _parseInboundQuantity_(_moCell_(row, ix, 'quantity')),
              unitPrice: orderData.unitPrice != null ? orderData.unitPrice : _parseInboundQuantity_(_moCell_(row, ix, 'unitPrice')),
              orderAmount: orderData.orderAmount != null ? orderData.orderAmount : _parseInboundQuantity_(_moCell_(row, ix, 'amount')),
              detailInfo: detailInfo
            })
          ]);
          
          return true;
        }
      }
      
      return false;
    } catch (error) {
      Logger.log('자재 발주 수정 오류: ' + error.toString());
      throw error;
    }
  }

  function deleteMaterialOrder(orderNumber) {
    try {
      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      for (var i = 1; i < values.length; i++) {
        const row = values[i];
        if (String(_moCell_(row, ix, 'orderNumber')).trim() === String(orderNumber).trim()) {
          sheet.deleteRow(i + 1);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      Logger.log('자재 발주 삭제 오류: ' + error.toString());
      throw error;
    }
  }

  function setMaterialOrderStatus(orderNumber, status) {
    try {
      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      for (var i = 1; i < values.length; i++) {
        const row = values[i];
        if (String(_moCell_(row, ix, 'orderNumber')).trim() === String(orderNumber).trim()) {
          let detailInfo = _moMergeDetailFromRow_(row, ix);
          detailInfo.status = status;
          _moPersistDetailJson_(sheet, i + 1, ix, detailInfo);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      Logger.log('자재 발주 상태 변경 오류: ' + error.toString());
      throw error;
    }
  }

  function setMaterialOrderGroupStatus(orderNumber, status) {
    try {
      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      let updatedCount = 0;
      
      for (var i = 1; i < values.length; i++) {
        const row = values[i];
        if (String(_moCell_(row, ix, 'orderNumber')).trim() === String(orderNumber).trim()) {
          let detailInfo = _moMergeDetailFromRow_(row, ix);
          detailInfo.status = status;
          _moPersistDetailJson_(sheet, i + 1, ix, detailInfo);
          updatedCount++;
        }
      }
      
      return updatedCount > 0;
    } catch (error) {
      Logger.log('자재 발주 그룹 상태 변경 오류: ' + error.toString());
      throw error;
    }
  }

  function deleteMaterialOrderGroup(orderNumber) {
    try {
      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      const on = String(orderNumber != null ? orderNumber : '').trim();
      const rowsToDelete = [];
      var inboundBlocked = 0;

      for (var i = values.length - 1; i >= 1; i--) {
        const row = values[i];
        if (String(_moCell_(row, ix, 'orderNumber')).trim() !== on) continue;
        var detailInfo = _moMergeDetailFromRow_(row, ix);
        if (_moLineHasInbound_(detailInfo)) {
          inboundBlocked++;
          continue;
        }
        rowsToDelete.push(i + 1);
      }

      if (inboundBlocked > 0 && !rowsToDelete.length) {
        return {
          success: false,
          message:
            '입고·LOT가 있는 품목만 있어 삭제할 수 없습니다. 입고 취소 후 다시 시도하세요. (입고 관련 ' +
            inboundBlocked +
            '건)'
        };
      }
      if (inboundBlocked > 0 && rowsToDelete.length) {
        return {
          success: false,
          message:
            '일부 품목(' +
            inboundBlocked +
            '건)은 입고·LOT가 있어 삭제되지 않았습니다. 미입고 품목만 삭제하려면 행별로 처리하세요.'
        };
      }

      rowsToDelete.forEach(function (rowNum) {
        sheet.deleteRow(rowNum);
      });

      if (!rowsToDelete.length) {
        return { success: false, message: '삭제할 데이터가 없습니다.' };
      }
      return { success: true, deleted: rowsToDelete.length };
    } catch (error) {
      Logger.log('자재 발주 그룹 삭제 오류: ' + error.toString());
      throw error;
    }
  }

  // ========== 입고 검수 — 공급사 바코드 조회 ==========

  /**
   * MPN 스캔 → 자재등록 여부·신규등록 제안 (고객사·발주 조회 없음 — 입고 처리 단계에서 구분)
   * @param {string} barcode
   * @return {{ok:boolean, registered?:boolean, scanned?:string, material?:Object, suggest?:Object, message?:string}}
   */
  function lookupSupplierBarcodeForReceive(barcode) {
    try {
      var raw = String(barcode == null ? '' : barcode).trim();
      if (!raw) {
        return { ok: false, message: '바코드를 스캔하거나 입력하세요.' };
      }

      var matchResult = null;
      try {
        matchResult = _findMaterialInRegisterByBarcodeMatch_(raw);
      } catch (e1) {
        Logger.log('입고검수 자재조회 오류: ' + e1.toString());
      }
      var material = matchResult ? matchResult.material : null;

      if (material) {
        var matchMsg = '자재등록에 등록된 품목입니다.';
        if (matchResult && matchResult.matchType === 'similar') {
          var fld =
            _BARCODE_MATCH_FIELD_LABELS_[matchResult.matchedField] || matchResult.matchedField || '';
          matchMsg =
            '유사 매칭 (' +
            matchResult.score +
            '%) · ' +
            fld +
            ' — 스캔값과 등록값이 비슷합니다. 품목을 확인하세요.';
        }
        return {
          ok: true,
          registered: true,
          scanned: raw,
          message: matchMsg,
          matchType: matchResult ? matchResult.matchType : 'exact',
          matchScore: matchResult ? matchResult.score : 100,
          matchedField: matchResult ? matchResult.matchedField : '',
          material: {
            id: material.id,
            materialCode: String(material.materialCode || '').trim(),
            materialName: String(material.materialName || '').trim(),
            specification: String(material.specification || '').trim(),
            partNo: String(_materialMpn_(material) || '').trim(),
            mpn: String(_materialMpn_(material) || '').trim(),
            spn: String(_materialSpn_(material) || '').trim(),
            spn1: String(_materialSpn_(material) || '').trim(),
            mpn1: String(_materialSpn_(material) || '').trim()
          }
        };
      }

      var parsed = _parseMaterialBarcodeScan_(raw);
      var embeddedTokens = _extractEmbeddedPartTokens_(raw);
      var suggestPn = embeddedTokens.length ? embeddedTokens[0] : raw;

      var suggest = {
        materialName: '',
        specification: parsed.specification || '',
        partNo: ''
      };

      if (/^[A-Za-z0-9][A-Za-z0-9\-_.]{2,}$/.test(suggestPn)) {
        suggest.partNo = suggestPn;
      }

      return {
        ok: true,
        registered: false,
        scanned: raw,
        message: '자재등록에 없습니다. 아래 정보를 확인한 뒤 신규 등록하세요.',
        suggest: suggest
      };
    } catch (error) {
      Logger.log('lookupSupplierBarcodeForReceive 오류: ' + error.toString());
      return { ok: false, message: error.message || String(error) };
    }
  }

  // ========== 자재 입고 관련 함수 ==========

  /** 자재발주 1행의 Part No.(MPN) 후보 (열 + 입고내역 JSON) */
  function _moRowPartNos_(row, ix, detailInfo) {
    var d = detailInfo;
    if (!d) d = _moMergeDetailFromRow_(row, ix);
    var seen = {};
    var out = [];
    function add(s) {
      s = String(s == null ? '' : s).trim();
      if (!s) return;
      var k = s.toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      out.push(s);
    }
    if (ix.partNo >= 0) add(row[ix.partNo]);
    add(d.partNo);
    return out;
  }

  /** 스캔값 ↔ 등록 코드(MPN·SPN 각각) 유사도 — 필드는 섞지 않고 같은 열 값끼리만 비교 */
  function _scoreMpnAgainstScan_(raw, candidate) {
    var cand = String(candidate == null ? '' : candidate).trim();
    if (!cand) return 0;
    var rawStr = String(raw == null ? '' : raw).trim();
    if (!rawStr) return 0;
    var best = _partCodePlusQtyMatchScore_(rawStr, cand);
    var rawNorm = _normalizeBarcodeForMatch_(rawStr);
    if (rawNorm) best = Math.max(best, _embeddedBarcodeMatchScore_(rawNorm, cand));
    var parts = _expandBarcodeScanCandidates_(rawStr);
    var i;
    best = Math.max(best, _barcodeSimilarityScore_(rawStr, cand));
    for (i = 0; i < parts.length; i++) {
      best = Math.max(best, _barcodeSimilarityScore_(parts[i], cand));
    }
    if (rawStr.toLowerCase() === cand.toLowerCase()) best = Math.max(best, 100);
    return best;
  }

  /**
   * 입고 스캔(MPN) ↔ 발주 행 매칭 — Part No. 우선 (BOM 자재코드는 사용하지 않음)
   * @return {boolean}
   */
  function _orderRowMatchesMaterialMaster_(row, ix, materialFromMaster) {
    if (!materialFromMaster) return false;
    var masterMaterialName = String(materialFromMaster.materialName || '').toLowerCase().trim();
    var masterSpecification = String(materialFromMaster.specification || '').toLowerCase().trim();
    var masterCode = String(materialFromMaster.materialCode || '').trim().toLowerCase();
    var orderMaterialName = String(_moCell_(row, ix, 'materialName')).trim().toLowerCase();
    var orderSpecification = String(_moCell_(row, ix, 'spec')).trim().toLowerCase();
    var orderCode = '';
    if (ix.materialCode >= 0) {
      orderCode = String(row[ix.materialCode] != null ? row[ix.materialCode] : '').trim().toLowerCase();
    }
    if (masterCode && orderCode && masterCode === orderCode) return true;
    var materialNameMatch =
      masterMaterialName &&
      orderMaterialName &&
      (masterMaterialName === orderMaterialName ||
        masterMaterialName.indexOf(orderMaterialName) >= 0 ||
        orderMaterialName.indexOf(masterMaterialName) >= 0);
    var specificationMatch =
      (!masterSpecification && !orderSpecification) ||
      (masterSpecification &&
        orderSpecification &&
        (masterSpecification === orderSpecification ||
          masterSpecification.indexOf(orderSpecification) >= 0 ||
          orderSpecification.indexOf(masterSpecification) >= 0));
    return materialNameMatch && (specificationMatch || !masterSpecification || !orderSpecification);
  }

  /** 입고 스캔 — 자재등록 MPN 또는 SPN 중 하나라도 맞으면 (접두·포함 허용, MPN≠SPN) */
  function _orderRowMatchesInboundMpnScan_(rawBarcode, row, ix, materialFromMaster) {
    var threshold = 82;
    var raw = String(rawBarcode == null ? '' : rawBarcode).trim();
    if (!raw) return false;

    var detailInfo = _moMergeDetailFromRow_(row, ix);
    var partNos = _moRowPartNos_(row, ix, detailInfo);
    var pi;
    for (pi = 0; pi < partNos.length; pi++) {
      if (_scoreMpnAgainstScan_(raw, partNos[pi]) >= threshold) return true;
    }

    if (materialFromMaster) {
      var regMpn = _materialMpn_(materialFromMaster);
      var regMpn2 = _materialMpn2_(materialFromMaster);
      var regSpn = _materialSpnForMatch_(materialFromMaster);
      var regSpn2 = _materialSpn2_(materialFromMaster);
      var mpnHit =
        (regMpn && _scoreMpnAgainstScan_(raw, regMpn) >= threshold) ||
        (regMpn2 && _scoreMpnAgainstScan_(raw, regMpn2) >= threshold);
      var spnHit =
        (regSpn && _scoreMpnAgainstScan_(raw, regSpn) >= threshold) ||
        (regSpn2 && _scoreMpnAgainstScan_(raw, regSpn2) >= threshold);
      if ((mpnHit || spnHit) && _orderRowMatchesMaterialMaster_(row, ix, materialFromMaster)) {
        return true;
      }
    }

    return false;
  }

  /** 발주 행 + 자재등록 → 입고 화면용 CPN·MPN 보강 */
  function _inboundOrderFieldsFromRow_(row, ix, detailInfo, materialFromMaster) {
    var d = detailInfo || _moMergeDetailFromRow_(row, ix);
    var partNos = _moRowPartNos_(row, ix, d);
    var cpn = '';
    var mpn = '';
    var mpn2 = '';
    var spn = '';
    var spn2 = '';
    var partNo = partNos.length ? partNos[0] : '';
    if (materialFromMaster) {
      cpn = String(materialFromMaster.materialCode || '').trim();
      mpn = String(_materialMpn_(materialFromMaster) || '').trim();
      mpn2 = String(_materialMpn2_(materialFromMaster) || '').trim();
      spn = String(_materialSpn_(materialFromMaster) || '').trim();
      spn2 = String(_materialSpn2_(materialFromMaster) || '').trim();
    }
    if (!cpn && d.materialCode != null) cpn = String(d.materialCode).trim();
    if (!cpn && ix.materialCode >= 0) {
      var colMc = String(row[ix.materialCode] != null ? row[ix.materialCode] : '').trim();
      if (colMc) cpn = colMc;
    }
    if (!partNo && mpn) partNo = mpn;
    return {
      materialCode: cpn,
      productCode: d.productCode != null ? String(d.productCode).trim() : '',
      partNo: partNo || mpn || spn,
      mpn: mpn,
      mpn2: mpn2,
      spn: spn,
      spn2: spn2,
      spn1: spn,
      mpn1: ''
    };
  }

  /**
   * 바코드로 자재 찾기 (발주 대기 목록 반환)
   * 릴 SPN 스캔 → 자재등록(SPN) → 발주 Part No. 매칭
   */
  function findMaterialByBarcode(barcode) {
    try {
      const parsed = _parseMaterialBarcodeScan_(barcode);
      const barcodeLower = parsed.raw.toLowerCase();
      let identifiedMaterialName = '';
      let identifiedSpecification = '';
      let identifiedMaterialCode = '';
      let identifiedVendorCode = '';
      const matchingOrders = [];
      
      // 1단계: 자재 마스터(자재등록 시트)에서 MPN으로 자재 찾기
      let materialFromMaster = null;
      try {
        materialFromMaster = findMaterialByBarcodeInRegister(barcode);
        if (materialFromMaster) {
          identifiedMaterialName = materialFromMaster.materialName || '';
          identifiedSpecification = materialFromMaster.specification || '';
          identifiedMaterialCode = String(materialFromMaster.materialCode || '').trim();
          identifiedVendorCode = _materialScanCode_(materialFromMaster);
          Logger.log('자재 마스터에서 찾음: ' + identifiedMaterialName + ', ' + identifiedSpecification);
        }
      } catch (e) {
        Logger.log('자재 마스터 조회 오류 (무시): ' + e.toString());
      }
      
      // 2단계: 자재 발주 시트에서 발주서 찾기
      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      if (values.length <= 1) {
        return {
          found: matchingOrders.length > 0,
          materialCode: identifiedMaterialCode,
          vendorCode: identifiedVendorCode,
          materialName: identifiedMaterialName,
          specification: identifiedSpecification,
          orders: matchingOrders
        };
      }
      
      // 자재 마스터에서 찾은 정보로 발주서 찾기
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        
        if (!String(_moCell_(row, ix, 'orderNumber')).trim()) {
          continue;
        }
        
        const orderNumber = String(_moCell_(row, ix, 'orderNumber')).trim();
        const materialName = String(_moCell_(row, ix, 'materialName')).trim();
        const specification = String(_moCell_(row, ix, 'spec')).trim();
        
        var matches = _orderRowMatchesInboundMpnScan_(barcode, row, ix, materialFromMaster);
        
        // 상세정보에 저장된 바코드(레거시) 일치
        if (!matches) {
          var dBar = _moMergeDetailFromRow_(row, ix);
          if (dBar.barcode && String(dBar.barcode).toLowerCase().trim() === barcodeLower) {
            matches = true;
          }
        }
        
        if (matches) {
          let detailInfo = _moMergeDetailFromRow_(row, ix);
          
          const orderQuantity = _parseInboundQuantity_(_moCell_(row, ix, 'quantity'));
          const inboundQuantity = _moLotsInboundSum_(detailInfo);
          const remainingQuantity = orderQuantity - inboundQuantity;
          
          // 입고 대기 중인 자재만 추가 (잔여수량이 있는 경우)
          if (remainingQuantity > 0) {
            if (!identifiedMaterialName && materialName) {
              identifiedMaterialName = materialName;
            }
            if (!identifiedSpecification && specification) {
              identifiedSpecification = specification;
            }

            var inboundFields = _inboundOrderFieldsFromRow_(row, ix, detailInfo, materialFromMaster);
            
            matchingOrders.push({
              orderNumber: orderNumber,
              orderDate: _moCell_(row, ix, 'orderDate') instanceof Date ? Utilities.formatDate(_moCell_(row, ix, 'orderDate'), Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(_moCell_(row, ix, 'orderDate') || ''),
              deliveryDate: _moCell_(row, ix, 'deliveryDate') instanceof Date ? Utilities.formatDate(_moCell_(row, ix, 'deliveryDate'), Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(_moCell_(row, ix, 'deliveryDate') || ''),
              supplier: String(_moCell_(row, ix, 'customer')),
              materialName: materialName,
              specification: specification,
              materialCode: inboundFields.materialCode,
              productCode: inboundFields.productCode,
              partNo: inboundFields.partNo,
              mpn: inboundFields.mpn,
              mpn2: inboundFields.mpn2,
              spn: inboundFields.spn,
              spn2: inboundFields.spn2,
              spn1: inboundFields.spn1,
              mpn1: inboundFields.mpn1,
              quantity: orderQuantity,
              inboundQuantity: inboundQuantity,
              remainingQuantity: remainingQuantity,
              unitPrice: _parseInboundQuantity_(_moCell_(row, ix, 'unitPrice')),
              orderAmount: _parseInboundQuantity_(_moCell_(row, ix, 'amount')),
              detailInfo: detailInfo
            });
          }
        }
      }
      
      // 발주번호로도 찾기 (바코드에 발주번호가 포함된 경우) - 기존 로직 유지
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        
        if (!String(_moCell_(row, ix, 'orderNumber')).trim()) {
          continue;
        }
        
        const orderNumber = String(_moCell_(row, ix, 'orderNumber')).trim();
        const materialName = String(_moCell_(row, ix, 'materialName')).trim();
        const specification = String(_moCell_(row, ix, 'spec')).trim();
        
        // 바코드가 발주번호를 포함하는지 확인
        let matchesByOrderNumber = false;
        if (orderNumber && barcodeLower.includes(orderNumber.toLowerCase())) {
          matchesByOrderNumber = true;
        }
        
        // 상세정보의 바코드로도 확인
        if (!matchesByOrderNumber) {
          var d2 = _moMergeDetailFromRow_(row, ix);
          if (d2.barcode && String(d2.barcode).toLowerCase().trim() === barcodeLower) {
            matchesByOrderNumber = true;
          }
        }
        
        if (matchesByOrderNumber) {
          let detailInfo = _moMergeDetailFromRow_(row, ix);
          
          const orderQuantity = _parseInboundQuantity_(_moCell_(row, ix, 'quantity'));
          const inboundQuantity = _moLotsInboundSum_(detailInfo);
          const remainingQuantity = orderQuantity - inboundQuantity;
          
          if (remainingQuantity > 0) {
            // 이미 추가된 발주인지 확인
            const alreadyAdded = matchingOrders.some(function(order) {
              return order.orderNumber === orderNumber && 
                    order.materialName === materialName && 
                    order.specification === specification;
            });
            
            if (!alreadyAdded) {
              if (!identifiedMaterialName && materialName) {
                identifiedMaterialName = materialName;
              }
              if (!identifiedSpecification && specification) {
                identifiedSpecification = specification;
              }

              var inboundFields2 = _inboundOrderFieldsFromRow_(row, ix, detailInfo, materialFromMaster);
              
              matchingOrders.push({
                orderNumber: orderNumber,
                orderDate: _moCell_(row, ix, 'orderDate') instanceof Date ? Utilities.formatDate(_moCell_(row, ix, 'orderDate'), Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(_moCell_(row, ix, 'orderDate') || ''),
                deliveryDate: _moCell_(row, ix, 'deliveryDate') instanceof Date ? Utilities.formatDate(_moCell_(row, ix, 'deliveryDate'), Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(_moCell_(row, ix, 'deliveryDate') || ''),
                supplier: String(_moCell_(row, ix, 'customer')),
                materialName: materialName,
                specification: specification,
                materialCode: inboundFields2.materialCode,
                productCode: inboundFields2.productCode,
                partNo: inboundFields2.partNo,
                mpn: inboundFields2.mpn,
                mpn2: inboundFields2.mpn2,
                spn: inboundFields2.spn,
                spn2: inboundFields2.spn2,
                spn1: inboundFields2.spn1,
                mpn1: inboundFields2.mpn1,
                quantity: orderQuantity,
                inboundQuantity: inboundQuantity,
                remainingQuantity: remainingQuantity,
                unitPrice: _parseInboundQuantity_(_moCell_(row, ix, 'unitPrice')),
                orderAmount: _parseInboundQuantity_(_moCell_(row, ix, 'amount')),
                detailInfo: detailInfo
              });
            }
          }
        }
      }
      
      // 납기·발주일 오름차순 (먼저 발주한 것 우선 표시)
      matchingOrders.sort(function(a, b) {
        var da = String(a.deliveryDate || a.orderDate || '');
        var db = String(b.deliveryDate || b.orderDate || '');
        var cmp = da.localeCompare(db);
        if (cmp !== 0) return cmp;
        return String(a.orderNumber || '').localeCompare(String(b.orderNumber || ''), undefined, { numeric: true });
      });
      
      return {
        found: matchingOrders.length > 0,
        materialCode: identifiedMaterialCode,
        vendorCode: identifiedVendorCode,
        materialName: identifiedMaterialName,
        specification: identifiedSpecification,
        orders: matchingOrders
      };
    } catch (error) {
      Logger.log('바코드로 자재 찾기 오류: ' + error.toString());
      throw error;
    }
  }

  /**
   * 특정 발주번호 안에서만 릴 바코드(MPN 등) 매칭 — 입고 처리(발주 선선택)용
   * @param {string} orderNumber
   * @param {string} barcode
   */
  function findMaterialByBarcodeForOrder(orderNumber, barcode) {
    var on = String(orderNumber == null ? '' : orderNumber).trim();
    if (!on) {
      return { found: false, orders: [], message: '발주번호가 필요합니다.' };
    }
    var base = findMaterialByBarcode(barcode);
    var orders = [];
    if (base && base.orders && base.orders.length) {
      for (var i = 0; i < base.orders.length; i++) {
        var o = base.orders[i] || {};
        if (String(o.orderNumber || '').trim() === on) {
          orders.push(o);
        }
      }
    }
    return {
      found: orders.length > 0,
      materialCode: base ? base.materialCode : '',
      vendorCode: base ? base.vendorCode : '',
      materialName: base ? base.materialName : '',
      specification: base ? base.specification : '',
      mpn: base && base.orders && base.orders[0] ? base.orders[0].mpn : '',
      spn: base && base.orders && base.orders[0] ? base.orders[0].spn : '',
      spn1: base && base.orders && base.orders[0] ? base.orders[0].spn1 : '',
      mpn1: base && base.orders && base.orders[0] ? base.orders[0].mpn1 : '',
      orders: orders,
      message: orders.length ? '' : '이 발주에서 일치하는 품목이 없습니다.'
    };
  }

  function getMaterialOrdersForInbound() {
    try {
      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      if (values.length <= 1) {
        return [];
      }

      /** 자재명+규격 → 자재등록 자재코드·Part No. (입고 화면 컬럼 보강) */
      var mats = getMaterials();
      var materialCodeByNameSpec = {};
      var customerByNameSpec = {};
      var partNoByNameSpec = {};
      var mpnByNameSpec = {};
      var mpn2ByNameSpec = {};
      var spnByNameSpec = {};
      var spn2ByNameSpec = {};
      for (var mi = 0; mi < mats.length; mi++) {
        var mm = mats[mi] || {};
        var mk = _mrpMaterialKey_(mm.materialName, mm.specification);
        var cd = String(mm.materialCode != null ? mm.materialCode : '').trim();
        if (mk && cd && !materialCodeByNameSpec[mk]) materialCodeByNameSpec[mk] = cd;
        var cust = String(mm.customer != null ? mm.customer : '').trim();
        if (mk && cust && !customerByNameSpec[mk]) customerByNameSpec[mk] = cust;
        var mpnVal = String(_materialMpn_(mm) || '').trim();
        if (mk && mpnVal && !mpnByNameSpec[mk]) mpnByNameSpec[mk] = mpnVal;
        var mpn2Val = String(_materialMpn2_(mm) || '').trim();
        if (mk && mpn2Val && !mpn2ByNameSpec[mk]) mpn2ByNameSpec[mk] = mpn2Val;
        var spnVal = String(_materialSpn_(mm) || '').trim();
        if (mk && spnVal && !partNoByNameSpec[mk]) partNoByNameSpec[mk] = spnVal;
        if (mk && spnVal && !spnByNameSpec[mk]) spnByNameSpec[mk] = spnVal;
        var spn2Val = String(_materialSpn2_(mm) || '').trim();
        if (mk && spn2Val && !spn2ByNameSpec[mk]) spn2ByNameSpec[mk] = spn2Val;
      }
      
      // 먼저 모든 발주 데이터를 수집
      const allOrders = [];
      
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        
        if (!String(_moCell_(row, ix, 'orderNumber')).trim()) {
          continue;
        }
        
        const orderNumber = String(_moCell_(row, ix, 'orderNumber')).trim();
        const quantity = _parseInboundQuantity_(_moCell_(row, ix, 'quantity'));
        const unitPrice = _parseInboundQuantity_(_moCell_(row, ix, 'unitPrice'));
        const orderAmount = _parseInboundQuantity_(_moCell_(row, ix, 'amount'));
        
        let detailInfo = _moMergeDetailFromRow_(row, ix);
        
        var lotsInboundSum = _moLotsInboundSum_(detailInfo);
        /** processMaterialInbound과 동일: 입고누적은 lots 합만 사용 */
        const remainingQuantity = quantity - lotsInboundSum;

        var materialNameStr = String(_moCell_(row, ix, 'materialName')).trim();
        var specificationStr = String(_moCell_(row, ix, 'spec')).trim();
        var productCodeFromJson =
          detailInfo.productCode != null ? String(detailInfo.productCode).trim() : '';
        var materialCodeFromJson =
          detailInfo.materialCode != null ? String(detailInfo.materialCode).trim() : '';
        var colMaterialCode =
          ix.materialCode >= 0 ? String(row[ix.materialCode] != null ? row[ix.materialCode] : '').trim() : '';
        var regMaterialCode =
          materialNameStr && materialCodeByNameSpec[_mrpMaterialKey_(materialNameStr, specificationStr)]
            ? materialCodeByNameSpec[_mrpMaterialKey_(materialNameStr, specificationStr)]
            : '';
        var resolvedMaterialCode = colMaterialCode || materialCodeFromJson || regMaterialCode || productCodeFromJson;
        var partNoFromCol =
          ix.partNo >= 0 ? String(row[ix.partNo] != null ? row[ix.partNo] : '').trim() : '';
        var partNoFromDetail =
          detailInfo.partNo != null ? String(detailInfo.partNo).trim() : '';
        var regPartNo =
          materialNameStr && partNoByNameSpec[_mrpMaterialKey_(materialNameStr, specificationStr)]
            ? partNoByNameSpec[_mrpMaterialKey_(materialNameStr, specificationStr)]
            : '';
        var regMpn =
          materialNameStr && mpnByNameSpec[_mrpMaterialKey_(materialNameStr, specificationStr)]
            ? mpnByNameSpec[_mrpMaterialKey_(materialNameStr, specificationStr)]
            : '';
        var regMpn2 =
          materialNameStr && mpn2ByNameSpec[_mrpMaterialKey_(materialNameStr, specificationStr)]
            ? mpn2ByNameSpec[_mrpMaterialKey_(materialNameStr, specificationStr)]
            : '';
        var regSpn =
          materialNameStr && spnByNameSpec[_mrpMaterialKey_(materialNameStr, specificationStr)]
            ? spnByNameSpec[_mrpMaterialKey_(materialNameStr, specificationStr)]
            : '';
        var regSpn2 =
          materialNameStr && spn2ByNameSpec[_mrpMaterialKey_(materialNameStr, specificationStr)]
            ? spn2ByNameSpec[_mrpMaterialKey_(materialNameStr, specificationStr)]
            : '';
        var resolvedPartNo = partNoFromCol || partNoFromDetail || regPartNo || '';
        var resolvedMpn = regMpn || '';
        var resolvedMpn2 = regMpn2 || '';
        var resolvedSpn = regSpn || '';
        var resolvedSpn2 = regSpn2 || '';
        var resolvedCustomer =
          materialNameStr && customerByNameSpec[_mrpMaterialKey_(materialNameStr, specificationStr)]
            ? customerByNameSpec[_mrpMaterialKey_(materialNameStr, specificationStr)]
            : '';
        
        const orderData = {
          orderNumber: orderNumber,
          orderDate: _moCell_(row, ix, 'orderDate') instanceof Date ? 
            Utilities.formatDate(_moCell_(row, ix, 'orderDate'), Session.getScriptTimeZone(), 'yyyy-MM-dd') : 
            String(_moCell_(row, ix, 'orderDate') || ''),
          deliveryDate: _moCell_(row, ix, 'deliveryDate') instanceof Date ? 
            Utilities.formatDate(_moCell_(row, ix, 'deliveryDate'), Session.getScriptTimeZone(), 'yyyy-MM-dd') : 
            String(_moCell_(row, ix, 'deliveryDate') || ''),
          supplier: String(_moCell_(row, ix, 'customer')),
          customer: resolvedCustomer,
          materialName: materialNameStr,
          specification: specificationStr,
          materialCode: resolvedMaterialCode,
          productCode: productCodeFromJson,
          partNo: resolvedPartNo || resolvedMpn || resolvedSpn,
          mpn: resolvedMpn,
          mpn2: resolvedMpn2,
          spn: resolvedSpn,
          spn2: resolvedSpn2,
          spn1: resolvedSpn,
          mpn1: '',
          quantity: quantity,
          unitPrice: unitPrice,
          orderAmount: orderAmount,
          detailInfo: detailInfo,
          remainingQuantity: remainingQuantity
        };
        
        allOrders.push(orderData);
      }
      
      /** 입고 완료된 발주도 목록에 유지 (발주 기준 입고 테이블에서 사라지지 않게) */
      return allOrders;
    } catch (error) {
      Logger.log('입고 대기 목록 가져오기 오류: ' + error.toString());
      return [];
    }
  }

  /**
   * 입·불출 화면 초기 로드(입고 목록 + BOM 제품 선택) — 서버 왕복 1회
   * @return {{ok:boolean, inboundRows?:Array, bomOptions?:Array, error?:string}}
   */
  function getMaterialInboundOutboundPageInit() {
    try {
      return {
        ok: true,
        inboundRows: getMaterialOrdersForInbound() || [],
        bomOptions: getSemiFinishedRegisterOptions() || []
      };
    } catch (e) {
      Logger.log('getMaterialInboundOutboundPageInit 오류: ' + e.toString());
      return { ok: false, error: e.message || String(e), inboundRows: [], bomOptions: [] };
    }
  }

  function getAllLots() {
    try {
      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      if (values.length <= 1) {
        return [];
      }
      
      const allLots = [];
      
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        
        if (!String(_moCell_(row, ix, 'orderNumber')).trim()) {
          continue;
        }
        
        const orderNumber = String(_moCell_(row, ix, 'orderNumber')).trim();
        const materialName = String(_moCell_(row, ix, 'materialName')).trim();
        const specification = String(_moCell_(row, ix, 'spec')).trim();
        const orderQuantity = _parseInboundQuantity_(_moCell_(row, ix, 'quantity'));
        
        let detailInfo = _moMergeDetailFromRow_(row, ix);
        
        // LOT 배열이 있으면 각 LOT를 개별 항목으로 추가
        if (detailInfo.lots && Array.isArray(detailInfo.lots) && detailInfo.lots.length > 0) {
          var inboundQty = _moLotsInboundSum_(detailInfo);
          const remainingQty = orderQuantity - inboundQty;
          
          detailInfo.lots.forEach(function(lot) {
            let status = '미입고';
            if (inboundQty >= orderQuantity) {
              status = '입고완료';
            } else if (inboundQty > 0) {
              status = '부분입고';
            }
            
            var materialCodeStr =
              ix.materialCode >= 0 ? String(row[ix.materialCode] != null ? row[ix.materialCode] : '').trim() : '';
            var partNoStr = ix.partNo >= 0 ? String(row[ix.partNo] != null ? row[ix.partNo] : '').trim() : '';
            var matFromDetail =
              detailInfo.materialCode != null ? String(detailInfo.materialCode).trim() : '';
            allLots.push({
              orderNumber: orderNumber,
              materialCode: materialCodeStr || matFromDetail,
              materialName: materialName,
              specification: specification,
              partNo: partNoStr,
              lotNumber: lot.lotNumber || '',
              quantity: lot.quantity || 0,
              inboundDate: lot.inboundDate || '',
              createdAt: lot.createdAt || '',
              orderQuantity: orderQuantity,
              totalInboundQuantity: inboundQty,
              remainingQuantity: remainingQty,
              status: status
            });
          });
        }
      }
      
      // 입고일 기준 최신순으로 정렬
      allLots.sort(function(a, b) {
        const dateA = a.inboundDate || '';
        const dateB = b.inboundDate || '';
        if (dateB < dateA) return -1;
        if (dateB > dateA) return 1;
        return 0;
      });
      
      return allLots;
    } catch (error) {
      Logger.log('전체 LOT 목록 가져오기 오류: ' + error.toString());
      return [];
    }
  }

  /**
   * 자재 입고 이력: 발주 시트 입고 LOT를 행 단위로 펼침(입고 수량 0 제외, 입고일 최신 우선)
   * @return {Array<Object>}
   */
  function getMaterialInboundLotHistory() {
    try {
      var rows = getAllLots() || [];
      return rows.filter(function (r) {
        return _parseInboundQuantity_(r && r.quantity) > 0;
      });
    } catch (error) {
      Logger.log('getMaterialInboundLotHistory 오류: ' + error.toString());
      return [];
    }
  }

  /**
   * 자재발주 시트·입고 JSON에서 수량 파싱 (콤마 천단위, 공백, 문자열 quantity 대응)
   * @param {*} v
   * @return {number}
   */
  function _parseInboundQuantity_(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number' && isFinite(v)) return v;
    var s = String(v)
      .replace(/,/g, '')
      .replace(/\s/g, '')
      .trim();
    if (!s) return 0;
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  /**
   * 자재발주 1행에 입고 LOT 반영
   * @return {{success:boolean, message?:string}}
   */
  function _applyMaterialInboundOnRow_(sheet, sheetRow1Based, ix, row, orderNumber, qtyIn, inboundDate) {
    var qty = _parseInboundQuantity_(qtyIn);
    if (isNaN(qty) || qty <= 0) {
      return { success: false, message: '입고 수량은 0보다 커야 합니다.' };
    }
    var on = String(orderNumber).trim();
    var detailInfo = _moMergeDetailFromRow_(row, ix);
    var orderQuantity = _parseInboundQuantity_(_moCell_(row, ix, 'quantity'));
    if (!detailInfo.lots || !Array.isArray(detailInfo.lots)) {
      detailInfo.lots = [];
    }
    var currentInboundQty = _moLotsInboundSum_(detailInfo);
    var newInboundQuantity = currentInboundQty + qty;
    if (newInboundQuantity > orderQuantity + 1e-9) {
      var nm = String(_moCell_(row, ix, 'materialName')).trim();
      return {
        success: false,
        message:
          (nm || '품목') +
          ': 입고 합계가 발주 수량을 초과합니다. (발주 ' +
          orderQuantity +
          ', 기존입고 ' +
          currentInboundQty +
          ', 이번 ' +
          qty +
          ')'
      };
    }
    var nextLotNum = 1;
    if (detailInfo.lots.length > 0) {
      var lastLotNumber = detailInfo.lots[detailInfo.lots.length - 1].lotNumber || '';
      var lastLotMatch = lastLotNumber.match(/-LOT-(\d+)$/);
      if (lastLotMatch && lastLotMatch[1]) {
        nextLotNum = parseInt(lastLotMatch[1], 10) + 1;
      }
    }
    var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    var lotEntry = {
      lotNumber: on + '-LOT-' + String(nextLotNum).padStart(3, '0'),
      quantity: qty,
      inboundDate: inboundDate,
      createdAt: nowStr
    };
    detailInfo.lots.push(lotEntry);
    detailInfo.inboundQuantity = newInboundQuantity;
    detailInfo.inboundDate = inboundDate;
    if (newInboundQuantity >= orderQuantity) {
      detailInfo.status = '입고완료';
    } else if (newInboundQuantity > 0) {
      detailInfo.status = '부분입고';
    }
    _moPersistDetailJson_(sheet, sheetRow1Based, ix, detailInfo);
    return { success: true, totalQty: qty };
  }

  /**
   * 자재 입고 처리 — 성공 시 { success: true, totalQty?:number }, 실패 시 { success: false, message }
   */
  function processMaterialInbound(orderNumber, materialName, specification, inboundQuantity, inboundDate) {
    var lock = LockService.getDocumentLock();
    if (!lock.tryLock(20000)) {
      return { success: false, message: '다른 저장 처리 중입니다. 잠시 후 다시 시도하세요.' };
    }
    try {
      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      const values = sheet.getDataRange().getValues();
      const on = String(orderNumber).trim();
      const mn = String(materialName).trim();
      const sp = String(specification || '').trim();

      for (var i = 1; i < values.length; i++) {
        const row = values[i];
        const rowOrderNumber = String(_moCell_(row, ix, 'orderNumber')).trim();
        const rowMaterialName = String(_moCell_(row, ix, 'materialName')).trim();
        const rowSpecification = String(_moCell_(row, ix, 'spec')).trim();

        if (rowOrderNumber === on && rowMaterialName === mn && rowSpecification === sp) {
          var res = _applyMaterialInboundOnRow_(sheet, i + 1, ix, row, on, inboundQuantity, inboundDate);
          if (res.success) {
            invalidateMaterialInventoryCache_();
          }
          return res;
        }
      }

      return { success: false, message: '해당 발주 행을 찾을 수 없습니다.' };
    } catch (error) {
      Logger.log('자재 입고 처리 오류: ' + error.toString());
      throw error;
    } finally {
      try {
        lock.releaseLock();
      } catch (rel) {}
    }
  }

  /**
   * 발주번호 기준 잔량 전체 일괄 입고
   * @param {string} orderNumber
   * @param {string} inboundDate yyyy-MM-dd
   * @return {{success:boolean, processed?:number, skipped?:number, message?:string, errors?:string[]}}
   */
  function processMaterialInboundFullOrder(orderNumber, inboundDate) {
    var lock = LockService.getDocumentLock();
    if (!lock.tryLock(30000)) {
      return { success: false, message: '다른 저장 처리 중입니다. 잠시 후 다시 시도하세요.' };
    }
    try {
      var on = String(orderNumber || '').trim();
      if (!on) {
        return { success: false, message: '발주번호가 필요합니다.' };
      }
      var dt =
        inboundDate != null && String(inboundDate).trim() !== ''
          ? String(inboundDate).trim()
          : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      const values = sheet.getDataRange().getValues();
      var processed = 0;
      var skipped = 0;
      var errors = [];

      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        if (String(_moCell_(row, ix, 'orderNumber')).trim() !== on) continue;

        var detailInfo = _moMergeDetailFromRow_(row, ix);
        var orderQuantity = _parseInboundQuantity_(_moCell_(row, ix, 'quantity'));
        var currentInboundQty = _moLotsInboundSum_(detailInfo);
        var remaining = orderQuantity - currentInboundQty;
        if (remaining <= 1e-9) {
          skipped++;
          continue;
        }

        var res = _applyMaterialInboundOnRow_(sheet, i + 1, ix, row, on, remaining, dt);
        if (res.success) {
          processed++;
        } else {
          errors.push(res.message || '입고 실패');
        }
      }

      if (processed > 0) {
        invalidateMaterialInventoryCache_();
      }

      if (processed === 0) {
        if (errors.length) {
          return { success: false, message: errors[0], errors: errors, processed: 0, skipped: skipped };
        }
        return {
          success: false,
          message: '입고할 잔량이 있는 품목이 없습니다.',
          processed: 0,
          skipped: skipped
        };
      }

      var msg = processed + '개 품목을 잔량만큼 입고 처리했습니다.';
      if (errors.length) {
        msg += ' (' + errors.length + '건 실패)';
      }
      return {
        success: true,
        processed: processed,
        skipped: skipped,
        errors: errors,
        message: msg
      };
    } catch (error) {
      Logger.log('발주 전체 입고 처리 오류: ' + error.toString());
      throw error;
    } finally {
      try {
        lock.releaseLock();
      } catch (rel) {}
    }
  }

  /**
   * 입고 실수 시: 해당 행의 LOT·입고누적을 비우고 상태를 '발주'로 되돌림.
   * (자재재고 시트 등은 자동으로 되돌리지 않습니다. 입고로 반영된 재고가 있으면 별도 확인하세요.)
   * @param {string} orderNumber 발주번호
   * @param {string} materialName 자재명
   * @param {string} specification 규격(없으면 '')
   * @return {{ success:boolean, message?:string }}
   */
  function resetMaterialOrderInboundLine(orderNumber, materialName, specification) {
    try {
      var sheet = getMaterialOrderSheet();
      var ix = _getMaterialOrderColumnIndices_(sheet);
      var values = sheet.getDataRange().getValues();
      var on = String(orderNumber != null ? orderNumber : '').trim();
      var mn = String(materialName != null ? materialName : '').trim();
      var sp = String(specification != null ? specification : '').trim();
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        if (String(_moCell_(row, ix, 'orderNumber')).trim() !== on) continue;
        if (String(_moCell_(row, ix, 'materialName')).trim() !== mn) continue;
        if (String(_moCell_(row, ix, 'spec')).trim() !== sp) continue;
        var detailInfo = _moMergeDetailFromRow_(row, ix);
        detailInfo.lots = [];
        delete detailInfo.inboundQuantity;
        delete detailInfo.inboundDate;
        detailInfo.status = '발주';
        _moPersistDetailJson_(sheet, i + 1, ix, detailInfo);
        invalidateMaterialInventoryCache_();
        return {
          success: true,
          message:
            '입고 LOT를 비우고 발주 상태로 되돌렸습니다. 자재등록 시트의 직접 재고·입고로 반영된 수량은 자동으로 되돌리지 않으니, 실물·재고 화면을 확인하세요.'
        };
      }
      return { success: false, message: '해당 발주 행을 찾을 수 없습니다.' };
    } catch (e) {
      Logger.log('resetMaterialOrderInboundLine: ' + e.toString());
      return { success: false, message: e.message || String(e) };
    }
  }

  /**
   * 자재출고 시트 (재고 출고 집계용)
   * 기본 권장 열:
   * 출고일, 주문번호, 자재코드, 자재명, 규격, Part No., 출고수량, 부서
   */
  function getMaterialOutboundSheet() {
    try {
      const ss = getSpreadsheet();
      let sheet = ss.getSheetByName('자재출고');
      if (!sheet) {
        sheet = ss.insertSheet('자재출고');
        const headers = [[
          '출고일',
          '주문번호',
          '자재코드',
          '자재명',
          '규격',
          'Part No.',
          '출고수량',
          '부서'
        ]];
        sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
        sheet.getRange(1, 1, 1, headers[0].length)
          .setFontWeight('bold')
          .setBackground('#f7fafc')
          .setFontColor('#4a5568');
      }
      return sheet;
    } catch (error) {
      Logger.log('자재출고 시트 오류: ' + error.toString());
      throw error;
    }
  }

  function _materialOutboundHeaderIndexMap_(headerRow) {
    var findIdx = function (candidates) {
      for (var i = 0; i < candidates.length; i++) {
        var c = String(candidates[i] || '').trim();
        for (var j = 0; j < headerRow.length; j++) {
          if (String(headerRow[j] || '').trim() === c) return j;
        }
      }
      return -1;
    };
    return {
      date: findIdx(['출고일']),
      // 과거 출고번호가 있던 시트 호환용 (읽기만 가능)
      outboundNo: findIdx(['출고번호']),
      materialCode: findIdx(['자재코드']),
      materialName: findIdx(['자재명']),
      specification: findIdx(['규격']),
      partNo: findIdx(['Part No.', 'Part No', 'PART NO', 'P/N', 'PN']),
      quantity: findIdx(['출고수량']),
      requestDept: findIdx(['부서', '요청부서']),
      workOrderNo: findIdx(['주문번호', '작업/주문번호', '발주번호']),
      note: findIdx(['비고'])
    };
  }

  function _materialOutboundCellString_(row, idx) {
    if (!row || idx < 0 || idx >= row.length || row[idx] == null) return '';
    return String(row[idx]).trim();
  }

  var MATERIAL_PRODUCT_OUTBOUND_SHEET_NAME = '자재출고제품';

  /** 주문·제품별 출고 제품수량 누적 시트 (BOM 1회 = 1행) */
  function getMaterialProductOutboundSheet() {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(MATERIAL_PRODUCT_OUTBOUND_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(MATERIAL_PRODUCT_OUTBOUND_SHEET_NAME);
      var headers = [['출고일', '주문번호', '제품코드', '제품명', '버전', '출고제품수량', '부서']];
      sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
      sheet.getRange(1, 1, 1, headers[0].length).setFontWeight('bold').setBackground('#f7fafc');
      sheet.setFrozenRows(1);
    }
    return sheet;
  }

  function _materialProductOutboundKey_(code, name, version) {
    return (
      String(code != null ? code : '').trim() +
      '\x1f' +
      String(name != null ? name : '').trim() +
      '\x1f' +
      String(version != null ? version : '').trim()
    );
  }

  function _sumShippedProductQtyForOrder_(orderNo, code, name, version) {
    var on = String(orderNo || '').trim();
    if (!on) return 0;
    var sheet = getMaterialProductOutboundSheet();
    var lr = sheet.getLastRow();
    if (lr < 2) return 0;
    var lc = Math.max(7, sheet.getLastColumn());
    var headerRow = sheet.getRange(1, 1, 1, lc).getValues()[0] || [];
    var onIx = _findHeaderIndexByNames_(headerRow, ['주문번호', '작업/주문번호', '발주번호']);
    var codeIx = _findHeaderIndexByNames_(headerRow, ['제품코드']);
    var nameIx = _findHeaderIndexByNames_(headerRow, ['제품명']);
    var verIx = _findHeaderIndexByNames_(headerRow, ['버전']);
    var qtyIx = _findHeaderIndexByNames_(headerRow, ['출고제품수량', '제품수량', '출고수량']);
    var targetKey = _materialProductOutboundKey_(code, name, version);
    var vals = sheet.getRange(2, 1, lr, lc).getValues();
    var sum = 0;
    for (var i = 0; i < vals.length; i++) {
      var r = vals[i] || [];
      if (onIx >= 0 && String(r[onIx] || '').trim() !== on) continue;
      var rk = _materialProductOutboundKey_(
        codeIx >= 0 ? r[codeIx] : '',
        nameIx >= 0 ? r[nameIx] : '',
        verIx >= 0 ? r[verIx] : ''
      );
      if (rk !== targetKey) continue;
      var qv = qtyIx >= 0 ? r[qtyIx] : 0;
      sum += typeof qv === 'number' ? qv : parseFloat(String(qv).replace(/,/g, '')) || 0;
    }
    return sum;
  }

  /**
   * 주문서번호 기준 제품별 누적 출고 제품수량 (주문 대비 부분출고 표시용)
   * @param {string} orderNumber
   * @return {{ok:boolean, orderNumber?:string, products?:Array, error?:string}}
   */
  function getMaterialProductOutboundProgress(orderNumber) {
    try {
      var on = String(orderNumber || '').trim();
      if (!on) return { ok: false, error: '주문서번호가 필요합니다.' };
      var shippedMap = {};
      var sheet = getMaterialProductOutboundSheet();
      var lr = sheet.getLastRow();
      if (lr >= 2) {
        var lc = Math.max(7, sheet.getLastColumn());
        var headerRow = sheet.getRange(1, 1, 1, lc).getValues()[0] || [];
        var onIx = _findHeaderIndexByNames_(headerRow, ['주문번호', '작업/주문번호', '발주번호']);
        var codeIx = _findHeaderIndexByNames_(headerRow, ['제품코드']);
        var nameIx = _findHeaderIndexByNames_(headerRow, ['제품명']);
        var verIx = _findHeaderIndexByNames_(headerRow, ['버전']);
        var qtyIx = _findHeaderIndexByNames_(headerRow, ['출고제품수량', '제품수량', '출고수량']);
        var vals = sheet.getRange(2, 1, lr, lc).getValues();
        for (var i = 0; i < vals.length; i++) {
          var r = vals[i] || [];
          if (onIx >= 0 && String(r[onIx] || '').trim() !== on) continue;
          var key = _materialProductOutboundKey_(
            codeIx >= 0 ? r[codeIx] : '',
            nameIx >= 0 ? r[nameIx] : '',
            verIx >= 0 ? r[verIx] : ''
          );
          var qv = qtyIx >= 0 ? r[qtyIx] : 0;
          var qn = typeof qv === 'number' ? qv : parseFloat(String(qv).replace(/,/g, '')) || 0;
          shippedMap[key] = (shippedMap[key] || 0) + qn;
        }
      }
      var products = [];
      var seen = {};
      var bundle = getOrdersByNumber(on);
      var items = bundle && bundle.items ? bundle.items : [];
      for (var j = 0; j < items.length; j++) {
        var o = items[j] || {};
        var pn = String(o.productName || '').trim();
        if (!pn) continue;
        var key = _materialProductOutboundKey_(o.productCode, o.productName, o.version);
        if (seen[key]) continue;
        seen[key] = true;
        var orderQty = Number(o.quantity) || 0;
        var shipped = shippedMap[key] || 0;
        var remaining = Math.max(0, orderQty - shipped);
        var status = 'none';
        if (shipped > 1e-9 && remaining <= 1e-9) status = 'complete';
        else if (shipped > 1e-9) status = 'partial';
        products.push({
          productKey: key,
          productCode: String(o.productCode || '').trim(),
          productName: pn,
          version: String(o.version || '').trim(),
          orderQuantity: orderQty,
          shippedQuantity: shipped,
          remainingQuantity: remaining,
          status: status
        });
      }
      return { ok: true, orderNumber: on, products: products };
    } catch (err) {
      Logger.log('getMaterialProductOutboundProgress 오류: ' + err.toString());
      return { ok: false, error: err.message || String(err) };
    }
  }

  function _appendMaterialProductOutboundSession_(opts) {
    opts = opts || {};
    var qty = Number(opts.quantity) || 0;
    if (qty <= 0) return;
    var sheet = getMaterialProductOutboundSheet();
    sheet.appendRow([
      opts.outboundDate || '',
      opts.orderNumber || '',
      opts.productCode != null ? String(opts.productCode).trim() : '',
      opts.productName != null ? String(opts.productName).trim() : '',
      opts.version != null ? String(opts.version).trim() : '',
      qty,
      opts.requestDept != null ? String(opts.requestDept).trim() : ''
    ]);
  }

  /**
   * BOM 자재 전량 불출 후 제품 대수(누적) 기록 — 부분 불출 마지막 회차용
   * @param {{outboundDate?:string, orderNumber:string, productCode?:string, productName?:string, version?:string, quantity:number, orderQuantity?:number, requestDept?:string}} payload
   */
  function recordMaterialProductOutboundSession(payload) {
    try {
      payload = payload || {};
      var workOrder = payload.orderNumber != null ? String(payload.orderNumber).trim() : '';
      var pq = Number(payload.quantity) || 0;
      var oq = Number(payload.orderQuantity) || 0;
      if (!workOrder) return { success: false, message: '주문번호가 필요합니다.' };
      if (pq <= 0) return { success: false, message: '출고 제품수량을 확인하세요.' };
      if (oq > 0) {
        var shippedBefore = _sumShippedProductQtyForOrder_(
          workOrder,
          payload.productCode,
          payload.productName,
          payload.version
        );
        var remain = Math.max(0, oq - shippedBefore);
        if (pq > remain + 1e-9) {
          return {
            success: false,
            message:
              '출고 제품수량(' +
              pq +
              ')이 잔여 수량(' +
              remain +
              ')을 초과합니다. (주문 ' +
              oq +
              '개 · 이미 출고 ' +
              shippedBefore +
              '개)'
          };
        }
      }
      var d = payload.outboundDate
        ? String(payload.outboundDate).trim()
        : Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
      _appendMaterialProductOutboundSession_({
        outboundDate: d,
        orderNumber: workOrder,
        productCode: payload.productCode,
        productName: payload.productName,
        version: payload.version,
        quantity: pq,
        requestDept: payload.requestDept != null ? String(payload.requestDept).trim() : ''
      });
      invalidateProductionPlanPageCache_('smt');
      return { success: true };
    } catch (err) {
      Logger.log('recordMaterialProductOutboundSession 오류: ' + err.toString());
      return { success: false, message: err.message || String(err) };
    }
  }

  function _materialOutboundLineKey_(code, name, spec) {
    return (
      String(name != null ? name : '').trim() +
      '\x1f' +
      String(spec != null ? spec : '').trim() +
      '\x1f' +
      String(code != null ? code : '').trim()
    );
  }

  /** 주문번호 기준 자재별 누적 출고수량 (자재명·규격·코드) */
  function _buildMaterialOutboundShippedMapForOrder_(orderNumber) {
    var result = {};
    var on = String(orderNumber || '').trim();
    if (!on) return result;
    var sheet = getMaterialOutboundSheet();
    var lr = sheet.getLastRow();
    if (lr < 2) return result;
    var lc = Math.max(sheet.getLastColumn(), 1);
    var headerRow = sheet.getRange(1, 1, 1, lc).getValues()[0] || [];
    var map = _materialOutboundHeaderIndexMap_(headerRow);
    var vals = sheet.getRange(2, 1, lr, lc).getValues();
    var i;
    for (i = 0; i < vals.length; i++) {
      var row = vals[i] || [];
      var wo = _materialOutboundCellString_(row, map.workOrderNo);
      if (wo !== on) continue;
      var qv = map.quantity >= 0 ? row[map.quantity] : 0;
      var qn = typeof qv === 'number' ? qv : parseFloat(String(qv).replace(/,/g, '')) || 0;
      if (!(qn > 0)) continue;
      var lk = _materialOutboundLineKey_(
        map.materialCode >= 0 ? row[map.materialCode] : '',
        map.materialName >= 0 ? row[map.materialName] : '',
        map.specification >= 0 ? row[map.specification] : ''
      );
      result[lk] = (result[lk] || 0) + qn;
    }
    return result;
  }

  /**
   * 자재 출고 이력 (최근 행이 먼저 오도록 역순)
   */
  function getMaterialOutboundRecords() {
    try {
      const ss = getSpreadsheet();
      const sheet = ss.getSheetByName('자재출고');
      if (!sheet) {
        return [];
      }
      const values = sheet.getDataRange().getValues();
      if (values.length <= 1) {
        return [];
      }
      var headerRow = values[0] || [];
      var map = _materialOutboundHeaderIndexMap_(headerRow);
      const tz = Session.getScriptTimeZone();
      const out = [];
      for (var i = values.length - 1; i >= 1; i--) {
        var row = values[i];
        var d0 = map.date >= 0 ? row[map.date] : row[0];
        var dateStr = '';
        if (d0 instanceof Date) {
          dateStr = Utilities.formatDate(d0, tz, 'yyyy-MM-dd');
        } else {
          dateStr = d0 ? String(d0) : '';
        }
        var workOrderNo = _materialOutboundCellString_(row, map.workOrderNo);
        var qtyRaw = map.quantity >= 0 && map.quantity < row.length ? row[map.quantity] : '';
        out.push({
          outboundDate: dateStr,
          materialCode: _materialOutboundCellString_(row, map.materialCode),
          materialName: _materialOutboundCellString_(row, map.materialName),
          specification: _materialOutboundCellString_(row, map.specification),
          partNo: _materialOutboundCellString_(row, map.partNo),
          quantity: qtyRaw !== ''
            ? (typeof qtyRaw === 'number' ? qtyRaw : parseFloat(qtyRaw) || 0)
            : 0,
          requestDept: _materialOutboundCellString_(row, map.requestDept),
          workOrderNumber: workOrderNo,
          orderNumber: workOrderNo,
          note: _materialOutboundCellString_(row, map.note)
        });
      }
      return out;
    } catch (error) {
      Logger.log('getMaterialOutboundRecords 오류: ' + error.toString());
      return [];
    }
  }

  /**
   * 자재 출고 등록
   * @param {{ outboundDate?: string, materialCode?: string, materialName: string, specification?: string, partNo?: string, quantity: number, requestDept?: string, workOrderNumber?: string }} data
   */
  function addMaterialOutboundRecord(data) {
    try {
      data = data || {};
      var qty = parseFloat(data.quantity);
      if (isNaN(qty) || qty <= 0) {
        return { success: false, message: '출고 수량은 0보다 커야 합니다.' };
      }
      var materialName = (data.materialName != null ? String(data.materialName) : '').trim();
      if (!materialName) {
        return { success: false, message: '자재명을 입력하세요.' };
      }
      const sheet = getMaterialOutboundSheet();
      var headerRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0] || [];
      var map = _materialOutboundHeaderIndexMap_(headerRow);
      if (map.date < 0 || map.materialName < 0 || map.quantity < 0) {
        return { success: false, message: '자재출고 시트 헤더를 확인하세요. (출고일/자재명/출고수량 필수)' };
      }
      var d = data.outboundDate
        ? String(data.outboundDate).trim()
        : Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
      var colCount = Math.max(sheet.getLastColumn(), headerRow.length);
      var row = new Array(colCount).fill('');
      if (map.date >= 0) row[map.date] = d;
      if (map.materialCode >= 0) row[map.materialCode] = data.materialCode != null ? String(data.materialCode).trim() : '';
      if (map.materialName >= 0) row[map.materialName] = materialName;
      if (map.specification >= 0) row[map.specification] = data.specification != null ? String(data.specification).trim() : '';
      if (map.partNo >= 0) row[map.partNo] = data.partNo != null ? String(data.partNo).trim() : '';
      if (map.quantity >= 0) row[map.quantity] = qty;
      if (map.requestDept >= 0) row[map.requestDept] = data.requestDept != null ? String(data.requestDept).trim() : '';
      if (map.workOrderNo >= 0) row[map.workOrderNo] = data.workOrderNumber != null ? String(data.workOrderNumber).trim() : '';
      if (map.note >= 0) row[map.note] = '';
      sheet.appendRow(row);
      return { success: true };
    } catch (error) {
      Logger.log('addMaterialOutboundRecord 오류: ' + error.toString());
      return { success: false, message: error.message || String(error) };
    }
  }

  /**
   * 자재 출고 일괄 등록
   * @param {{outboundDate?:string, workOrderNumber?:string, requestDept?:string, items?:Array<{materialCode?:string, materialName:string, specification?:string, partNo?:string, quantity:number|string}>}} payload
   */
  function addMaterialOutboundRecordsBatch(payload) {
    var lock = LockService.getDocumentLock();
    if (!lock.tryLock(20000)) {
      return { success: false, message: '다른 저장 처리 중입니다. 잠시 후 다시 시도하세요.' };
    }
    try {
      payload = payload || {};
      var items = Array.isArray(payload.items) ? payload.items : [];
      if (!items.length) {
        return { success: false, message: '출고 자재를 1개 이상 입력하세요.' };
      }
      var sheet = getMaterialOutboundSheet();
      var headerRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0] || [];
      var map = _materialOutboundHeaderIndexMap_(headerRow);
      if (map.date < 0 || map.materialName < 0 || map.quantity < 0) {
        return { success: false, message: '자재출고 시트 헤더를 확인하세요. (출고일/자재명/출고수량 필수)' };
      }
      var d = payload.outboundDate
        ? String(payload.outboundDate).trim()
        : Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
      var workOrder = payload.workOrderNumber != null ? String(payload.workOrderNumber).trim() : '';
      var dept = payload.requestDept != null ? String(payload.requestDept).trim() : '';
      var po = payload.productOutbound;
      if (po && workOrder) {
        var pq = Number(po.quantity) || 0;
        var oq = Number(po.orderQuantity) || 0;
        if (pq <= 0) {
          return { success: false, message: '출고 제품수량을 확인하세요.' };
        }
        if (oq > 0) {
          var shippedBefore = _sumShippedProductQtyForOrder_(
            workOrder,
            po.productCode,
            po.productName,
            po.version
          );
          var remain = Math.max(0, oq - shippedBefore);
          if (pq > remain + 1e-9) {
            return {
              success: false,
              message:
                '출고 제품수량(' +
                pq +
                ')이 잔여 수량(' +
                remain +
                ')을 초과합니다. (주문 ' +
                oq +
                '개 · 이미 출고 ' +
                shippedBefore +
                '개)'
            };
          }
        }
      }
      var colCount = Math.max(sheet.getLastColumn(), headerRow.length);
      var invList = getMaterialInventory();
      var invByKey = {};
      for (var vi = 0; vi < invList.length; vi++) {
        var iv = invList[vi] || {};
        var vk = (iv.materialName || '').toString().trim() + '|' + (iv.specification || '').toString().trim();
        invByKey[vk] =
          iv.currentStockRaw != null && isFinite(Number(iv.currentStockRaw))
            ? Number(iv.currentStockRaw)
            : Number(iv.currentStock) || 0;
      }
      var rows = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i] || {};
        var name = it.materialName != null ? String(it.materialName).trim() : '';
        var spec = it.specification != null ? String(it.specification).trim() : '';
        var qty = typeof it.quantity === 'number' ? it.quantity : parseFloat(String(it.quantity != null ? it.quantity : '').replace(/,/g, '').trim());
        if (!name) return { success: false, message: (i + 1) + '행 자재명을 확인하세요.' };
        if (isNaN(qty) || qty <= 0) return { success: false, message: (i + 1) + '행 출고수량은 0보다 커야 합니다.' };
        var ikey = name + '|' + spec;
        var stockAvail = invByKey[ikey];
        if (stockAvail == null) stockAvail = 0;
        if (qty > stockAvail + 1e-9) {
          return {
            success: false,
            message:
              (i + 1) +
              '행 「' +
              name +
              (spec ? ' / ' + spec : '') +
              '」 출고수량(' +
              qty +
              ')이 현재 재고(' +
              stockAvail +
              ')를 초과합니다.'
          };
        }
        var row = new Array(colCount).fill('');
        if (map.date >= 0) row[map.date] = d;
        if (map.workOrderNo >= 0) row[map.workOrderNo] = workOrder;
        if (map.materialCode >= 0) row[map.materialCode] = it.materialCode != null ? String(it.materialCode).trim() : '';
        if (map.materialName >= 0) row[map.materialName] = name;
        if (map.specification >= 0) row[map.specification] = it.specification != null ? String(it.specification).trim() : '';
        if (map.partNo >= 0) row[map.partNo] = it.partNo != null ? String(it.partNo).trim() : '';
        if (map.quantity >= 0) row[map.quantity] = qty;
        if (map.requestDept >= 0) {
          var lineDept = it.requestDept != null ? String(it.requestDept).trim() : '';
          row[map.requestDept] = lineDept || dept;
        }
        if (map.note >= 0) row[map.note] = '';
        rows.push(row);
      }
      if (!rows.length) return { success: false, message: '저장할 출고 항목이 없습니다.' };
      _sheetAppendRows_(sheet, rows, colCount);
      if (po && workOrder) {
        _appendMaterialProductOutboundSession_({
          outboundDate: d,
          orderNumber: workOrder,
          productCode: po.productCode,
          productName: po.productName,
          version: po.version,
          quantity: Number(po.quantity) || 0,
          requestDept: dept
        });
      }
      invalidateMaterialInventoryCache_();
      invalidateProductionPlanPageCache_('smt');
      return { success: true, inserted: rows.length };
    } catch (error) {
      Logger.log('addMaterialOutboundRecordsBatch 오류: ' + error.toString());
      return { success: false, message: error.message || String(error) };
    } finally {
      try {
        lock.releaseLock();
      } catch (rel) {}
    }
  }

  function createOrderFromQuote(quoteNumber) {
    try {
      // 견적서 정보 가져오기
      const quote = getQuoteByNumber(quoteNumber);
      if (!quote) {
        return { success: false, message: '견적서를 찾을 수 없습니다.' };
      }
      
      // 주문일 (오늘)
      const today = new Date();
      const orderDate = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      
      // 납기일 (주문일 기준 30일 후)
      const deliveryDateObj = new Date(today);
      deliveryDateObj.setDate(deliveryDateObj.getDate() + 30);
      const deliveryDate = Utilities.formatDate(deliveryDateObj, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      
      // 총액 계산
      const totalAmount = quote.totalAmount || ((quote.smt || 0) + (quote.dip || 0) + (quote.assembly || 0) + (quote.test || 0) + (quote.packing || 0) + (quote.materialCost || 0) + (quote.setupCost || 0));
      
      // 주문서 데이터 생성
      const orderData = {
        customer: quote.customer || '',
        productCode: (quote.productCode || (quote.detailInfo && quote.detailInfo.productCode) || ''),
        productName: _mergeVersionIntoProductName_(quote.productName || '', quote.version || ''),
        quantity: quote.boardQty || 0,
        orderDate: orderDate,
        deliveryDate: deliveryDate,
        orderAmount: totalAmount,
        sourceQuoteNumber: quoteNumber,
        source: 'quote'
      };
      
      // 주문서 저장
      const success = saveOrder(orderData);
      
      if (success) {
        return { success: true, message: '주문서가 생성되었습니다.' };
      } else {
        return { success: false, message: '주문서 생성에 실패했습니다.' };
      }
    } catch (error) {
      Logger.log('견적서에서 주문서 생성 오류: ' + error.toString());
      return { success: false, message: '주문서 생성 중 오류가 발생했습니다: ' + error.toString() };
    }
  }

  function generateQuotePDF(quoteNumber) {
    try {
      const quote = getQuoteByNumber(quoteNumber);
      if (!quote) {
        return HtmlService.createHtmlOutput('견적서를 찾을 수 없습니다.');
      }
      
      const htmlContent = createPDFHTML(quote);
      const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
        .setTitle('견적서 - ' + quoteNumber);
      
      return htmlOutput;
    } catch (error) {
      Logger.log('PDF 생성 오류: ' + error.toString());
      return HtmlService.createHtmlOutput('PDF 생성 중 오류가 발생했습니다.');
    }
  }

  /** 저장 견적 SMT 합계에 SET-UP 포함 여부 (구 견적은 별도 setupCost) */
  function resolveSmtTotalWithSetup_(smtTotal, smtSetupAmount, settings) {
    if (settings && settings.smtIncludesSetup === true) return Number(smtTotal) || 0;
    return (Number(smtTotal) || 0) + (Number(smtSetupAmount) || 0);
  }

  function buildSetupRowLabel_(indent, setupRate, setupPartCount, setupAmount, qty) {
    var lbl = indent + '└ SET-UP  ₩' + setupRate.toLocaleString() + '/종 × ' + setupPartCount + '종';
    var amount = Math.round(Number(setupAmount) || 0);
    if (amount > setupPartCount * setupRate) lbl += ' (최소 ₩' + SMT_SETUP_MIN.toLocaleString() + ')';
    lbl += ' · 주문 총 ₩' + amount.toLocaleString();
    if ((Number(qty) || 1) > 1) lbl += ' → 생산수량 분할';
    return lbl;
  }

  /** 견적 표시 통화: 내부 계산은 원화, PDF는 USD (₩1,350 = $1) */
  var QUOTE_KRW_PER_USD = 1350;

  function formatQuoteUsdUnit_(krw) {
    return formatQuoteUsd_(krw, 4);
  }

  function formatQuoteUsdTotal_(krw) {
    return formatQuoteUsd_(krw, 3);
  }

  function formatQuoteUsd_(krw, fractionDigits) {
    var digits = fractionDigits != null ? fractionDigits : 3;
    var usd = (Number(krw) || 0) / QUOTE_KRW_PER_USD;
    return '$' + usd.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function formatQuoteKrw_(krw) {
    return '₩' + Math.round(Number(krw) || 0).toLocaleString('ko-KR');
  }

  function formatQuoteKrwUnit_(krw) {
    return formatQuoteKrw_(krw);
  }

  function formatQuoteKrwTotal_(krw) {
    return formatQuoteKrw_(krw);
  }

  function getQuoteOutputLang_(quoteType) {
    return quoteType === 'domestic' ? 'ko' : 'en';
  }

  function getQuoteMoneyFormatters_(quoteType) {
    if (quoteType === 'domestic') {
      return { fmtUnit: formatQuoteKrwUnit_, fmtTotal: formatQuoteKrwTotal_ };
    }
    return { fmtUnit: formatQuoteUsdUnit_, fmtTotal: formatQuoteUsdTotal_ };
  }

  function krwToUsdNum_(krw) {
    return (Number(krw) || 0) / QUOTE_KRW_PER_USD;
  }

  function quoteExportCnt_(n, suffix) {
    if (n === '' || n == null) return '';
    var num = Number(n);
    return (isNaN(num) ? String(n) : num.toLocaleString()) + (suffix || '');
  }

  /** 견적서 PDF/엑셀/미리보기 라벨 (export=영문·USD, domestic=국문·원화) */
  function getQuoteExportLabels_(lang, quoteType) {
    var en = lang === 'en';
    var domestic = quoteType === 'domestic';
    return {
      smtSection: en ? '1. SMT Process Total' : '1. SMT 공정 합계',
      dipSection: en ? '2. Soldering Process Total' : '2. 납땜 공정 합계',
      postSection: en ? '3. Post-Process Total' : '3. 후공정 합계',
      materialSection: en ? '4. Raw Materials Total' : '4. 원자재 합계',
      subMaterialSection: en ? '5. Consumables Total (10% of SMT+Soldering+Post-Process)' : '5. 부자재 합계 (SMT+납땜+후공정 합계의 10%)',
      smtMin: en ? 'SMT Labor Minimum' : 'SMT 실装 최소',
      aoi: en ? 'AOI & Visual Inspection' : 'AOI 및 외관검사',
      sideDouble: en ? ' (Double-sided)' : ' (양면)',
      sideSingle: en ? ' (Single-sided)' : ' (단면)',
      pcbWash: en ? 'PCB Cleaning' : 'PCB 세척',
      perUnitSuffix: en ? ' (per unit)' : ' (대당)',
      cntPc: en ? ' pc' : '대',
      cntTypes: en ? ' types' : '종',
      cntMin: en ? ' min' : '분',
      unitPerMin: en ? '/min' : '/분',
      setupMin: en ? ' (min. ' : ' (최소 ',
      setupOrderTotal: en ? ' · order total ' : ' · 주문 총 ',
      setupSplit: en ? ' → split by production qty' : ' → 생산수량 분할',
      dipHand13: en ? 'Hand Solder (1~3 PIN)' : '수납땜 (1~3PIN)',
      dipHand410: en ? 'Hand Solder (4~10 PIN)' : '수납땜 (4~10PIN)',
      dipHand10: en ? 'Hand Solder (10+ PIN)' : '수납땜 (10PIN 이상)',
      dipWave13: en ? 'WAVE Standard (1~3 PIN)' : 'WAVE 일반(1~3PIN)',
      dipWave410: en ? 'WAVE Medium (4~10 PIN)' : 'WAVE 중형(4~10PIN)',
      dipWave10: en ? 'WAVE Large (10+ PIN)' : 'WAVE 대형(10PIN 이상)',
      postAssembly: en ? 'Assembly' : '조립',
      postTest: en ? 'Test' : '테스트',
      postPacking: en ? 'Packing' : '포장',
      oddParts: en ? 'Odd-form Parts' : '이형 부품',
      specialModule: en ? 'Special/Module' : '특수/모듈',
      bgaSmall: en ? 'BGA (1~100 balls)' : 'BGA (1~100볼)',
      bgaMedium: en ? 'BGA (101~256 balls)' : 'BGA (101~256볼)',
      bgaLarge: en ? 'BGA (257+ balls)' : 'BGA (257볼+)',
      title: en ? 'QUOTATION' : '견 적 서',
      quoteNo: en ? 'Quote No.' : '관리번호',
      date: en ? 'Date' : '발행일자',
      customer: en ? 'Customer' : '고객사',
      product: en ? 'Product' : '제품명',
      qty: en ? 'Quantity' : '생산 수량',
      qtyUnit: en ? ' pcs' : ' 개',
      currency: en ? 'Currency' : '통화',
      supplier: en ? 'Supplier' : '공급자',
      supplierName: en ? 'Mirae SMT' : '미래SMT',
      contact: en ? 'Contact' : '담당자',
      contactName: en ? 'Sales Team' : '영업관리팀',
      continued: en ? 'Quotation (continued)' : '견적서 (계속)',
      colProcess: en ? 'Process Details' : '공정 세부 항목',
      colUnit: en ? 'Unit Price (USD)' : (domestic ? '개수당 단가 (원)' : '개수당 단가 (USD)'),
      colQty: en ? 'Qty' : '개수',
      colTotal: en ? 'Total per Unit (USD)' : (domestic ? '대당 합계 (원)' : '대당 합계 (USD)'),
      currencyValue: en ? 'USD (₩1,350/USD)' : (domestic ? 'KRW (원화)' : 'USD (₩1,350/USD)'),
      emptyPreview: en ? 'Generate a quotation to preview' : '견적서를 생성해주세요',
      specialDiscount: en ? 'Special Discount (excl. VAT)' : '특별 할인 (VAT 별도)',
      unitPrice: en ? 'Per Unit Price (excl. VAT)' : '대당 단가 (VAT 별도)',
      grandTotal: en ? 'Grand Total (excl. VAT)' : '최종 합계 금액 (VAT 별도)',
      savePdfTitle: en ? 'Save as PDF:' : 'PDF로 저장하기:',
      savePdfHint: en ? 'When the print dialog opens, select "Save as PDF" as the destination.' : '인쇄 다이얼로그가 열리면 "대상"을 "PDF로 저장"으로 선택하세요.',
      savePdfBtn: en ? 'Save as PDF' : 'PDF로 저장'
    };
  }

  /** 견적서 PDF/엑셀 공통 테이블 데이터 */
  function buildQuoteTableExportData_(quote, lang) {
    var quoteType = getQuoteTypeFromQuote_(quote);
    lang = lang || getQuoteOutputLang_(quoteType);
    var L = getQuoteExportLabels_(lang, quoteType);
    var moneyFmt = getQuoteMoneyFormatters_(quoteType);
    const qty = quote.boardQty || 1;
    const inputs = (quote.detailInfo && quote.detailInfo.inputs) || {};
    const settings = (quote.detailInfo && quote.detailInfo.settings) || {};
    const smtInputs = inputs.smt || {};
    const dipInputs = inputs.dip || {};
    const postInputs = inputs.postProcess || {};

    const smtTotal = quote.smt || 0;
    let dipTotal = quote.dip || 0;
    let postTotal = quote.assembly || 0;
    let smtTotalBlended = smtTotal;
    const materialCost = quote.materialCost || 0;
    var pcbBoardsPdf = normalizeSmtPcbBoards_(smtInputs);
    var smtAggPdf = aggregateSmtFromPcbBoards_(pcbBoardsPdf);
    var smtSetupAmount = smtAggPdf.smtSetupAmount;
    if (smtSetupAmount <= 0 && smtAggPdf.setupPartCount <= 0 && (Number(quote.setupCost) || 0) > 0) {
      smtSetupAmount = Number(quote.setupCost) || 0;
    }
    smtTotalBlended = resolveSmtTotalWithSetup_(smtTotalBlended, smtSetupAmount, settings);

    const smtPerUnit = Math.round(smtTotalBlended / qty);
    const dipPerUnit = Math.round(dipTotal / qty);
    const postPerUnit = Math.round(postTotal / qty);
    const matPerUnit = Math.round(materialCost / qty);
    const subMaterialTotal = Math.round((smtTotalBlended + dipTotal + postTotal) * 0.10);
    const subMaterialPerUnit = qty > 0 ? Math.round(subMaterialTotal / qty) : 0;
    const lineSetupPerUnit = qty > 0 ? Math.round(smtSetupAmount / qty) : 0;
    const subtotalBeforeDiscount = smtTotalBlended + dipTotal + postTotal + materialCost + subMaterialTotal;
    var specialDiscount = Math.max(0, Math.round(Number(settings.specialDiscount) || 0));
    if (specialDiscount > subtotalBeforeDiscount) specialDiscount = subtotalBeforeDiscount;
    const totalAmount = Math.max(0, subtotalBeforeDiscount - specialDiscount);
    const unitPrice = qty > 0 ? Math.floor(totalAmount / qty) : 0;

    const smtPerUnitVal = smtTotalBlended / qty;
    var preMarkupSmtPerUnit = smtAggPdf.smtLaborUnit + lineSetupPerUnit;
    var smtMarkupRatio = preMarkupSmtPerUnit > 0 ? (smtPerUnitVal / preMarkupSmtPerUnit) : 1;
    var setupRatePdf = SMT_SETUP_RATE;

    function row_(label, unitKrw, countText, amountKrw, amountSuffix, opts) {
      opts = opts || {};
      var unitDisplay = '';
      if (unitKrw != null && unitKrw !== '') {
        unitDisplay = opts.unitSuffix ? moneyFmt.fmtUnit(unitKrw) + opts.unitSuffix : moneyFmt.fmtUnit(unitKrw);
      }
      var amountDisplay = '';
      if (amountKrw != null && amountKrw !== '') {
        amountDisplay = moneyFmt.fmtTotal(amountKrw) + (amountSuffix || '');
      }
      return {
        label: label,
        unitDisplay: unitDisplay,
        countDisplay: countText || '',
        amountDisplay: amountDisplay,
        isSub: !!opts.isSub,
        isPcbHdr: !!opts.isPcbHdr
      };
    }

    var smtRows = [];
    smtRows.push(row_(L.smtSection + (pcbBoardsPdf.length > 1 ? ' (' + pcbBoardsPdf.length + ' PCB)' : ''), '', '', smtPerUnit));
    smtAggPdf.boardDetails.forEach(function(bd) {
      var pcbLineSetup = qty > 0 ? Math.round(bd.setupAmount / qty) : 0;
      var pcbLaborDisp = Math.round(bd.laborUnit * smtMarkupRatio);
      var pcbMinAdj = bd.laborMinApplied ? Math.round(bd.laborMinAdjustment * smtMarkupRatio) : 0;
      var pcbAmtComp = pcbLaborDisp - bd.aoiUnit - bd.pcbWashUnit - pcbMinAdj;
      if (pcbAmtComp < 0) pcbAmtComp = 0;
      if (pcbBoardsPdf.length > 1) {
        smtRows.push(row_('  ■ ' + bd.pcbName, '', '', pcbLaborDisp + pcbLineSetup, '', { isPcbHdr: true }));
      }
      var componentRows = buildSmtComponentRows_(bd, lang);
      var scaledComponents = scaleLaborLineItems_(componentRows, pcbAmtComp, function(r) { return r.unit * r.cnt; });
      scaledComponents.forEach(function(r) {
        smtRows.push(row_('  └ ' + r.label, r.displayUnit, quoteExportCnt_(r.cnt), r.displayAmount, '', { isSub: true }));
      });
      if (pcbMinAdj > 0) {
        smtRows.push(row_('  └ ' + L.smtMin, 3000, quoteExportCnt_(1, L.cntPc), pcbMinAdj, '', { isSub: true }));
      }
      if (bd.aoiEnabled && bd.aoiUnit > 0) {
        var aoiSide = bd.smtSide === 'double' ? L.sideDouble : L.sideSingle;
        smtRows.push(row_('  └ ' + L.aoi + aoiSide, bd.smtSide === 'double' ? 200 : 100, quoteExportCnt_(1, L.cntPc), bd.aoiUnit, '', { isSub: true }));
      }
      if (bd.pcbWashEnabled && bd.pcbWashUnit > 0) {
        smtRows.push(row_('  └ ' + L.pcbWash, 100, quoteExportCnt_(1, L.cntPc), bd.pcbWashUnit, '', { isSub: true }));
      }
      if (bd.setupPartCount > 0 && bd.setupAmount > 0) {
        var setupNote = bd.setupAmount > bd.setupPartCount * setupRatePdf ? L.setupMin + moneyFmt.fmtTotal(SMT_SETUP_MIN) + ')' : '';
        var setupLbl = '  └ SET-UP' + setupNote + L.setupOrderTotal + moneyFmt.fmtTotal(bd.setupAmount) + (qty > 1 ? L.setupSplit : '');
        smtRows.push(row_(setupLbl, setupRatePdf, quoteExportCnt_(bd.setupPartCount, L.cntTypes), pcbLineSetup, L.perUnitSuffix, { isSub: true }));
      }
    });

    const dipBoardsPdf = normalizeDipPcbBoards_(dipInputs);
    const dipAggPdf = aggregateDipFromPcbBoards_(dipBoardsPdf);
    var restRows = [];
    restRows.push(row_(L.dipSection + (dipBoardsPdf.length > 1 ? ' (' + dipBoardsPdf.length + ' PCB)' : ''), '', '', dipPerUnit));
    dipAggPdf.boardDetails.forEach(function(bd) {
      var pcbUnit = bd.boardUnit || computeDipBoardUnit_(bd);
      if (dipBoardsPdf.length > 1) {
        restRows.push(row_('  ■ ' + bd.pcbName, '', '', pcbUnit, '', { isPcbHdr: true }));
      }
      var dipItems = [
        { label: L.dipHand13, unit: 400, cnt: bd.dipGeneral },
        { label: L.dipHand410, unit: 450, cnt: bd.dipConnector },
        { label: L.dipHand10, unit: 500, cnt: bd.dipWire },
        { label: L.dipWave13, unit: 300, cnt: bd.waveGeneral },
        { label: L.dipWave410, unit: 350, cnt: bd.waveConnector },
        { label: L.dipWave10, unit: 400, cnt: bd.waveWire }
      ].filter(function(i) { return i.cnt > 0; });
      var scaledDipBoard = scaleLaborLineItems_(dipItems, pcbUnit, function(i) { return i.unit * i.cnt; });
      scaledDipBoard.forEach(function(i) {
        restRows.push(row_('  └ ' + i.label, i.displayUnit, quoteExportCnt_(i.cnt), i.displayAmount, '', { isSub: true }));
      });
    });

    const postPerUnitCombined = Math.round(postTotal / qty);
    const postAssemblyMin = Number(postInputs.postAssembly) || 0;
    const postTestMin = Number(postInputs.postTest) || 0;
    const postPackingMin = Number(postInputs.postPacking) || 0;
    const postItems = [
      { label: L.postAssembly, min: postAssemblyMin },
      { label: L.postTest, min: postTestMin },
      { label: L.postPacking, min: postPackingMin }
    ].filter(function(i) { return i.min > 0; });
    restRows.push(row_(L.postSection, '', '', postPerUnit));
    var postDisplayItems = scalePostDisplayItems_(postItems, postPerUnitCombined);
    postDisplayItems.forEach(function(i) {
      var rate = i.min > 0 ? Math.round(i.value / i.min) : 540;
      restRows.push(row_('  └ ' + i.label, rate, quoteExportCnt_(i.min, L.cntMin), i.value, '', { isSub: true, unitSuffix: L.unitPerMin }));
    });
    restRows.push(row_(L.materialSection, '', '', matPerUnit));
    restRows.push(row_(L.subMaterialSection, '', '', subMaterialPerUnit));

    return {
      quoteNumber: quote.quoteNumber || '',
      quoteDate: quote.quoteDate || '',
      customer: quote.customer || '',
      productName: quote.productName || '',
      boardQty: qty,
      unitPrice: unitPrice,
      totalAmount: totalAmount,
      specialDiscount: specialDiscount,
      subtotalBeforeDiscount: subtotalBeforeDiscount,
      smtRows: smtRows,
      restRows: restRows,
      quoteType: quoteType,
      labels: L,
      moneyFmt: moneyFmt
    };
  }

  function padQuoteExcelRow_(cells) {
    var row = (cells || []).slice();
    while (row.length < 4) row.push('');
    return row.slice(0, 4);
  }

  function writeQuoteExcelSheet_(sheet, exportData) {
    var L = exportData.labels || getQuoteExportLabels_('ko', exportData.quoteType || 'export');
    var fmt = (exportData.moneyFmt && exportData.moneyFmt.fmtTotal) || formatQuoteUsdTotal_;
    var rows = [
      padQuoteExcelRow_([L.title.replace(/\s/g, ' ')]),
      padQuoteExcelRow_([]),
      padQuoteExcelRow_([L.quoteNo, exportData.quoteNumber]),
      padQuoteExcelRow_([L.date, exportData.quoteDate]),
      padQuoteExcelRow_([L.customer, exportData.customer]),
      padQuoteExcelRow_([L.product, exportData.productName]),
      padQuoteExcelRow_([L.qty, exportData.boardQty]),
      padQuoteExcelRow_([L.currency, L.currencyValue || 'USD (₩1,350/USD)']),
      padQuoteExcelRow_([]),
      padQuoteExcelRow_([L.colProcess, L.colUnit, L.colQty, L.colTotal])
    ];
    exportData.smtRows.forEach(function(r) {
      rows.push(padQuoteExcelRow_([r.label, r.unitDisplay, r.countDisplay, r.amountDisplay]));
    });
    rows.push(padQuoteExcelRow_([]));
    exportData.restRows.forEach(function(r) {
      rows.push(padQuoteExcelRow_([r.label, r.unitDisplay, r.countDisplay, r.amountDisplay]));
    });
    rows.push(padQuoteExcelRow_([]));
    if (exportData.specialDiscount > 0) {
      rows.push(padQuoteExcelRow_([L.specialDiscount, '', '', '-' + fmt(exportData.specialDiscount)]));
    }
    rows.push(padQuoteExcelRow_([L.unitPrice, '', '', fmt(exportData.unitPrice)]));
    rows.push(padQuoteExcelRow_([L.grandTotal, '', '', fmt(exportData.totalAmount)]));

    var headerRow = 10;
    var dataStartRow = 11;
    sheet.getRange(1, 1, rows.length, 4).setValues(rows);
    sheet.getRange(1, 1, 1, 4).merge().setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange(headerRow, 1, 1, 4).setFontWeight('bold').setBackground('#edf2f7');
    sheet.setColumnWidth(1, 360);
    sheet.setColumnWidth(2, 140);
    sheet.setColumnWidth(3, 90);
    sheet.setColumnWidth(4, 140);
    if (rows.length >= dataStartRow) {
      sheet.getRange(dataStartRow, 1, rows.length - dataStartRow + 1, 4).setVerticalAlignment('middle');
    }
    sheet.getRange(rows.length - 1, 1, 2, 3).setFontWeight('bold');
    sheet.getRange(rows.length - 1, 4, 2, 1).setFontWeight('bold');
  }

  function exportSheetAsXlsxBlob_(spreadsheetId, sheetId, fileName) {
    var token = ScriptApp.getOAuthToken();
    var url = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export?format=xlsx&gid=' + sheetId;
    var response = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) {
      throw new Error('엑셀 변환 실패 (HTTP ' + response.getResponseCode() + ')');
    }
    return response.getBlob().setName(fileName);
  }

  function createQuoteExcelBlob_(quoteNumber) {
    var quote = getQuoteByNumber(quoteNumber);
    if (!quote) return null;
    var quoteType = getQuoteTypeFromQuote_(quote);
    var exportData = buildQuoteTableExportData_(quote, getQuoteOutputLang_(quoteType));
    var ss = getSpreadsheet();
    var safeTag = String(quoteNumber || 'quote').replace(/[\\/?*[\]:]/g, '_').substring(0, 24);
    var tempSheetName = '_견적엑셀_' + safeTag + '_' + Utilities.getUuid().substring(0, 6);
    if (tempSheetName.length > 99) tempSheetName = tempSheetName.substring(0, 99);
    var sheet = ss.insertSheet(tempSheetName);
    try {
      writeQuoteExcelSheet_(sheet, exportData);
      SpreadsheetApp.flush();
      Utilities.sleep(400);
      var safeName = '견적서_' + String(quoteNumber || 'quote').replace(/[\\/:*?"<>|]/g, '_') + '.xlsx';
      return exportSheetAsXlsxBlob_(ss.getId(), sheet.getSheetId(), safeName);
    } finally {
      try {
        ss.deleteSheet(sheet);
      } catch (delErr) {
        Logger.log('견적 엑셀 임시시트 삭제 실패: ' + delErr);
      }
    }
  }

  function serveQuoteExcelDownload_(quoteNumber) {
    var blob = createQuoteExcelBlob_(quoteNumber);
    if (!blob) {
      return HtmlService.createHtmlOutput('견적서를 찾을 수 없습니다.')
        .setTitle('엑셀 다운로드')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    var safeName = '견적서_' + String(quoteNumber || 'quote').replace(/[\\/:*?"<>|]/g, '_') + '.xlsx';
    var b64 = Utilities.base64Encode(blob.getBytes());
    var html = '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>엑셀 다운로드</title></head><body style="font-family:sans-serif;padding:24px;">' +
      '<p>견적서 엑셀 파일을 준비했습니다. 자동으로 다운로드되지 않으면 아래 버튼을 눌러주세요.</p>' +
      '<button id="dlBtn" style="padding:10px 16px;font-size:14px;cursor:pointer;">' + safeName + ' 다운로드</button>' +
      '<script>(function(){' +
      'var b64=' + JSON.stringify(b64) + ';' +
      'var fileName=' + JSON.stringify(safeName) + ';' +
      'function downloadExcel(){' +
        'var binary=atob(b64);var len=binary.length;var bytes=new Uint8Array(len);' +
        'for(var i=0;i<len;i++){bytes[i]=binary.charCodeAt(i);}' +
        'var out=new Blob([bytes],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});' +
        'var url=URL.createObjectURL(out);var a=document.createElement("a");' +
        'a.href=url;a.download=fileName;document.body.appendChild(a);a.click();' +
        'document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},1000);' +
      '}' +
      'document.getElementById("dlBtn").addEventListener("click",downloadExcel);' +
      'downloadExcel();' +
      '})();</script></body></html>';
    return HtmlService.createHtmlOutput(html)
      .setTitle('견적서 엑셀 다운로드')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  function getQuoteExcelDownload(quoteNumber) {
    try {
      var blob = createQuoteExcelBlob_(quoteNumber);
      if (!blob) return null;
      var safeName = String(quoteNumber || 'quote').replace(/[\\/:*?"<>|]/g, '_');
      return {
        fileName: '견적서_' + safeName + '.xlsx',
        mimeType: blob.getContentType(),
        data: Utilities.base64Encode(blob.getBytes())
      };
    } catch (error) {
      Logger.log('getQuoteExcelDownload 오류: ' + error);
      throw error;
    }
  }

  function buildQuotePdfSummaryBlockHtml_(unitPrice, totalAmount, specialDiscount, formatCurrency, lang, quoteType) {
    lang = lang || 'en';
    var L = getQuoteExportLabels_(lang, quoteType || (lang === 'ko' ? 'domestic' : 'export'));
    var fmt = formatCurrency || formatQuoteUsd_;
    var discount = Math.max(0, Number(specialDiscount) || 0);
    var discountRow = '';
    if (discount > 0) {
      discountRow = '<div class="summary-discount-row" style="display:flex;justify-content:space-between;align-items:center;font-size:15px;padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid #feebc8;">' +
        '<span style="font-weight:600;">' + L.specialDiscount + '</span>' +
        '<span style="font-weight:700;color:#059669;white-space:nowrap;">-' + fmt(discount) + '</span></div>';
    }
    return '<div class="summary-box">' +
      '<div class="summary-unit-row">' +
        '<span style="font-weight:600;">' + L.unitPrice + '</span>' +
        '<span class="summary-unit-val">' + fmt(unitPrice) + '</span>' +
      '</div>' +
      discountRow +
      '<div class="summary-grand-row">' +
        '<span style="font-weight:700;">' + L.grandTotal + '</span>' +
        '<span class="grand-total-val">' + fmt(totalAmount) + '</span>' +
      '</div></div>';
  }

  function buildQuotePdfTableRow4_(label, unitCol, countCol, amountCol, opts) {
    opts = opts || {};
    var tdMain = 'text-align:right;font-weight:700;color:#0f172a;';
    var tdSub = 'text-align:right;font-weight:600;color:#64748b;font-size:11px;';
    var tdCnt = 'text-align:center;font-size:11px;color:#64748b;';
    var pad = opts.isPcbHdr ? 'padding-left:16px;font-weight:600;' : (opts.isSub ? 'padding-left:28px;font-size:11px;' : '');
    var bg = opts.isPcbHdr ? 'background:#f1f5f9;font-size:12px;' : (opts.isSub ? 'background:#f8fafc;font-size:12px;' : '');
    var amtStyle = opts.isSub || opts.isPcbHdr ? tdSub : tdMain;
    return '<tr style="' + bg + '">' +
      '<td style="' + pad + '">' + label + '</td>' +
      '<td style="' + tdSub + '">' + (unitCol || '') + '</td>' +
      '<td style="' + tdCnt + '">' + (countCol || '') + '</td>' +
      '<td style="' + amtStyle + '">' + (amountCol || '') + '</td></tr>';
  }

  function createPDFHTML(quote) {
    var quoteType = getQuoteTypeFromQuote_(quote);
    var lang = getQuoteOutputLang_(quoteType);
    const formatCurrency = getQuoteMoneyFormatters_(quoteType).fmtTotal;
    const exportData = buildQuoteTableExportData_(quote, lang);
    const L = getQuoteExportLabels_(lang, quoteType);
    const qty = exportData.boardQty || 1;
    const unitPrice = exportData.unitPrice;
    const totalAmount = exportData.totalAmount;
    const specialDiscount = exportData.specialDiscount || 0;

    var smtTableRows = '';
    exportData.smtRows.forEach(function(r) {
      smtTableRows += buildQuotePdfTableRow4_(r.label, r.unitDisplay, r.countDisplay, r.amountDisplay, { isSub: r.isSub, isPcbHdr: r.isPcbHdr });
    });

    var restTableRows = '';
    exportData.restRows.forEach(function(r) {
      restTableRows += buildQuotePdfTableRow4_(r.label, r.unitDisplay, r.countDisplay, r.amountDisplay, { isSub: r.isSub, isPcbHdr: r.isPcbHdr });
    });
    
    return `
  <!DOCTYPE html>
  <html lang="${lang}">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${L.title} - ${quote.quoteNumber}</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: 'Segoe UI', Arial, sans-serif;
        padding: 40px;
        background: white;
        color: #1a202c;
      }
      .pdf-header {
        background: #1a2a6c;
        color: white;
        padding: 30px 20px;
        text-align: center;
        margin-bottom: 30px;
      }
      .pdf-header h1 {
        margin: 0;
        letter-spacing: 15px;
        font-size: 28px;
        font-weight: 700;
      }
      .pdf-info {
        display: flex;
        justify-content: space-between;
        padding: 20px;
        background: #f1f5f9;
        border-bottom: 1px solid #ddd;
        margin-bottom: 30px;
        font-size: 14px;
      }
      .pdf-body {
        padding: 20px 0;
      }
      .quote-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 30px;
        border: 1px solid #ddd;
      }
      .quote-table th {
        background: #edf2f7;
        text-align: left;
        padding: 15px;
        border-bottom: 2px solid #1a2a6c;
        font-size: 14px;
        font-weight: 700;
      }
      .quote-table th:first-child { width: 40%; }
      .quote-table th:nth-child(2) { width: 18%; text-align: right; }
      .quote-table th:nth-child(3) { width: 14%; text-align: center; }
      .quote-table th:nth-child(4) { width: 28%; text-align: right; }
      .quote-table td:nth-child(2),
      .quote-table td:nth-child(4) { text-align: right; }
      .quote-table td:nth-child(3) { text-align: center; }
      .quote-table td {
        padding: 15px;
        border-bottom: 1px solid #eee;
        font-size: 14px;
      }
      .quote-table tr.sub-row td {
        padding: 10px 15px;
        font-size: 11px;
      }
      .quote-table td:last-child {
        text-align: right;
        font-weight: 700;
      }
      .summary-box {
        background: #fffaf0;
        border: 2px solid #feebc8;
        border-radius: 8px;
        padding: 25px 45px;
        margin-top: 20px;
        overflow: visible;
        box-sizing: border-box;
      }
      .summary-unit-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 16px;
        padding-bottom: 14px;
        margin-bottom: 14px;
        border-bottom: 1px solid #feebc8;
      }
      .summary-unit-val {
        font-size: 18px;
        font-weight: 700;
        color: #b21f1f;
      }
      .summary-grand-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 18px;
      }
      .grand-total-val {
        font-size: 20px;
        font-weight: 700;
        color: #b21f1f;
        flex: 0 0 auto;
        white-space: nowrap;
        text-align: right;
        padding-left: 20px;
        overflow: visible;
      }
      .stamp-area {
        margin-top: 50px;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 20px;
        text-align: right;
      }
      .stamp-circle {
        width: 70px;
        height: 70px;
        min-width: 70px;
        min-height: 70px;
        max-width: 70px;
        max-height: 70px;
        border: 2px solid #b21f1f;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: #b21f1f;
        text-align: center;
        font-weight: 700;
        box-sizing: border-box;
        aspect-ratio: 1;
      }
      @media print {
        body {
          padding: 0;
        }
        .pdf-page {
          page-break-after: always;
          break-after: page;
        }
        .pdf-page-last {
          page-break-after: auto;
          break-after: auto;
        }
      }
      .pdf-page {
        margin-bottom: 20px;
      }
      .pdf-continue-header {
        padding: 12px 20px;
        background: #f1f5f9;
        border-bottom: 2px solid #1a2a6c;
        margin-bottom: 20px;
        font-size: 13px;
        line-height: 1.5;
      }
      .download-notice {
        text-align: center;
        padding: 20px;
        background: #eff6ff;
        border: 1px solid #3b82f6;
        border-radius: 8px;
        margin-bottom: 20px;
        color: #1e40af;
        font-size: 14px;
      }
      .download-button {
        background: #3b82f6;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        margin: 10px;
      }
      .download-button:hover {
        background: #2563eb;
      }
    </style>
    <script>
      window.onload = function() {
        setTimeout(function() {
          window.print();
        }, 500);
      };
    </script>
  </head>
  <body>
    <div class="download-notice">
      <p><strong>${L.savePdfTitle}</strong> ${L.savePdfHint}</p>
      <button class="download-button" onclick="window.print()">${L.savePdfBtn}</button>
    </div>
    <div class="pdf-page">
      <div class="pdf-header">
        <h1>${L.title}</h1>
      </div>
      <div class="pdf-info">
        <div>
          <strong>${L.quoteNo}:</strong> ${quote.quoteNumber}<br>
          <strong>${L.date}:</strong> ${quote.quoteDate}<br>
          <strong>${L.customer}:</strong> ${quote.customer}<br>
          <strong>${L.product}:</strong> ${quote.productName}<br>
          <strong>${L.qty}:</strong> ${(quote.boardQty || 0).toLocaleString()}${L.qtyUnit}
        </div>
        <div style="text-align:right;">
          <strong>${L.supplier}:</strong> ${L.supplierName}<br>
          <strong>${L.contact}:</strong> ${L.contactName}
        </div>
      </div>
      <div class="pdf-body">
        <table class="quote-table">
          <thead>
            <tr>
              <th>${L.colProcess}</th>
              <th>${L.colUnit}</th>
              <th>${L.colQty}</th>
              <th>${L.colTotal}</th>
            </tr>
          </thead>
          <tbody>
            ${smtTableRows}
          </tbody>
        </table>
      </div>
    </div>
    <div class="pdf-page pdf-page-last">
      <div class="pdf-continue-header">
        <strong style="font-size:15px;color:#1a2a6c;">${L.continued}</strong><br>
        <span style="color:#475569;">${L.quoteNo}: ${quote.quoteNumber} · ${L.customer}: ${quote.customer || '-'} · ${L.product}: ${quote.productName || '-'} · ${L.qty}: ${(quote.boardQty || 0).toLocaleString()}${L.qtyUnit}</span>
      </div>
      <div class="pdf-body">
        <table class="quote-table">
          <thead>
            <tr>
              <th>${L.colProcess}</th>
              <th>${L.colUnit}</th>
              <th>${L.colQty}</th>
              <th>${L.colTotal}</th>
            </tr>
          </thead>
          <tbody>
            ${restTableRows}
          </tbody>
        </table>
        ${buildQuotePdfSummaryBlockHtml_(unitPrice, totalAmount, specialDiscount, formatCurrency, lang, quoteType)}
      </div>
    </div>
  </body>
  </html>
    `;
  }

  // ========== 자재 발주 PDF 생성 (공급사 발송용 — 견적서 PDF와 별도 디자인) ==========

  function _moPdfFormatNumber_(num) {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function _moPdfEscapeHtml_(text) {
    if (text === null || text === undefined || String(text).trim() === '') return '-';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /** 발주서 PDF — 원화(₩) 표시 */
  function _moPdfMoneyHtml_(amount) {
    var n = typeof amount === 'number' ? amount : parseFloat(String(amount != null ? amount : '').replace(/,/g, '')) || 0;
    return '₩' + _moPdfFormatNumber_(Math.round(n));
  }

  function _moPdfSharedStyles_() {
    return (
      '@page { size: A4; margin: 14mm 12mm; }' +
      'html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
      'body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", Arial, sans-serif; margin: 0; padding: 28px 32px 36px; color: #0f172a; background: #fff; font-size: 13px; line-height: 1.45; }' +
      '.top-stripe { height: 6px; background: linear-gradient(90deg, #0d9488 0%, #14b8a6 55%, #5eead4 100%); margin: -28px -32px 22px; }' +
      '.letterhead { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 22px; padding-bottom: 18px; border-bottom: 2px solid #e2e8f0; }' +
      '.issuer .brand { font-size: 22px; font-weight: 800; color: #0f766e; letter-spacing: -0.5px; }' +
      '.issuer .sub { font-size: 12px; color: #64748b; margin-top: 4px; }' +
      '.doc-title { text-align: right; }' +
      '.doc-title .en { font-size: 11px; font-weight: 700; color: #0d9488; letter-spacing: 0.12em; }' +
      '.doc-title h1 { margin: 4px 0 0; font-size: 26px; font-weight: 800; color: #134e4a; letter-spacing: 0.08em; }' +
      '.doc-title .no { margin-top: 8px; font-size: 14px; font-weight: 700; color: #334155; }' +
      '.po-barcode-wrap { margin-top: 8px; display: flex; justify-content: flex-end; }' +
      '.po-order-barcode { display: block; max-width: 160px; height: auto; }' +
      '.party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }' +
      '.party-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 16px; background: #f8fafc; }' +
      '.party-box.to { border-color: #99f6e4; background: #f0fdfa; }' +
      '.party-box .label { font-size: 11px; font-weight: 700; color: #0d9488; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }' +
      '.party-box .name { font-size: 16px; font-weight: 700; color: #0f172a; }' +
      '.party-box .meta { font-size: 12px; color: #475569; margin-top: 6px; }' +
      '.meta-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; font-size: 12px; }' +
      '.meta-bar .cell { background: #f1f5f9; border-radius: 6px; padding: 10px 12px; }' +
      '.meta-bar .cell strong { display: block; color: #64748b; font-size: 10px; margin-bottom: 4px; }' +
      '.items { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }' +
      '.items th { background: #134e4a; color: #fff; padding: 10px 8px; text-align: left; font-weight: 600; border: 1px solid #0f766e; }' +
      '.items th.num, .items td.num { text-align: right; }' +
      '.items td { padding: 9px 8px; border: 1px solid #e2e8f0; vertical-align: top; }' +
      '.items tr.zebra td { background: #f8fafc; }' +
      '.items td.c-no, .items th.c-no { text-align: center; width: 36px; }' +
      '.items td.c-code, .items th.c-code { width: 88px; font-family: Consolas, monospace; font-size: 11px; }' +
      '.items td.c-part, .items th.c-part { width: 100px; font-size: 12px; }' +
      '.items td.amt { font-weight: 700; color: #0f766e; }' +
      '.totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 20px; }' +
      '.totals { width: 340px; border: 2px solid #0d9488; border-radius: 8px; overflow: hidden; }' +
      '.totals .row { display: flex; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #ccfbf1; font-size: 13px; }' +
      '.totals .row:last-child { border-bottom: none; background: #f0fdfa; font-size: 16px; font-weight: 800; color: #134e4a; }' +
      '.totals .row .val { font-variant-numeric: tabular-nums; }' +
      '.notes { border-left: 4px solid #0d9488; padding: 12px 14px; background: #f8fafc; font-size: 11px; color: #475569; line-height: 1.6; margin-bottom: 0; }' +
      '.notes strong { color: #134e4a; }' +
      '.no-print { margin-bottom: 12px; }' +
      '@media print { .no-print { display: none; } body { padding: 0; } .top-stripe { margin: 0 0 18px; } }'
    );
  }

  function _moPdfOrderBarcodeOnloadScript_(orderNumber) {
    var po = String(orderNumber == null ? '' : orderNumber).trim();
    return (
      '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>' +
      '<script>' +
      'window.onload=function(){' +
      'try{' +
      'var po=' +
      JSON.stringify(po) +
      ';' +
      'if(po&&window.JsBarcode){JsBarcode("#poOrderBarcode",po,{format:"CODE128",width:1.2,height:32,margin:4,displayValue:false});}' +
      '}catch(e){}' +
      'setTimeout(function(){window.print();},650);' +
      '};' +
      '</script>'
    );
  }

  /**
   * 공급사 전달용 발주서 HTML (청록 톤 레터헤드, 품목코드·Part No. 포함)
   */
  function _buildMaterialOrderSupplierPdfHtml_(orderNumber, orders, firstOrder, totalQuantity, totalAmount) {
    var esc = _moPdfEscapeHtml_;
    var fmtQty = _moPdfFormatNumber_;
    var orderNumberSafe = esc(orderNumber || '');
    var orderDate = esc(firstOrder.orderDate || '-');
    var deliveryDate = esc(firstOrder.deliveryDate || '-');
    var supplier = esc(firstOrder.supplier || '-');
    var issuedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

    var tableRows = orders
      .map(function (order, idx) {
        var productCode = esc(order.productCode || '');
        var partNo = esc(order.partNo || '');
        var materialName = esc(order.materialName || '-');
        var specification = esc(order.specification || '-');
        var quantity = order.quantity || 0;
        var unitPrice = order.unitPrice || 0;
        var orderAmount = order.orderAmount || 0;
        var zebra = idx % 2 === 1 ? ' class="zebra"' : '';
        return (
          '<tr' +
          zebra +
          '>' +
          '<td class="c-no">' +
          (idx + 1) +
          '</td>' +
          '<td class="c-code">' +
          productCode +
          '</td>' +
          '<td>' +
          materialName +
          '</td>' +
          '<td>' +
          specification +
          '</td>' +
          '<td class="c-part">' +
          partNo +
          '</td>' +
          '<td class="num">' +
          fmtQty(quantity) +
          '</td>' +
          '<td class="num">' +
          _moPdfMoneyHtml_(unitPrice) +
          '</td>' +
          '<td class="num amt">' +
          _moPdfMoneyHtml_(orderAmount) +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    var L = {
      title: '발주서 ' + orderNumberSafe,
      printHint: '인쇄 대화상자에서 「PDF로 저장」을 선택하면 공급사에 보낼 파일을 만들 수 있습니다.',
      brandSub: '자재 구매 발주 · Purchase Order',
      docEn: 'MATERIAL PURCHASE ORDER',
      docTitle: '발 주 서',
      fromLabel: '발주처 From',
      fromMeta: '발주일: ' + orderDate + '<br>문서발행: ' + issuedAt,
      toLabel: '수신 공급사 To',
      toMeta: '아래 품목·수량·납기에 따라 납품 부탁드립니다.',
      metaPo: '발주번호',
      metaOrderDate: '발주일',
      metaDelivery: '납기요청일',
      metaLines: '품목 수',
      metaLinesVal: orders.length + '건',
      thNo: 'No',
      thCode: 'CPN',
      thName: '자재명',
      thSpec: '규격/사양',
      thPart: 'Part No.',
      thQty: '수량',
      thUnit: '단가',
      thAmt: '금액',
      totalQty: '총 수량',
      totalAmt: '발주 합계 (VAT 별도)',
      notesTitle: '납품 안내',
      notesBody:
        '· 납기일: ' +
        deliveryDate +
        ' (변경 시 사전 협의)<br>' +
        '· 납품 시 발주번호(' +
        orderNumberSafe +
        ')를 송장·포장 라벨에 기재해 주세요.<br>' +
        '· 수량·규격 상이 시 입고 전 연락 부탁드립니다. 단가는 부가세 별도 기준입니다.'
    };

    return (
      '<!DOCTYPE html>' +
      '<html lang="ko">' +
      '<head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>' +
      L.title +
      '</title>' +
      '<style>' +
      _moPdfSharedStyles_() +
      '</style>' +
      _moPdfOrderBarcodeOnloadScript_(orderNumber) +
      '</head>' +
      '<body>' +
      '<div class="top-stripe"></div>' +
      '<div class="no-print" style="font-size:12px;color:#64748b;">' +
      L.printHint +
      '</div>' +
      '<div class="letterhead">' +
      '<div class="issuer">' +
      '<div class="brand">' +
      '미래SMT' +
      '</div>' +
      '<div class="sub">' +
      L.brandSub +
      '</div>' +
      '</div>' +
      '<div class="doc-title">' +
      '<div class="en">' +
      L.docEn +
      '</div>' +
      '<h1>' +
      L.docTitle +
      '</h1>' +
      '<div class="po-barcode-wrap"><svg id="poOrderBarcode" class="po-order-barcode" role="img" aria-label="' +
      orderNumberSafe +
      '"></svg></div>' +
      '</div>' +
      '</div>' +
      '<div class="party-grid">' +
      '<div class="party-box">' +
      '<div class="label">' +
      L.fromLabel +
      '</div>' +
      '<div class="name">' +
      '미래SMT' +
      '</div>' +
      '<div class="meta">' +
      L.fromMeta +
      '</div>' +
      '</div>' +
      '<div class="party-box to">' +
      '<div class="label">' +
      L.toLabel +
      '</div>' +
      '<div class="name">' +
      supplier +
      '</div>' +
      '<div class="meta">' +
      L.toMeta +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="meta-bar">' +
      '<div class="cell"><strong>' +
      L.metaPo +
      '</strong>' +
      orderNumberSafe +
      '</div>' +
      '<div class="cell"><strong>' +
      L.metaOrderDate +
      '</strong>' +
      orderDate +
      '</div>' +
      '<div class="cell"><strong>' +
      L.metaDelivery +
      '</strong>' +
      deliveryDate +
      '</div>' +
      '<div class="cell"><strong>' +
      L.metaLines +
      '</strong>' +
      L.metaLinesVal +
      '</div>' +
      '</div>' +
      '<table class="items">' +
      '<thead><tr>' +
      '<th class="c-no">' +
      L.thNo +
      '</th>' +
      '<th class="c-code">' +
      L.thCode +
      '</th>' +
      '<th>' +
      L.thName +
      '</th>' +
      '<th>' +
      L.thSpec +
      '</th>' +
      '<th class="c-part">' +
      L.thPart +
      '</th>' +
      '<th class="num">' +
      L.thQty +
      '</th>' +
      '<th class="num">' +
      L.thUnit +
      '</th>' +
      '<th class="num">' +
      L.thAmt +
      '</th>' +
      '</tr></thead>' +
      '<tbody>' +
      tableRows +
      '</tbody>' +
      '</table>' +
      '<div class="totals-wrap">' +
      '<div class="totals">' +
      '<div class="row"><span>' +
      L.totalQty +
      '</span><span class="val">' +
      fmtQty(totalQuantity) +
      '</span></div>' +
      '<div class="row"><span>' +
      L.totalAmt +
      '</span><span class="val">' +
      _moPdfMoneyHtml_(totalAmount) +
      '</span></div>' +
      '</div>' +
      '</div>' +
      '<div class="notes">' +
      '<strong>' +
      L.notesTitle +
      '</strong><br>' +
      L.notesBody +
      '</div>' +
      '</body></html>'
    );
  }

  function generateMaterialOrderPDF(orderNumber) {
    Logger.log('=== generateMaterialOrderPDF 함수 시작 ===');
    Logger.log('발주번호: ' + orderNumber);
    Logger.log('발주번호 타입: ' + typeof orderNumber);
    
    try {
      
      if (!orderNumber) {
        Logger.log('발주번호가 없습니다.');
        return HtmlService.createHtmlOutput('<html><body><h1>오류</h1><p>발주번호가 필요합니다.</p></body></html>');
      }
      
      var materialOrders = [];
      try {
        materialOrders = getMaterialOrders();
        Logger.log('전체 발주 수: ' + materialOrders.length);
      } catch (err) {
        Logger.log('getMaterialOrders 오류: ' + err.toString());
        return HtmlService.createHtmlOutput('<html><body><h1>오류</h1><p>발주 데이터를 가져오는 중 오류가 발생했습니다: ' + err.toString() + '</p></body></html>');
      }
      
      var orders = [];
      for (var j = 0; j < materialOrders.length; j++) {
        var o = materialOrders[j];
        if (o && o.orderNumber && o.orderNumber.toString() === orderNumber.toString()) {
          orders.push(o);
        }
      }
      
      Logger.log('필터링된 발주 수: ' + orders.length);
      
      if (orders.length === 0) {
        Logger.log('발주번호를 찾을 수 없습니다: ' + orderNumber);
        return HtmlService.createHtmlOutput('<html><body><h1>오류</h1><p>발주번호 "' + orderNumber + '"를 찾을 수 없습니다.</p></body></html>');
      }
      
      var firstOrder = orders[0];
      var totalQuantity = 0;
      var totalAmount = 0;
      
      for (var k = 0; k < orders.length; k++) {
        totalQuantity += (orders[k].quantity || 0);
        totalAmount += (orders[k].orderAmount || 0);
      }
      
      var htmlContent = _buildMaterialOrderSupplierPdfHtml_(orderNumber, orders, firstOrder, totalQuantity, totalAmount);
      
      Logger.log('HTML 생성 완료, 길이: ' + htmlContent.length);
      Logger.log('HTML 처음 200자: ' + htmlContent.substring(0, 200));
      
      Logger.log('HtmlOutput 생성 시작');
      var htmlOutput = HtmlService.createHtmlOutput(htmlContent);
      htmlOutput.setTitle('자재 발주서 - ' + orderNumber);
      htmlOutput.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      
      Logger.log('HtmlOutput 생성 완료');
      Logger.log('=== generateMaterialOrderPDF 함수 종료 ===');
      
      return htmlOutput;
    } catch (error) {
      Logger.log('자재 발주 PDF 생성 오류: ' + error.toString());
      Logger.log('스택 트레이스: ' + (error.stack || '없음'));
      var errorHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>PDF 생성 오류</title></head><body><h1>PDF 생성 오류</h1><p>' + (error.toString() || '알 수 없는 오류') + '</p><p>스택: ' + (error.stack || '없음') + '</p></body></html>';
      return HtmlService.createHtmlOutput(errorHtml)
        .setTitle('PDF 생성 오류')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
  }

  // ==================== 자재 재고 관련 함수 ====================

  /**
   * 자재등록 시트의 재고수량 열에 수량 가산 (레거시 API 호환: 예전 자재직접재고 시트 append 대체)
   * @return {boolean} 매칭 행이 없으면 false
   */
  function addDirectMaterialStock(materialCode, materialName, specification, quantity) {
    try {
      var ok = _upsertMaterialDirectStock_(materialCode, materialName, specification, quantity, 'add');
      if (ok) invalidateMaterialInventoryCache_();
      return ok;
    } catch (error) {
      Logger.log('자재 직접재고 가산 오류: ' + error.toString());
      throw error;
    }
  }

  var MATERIAL_INV_CACHE_TTL_SEC = 45;
  var MATERIAL_INV_CACHE_SCRIPT_KEY = 'ERP_MAT_INV_V1';
  var __materialInvCache_ = null;

  function invalidateMaterialInventoryCache_() {
    __materialInvCache_ = null;
    try {
      CacheService.getScriptCache().remove(MATERIAL_INV_CACHE_SCRIPT_KEY);
    } catch (eInv) {}
  }

  /**
   * 자재 재고 현황 가져오기
   * 입고 수량 - 출고 수량 + 자재직접재고 = 현재 재고량
   */
  function _loadMaterialInventoryRaw_() {
      const sheet = getMaterialOrderSheet();
      const ix = _getMaterialOrderColumnIndices_(sheet);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      var registerMaps = _buildMaterialRegisterLookupMaps_(getMaterials() || []);
      const inventoryMap = {};
      
      for (var i = 1; i < values.length; i++) {
        const row = values[i] || [];
        const materialName = String(_moCell_(row, ix, 'materialName')).trim();
        const specification = String(_moCell_(row, ix, 'spec')).trim();
        if (!materialName) continue;
        let detailInfo = _moMergeDetailFromRow_(row, ix);
        var colMc = ix.materialCode >= 0 ? String(row[ix.materialCode] != null ? row[ix.materialCode] : '').trim() : '';
        var codeFromJson = detailInfo.materialCode != null ? String(detailInfo.materialCode).trim() : '';
        var idn = _resolveMaterialStockIdentity_(registerMaps, colMc || codeFromJson, materialName, specification);
        var bucket = _materialStockBucket_(inventoryMap, idn.customer, idn.materialCode, idn.materialName, idn.specification);
        if (detailInfo.lots && Array.isArray(detailInfo.lots)) {
          detailInfo.lots.forEach(function(lot) {
            if (lot.quantity) {
              bucket.inboundQuantity += (typeof lot.quantity === 'number' ? lot.quantity : parseFloat(lot.quantity) || 0);
            }
          });
        }
      }
      
      // 자재 출고 시트에서 출고 수량 계산 (출고 시트가 있는 경우)
      try {
        const outboundSheet = getSpreadsheet().getSheetByName('자재출고');
        if (outboundSheet) {
          const outboundDataRange = outboundSheet.getDataRange();
          const outboundValues = outboundDataRange.getValues();
          var outboundHeader = outboundValues.length > 0 ? outboundValues[0] : [];
          var outboundMap = _materialOutboundHeaderIndexMap_(outboundHeader);
          for (var j = 1; j < outboundValues.length; j++) {
            var orow = outboundValues[j] || [];
            const outboundMaterialCode = outboundMap.materialCode >= 0 && orow[outboundMap.materialCode] != null ? String(orow[outboundMap.materialCode]).trim() : '';
            const outboundMaterialName = outboundMap.materialName >= 0 && orow[outboundMap.materialName] != null ? String(orow[outboundMap.materialName]).trim() : '';
            const outboundSpecification = outboundMap.specification >= 0 && orow[outboundMap.specification] != null ? String(orow[outboundMap.specification]).trim() : '';
            var oqRaw = outboundMap.quantity >= 0 ? orow[outboundMap.quantity] : '';
            const outboundQuantity = oqRaw ? (typeof oqRaw === 'number' ? oqRaw : parseFloat(oqRaw) || 0) : 0;
            if (!outboundMaterialName && !outboundMaterialCode) continue;
            var oidn = _resolveMaterialStockIdentity_(registerMaps, outboundMaterialCode, outboundMaterialName, outboundSpecification);
            var obucket = _materialStockBucket_(inventoryMap, oidn.customer, oidn.materialCode, oidn.materialName, oidn.specification);
            obucket.outboundQuantity += outboundQuantity;
          }
        }
      } catch (e) {
        Logger.log('자재 출고 시트 조회 오류 (없을 수 있음): ' + e.toString());
      }
      
      // 자재직접재고 시트 합산
      try {
        var directStocks = _loadMaterialDirectStockEntries_();
        for (var k = 0; k < directStocks.length; k++) {
          var ds = directStocks[k] || {};
          var directMaterialName = String(ds.materialName || '').trim();
          var directSpecification = String(ds.specification || '').trim();
          var directMaterialCode = String(ds.materialCode || '').trim();
          var directQuantity = Number(ds.directStock) || 0;
          if (!directMaterialName) continue;
          var didn = _resolveMaterialStockIdentity_(registerMaps, directMaterialCode, directMaterialName, directSpecification);
          var dbucket = _materialStockBucket_(inventoryMap, didn.customer, didn.materialCode, didn.materialName, didn.specification);
          dbucket.directStock = (dbucket.directStock || 0) + directQuantity;
        }
      } catch (e) {
        Logger.log('자재직접재고 조회 오류 (없을 수 있음): ' + e.toString());
      }
      
      // 재고 현황 배열 생성
      const inventory = [];
      for (var key in inventoryMap) {
        const item = inventoryMap[key];
        const directStock = item.directStock || 0;
        const currentStock = (item.inboundQuantity || 0) - (item.outboundQuantity || 0) + directStock;
        
        inventory.push({
          stockKey: item.stockKey || key,
          customer: item.customer || '',
          materialCode: item.materialCode || '',
          materialName: item.materialName,
          specification: item.specification,
          inboundQuantity: item.inboundQuantity || 0,
          outboundQuantity: item.outboundQuantity || 0,
          directStock: directStock,
          currentStockRaw: currentStock,
          currentStock: currentStock >= 0 ? currentStock : 0
        });
      }
      
      inventory.sort(function(a, b) {
        var ca = (a.customer || '').toLowerCase();
        var cb = (b.customer || '').toLowerCase();
        if (ca !== cb) return ca < cb ? -1 : 1;
        var cda = (a.materialCode || '').toLowerCase();
        var cdb = (b.materialCode || '').toLowerCase();
        if (cda !== cdb) return cda < cdb ? -1 : 1;
        const nameA = (a.materialName || '').toLowerCase();
        const nameB = (b.materialName || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });
      
      return inventory;
  }

  function getMaterialInventory() {
    try {
      if (
        __materialInvCache_ &&
        __materialInvCache_.list &&
        Date.now() - __materialInvCache_.loadedAt < MATERIAL_INV_CACHE_TTL_SEC * 1000
      ) {
        return __materialInvCache_.list;
      }
      try {
        var cached = CacheService.getScriptCache().get(MATERIAL_INV_CACHE_SCRIPT_KEY);
        if (cached) {
          var parsed = JSON.parse(cached);
          if (parsed && parsed.list) {
            parsed.loadedAt = Date.now();
            __materialInvCache_ = parsed;
            return parsed.list;
          }
        }
      } catch (eCache) {}
      var list = _loadMaterialInventoryRaw_();
      __materialInvCache_ = { list: list, loadedAt: Date.now() };
      try {
        var json = JSON.stringify({ list: list });
        if (json.length <= 95000) {
          CacheService.getScriptCache().put(MATERIAL_INV_CACHE_SCRIPT_KEY, json, MATERIAL_INV_CACHE_TTL_SEC);
        }
      } catch (ePut) {}
      return list;
    } catch (error) {
      Logger.log('자재 재고 현황 가져오기 오류: ' + error.toString());
      throw error;
    }
  }

  /**
   * 자재 재고 화면용: 자재등록 시트 품목 중 품목구분 0(원재료)만 + 시트 재고 매칭
   * 재고 키는 getMaterialInventory()와 동일하게 자재명|규격(SIZE_DES) 문자열로 매칭합니다.
   * @return {{ok:boolean, rows?:Array, error?:string, zone?:string, count?:number}}
   */
  function getMaterialInventoryForEcountRawMaterials() {
    try {
      var prodRes = apiGetEcountProductsForMaster({ PROD_TYPE: '0' });
      if (!prodRes || !prodRes.ok) {
        return {
          ok: false,
          error: (prodRes && prodRes.error) ? prodRes.error : '품목 조회 실패',
          rows: []
        };
      }
      var products = prodRes.products || [];
      products = products.filter(function (p) {
        if (!p) return false;
        var t = p.PROD_TYPE;
        if (t === undefined || t === null || t === '') return false;
        return String(t).trim() === '0';
      });

      var invList = getMaterialInventory();
      var invMap = {};
      for (var i = 0; i < invList.length; i++) {
        var it = invList[i];
        var nk = (it.materialName || '').toString().trim() + '|' + (it.specification || '').toString().trim();
        invMap[nk] = it;
      }

      var rows = [];
      for (var j = 0; j < products.length; j++) {
        var p = products[j];
        var name = (p.PROD_DES !== undefined && p.PROD_DES !== null) ? String(p.PROD_DES).trim() : '';
        var spec = (p.SIZE_DES !== undefined && p.SIZE_DES !== null) ? String(p.SIZE_DES).trim() : '';
        var key = name + '|' + spec;
        var st = invMap[key];
        rows.push({
          prodCd: p.PROD_CD !== undefined && p.PROD_CD !== null ? String(p.PROD_CD).trim() : '',
          prodDes: name,
          sizeDes: spec,
          prodType: p.PROD_TYPE,
          inboundQuantity: st ? (st.inboundQuantity || 0) : 0,
          outboundQuantity: st ? (st.outboundQuantity || 0) : 0,
          directStock: st ? (st.directStock || 0) : 0,
          currentStock: st ? (st.currentStock || 0) : 0
        });
      }
      rows.sort(function (a, b) {
        return (a.prodCd || '').localeCompare(b.prodCd || '', undefined, { numeric: true });
      });
      return {
        ok: true,
        rows: rows,
        count: rows.length,
        zone: prodRes.zone || ''
      };
    } catch (err) {
      Logger.log('getMaterialInventoryForEcountRawMaterials 오류: ' + err.toString());
      return {
        ok: false,
        error: err.message || String(err),
        rows: []
      };
    }
  }

  /**
   * 자재 재고 화면용: 자재등록 시트의 자재만 + 입고·출고·자재등록 재고수량(getMaterialInventory) 매칭
   * 키는 자재명|규격 (이카운트 연동 없이 동작)
   * @return {{ok:boolean, rows?:Array, error?:string, zone?:string, count?:number}}
   */
  function getMaterialInventoryForRegisteredMaterials() {
    try {
      var sheet = getMaterialRegisterSheet();
      var lastRow = sheet.getLastRow();
      var lastCol = Math.max(sheet.getLastColumn(), 7);
      if (lastRow < 2) {
        return { ok: true, rows: [], count: 0, zone: '' };
      }

      var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
      var ix = _materialRegisterInventoryColumnIndices_(headerRow);
      var partNoCol = _findHeaderIndexByNames_(headerRow, ['Part No.', 'Part No', 'PART NO', 'P/N', 'PN']);
      var processCol = _findHeaderIndexByNames_(headerRow, ['공정', '공정구분', 'Process']);
      if (processCol < 0) {
        processCol = _findHeaderIndexByNames_(headerRow, ['출고', '출고부서', '출고부서번호', '부서번호']);
      }

      var dataRng = sheet.getRange(2, 1, lastRow, lastCol);
      var rawVals = dataRng.getValues();
      var rawDisp = rawVals;
      try {
        rawDisp = dataRng.getDisplayValues();
      } catch (eDisp) {
        rawDisp = rawVals;
      }
      var rawRich = [];
      try {
        rawRich = dataRng.getRichTextValues();
      } catch (eRich) {
        rawRich = [];
      }

      var invList = getMaterialInventory();
      var invMap = {};
      for (var i = 0; i < invList.length; i++) {
        var it = invList[i] || {};
        var sk = it.stockKey || _materialStockKey_(it.customer, it.materialCode, it.materialName, it.specification);
        invMap[sk] = it;
        var legacy = (it.materialName || '').toString().trim() + '|' + (it.specification || '').toString().trim();
        if (!invMap[legacy]) invMap[legacy] = it;
      }
      var pendingMap = _mrpBuildPendingInboundMap_();
      var mats = getMaterials() || [];
      var matById = {};
      for (var mxi = 0; mxi < mats.length; mxi++) {
        var mm = mats[mxi];
        if (mm && mm.id != null) matById[Number(mm.id)] = mm;
      }

      var rows = [];
      for (var r = 0; r < rawVals.length; r++) {
        var regId = r + 1;
        var mat = matById[regId] || null;
        var customer = mat
          ? String(mat.customer || '').trim()
          : _materialRegisterSheetPickCell_(rawVals, rawDisp, rawRich, r, ix.customerCol);
        var name = mat
          ? String(mat.materialName || '').trim()
          : _materialRegisterSheetPickCell_(rawVals, rawDisp, rawRich, r, ix.nameCol);
        if (!name) continue;
        var spec = mat
          ? String(mat.specification || '').trim()
          : _materialRegisterSheetPickCell_(rawVals, rawDisp, rawRich, r, ix.specCol);
        var mpnCol = _materialRegisterMpnColumnIndex_(headerRow);
        var mpnVal = mat ? String(_materialMpn_(mat) || '').trim() : '';
        if (!mpnVal && mpnCol >= 0) {
          mpnVal = _materialRegisterSheetPickCell_(rawVals, rawDisp, rawRich, r, mpnCol);
        }
        if (!mpnVal) {
          mpnVal = _parseMaterialRegisterMpnFromRow_(headerRow, rawVals[r] || []);
        }
        var spnVal = mat ? String(_materialSpn_(mat) || '').trim() : '';
        var partNo = spnVal;
        if (!partNo) {
          partNo = _materialRegisterSheetPickCell_(rawVals, rawDisp, rawRich, r, partNoCol);
        }
        var process = mat
          ? _normalizeMaterialProcess_(mat.process || mat.form || mat.outboundDept)
          : '';
        if (!process && processCol >= 0) {
          process = _normalizeMaterialProcess_(
            _materialRegisterSheetPickCell_(rawVals, rawDisp, rawRich, r, processCol)
          );
        }
        var code = mat ? String(mat.materialCode || '').trim() : '';
        if (!code) {
          code = _materialRegisterResolveRowCode_(rawVals, rawDisp, rawRich, r, ix.codeCol, ix.nameCol, ix.specCol, name, spec);
        }
        var sk = _materialStockKey_(customer, code, name, spec);
        var st = invMap[sk] || invMap[name + '|' + spec] || invMap[name + '|'];
        var cur = st ? Number(st.currentStock) || 0 : 0;
        var pend = _mrpRound_(pendingMap[_mrpMaterialKey_(name, spec)] || 0);
        rows.push({
          registerId: regId,
          customer: String(customer != null ? customer : ''),
          prodCd: String(code != null ? code : ''),
          prodDes: name,
          sizeDes: spec,
          partNo: partNo,
          mpn: mpnVal,
          spn: spnVal || partNo,
          spn1: spnVal || partNo,
          mpn1: spnVal || partNo,
          prodType: '0',
          inboundQuantity: st ? (st.inboundQuantity || 0) : 0,
          outboundQuantity: st ? (st.outboundQuantity || 0) : 0,
          directStock: st ? (st.directStock || 0) : 0,
          currentStock: cur,
          currentStockRaw: st && st.currentStockRaw != null ? st.currentStockRaw : cur,
          pendingInbound: pend,
          availableQty: _mrpRound_(cur + pend),
          process: process,
          outboundDept: process
        });
      }

      rows.sort(function (a, b) {
        return (a.prodCd || '').localeCompare(b.prodCd || '', undefined, { numeric: true });
      });
      return {
        ok: true,
        rows: rows,
        count: rows.length,
        zone: ''
      };
    } catch (err) {
      Logger.log('getMaterialInventoryForRegisteredMaterials 오류: ' + err.toString());
      return {
        ok: false,
        error: err.message || String(err),
        rows: []
      };
    }
  }

/**
 * 주문현황 — SMT·후공정·납품 직접 진행 수량 저장 (주문직접진행 시트)
 */
function setOrderDirectProgress(payload) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) {
    return { ok: false, error: '다른 저장 처리 중입니다. 잠시 후 다시 시도하세요.' };
  }
  try {
    payload = payload && typeof payload === 'object' ? payload : {};
    var rowKey = String(payload.rowKey || '').trim();
    if (!rowKey) return { ok: false, error: '행 정보가 없습니다.' };
    var ord = _findOrderLineByDashboardRowKey_(rowKey);
    if (!ord) return { ok: false, error: '주문 행을 찾을 수 없습니다.' };

    if (payload.revertToProduction === true) {
      _deleteOrderDirectProgress_(rowKey);
      invalidateOrderDirectProgressCaches_();
      var maps0 = _getCachedProductionMaps_();
      var qtyMap0 = _smtFilterQtyMapForSmtLines_(maps0.qtyMap || {});
      var smtByLabel0 = maps0.smtByLabel || _dashboardSmtCountsByOrderLabel_(qtyMap0);
      return {
        ok: true,
        reverted: true,
        row: _orderDashboardRowFromOrder_(
          ord,
          qtyMap0,
          maps0.postCounts || {},
          maps0.shipMap || {},
          smtByLabel0,
          _dashboardBaseOrders_()
        )
      };
    }

    var tgt = Math.max(0, Math.floor(Number(ord.quantity) || 0));
    var smtQty = _parseOrderDirectProgressQty_(payload.smtQty);
    var postQty = _parseOrderDirectProgressQty_(payload.postQty);
    var shipQty = _parseOrderDirectProgressQty_(payload.shipQty);
    if (smtQty == null || postQty == null || shipQty == null) {
      return { ok: false, error: 'SMT·후공정·납품 수량을 모두 입력하세요.' };
    }
    if (tgt > 0) {
      if (smtQty > tgt) smtQty = tgt;
      if (postQty > tgt) postQty = tgt;
      if (shipQty > tgt) shipQty = tgt;
    }

    _upsertOrderDirectProgress_(rowKey, ord, smtQty, postQty, shipQty);
    invalidateOrderDirectProgressCaches_();

    var maps = _getCachedProductionMaps_();
    var qtyMap = _smtFilterQtyMapForSmtLines_(maps.qtyMap || {});
    var smtByLabel = maps.smtByLabel || _dashboardSmtCountsByOrderLabel_(qtyMap);
    return {
      ok: true,
      row: _orderDashboardRowFromOrder_(
        ord,
        qtyMap,
        maps.postCounts || {},
        maps.shipMap || {},
        smtByLabel,
        _dashboardBaseOrders_()
      )
    };
  } catch (err) {
    Logger.log('setOrderDirectProgress 오류: ' + err.toString());
    return { ok: false, error: err.message || String(err) };
  } finally {
    try {
      lock.releaseLock();
    } catch (rel) {}
  }
}

function getOrderDirectProgressDetail(rowKey) {
  try {
    rowKey = String(rowKey || '').trim();
    if (!rowKey) return { ok: false, error: '행 정보가 없습니다.' };
    var ord = _findOrderLineByDashboardRowKey_(rowKey);
    if (!ord) return { ok: false, error: '주문 행을 찾을 수 없습니다.' };
    var maps = _getCachedProductionMaps_();
    var qtyMap = _smtFilterQtyMapForSmtLines_(maps.qtyMap || {});
    var smtByLabel = maps.smtByLabel || _dashboardSmtCountsByOrderLabel_(qtyMap);
    return {
      ok: true,
      row: _orderDashboardRowFromOrder_(
        ord,
        qtyMap,
        maps.postCounts || {},
        maps.shipMap || {},
        smtByLabel,
        _dashboardBaseOrders_()
      )
    };
  } catch (err) {
    Logger.log('getOrderDirectProgressDetail 오류: ' + err.toString());
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * 자재 재고 화면 — 직접재고(자재직접재고 시트)만 수정
 * @param {number|string} registerId 자재등록 시트 행 id
 * @param {number|string} stockQuantity 새 직접재고 수량
 * @return {{ok:boolean, registerId?:number, directStock?:number, currentStock?:number, error?:string}}
 */
function setMaterialDirectStock(registerId, stockQuantity) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) {
    return { ok: false, error: '다른 저장 처리 중입니다. 잠시 후 다시 시도하세요.' };
  }
  try {
    var id = parseInt(registerId, 10);
    if (isNaN(id) || id < 1) {
      return { ok: false, error: '유효하지 않은 품목입니다.' };
    }
    var qty =
      stockQuantity != null && stockQuantity !== ''
        ? typeof stockQuantity === 'number'
          ? stockQuantity
          : parseFloat(String(stockQuantity).replace(/,/g, ''))
        : 0;
    if (isNaN(qty)) qty = 0;
    qty = Math.max(0, qty);

    var mats = getMaterials() || [];
    var mat = null;
    for (var mi = 0; mi < mats.length; mi++) {
      if (mats[mi] && Number(mats[mi].id) === id) {
        mat = mats[mi];
        break;
      }
    }
    if (!mat) {
      return { ok: false, error: '자재등록 시트에서 해당 행을 찾을 수 없습니다.' };
    }
    var name = String(mat.materialName || '').trim();
    if (!name) {
      return { ok: false, error: '해당 행에 자재명이 없습니다.' };
    }
    var spec = String(mat.specification || '').trim();
    var code = String(mat.materialCode || '').trim();
    var customer = String(mat.customer || '').trim();
    if (!_upsertMaterialDirectStock_(code, name, spec, qty, 'set')) {
      return { ok: false, error: '직접재고 저장에 실패했습니다.' };
    }
    invalidateMaterialInventoryCache_();

    var invList = getMaterialInventory();
    var sk = _materialStockKey_(customer, code, name, spec);
    var st = null;
    var ii;
    for (ii = 0; ii < invList.length; ii++) {
      var it = invList[ii];
      var itk =
        it.stockKey || _materialStockKey_(it.customer, it.materialCode, it.materialName, it.specification);
      if (itk === sk) {
        st = it;
        break;
      }
      var k = (it.materialName || '').toString().trim() + '|' + (it.specification || '').toString().trim();
      if (k === name + '|' + spec || k === name + '|') {
        st = it;
        break;
      }
    }
    var inbound = st ? Number(st.inboundQuantity) || 0 : 0;
    var outbound = st ? Number(st.outboundQuantity) || 0 : 0;
    var current = inbound - outbound + qty;

    return {
      ok: true,
      registerId: id,
      directStock: qty,
      currentStock: current,
      inboundQuantity: inbound,
      outboundQuantity: outbound
    };
  } catch (err) {
    Logger.log('setMaterialDirectStock 오류: ' + err.toString());
    return { ok: false, error: err.message || String(err) };
  } finally {
    try {
      lock.releaseLock();
    } catch (rel) {}
  }
}

  /** 자재등록 시트 표준 헤더 (신규 시트 생성용 · 공급사코드/MS_ 미사용) */
  var MATERIAL_REGISTER_CANONICAL_HEADERS_ = [
    '고객사',
    '자재명',
    '규격',
    '공정',
    'CPN',
    'MPN',
    'MPN2',
    'SPN',
    'SPN2',
    '공급업체',
    '도급/사급',
    'MOQ',
    '단가'
  ];

  var MATERIAL_DIRECT_STOCK_SHEET_NAME_ = '자재직접재고';

  function getMaterialDirectStockSheet() {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(MATERIAL_DIRECT_STOCK_SHEET_NAME_);
    if (!sheet) {
      sheet = ss.insertSheet(MATERIAL_DIRECT_STOCK_SHEET_NAME_);
      var headers = [['미래코드', '자재명', '규격', '직접재고']];
      sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
      sheet.getRange(1, 1, 1, headers[0].length).setFontWeight('bold');
      sheet.getRange(1, 1, 1, headers[0].length).setBackground('#f7fafc');
    }
    return sheet;
  }

  function _loadMaterialDirectStockEntries_() {
    var out = [];
    try {
      var ss = getSpreadsheet();
      var sheet = ss.getSheetByName(MATERIAL_DIRECT_STOCK_SHEET_NAME_);
      if (!sheet || sheet.getLastRow() < 2) return out;
      var hdr = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
      var codeIx = _findHeaderIndexByNames_(hdr, ['미래코드', '자재코드']);
      var nameIx = _findHeaderIndexByNames_(hdr, ['자재명']);
      var specIx = _findHeaderIndexByNames_(hdr, ['규격']);
      var qtyIx = _findHeaderIndexByNames_(hdr, ['직접재고', '재고수량']);
      if (nameIx < 0 || qtyIx < 0) return out;
      var vals = sheet.getRange(2, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
      for (var i = 0; i < vals.length; i++) {
        var row = vals[i] || [];
        var name = nameIx >= 0 ? String(row[nameIx] != null ? row[nameIx] : '').trim() : '';
        if (!name) continue;
        var spec = specIx >= 0 ? String(row[specIx] != null ? row[specIx] : '').trim() : '';
        var code = codeIx >= 0 ? String(row[codeIx] != null ? row[codeIx] : '').trim() : '';
        var qRaw = row[qtyIx];
        var qty =
          qRaw !== '' && qRaw != null ? (typeof qRaw === 'number' ? qRaw : parseFloat(String(qRaw).replace(/,/g, '')) || 0) : 0;
        out.push({ materialCode: code, materialName: name, specification: spec, directStock: qty });
      }
    } catch (eDs) {
      Logger.log('자재직접재고 조회 오류: ' + eDs.toString());
    }
    return out;
  }

  function _findMaterialDirectStockRowIndex_(sheet, materialCode, materialName, specification) {
    if (!sheet || sheet.getLastRow() < 2) return -1;
    var hdr = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
    var codeIx = _findHeaderIndexByNames_(hdr, ['미래코드', '자재코드']);
    var nameIx = _findHeaderIndexByNames_(hdr, ['자재명']);
    var specIx = _findHeaderIndexByNames_(hdr, ['규격']);
    if (nameIx < 0) return -1;
    var code = String(materialCode || '').trim();
    var name = String(materialName || '').trim();
    var spec = String(specification || '').trim();
    var vals = sheet.getRange(2, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
    for (var i = 0; i < vals.length; i++) {
      var row = vals[i] || [];
      var rcode = codeIx >= 0 ? String(row[codeIx] != null ? row[codeIx] : '').trim() : '';
      var rname = String(row[nameIx] != null ? row[nameIx] : '').trim();
      var rspec = specIx >= 0 ? String(row[specIx] != null ? row[specIx] : '').trim() : '';
      if (code && rcode && rcode === code) return i + 2;
      if (name && rname === name && rspec === spec) return i + 2;
    }
    return -1;
  }

  /** @param {'set'|'add'} mode */
  function _upsertMaterialDirectStock_(materialCode, materialName, specification, quantity, mode) {
    var sheet = getMaterialDirectStockSheet();
    var name = String(materialName || '').trim();
    if (!name) return false;
    var spec = String(specification || '').trim();
    var code = String(materialCode || '').trim();
    var add =
      quantity != null && quantity !== ''
        ? typeof quantity === 'number'
          ? quantity
          : parseFloat(String(quantity).replace(/,/g, '')) || 0
        : 0;
    if (isNaN(add)) add = 0;
    var rowNum = _findMaterialDirectStockRowIndex_(sheet, code, name, spec);
    var qtyCol = _findHeaderIndexByNames_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [], [
      '직접재고',
      '재고수량'
    ]);
    if (qtyCol < 0) qtyCol = 3;
    if (rowNum >= 2) {
      var cur = sheet.getRange(rowNum, qtyCol + 1).getValue();
      var curN = cur !== '' && cur != null ? (typeof cur === 'number' ? cur : parseFloat(String(cur).replace(/,/g, '')) || 0) : 0;
      var next = mode === 'add' ? curN + add : Math.max(0, add);
      sheet.getRange(rowNum, qtyCol + 1).setValue(next);
      if (code) {
        var codeCol = _findHeaderIndexByNames_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [], [
          '미래코드',
          '자재코드'
        ]);
        if (codeCol >= 0) sheet.getRange(rowNum, codeCol + 1).setValue(code);
      }
      return true;
    }
    sheet.appendRow([code, name, spec, mode === 'add' ? add : Math.max(0, add)]);
    return true;
  }

  function _parsedMaterialToMaterialData_(m) {
    if (!m) return {};
    return {
      customer: m.customer,
      materialCode: m.materialCode,
      vendorCode: m.vendorCode,
      materialName: m.materialName,
      specification: m.specification,
      partNo: m.partNo,
      mpn: m.mpn,
      mpn2: m.mpn2,
      spn: m.spn,
      spn2: m.spn2,
      supplier: m.supplier,
      supplyType: m.supplyType,
      moq: m.moq,
      basePrice: m.basePrice,
      outboundDept: m.outboundDept,
      process: m.process,
      form: m.form,
      marketPrice: m.marketPrice,
      note: m.note,
      supplierBarcode: m.supplierBarcode
    };
  }

  /** 자재명 열이 있으면 사용자 열 구성을 유지 (삭제·이름 변경해도 강제 복구 안 함) */
  function _materialRegisterHasRequiredHeaders_(headerRow) {
    return _findHeaderIndexByNames_(headerRow || [], ['자재명', '품목명']) >= 0;
  }

  function _materialRegisterHeadersAreCanonical_(headerRow) {
    var canonical = MATERIAL_REGISTER_CANONICAL_HEADERS_;
    if (!headerRow || headerRow.length !== canonical.length) return false;
    for (var i = 0; i < canonical.length; i++) {
      if (String(headerRow[i] || '').trim() !== canonical[i]) return false;
    }
    return true;
  }

  function _migrateRegisterStocksToDirectStockSheet_(materials) {
    if (!materials || !materials.length) return;
    for (var i = 0; i < materials.length; i++) {
      var m = materials[i] || {};
      var sq = m.stockQuantity;
      if (sq == null || sq === '') continue;
      var n = typeof sq === 'number' ? sq : parseFloat(String(sq).replace(/,/g, '')) || 0;
      if (!n) continue;
      _upsertMaterialDirectStock_(m.materialCode, m.materialName, m.specification, n, 'set');
    }
  }

  /** 자재등록 시트 선두 열이 표준 순서인지 */
  function _materialRegisterLeadingHeadersMatchCanonical_(headerRow) {
    var canonical = MATERIAL_REGISTER_CANONICAL_HEADERS_;
    if (!headerRow || headerRow.length < canonical.length) return false;
    for (var i = 0; i < canonical.length; i++) {
      if (String(headerRow[i] || '').trim() !== canonical[i]) return false;
    }
    return true;
  }

  /** 자재등록 시트 — 표준 헤더가 있으나 열 순서가 다를 때 재배열 (추가 열은 뒤에 유지) */
  function _ensureMaterialRegisterColumnOrder_(sheet) {
    if (!sheet) return;
    var canonical = MATERIAL_REGISTER_CANONICAL_HEADERS_;
    var lastRow = sheet.getLastRow();
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    if (lastRow < 1) return;
    var hr = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
    if (_materialRegisterLeadingHeadersMatchCanonical_(hr)) return;
    if (!_materialRegisterHasRequiredHeaders_(hr)) return;

    var missing = false;
    for (var ci = 0; ci < canonical.length; ci++) {
      if (_findHeaderIndexByNames_(hr, [canonical[ci]]) < 0) {
        missing = true;
        break;
      }
    }
    if (missing) return;

    var extraHeaders = [];
    var seenExtra = {};
    for (var ei = 0; ei < hr.length; ei++) {
      var eh = String(hr[ei] || '').trim();
      if (!eh || canonical.indexOf(eh) >= 0) continue;
      if (seenExtra[eh]) continue;
      seenExtra[eh] = true;
      extraHeaders.push(eh);
    }

    var materials = [];
    if (lastRow >= 2) {
      var vals = sheet.getRange(1, 1, lastRow, lastCol).getValues();
      for (var ri = 1; ri < vals.length; ri++) {
        var parsed = _parseMaterialRegisterRow_(hr, vals[ri] || [], ri);
        if (parsed) materials.push(parsed);
      }
    }

    var newHeaders = canonical.concat(extraHeaders);
    sheet.clear();
    sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
    sheet.getRange(1, 1, 1, newHeaders.length).setFontWeight('bold').setBackground('#f7fafc');
    if (!materials.length) return;

    var outRows = [];
    for (var mi = 0; mi < materials.length; mi++) {
      var md = _parsedMaterialToMaterialData_(materials[mi]);
      if (!String(md.mpn || '').trim() && String(md.partNo || '').trim()) {
        md.mpn = String(md.partNo).trim();
      }
      if (!String(md.spn || '').trim()) {
        if (String(md.spn1 || '').trim()) md.spn = String(md.spn1).trim();
        else if (String(md.spn2 || '').trim()) md.spn = String(md.spn2).trim();
      }
      md.partNo = md.mpn || md.partNo || '';
      md.spn1 = md.spn || '';
      outRows.push(_materialDataToSheetRowByHeader_(newHeaders, md));
    }
    sheet.getRange(2, 1, materials.length, newHeaders.length).setValues(outRows);
  }

  /** 자재등록 시트 — 자재명 열이 없을 때만 표준 헤더로 초기화 (기존 시트는 열 구성 유지) */
  function _ensureMaterialRegisterCanonicalLayout_(sheet) {
    if (!sheet) return;
    var lastRow = sheet.getLastRow();
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var hr = lastRow >= 1 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [] : [];
    if (_materialRegisterHeadersAreCanonical_(hr)) return;
    if (_materialRegisterHasRequiredHeaders_(hr)) return;

    var materials = [];
    if (lastRow >= 2) {
      var vals = sheet.getRange(1, 1, lastRow, lastCol).getValues();
      hr = vals[0] || [];
      for (var i = 1; i < vals.length; i++) {
        var parsed = _parseMaterialRegisterRow_(hr, vals[i] || [], i);
        if (parsed) materials.push(parsed);
      }
    }
    _migrateRegisterStocksToDirectStockSheet_(materials);

    var canonical = MATERIAL_REGISTER_CANONICAL_HEADERS_;
    sheet.clear();
    sheet.getRange(1, 1, 1, canonical.length).setValues([canonical]);
    sheet.getRange(1, 1, 1, canonical.length).setFontWeight('bold').setBackground('#f7fafc');
    if (materials.length) {
      var outRows = [];
      for (var j = 0; j < materials.length; j++) {
        var md = _parsedMaterialToMaterialData_(materials[j]);
        if (!String(md.mpn || '').trim() && String(md.partNo || '').trim()) {
          md.mpn = String(md.partNo).trim();
        }
        if (!String(md.spn || '').trim()) {
          if (String(md.spn1 || '').trim()) md.spn = String(md.spn1).trim();
          else if (String(md.mpn1 || '').trim()) md.spn = String(md.mpn1).trim();
          else if (String(md.spn2 || '').trim()) md.spn = String(md.spn2).trim();
          else if (String(md.mpn2 || '').trim()) md.spn = String(md.mpn2).trim();
          else if (String(md.spn3 || '').trim()) md.spn = String(md.spn3).trim();
          else if (String(md.vendorCode || '').trim()) md.spn = String(md.vendorCode).trim();
        }
        md.partNo = md.mpn || md.partNo || '';
        md.vendorCode = '';
        md.spn1 = md.spn || '';
        outRows.push(_materialDataToSheetRowByHeader_(canonical, md));
      }
      sheet.getRange(2, 1, materials.length, canonical.length).setValues(outRows);
    }
  }

  /**
   * 자재 등록 시트 가져오기
   */
  function getMaterialRegisterSheet() {
    try {
      const ss = getSpreadsheet();
      let sheet = ss.getSheetByName('자재등록');
      
      if (!sheet) {
        sheet = ss.insertSheet('자재등록');
        const headers = [MATERIAL_REGISTER_CANONICAL_HEADERS_];
        sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
        sheet.getRange(1, 1, 1, headers[0].length).setFontWeight('bold');
        sheet.getRange(1, 1, 1, headers[0].length).setBackground('#f7fafc');
      }

      try {
        _ensureMaterialRegisterCanonicalLayout_(sheet);
        _ensureMaterialRegisterMpnSpnHeaders_(sheet);
        _ensureMaterialRegisterColumnOrder_(sheet);
      } catch (eLayout) {
        Logger.log('자재등록 표준 레이아웃 보강 오류: ' + eLayout.toString());
      }

      return sheet;
    } catch (error) {
      Logger.log('자재 등록 시트 가져오기 오류: ' + error.toString());
      throw error;
    }
  }

  /**
   * 다음 미래코드 생성 (MS_00001 형식, 중복 없음)
   */
  function getNextMaterialCode() {
    try {
      var used = _buildMiraeCodeUsedSet_();
      var next = _allocateNextMiraeCode_(used);
      return next || _formatMiraeCodeFromNumber_(1);
    } catch (error) {
      Logger.log('미래코드 생성 오류: ' + error.toString());
      return _formatMiraeCodeFromNumber_(1);
    }
  }

  /**
   * 자재 목록 가져오기
   */
  /**
   * 자재 화면: 자재등록 시트 목록(UI용)
   * @return {{ok:boolean, count?:number, rows?:Array, error?:string}}
   */
  function getMaterialRegisterListForUi() {
    try {
      var mats = getMaterials() || [];
      var rows = [];
      for (var i = 0; i < mats.length; i++) {
        var m = mats[i] || {};
        rows.push({
          id: m.id != null ? Number(m.id) : i + 1,
          customer: String(m.customer || '').trim(),
          materialCode: String(m.materialCode || '').trim(),
          vendorCode: String(m.vendorCode || '').trim(),
          materialName: String(m.materialName || '').trim(),
          specification: String(m.specification || '').trim(),
          partNo: String(_materialMpn_(m) || '').trim(),
          mpn: String(_materialMpn_(m) || '').trim(),
          mpn2: String(m.mpn2 != null ? m.mpn2 : '').trim(),
          spn: String(m.spn != null ? m.spn : '').trim(),
          spn2: String(m.spn2 != null ? m.spn2 : '').trim(),
          spn1: String(m.spn != null ? m.spn : '').trim(),
          mpn1: '',
          form: String(m.form || m.process || '').trim(),
          process: _normalizeMaterialProcess_(m.process || m.form || m.outboundDept),
          supplyType: String(m.supplyType || '').trim(),
          outboundDept: _normalizeMaterialProcess_(m.process || m.form || m.outboundDept),
          supplier: String(m.supplier || '').trim(),
          moq: m.moq != null && m.moq !== '' ? Number(m.moq) || 0 : 0,
          basePrice: m.basePrice != null && m.basePrice !== '' ? Number(m.basePrice) || 0 : 0,
          marketPrice: m.marketPrice != null ? String(m.marketPrice).trim() : '',
          stockQuantity: m.stockQuantity != null && m.stockQuantity !== '' ? Number(m.stockQuantity) || 0 : 0
        });
      }
      rows.sort(function (a, b) {
        var ca = (a.materialCode || a.materialName || '').toLowerCase();
        var cb = (b.materialCode || b.materialName || '').toLowerCase();
        return ca.localeCompare(cb, 'ko', { numeric: true });
      });
      return { ok: true, count: rows.length, rows: rows };
    } catch (error) {
      Logger.log('getMaterialRegisterListForUi 오류: ' + error.toString());
      return { ok: false, error: error.message || String(error) };
    }
  }

  function getMaterials() {
    try {
      const sheet = getMaterialRegisterSheet();
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      if (values.length <= 1) {
        return [];
      }

      const headerRow = values[0] || [];
      const materials = [];

      for (var i = 1; i < values.length; i++) {
        var parsed = _parseMaterialRegisterRow_(headerRow, values[i] || [], i);
        if (parsed) materials.push(parsed);
      }

      return materials;
    } catch (error) {
      Logger.log('자재 목록 가져오기 오류: ' + error.toString());
      throw error;
    }
  }

  /** 바코드 필드값에서 구분자(|) 제거 */
  function _sanitizeMaterialBarcodeField_(value) {
    return String(value == null ? '' : value).trim().replace(/\|/g, ' ');
  }

  /** 고객 품번 CPN (자재등록 CPN 열) — MPN·미래코드·공급사코드와 혼동하지 않음 */
  function _materialCpn_(material) {
    return String((material || {}).materialCode != null ? material.materialCode : '').trim();
  }

  /** 제조사 품번 MPN (Octopart·시세) — SPN·공급사코드와 혼동하지 않음 */
  function _materialMpn_(material) {
    var m = material || {};
    var a = String(m.mpn != null ? m.mpn : '').trim();
    if (a) return a;
    a = String(m.partNo != null ? m.partNo : '').trim();
    if (a) return a;
    return '';
  }

  /** 공급사 품번 SPN (릴·발주서 바코드 스캔용) — 매칭용: SPN 열만 (없으면 빈 값, MPN과 혼용 안 함) */
  function _materialSpnForMatch_(material) {
    var m = material || {};
    var a = String(m.spn != null ? m.spn : '').trim();
    if (a) return a;
    a = String(m.spn1 != null ? m.spn1 : '').trim();
    if (a) return a;
    a = String(m.mpn1 != null ? m.mpn1 : '').trim();
    return a;
  }

  /** 공급사 품번 SPN (주 스캔값만, SPN2는 별도) */
  function _materialSpn_(material) {
    var m = material || {};
    var a = String(m.spn != null ? m.spn : '').trim();
    if (a) return a;
    a = String(m.spn1 != null ? m.spn1 : '').trim();
    if (a) return a;
    a = String(m.mpn1 != null ? m.mpn1 : '').trim();
    return a;
  }

  function _materialMpn2_(material) {
    return String((material || {}).mpn2 != null ? material.mpn2 : '').trim();
  }

  function _materialSpn2_(material) {
    return String((material || {}).spn2 != null ? material.spn2 : '').trim();
  }

  /** 자재 스캔용 코드 */
  function _materialScanCode_(material) {
    return _materialSpn_(material);
  }

  /** Part No.(MPN)|규격 형식의 바코드 payload (스캔·라벨용) */
  function buildMaterialBarcodePayload_(materialCode, vendorCode, specification) {
    var scan = _sanitizeMaterialBarcodeField_(vendorCode || materialCode);
    var parts = [];
    if (scan) parts.push(scan);
    var spec = _sanitizeMaterialBarcodeField_(specification);
    if (spec) parts.push(spec);
    return parts.join('|');
  }

  /** 스캔된 바코드 문자열 파싱 (구형: 미래코드만 인코딩된 라벨도 지원) */
  function _parseMaterialBarcodeScan_(barcode) {
    var raw = String(barcode == null ? '' : barcode).trim();
    if (!raw) {
      return { raw: '', materialCode: '', vendorCode: '', specification: '' };
    }
    if (raw.indexOf('|') < 0) {
      return { raw: raw, materialCode: '', vendorCode: raw, specification: '' };
    }
    var parts = raw.split('|');
    if (parts.length >= 3) {
      return {
        raw: raw,
        materialCode: String(parts[0] || '').trim(),
        vendorCode: String(parts[1] || '').trim(),
        specification: parts.slice(2).join('|').trim()
      };
    }
    return {
      raw: raw,
      materialCode: '',
      vendorCode: String(parts[0] || '').trim(),
      specification: parts.slice(1).join('|').trim()
    };
  }

  /**
   * 자재등록 시트 — 바코드 정확 일치만
   */
  function _findMaterialInRegisterByExactBarcode_(barcode) {
    var raw = String(barcode == null ? '' : barcode).trim();
    if (!raw) return null;
    var parsed = _parseMaterialBarcodeScan_(raw);
    var rawLower = parsed.raw.toLowerCase();
    var codeLower = parsed.materialCode.toLowerCase();
    var vendorLower = parsed.vendorCode.toLowerCase();
    var materials = getMaterials();
    var i;
    for (i = 0; i < materials.length; i++) {
      var m = materials[i] || {};
      var mirae = String(m.materialCode || '').trim().toLowerCase();
      if (mirae && (mirae === rawLower || (codeLower && mirae === codeLower))) return m;
      var vendor = String(m.vendorCode || '').trim().toLowerCase();
      if (vendor && (vendor === rawLower || (vendorLower && vendor === vendorLower))) return m;
      var mpn1 = String(_materialSpn_(m) || '').trim().toLowerCase();
      if (mpn1 && mpn1 === rawLower) return m;
      var mpn2 = String(_materialMpn2_(m) || '').trim().toLowerCase();
      if (mpn2 && mpn2 === rawLower) return m;
      var spn = String(_materialSpn_(m) || '').trim().toLowerCase();
      if (spn && spn === rawLower) return m;
      var spn2 = String(_materialSpn2_(m) || '').trim().toLowerCase();
      if (spn2 && spn2 === rawLower) return m;
      var mpn = String(_materialMpn_(m) || '').trim().toLowerCase();
      if (mpn && mpn === rawLower) return m;
      var partNo = String(m.partNo || '').trim().toLowerCase();
      if (partNo && partNo === rawLower) return m;
      var supBc = String(m.supplierBarcode || '').trim().toLowerCase();
      if (supBc && supBc === rawLower) return m;
    }
    return null;
  }

  function _normalizeBarcodeForMatch_(s) {
    return String(s == null ? '' : s)
      .trim()
      .toLowerCase()
      .replace(/[\s\-_./\\:;,\u0000-\u001f]+/g, '');
  }

  /** 형제 품번 구분용 — 비교할 꼬리(끝) 길이 */
  function _partCodeSuffixTailLen_(minLen) {
    if (minLen >= 18) return 6;
    if (minLen >= 14) return 5;
    if (minLen >= 10) return 4;
    return 3;
  }

  /** Levenshtein 유사 매칭 시 꼬리(용량값 등)가 같아야 함 */
  function _partCodeSuffixesMatch_(left, right) {
    var a = _normalizeBarcodeForMatch_(left);
    var b = _normalizeBarcodeForMatch_(right);
    if (!a || !b) return false;
    if (a === b) return true;
    var minLen = Math.min(a.length, b.length);
    var tail = _partCodeSuffixTailLen_(minLen);
    return a.slice(-tail) === b.slice(-tail);
  }

  /** 긴 쪽 끝이 짧은 쪽과 같으면 접두만 추가된 경우 (10PC + MPN) */
  function _isPrefixOnlyBarcodeInclusion_(left, right) {
    var a = _normalizeBarcodeForMatch_(left);
    var b = _normalizeBarcodeForMatch_(right);
    if (!a || !b) return false;
    if (a === b) return true;
    var short = a.length <= b.length ? a : b;
    var long = a.length > b.length ? a : b;
    if (short.length < 6) return false;
    return long.slice(long.length - short.length) === short;
  }

  /** 릴·발주 라벨 — 선행 접두(공급사마다 다름) 제거 후보 */
  function _stripReelBarcodePrefixVariants_(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return [];
    var out = [];
    var seen = {};
    function add(v) {
      var t = String(v == null ? '' : v).trim();
      if (!t || t.length < 4) return;
      var k = t.toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      out.push(t);
    }
    add(s);
    var cur = s;
    var i;
    var m;
    for (i = 0; i < 4; i++) {
      m = cur.match(/^(\d{1,8})([A-Za-z].+)$/);
      if (!m || !m[2]) break;
      add(m[2]);
      cur = m[2];
    }
    for (i = 0; i < 4; i++) {
      m = cur.match(/^(\d{1,5}P)(.+)$/i);
      if (!m || !m[2]) break;
      add(m[2]);
      cur = m[2];
    }
    var maxStrip = Math.min(20, Math.max(0, s.length - 8));
    for (i = 1; i <= maxStrip; i++) {
      add(s.slice(i));
    }
    return out;
  }

  /** 릴 라벨 — 품번 뒤 수량(예: WR06X000PTL 5000, WR06X000PTL5000) */
  function _stripReelBarcodeSuffixVariants_(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return [];
    var out = [];
    var seen = {};
    function add(v) {
      var t = String(v == null ? '' : v).trim();
      if (!t || t.length < 4) return;
      var k = t.toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      out.push(t);
    }
    add(s);
    var m = s.match(/^(.+?)[\s,;|/\\-]+(\d{2,8})$/);
    if (m && m[1]) add(m[1].trim());
    m = s.match(/^([A-Za-z][A-Za-z0-9\-_.]{5,})(\d{3,8})$/);
    if (m && m[1]) add(m[1]);
    return out;
  }

  function _escapeRegexPart_(s) {
    return String(s == null ? '' : s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** 스캔값이 등록 품번 + 수량 꼬리인지 (릴 라벨) */
  function _reelScanToPartCodeCore_(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return '';
    var m = s.match(/^(.+?)[\s,;|/\\-]+(\d{2,8})$/);
    if (m && m[1]) s = m[1].trim();
    return _normalizeBarcodeForMatch_(s);
  }

  function _partCodePlusQtyMatchScore_(scan, candidate) {
    var scanRaw = String(scan == null ? '' : scan).trim();
    var cand = String(candidate == null ? '' : candidate).trim();
    if (!scanRaw || !cand) return 0;
    var coreScan = _reelScanToPartCodeCore_(scanRaw);
    var coreCand = _reelScanToPartCodeCore_(cand);
    if (coreScan && coreCand && coreScan === coreCand) return 100;
    if (scanRaw.toLowerCase() === cand.toLowerCase()) return 100;
    try {
      var re = new RegExp('^' + _escapeRegexPart_(cand) + '[\\s,;|/\\\\-]+\\d{2,8}$', 'i');
      if (re.test(scanRaw)) return 100;
    } catch (eRe) {}
    var a = _normalizeBarcodeForMatch_(scanRaw);
    var b = _normalizeBarcodeForMatch_(cand);
    if (b.length >= 6 && a.length > b.length && a.indexOf(b) === 0) {
      var tail = a.slice(b.length);
      if (/^\d{2,8}$/.test(tail)) return 99;
    }
    return 0;
  }

  /** 스캔 문자열 안에 박힌 품번 형태 조각 추출 (접두사 규칙 하드코딩 없음) */
  function _extractEmbeddedPartTokens_(raw) {
    var s = String(raw == null ? '' : raw);
    if (!s) return [];
    var out = [];
    var seen = {};
    var patterns = [
      /[A-Za-z]{2}\d{3,}[A-Za-z0-9\-_.]{2,}/g,
      /[A-Za-z0-9]{8,}/g
    ];
    var pi;
    var m;
    for (pi = 0; pi < patterns.length; pi++) {
      var re = patterns[pi];
      while ((m = re.exec(s)) !== null) {
        var t = String(m[0] || '').trim();
        if (t.length < 6) continue;
        var k = t.toLowerCase();
        if (seen[k]) continue;
        seen[k] = true;
        out.push(t);
      }
    }
    return out;
  }

  /** 짧은 쪽이 긴 쪽 끝에 붙어 있을 때만 고득점 (접두 스캔). 중간 부분만 겹치면 제외 */
  function _embeddedBarcodeMatchScore_(left, right) {
    var a = _normalizeBarcodeForMatch_(left);
    var b = _normalizeBarcodeForMatch_(right);
    if (!a || !b) return 0;
    if (a === b) return 100;
    if (b.length >= 6 && a.length > b.length && a.indexOf(b) === 0 && /^\d{2,8}$/.test(a.slice(b.length))) {
      return 99;
    }
    if (!_isPrefixOnlyBarcodeInclusion_(a, b)) return 0;
    var short = a.length <= b.length ? a : b;
    var long = a.length > b.length ? a : b;
    var extra = long.length - short.length;
    var ratio = short.length / long.length;
    if (extra === 0) return 100;
    if (short.length >= 10 && ratio >= 0.3) return 97;
    if (short.length >= 8 && extra <= 24) return 98;
    if (short.length >= 8 && ratio >= 0.45) return 95;
    if (short.length >= 6 && extra <= 4 && ratio >= 0.65) return 88;
    return 0;
  }

  function _levenshteinDistance_(a, b) {
    var m = a.length;
    var n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    var dp = [];
    var i;
    var j;
    for (i = 0; i <= m; i++) {
      dp[i] = [i];
    }
    for (j = 0; j <= n; j++) {
      dp[0][j] = j;
    }
    for (i = 1; i <= m; i++) {
      for (j = 1; j <= n; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }

  /** 스캔값 vs 등록값 유사도 (0~100). 정확·릴수량·접두만 허용 (형제 품번 오매칭 방지) */
  function _barcodeSimilarityScore_(scan, candidate) {
    var qtySc = _partCodePlusQtyMatchScore_(scan, candidate);
    if (qtySc >= 99) return qtySc;

    var coreS = _reelScanToPartCodeCore_(scan);
    var coreC = _reelScanToPartCodeCore_(candidate);
    if (coreS && coreC && coreS === coreC) return 100;

    var embed = _embeddedBarcodeMatchScore_(scan, candidate);
    if (embed >= 86) return embed;

    var a = _normalizeBarcodeForMatch_(scan);
    var b = _normalizeBarcodeForMatch_(candidate);
    if (!a || !b) return 0;
    if (a === b) return 100;

    if (_isPrefixOnlyBarcodeInclusion_(a, b)) {
      var short = a.length <= b.length ? a : b;
      var long = a.length > b.length ? a : b;
      if (short.length >= 8 && long.slice(long.length - short.length) === short) return 96;
      return 0;
    }
    return 0;
  }

  /** 스캔 문자열에서 비교 후보 조각 추출 (;, |, LOT 접미 등) */
  function _expandBarcodeScanCandidates_(raw) {
    var out = [];
    var seen = {};
    function add(s) {
      var t = String(s == null ? '' : s).trim();
      if (!t || t.length < 3) return;
      var k = t.toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      out.push(t);
    }
    add(raw);
    var corePart = _reelScanToPartCodeCore_(raw);
    if (corePart) add(corePart);
    var stripped = _stripReelBarcodePrefixVariants_(raw);
    for (var si = 0; si < stripped.length; si++) {
      add(stripped[si]);
    }
    var suffixStripped = _stripReelBarcodeSuffixVariants_(raw);
    for (var sj = 0; sj < suffixStripped.length; sj++) {
      add(suffixStripped[sj]);
    }
    var parsed = _parseMaterialBarcodeScan_(raw);
    add(parsed.materialCode);
    add(parsed.vendorCode);
    add(parsed.specification);
    var embedded = _extractEmbeddedPartTokens_(raw);
    for (var ei = 0; ei < embedded.length; ei++) {
      add(embedded[ei]);
    }
    var segs = String(raw).split(/[|;,\t\u001d\u001e]/);
    var i;
    for (i = 0; i < segs.length; i++) {
      add(segs[i]);
    }
    var runs = String(raw).match(/[A-Za-z0-9][A-Za-z0-9\-_.]{5,}/g);
    if (runs) {
      for (i = 0; i < runs.length; i++) {
        add(runs[i]);
      }
    }
    return out;
  }

  var _BARCODE_MATCH_FIELD_LABELS_ = {
    mpn: 'MPN',
    mpn2: 'MPN2',
    spn: 'SPN',
    spn2: 'SPN2',
    vendorCode: '공급사코드',
    materialCode: 'CPN',
    supplierBarcode: '바코드'
  };

  /**
   * 자재등록 — 스캔값을 MPN·SPN 각각 독립 비교 (접두·포함 허용, 필드 혼용 없음)
   * @return {{material:Object, matchType:string, score:number, matchedField:string}|null}
   */
  function _findMaterialInRegisterByBarcodeMatch_(barcode, minScore) {
    var threshold = minScore != null ? minScore : 82;
    var raw = String(barcode == null ? '' : barcode).trim();
    if (!raw) return null;

    var exact = _findMaterialInRegisterByExactBarcode_(raw);
    if (exact) {
      return { material: exact, matchType: 'exact', score: 100, matchedField: 'exact' };
    }

    var materials = getMaterials();
    var scanParts = _expandBarcodeScanCandidates_(raw);
    var rawNorm = _normalizeBarcodeForMatch_(raw);
    var fieldKeys = ['mpn', 'mpn2', 'spn', 'spn2', 'materialCode', 'supplierBarcode'];
    var bestMat = null;
    var bestScore = 0;
    var bestField = '';
    var bestMatId = '';
    var secondBestScore = 0;
    var secondBestMatId = '';

    var mi;
    var fi;
    var ci;
    for (mi = 0; mi < materials.length; mi++) {
      var m = materials[mi] || {};
      var mid = String(m.id != null ? m.id : mi);
      for (fi = 0; fi < fieldKeys.length; fi++) {
        var fk = fieldKeys[fi];
        var fv = '';
        if (fk === 'spn') fv = _materialSpnForMatch_(m);
        else if (fk === 'spn2') fv = _materialSpn2_(m);
        else if (fk === 'mpn') fv = _materialMpn_(m);
        else if (fk === 'mpn2') fv = _materialMpn2_(m);
        else if (fk === 'spn1' || fk === 'mpn1') fv = _materialSpn_(m);
        else fv = String(m[fk] || '').trim();
        if (!fv || ((fk === 'specification' || fk === 'materialName') && fv.length < 8)) continue;
        var sc = 0;
        if (rawNorm) {
          sc = Math.max(sc, _embeddedBarcodeMatchScore_(rawNorm, fv));
        }
        for (ci = 0; ci < scanParts.length; ci++) {
          sc = Math.max(sc, _barcodeSimilarityScore_(scanParts[ci], fv));
        }
        if (sc > 0) {
          if (sc > bestScore) {
            secondBestScore = bestScore;
            secondBestMatId = bestMatId;
            bestScore = sc;
            bestMat = m;
            bestField = fk;
            bestMatId = mid;
          } else if (sc > secondBestScore && mid !== bestMatId) {
            secondBestScore = sc;
            secondBestMatId = mid;
          } else if (sc === bestScore && sc >= threshold && mid !== bestMatId) {
            secondBestScore = sc;
            secondBestMatId = mid;
          }
        }
      }
    }

    if (!bestMat || bestScore < threshold) return null;
    var ambiguous =
      secondBestScore >= threshold &&
      secondBestMatId &&
      secondBestMatId !== bestMatId &&
      bestScore - secondBestScore <= 5;
    if (ambiguous) return null;

    return {
      material: bestMat,
      matchType: bestScore >= 100 ? 'exact' : 'similar',
      score: bestScore,
      matchedField: bestField
    };
  }

  /**
   * 바코드로 자재 찾기 (자재 등록용)
   */
  function findMaterialByBarcodeInRegister(barcode) {
    try {
      var matched = _findMaterialInRegisterByBarcodeMatch_(barcode);
      if (matched && matched.material) return matched.material;

      const materials = getMaterials();
      const parsed = _parseMaterialBarcodeScan_(barcode);
      const specLower = parsed.specification.toLowerCase().trim();

      if (specLower && specLower.length >= 4) {
        const specMatch = materials.find(function (material) {
          const specification = (material.specification || '').toLowerCase().trim();
          return specification && specification === specLower;
        });
        if (specMatch) return specMatch;
      }

      return null;
    } catch (error) {
      Logger.log('바코드로 자재 찾기 오류: ' + error.toString());
      throw error;
    }
  }

  /** 자재 단가 변경 이력 시트명 */
  var MATERIAL_PRICE_HISTORY_SHEET_NAME = '자재단가이력';

  /**
   * 자재 단가 이력 시트 (없으면 생성)
   */
  function getMaterialPriceHistorySheet() {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(MATERIAL_PRICE_HISTORY_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(MATERIAL_PRICE_HISTORY_SHEET_NAME);
      var headers = [
        ['변경일시', '자재ID', '자재코드', '자재명', '규격', '이전단가', '변경단가', '변동액', '변동률(%)', '변경사유']
      ];
      sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
      sheet.getRange(1, 1, 1, headers[0].length).setFontWeight('bold');
      sheet.getRange(1, 1, 1, headers[0].length).setBackground('#f7fafc');
      sheet.setFrozenRows(1);
    }
    return sheet;
  }

  function _roundMaterialPrice_(v) {
    var x = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
    if (isNaN(x)) return 0;
    return Math.round(x * 10000) / 10000;
  }

  /**
   * 단가가 바뀐 경우에만 이력 시트에 한 줄 추가
   */
  function _appendMaterialPriceHistory_(opts) {
    if (!opts) return;
    var oldP = _roundMaterialPrice_(opts.oldPrice);
    var newP = _roundMaterialPrice_(opts.newPrice);
    if (oldP === newP) return;

    var diff = Math.round((newP - oldP) * 10000) / 10000;
    var pct = 0;
    if (oldP !== 0) {
      pct = Math.round((diff / oldP) * 10000) / 100;
    } else if (newP !== 0) {
      pct = 100;
    }

    var sheet = getMaterialPriceHistorySheet();
    sheet.appendRow([
      new Date(),
      opts.materialId != null && opts.materialId !== '' ? opts.materialId : '',
      String(opts.materialCode || '').trim(),
      String(opts.materialName || '').trim(),
      String(opts.specification || '').trim(),
      oldP,
      newP,
      diff,
      pct,
      String(opts.reason || '자재 수정').trim() || '자재 수정'
    ]);
  }

  /**
   * 자재 화면 — 단가 이력 목록 (최신순)
   * @return {{ok:boolean, count?:number, rows?:Array, error?:string}}
   */
  function getMaterialPriceHistoryForUi() {
    try {
      var sheet = getMaterialPriceHistorySheet();
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        return { ok: true, count: 0, rows: [] };
      }
      var colCount = Math.min(sheet.getLastColumn(), 10);
      var vals = sheet.getRange(2, 1, lastRow, colCount).getValues();
      var rows = [];
      for (var i = vals.length - 1; i >= 0; i--) {
        var r = vals[i] || [];
        var changedAt = r[0];
        var atStr = '';
        if (changedAt instanceof Date) {
          atStr = Utilities.formatDate(changedAt, Session.getScriptTimeZone() || 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
        } else if (changedAt != null && changedAt !== '') {
          atStr = String(changedAt);
        }
        var oldP = _roundMaterialPrice_(r[5]);
        var newP = _roundMaterialPrice_(r[6]);
        var diff = r[7] != null && r[7] !== '' ? _roundMaterialPrice_(r[7]) : Math.round((newP - oldP) * 10000) / 10000;
        var pct = r[8] != null && r[8] !== '' ? Number(r[8]) : 0;
        if (isNaN(pct)) pct = 0;
        rows.push({
          changedAt: atStr,
          materialId: r[1] != null && r[1] !== '' ? String(r[1]) : '',
          materialCode: String(r[2] || '').trim(),
          materialName: String(r[3] || '').trim(),
          specification: String(r[4] || '').trim(),
          oldPrice: oldP,
          newPrice: newP,
          diff: diff,
          changePct: pct,
          reason: String(r[9] || '').trim()
        });
      }
      return { ok: true, count: rows.length, rows: rows };
    } catch (error) {
      Logger.log('getMaterialPriceHistoryForUi 오류: ' + error.toString());
      return { ok: false, error: error.message || String(error) };
    }
  }

  /**
   * 자재 저장
   */
  function saveMaterial(materialId, materialData) {
    try {
      const sheet = getMaterialRegisterSheet();

      if (materialData) {
        if (materialData.mpn != null) materialData.mpn = String(materialData.mpn).trim();
        if (materialData.mpn2 != null) materialData.mpn2 = String(materialData.mpn2).trim();
        if (materialData.spn != null) materialData.spn = String(materialData.spn).trim();
        if (materialData.spn2 != null) materialData.spn2 = String(materialData.spn2).trim();
        if (materialData.spn1 != null) materialData.spn1 = String(materialData.spn1).trim();
        if (!materialData.spn && materialData.spn1) materialData.spn = String(materialData.spn1).trim();
        if (!materialData.mpn && materialData.partNo) {
          materialData.mpn = String(materialData.partNo).trim();
        }
        if (materialData.process != null) materialData.process = _normalizeMaterialProcess_(materialData.process);
        if (materialData.form != null && !materialData.process) {
          materialData.process = _normalizeMaterialProcess_(materialData.form);
        }
        if (materialData.outboundDept != null && !materialData.process) {
          materialData.process = _normalizeMaterialProcess_(materialData.outboundDept);
        }
        materialData.form = materialData.process || '';
        materialData.outboundDept = materialData.process || '';
        materialData.partNo = materialData.mpn || materialData.partNo || '';
        materialData.spn1 = materialData.spn || materialData.spn1 || '';
      }

      // ===== 중복 방지: 고객사+CPN만 유일 (자재명·규격은 중복 허용) =====
      const normalize = (v) => (v == null ? '' : String(v)).trim().toLowerCase();

      const existing = getMaterials(); // id는 "시트 행 인덱스(i)" (헤더 제외)
      const currentIdStr = materialId != null && materialId !== '' ? String(materialId) : null;

      var incomingCode = materialData && materialData.materialCode != null ? String(materialData.materialCode).trim() : '';
      if (incomingCode) {
        var incomingCust = normalize(materialData && materialData.customer);
        var dupCode = existing.find(function (m) {
          if (!m) return false;
          if (currentIdStr && String(m.id) === currentIdStr) return false;
          var c = String(m.materialCode || '').trim();
          if (!c) return false;
          var mc = normalize(m.customer);
          return _materialCustomerCpnKey_(mc, c) === _materialCustomerCpnKey_(incomingCust, incomingCode);
        });
        if (dupCode) {
          return {
            success: false,
            message:
              '동일한 고객사·CPN이 이미 등록되어 있습니다: ' +
              (dupCode.customer ? dupCode.customer + ' · ' : '') +
              incomingCode
          };
        }
      }

      var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
      try {
        _ensureMaterialRegisterMpnSpnHeaders_(sheet);
        headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
      } catch (eMpnHdr) {
        Logger.log('자재등록 MPN/SPN 열 보강 오류: ' + eMpnHdr.toString());
      }
      if (currentIdStr && materialData && !Object.prototype.hasOwnProperty.call(materialData, 'stockQuantity')) {
        var stockColPreserve = _findHeaderIndexByNames_(headerRow, ['재고수량', '직접재고']);
        if (stockColPreserve >= 0) {
          var preserveRow = parseInt(currentIdStr, 10) + 1;
          if (!isNaN(preserveRow) && preserveRow >= 2) {
            var curStockCell = sheet.getRange(preserveRow, stockColPreserve + 1).getValue();
            materialData.stockQuantity =
              curStockCell !== '' && curStockCell != null
                ? typeof curStockCell === 'number'
                  ? curStockCell
                  : parseFloat(String(curStockCell).replace(/,/g, '')) || 0
                : 0;
          }
        }
      }
      var prevMaterial = null;
      if (currentIdStr) {
        prevMaterial = existing.find(function (m) {
          return m && String(m.id) === currentIdStr;
        });
      }
      if (prevMaterial && materialData) {
        if (!Object.prototype.hasOwnProperty.call(materialData, 'process')) {
          materialData.process =
            prevMaterial.process || prevMaterial.form || prevMaterial.outboundDept || '';
        }
        if (!Object.prototype.hasOwnProperty.call(materialData, 'outboundDept')) {
          materialData.outboundDept = materialData.process || prevMaterial.outboundDept || '';
        }
      }

      var outRow = _materialDataToSheetRowByHeader_(headerRow, materialData);
      if (materialId) {
        var rowNum = parseInt(String(materialId), 10) + 1;
        if (isNaN(rowNum) || rowNum < 2) {
          return { success: false, message: '잘못된 자재 행 번호입니다.' };
        }
        sheet.getRange(rowNum, 1, 1, outRow.length).setValues([outRow]);
      } else {
        sheet.appendRow(outRow);
      }

      if (currentIdStr && prevMaterial && materialData && Object.prototype.hasOwnProperty.call(materialData, 'basePrice')) {
        try {
          _appendMaterialPriceHistory_({
            materialId: currentIdStr,
            materialCode: materialData.materialCode || prevMaterial.materialCode,
            materialName: materialData.materialName || prevMaterial.materialName,
            specification: materialData.specification != null ? materialData.specification : prevMaterial.specification,
            oldPrice: prevMaterial.basePrice,
            newPrice: materialData.basePrice,
            reason: materialData.priceChangeReason || materialData.priceChangeNote || '자재 수정'
          });
        } catch (histErr) {
          Logger.log('자재단가이력 기록 오류: ' + histErr.toString());
        }
      }

      return { success: true, materialCode: String(materialData.materialCode || '').trim() };
    } catch (error) {
      Logger.log('자재 저장 오류: ' + error.toString());
      throw error;
    }
  }

  /**
   * 자재 삭제
   */
  function deleteMaterial(materialId) {
    try {
      const sheet = getMaterialRegisterSheet();
      const row = materialId + 1; // 헤더 행 제외
      sheet.deleteRow(row);
      return true;
    } catch (error) {
      Logger.log('자재 삭제 오류: ' + error.toString());
      throw error;
    }
  }

  // =======================
  // 제품BOM (MRP·BOM 조회·저장)
  // ---------------------------------------------------------------------------
  // 시트 1행은 헤더(표시 이름). 열 순서는 자유 — 아래 이름으로 열을 찾는다.
  // 운영 예시: 고객사 | 제품코드 | 제품명 | 자재코드 | 반제품코드 | 반제품명 | 소요량
  //   (버전은 별도 열 없이 제품명·제품코드에 포함. 기존 「버전」열은 무시하고 제품코드로만 매칭)
  //   (자재명 열이 없으면 자재명·반제품명·제품명 순으로 첫 매칭 열을 BOM 자재 표시에 사용)
  //   SMT 면(TOP/BOT/SINGLE)은 생산계획 배정 기준 — BOM 면구분 열은 사용하지 않음
  // ---------------------------------------------------------------------------

  /**
   * 완제품 BOM 시트 (제품코드 기준 행 다수).
   * 시트가 없으면 null — 자동으로 시트를 만들지 않음(스프레드시트에 빈 「제품BOM」이 생기는 것 방지).
   */
  function getProductBomSheet() {
    try {
      var ss = getSpreadsheet();
      return ss.getSheetByName(PRODUCT_BOM_SHEET_NAME) || null;
    } catch (error) {
      Logger.log('제품BOM 시트 가져오기 오류: ' + error.toString());
      throw error;
    }
  }

  /**
   * BOM 매칭용 텍스트 정규화
   * - 대소문자/앞뒤 공백/중복 공백/구분자 차이를 줄여 비교
   */
  function _normalizeBomMatchText_(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[|]/g, ' | ');
  }

  /**
   * BOM 매칭용 자재명 토큰화
   */
  function _tokenizeBomName_(v) {
    const n = _normalizeBomMatchText_(v);
    if (!n) return [];
    return n
      .split(/[\s|()[\]{}\-_,./\\:+]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);
  }

  /**
   * 비교용 축약 문자열 (공백/구분자 제거, RS-485 같은 표기 차이 완화)
   */
  function _compactBomText_(v) {
    const n = _normalizeBomMatchText_(v);
    if (!n) return '';
    return n
      .replace(/rs[\s\-]*485/g, 'rs485')
      .replace(/soic[\s\-]*8/g, 'soic8')
      .replace(/[\s|()[\]{}\-_,./\\:+]/g, '');
  }

  /**
   * 자재명 유사도 점수 계산
   * - 완전일치: 100
   * - 포함관계: 90
   * - 토큰 겹침 비율 기반: 0~89
   */
  function _scoreBomNameMatch_(left, right) {
    const a = _normalizeBomMatchText_(left);
    const b = _normalizeBomMatchText_(right);
    if (!a || !b) return 0;
    if (a === b) return 100;
    if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return 90;
    const ac = _compactBomText_(a);
    const bc = _compactBomText_(b);
    if (ac && bc) {
      if (ac === bc) return 96;
      if (ac.indexOf(bc) >= 0 || bc.indexOf(ac) >= 0) return 88;
    }

    const ta = _tokenizeBomName_(a);
    const tb = _tokenizeBomName_(b);
    if (!ta.length || !tb.length) return 0;

    const setB = {};
    for (let i = 0; i < tb.length; i++) setB[tb[i]] = true;
    let hit = 0;
    for (let j = 0; j < ta.length; j++) {
      if (setB[ta[j]]) hit++;
    }
    const ratioA = hit / ta.length;
    const ratioB = hit / tb.length;
    const score = Math.round(Math.max(ratioA, ratioB) * 85);
    return score;
  }

  /**
   * 규격/형태/PART NO 유사도 점수
   * - 빈 값은 비교 제외를 위해 -1 반환
   * - 완전일치 100, 포함관계 85, 토큰 겹침 0~80
   */
  function _scoreBomFieldMatch_(left, right) {
    const a = _normalizeBomMatchText_(left);
    const b = _normalizeBomMatchText_(right);
    if (!a || !b) return -1;
    if (a === b) return 100;
    if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return 85;
    const ta = _tokenizeBomName_(a);
    const tb = _tokenizeBomName_(b);
    if (!ta.length || !tb.length) return 0;
    const setB = {};
    for (let i = 0; i < tb.length; i++) setB[tb[i]] = true;
    let hit = 0;
    for (let j = 0; j < ta.length; j++) {
      if (setB[ta[j]]) hit++;
    }
    const ratioA = hit / ta.length;
    const ratioB = hit / tb.length;
    return Math.round(Math.max(ratioA, ratioB) * 80);
  }

  /** 시트 헤더 셀: 숨은 공백·전각 기호만 정리 (접두/접미 trim) */
  function _trimSheetHeaderCell_(s) {
    return String(s == null ? '' : s)
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/\uFF0E/g, '.')
      .replace(/\uFF0F/g, '/')
      .trim();
  }

  /** 시트 헤더 셀 문자열 → 비교용 키 (공백·기호 제거, 소문자) */
  function _foldSheetHeader_(s) {
    var t = _trimSheetHeaderCell_(s);
    return _normalizeBomMatchText_(t)
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9가-힣]/g, '');
  }

  /** 1행에서 정확히 일치하는 헤더 텍스트의 열 인덱스 (0-based), 없으면 -1 */
  function _findMaterialRegisterColumnByExactHeader_(headerRow, exactLabel) {
    if (!headerRow || !headerRow.length) return -1;
    var want = _trimSheetHeaderCell_(exactLabel);
    if (!want) return -1;
    for (var h = 0; h < headerRow.length; h++) {
      if (_trimSheetHeaderCell_(headerRow[h]) === want) return h;
    }
    return -1;
  }

  /** 자재등록 시트 셀 → 표시용 문자열 (RichTextValue 등) */
  function _sheetCellToPlainString_(v) {
    if (v == null) return '';
    if (typeof v === 'object' && v !== null && typeof v.getText === 'function') {
      try {
        return String(v.getText()).trim();
      } catch (e0) {
        return '';
      }
    }
    return String(v).trim();
  }

  /** 자재등록 데이터 블록: 값 → 표시값 → 리치텍스트 순으로 읽기 */
  function _materialRegisterSheetPickCell_(vals, disp, rich, r, c) {
    if (!vals || r < 0 || r >= vals.length) return '';
    var rowV = vals[r] || [];
    var s1 = c >= 0 && c < rowV.length && rowV[c] != null ? _sheetCellToPlainString_(rowV[c]) : '';
    if (s1) return s1;
    if (rich && rich.length > r && rich[r] && c >= 0 && c < rich[r].length) {
      var rt = rich[r][c];
      if (rt != null && typeof rt.getText === 'function') {
        try {
          var tr = String(rt.getText()).trim();
          if (tr) return tr;
        } catch (e1) {}
      }
    }
    if (!disp || r >= disp.length) return '';
    var rowD = disp[r] || [];
    var s2 = c >= 0 && c < rowD.length && rowD[c] != null ? _sheetCellToPlainString_(rowD[c]) : '';
    return s2 || '';
  }

  function _materialRegisterCodeLike_(t, nameVal, specVal) {
    if (!t || t.length > 64) return false;
    if (nameVal && t === nameVal) return false;
    if (specVal && t === specVal) return false;
    return !/\n|\r/.test(t);
  }

  function _materialRegisterResolveRowCode_(vals, disp, rich, r, codeCol, nameColIdx, specColIdx, nameVal, specVal) {
    function readCol(col) {
      if (col < 0) return '';
      return _materialRegisterSheetPickCell_(vals, disp, rich, r, col);
    }
    var order = [];
    if (codeCol >= 0 && codeCol !== nameColIdx && order.indexOf(codeCol) < 0) order.push(codeCol);
    if (!order.length && codeCol >= 0) order.push(codeCol);
    for (var oi = 0; oi < order.length; oi++) {
      var t = readCol(order[oi]);
      if (_materialRegisterCodeLike_(t, nameVal, specVal)) return t;
    }
    var rowLen = vals[r] && vals[r].length ? vals[r].length : 0;
    var lim = nameColIdx > 0 ? Math.min(nameColIdx, rowLen) : rowLen;
    for (var c = 0; c < lim; c++) {
      if (c === nameColIdx || c === specColIdx) continue;
      if (order.indexOf(c) >= 0) continue;
      var u = readCol(c);
      if (_materialRegisterCodeLike_(u, nameVal, specVal)) return u;
    }
    return '';
  }

  /**
   * 헤더 배열에서 후보 이름 목록 중 첫 번째 인덱스 반환
   * @param {Array} headerRow
   * @param {Array<string>} names
   * @return {number} 0-based index, 없으면 -1
   */
  function _findHeaderIndexByNames_(headerRow, names) {
    if (!headerRow || !headerRow.length) return -1;
    const normalizedHeader = headerRow.map((h) => _foldSheetHeader_(h));
    for (let i = 0; i < names.length; i++) {
      const key = _foldSheetHeader_(names[i]);
      const idx = normalizedHeader.indexOf(key);
      if (idx >= 0) return idx;
    }
    return -1;
  }

  /** 자재등록 시트 — MPN(제조사 품번) 열 인덱스 */
  function _materialRegisterMpnColumnIndex_(headerRow) {
    if (!headerRow || !headerRow.length) return -1;
    var exact = _findMaterialRegisterColumnByExactHeader_(headerRow, 'MPN');
    if (exact >= 0) return exact;
    return _findHeaderIndexByNames_(headerRow, [
      'MPN',
      'Mpn',
      'mpn',
      '제조사품번',
      '제조사 품번',
      '제조사품번(MPN)',
      'Manufacturer Part Number',
      'MANUFACTURER PART',
      'Part No',
      'PART NO',
      'PARTNO',
      'PartNo',
      'part no',
      'Part No.',
      'PART NO.',
      'partno'
    ]);
  }

  /** 자재등록 1행 — MPN 열 값 (MPN 우선, 비어 있으면 Part No. 등 fallback) */
  function _parseMaterialRegisterMpnFromRow_(headerRow, dr) {
    if (!headerRow || !headerRow.length || !dr) return '';
    var groups = [
      ['MPN', 'Mpn', 'mpn'],
      ['제조사품번', '제조사 품번', '제조사품번(MPN)', 'Manufacturer Part Number', 'MANUFACTURER PART'],
      ['Part No', 'PART NO', 'PARTNO', 'PartNo', 'part no', 'Part No.', 'PART NO.', 'partno']
    ];
    var gi;
    for (gi = 0; gi < groups.length; gi++) {
      var ix = _findHeaderIndexByNames_(headerRow, groups[gi]);
      if (ix < 0 || ix >= dr.length) continue;
      var v = _sheetCellToPlainString_(dr[ix]);
      if (v) return v;
    }
    return '';
  }

  /** 자재등록 시트 — CPN(고객 품번) 열 인덱스 (미래코드 MS_ 보다 CPN 우선) */
  function _materialRegisterCpnColumnIndex_(headerRow) {
    var codeCol = _findMaterialRegisterColumnByExactHeader_(headerRow, 'CPN');
    if (codeCol < 0) {
      codeCol = _findHeaderIndexByNames_(headerRow, [
        'CPN',
        '고객 CPN',
        '고객 BOM코드',
        'BOM코드',
        '고객품목코드',
        '고객 품목코드',
        '미래코드',
        '자재코드',
        '품목코드',
        '자재번호',
        '부품코드',
        '관리코드',
        'MATERIAL CODE',
        'Material Code',
        'ITEM CODE',
        'Item Code',
        'CODE',
        'P/N',
        'PN'
      ]);
    }
    return codeCol;
  }

  /** 자재 재고 화면용: 자재등록 1행에서 코드·명·규격 열 인덱스 */
  function _materialRegisterInventoryColumnIndices_(headerRow) {
    var customerCol = _findHeaderIndexByNames_(headerRow, ['고객사']);
    var codeCol = _materialRegisterCpnColumnIndex_(headerRow);

    var nameCol = _findMaterialRegisterColumnByExactHeader_(headerRow, '자재명');
    if (nameCol < 0) {
      nameCol = _findHeaderIndexByNames_(headerRow, [
        '자재명',
        '품목명',
        'MATERIAL NAME',
        'Material Name',
        'ITEM NAME',
        'Item Name',
        'PROD_DES'
      ]);
    }
    if (nameCol < 0) nameCol = 2;

    var specCol = _findMaterialRegisterColumnByExactHeader_(headerRow, '규격');
    if (specCol < 0) {
      specCol = _findHeaderIndexByNames_(headerRow, [
        '규격',
        '사양',
        '규격/사양',
        '규격 및 사양',
        'SIZE',
        'Size',
        'SIZE_DES',
        'SPEC',
        'Specification',
        '스펙'
      ]);
    }
    if (specCol < 0) specCol = 3;

    return { customerCol: customerCol, codeCol: codeCol, nameCol: nameCol, specCol: specCol };
  }

  /** 출고 부서 번호 1~4 (구 생산팀) — 레거시 */
  function _normalizeOutboundDeptNumber_(val) {
    if (val == null || val === '') return 0;
    if (typeof val === 'number' && isFinite(val)) {
      var ni = Math.round(val);
      return ni >= 1 && ni <= 4 ? ni : 0;
    }
    var s = String(val).trim();
    if (!s) return 0;
    var n = parseInt(s, 10);
    if (!isNaN(n) && n >= 1 && n <= 4) return n;
    var m = s.match(/생산\s*(\d)\s*팀/i) || s.match(/^(\d)\s*팀$/i);
    if (m) {
      var nt = parseInt(m[1], 10);
      if (nt >= 1 && nt <= 4) return nt;
    }
    return 0;
  }

  /** 자재등록 공정 — SMD / DIP (구 출고·생산팀 번호 호환) */
  function _normalizeMaterialProcess_(val) {
    if (val == null || val === '') return '';
    var s = String(val).trim();
    if (!s) return '';
    var u = s.toUpperCase().replace(/\s+/g, '');
    if (u === 'SMD' || u.indexOf('SMD') >= 0) return 'SMD';
    if (u === 'DIP' || u.indexOf('DIP') >= 0) return 'DIP';
    var legacy = _normalizeOutboundDeptNumber_(s);
    if (legacy === 1 || legacy === 2) return 'SMD';
    if (legacy === 3 || legacy === 4) return 'DIP';
    return '';
  }

  function _materialProcessLabel_(val) {
    var p = _normalizeMaterialProcess_(val);
    return p === 'SMD' || p === 'DIP' ? p : '';
  }

  function _outboundDeptLabelFromNumber_(n) {
    return _materialProcessLabel_(n) || '';
  }

  /**
   * 자재등록 시트 — MPN·SPN 열 보강 (구 MPN1/MPN2만 있는 시트에서 MPN 저장 누락 방지)
   */
  function _ensureMaterialRegisterMpnSpnHeaders_(sheet) {
    if (!sheet) return;
    var lc = Math.max(sheet.getLastColumn(), 1);
    var hr = sheet.getRange(1, 1, 1, lc).getValues()[0] || [];
    var specIx = _findHeaderIndexByNames_(hr, ['규격', '사양', '규격/사양', '규격 및 사양']);
    var processIx = _findHeaderIndexByNames_(hr, [
      '공정',
      '공정구분',
      'Process',
      '출고',
      '출고부서',
      '출고부서번호',
      '부서번호'
    ]);
    var mpnCol1Based = processIx >= 0 ? processIx + 2 : specIx >= 0 ? specIx + 2 : 6;

    if (_findHeaderIndexByNames_(hr, ['MPN']) < 0) {
      if (mpnCol1Based <= lc) {
        sheet.insertColumnAfter(mpnCol1Based - 1);
      } else {
        sheet.insertColumnAfter(lc);
        mpnCol1Based = lc + 1;
      }
      sheet.getRange(1, mpnCol1Based).setValue('MPN').setFontWeight('bold').setBackground('#f7fafc');
      lc = sheet.getLastColumn();
      hr = sheet.getRange(1, 1, 1, lc).getValues()[0] || [];
    }

    var mpnIx = _findHeaderIndexByNames_(hr, ['MPN']);
    if (mpnIx >= 0 && _findHeaderIndexByNames_(hr, ['MPN2']) < 0) {
      sheet.insertColumnAfter(mpnIx + 1);
      sheet.getRange(1, mpnIx + 2).setValue('MPN2').setFontWeight('bold').setBackground('#f7fafc');
      lc = sheet.getLastColumn();
      hr = sheet.getRange(1, 1, 1, lc).getValues()[0] || [];
    }

    var spnIx = _findHeaderIndexByNames_(hr, ['SPN']);
    var spn1Ix = _findHeaderIndexByNames_(hr, ['SPN1']);
    var mpn1Ix = _findHeaderIndexByNames_(hr, ['MPN1']);
    if (spnIx < 0) {
      if (spn1Ix >= 0) {
        sheet.getRange(1, spn1Ix + 1).setValue('SPN').setFontWeight('bold').setBackground('#f7fafc');
      } else if (mpn1Ix >= 0) {
        sheet.getRange(1, mpn1Ix + 1).setValue('SPN').setFontWeight('bold').setBackground('#f7fafc');
      } else {
        var mpn2Ix = _findHeaderIndexByNames_(hr, ['MPN2']);
        var afterMpn = mpn2Ix >= 0 ? mpn2Ix + 2 : mpnIx >= 0 ? mpnIx + 2 : mpnCol1Based + 1;
        if (afterMpn <= sheet.getLastColumn()) {
          sheet.insertColumnAfter(afterMpn - 1);
        } else {
          sheet.insertColumnAfter(sheet.getLastColumn());
          afterMpn = sheet.getLastColumn();
        }
        sheet.getRange(1, afterMpn).setValue('SPN').setFontWeight('bold').setBackground('#f7fafc');
      }
      lc = sheet.getLastColumn();
      hr = sheet.getRange(1, 1, 1, lc).getValues()[0] || [];
    }

    spnIx = _findHeaderIndexByNames_(hr, ['SPN']);
    if (spnIx >= 0 && _findHeaderIndexByNames_(hr, ['SPN2']) < 0) {
      sheet.insertColumnAfter(spnIx + 1);
      sheet.getRange(1, spnIx + 2).setValue('SPN2').setFontWeight('bold').setBackground('#f7fafc');
    }
  }

  /** 자재등록 — 공정(SMD/DIP) 열. 없으면 규격 다음(E열)에 삽입 (구 출고 열 호환) */
  function _ensureMaterialRegisterOutboundDeptHeader_(sheet) {
    if (!sheet) return;
    var lc = sheet.getLastColumn();
    if (lc < 1) return;
    var hr = sheet.getRange(1, 1, 1, lc).getValues()[0] || [];
    if (
      _findHeaderIndexByNames_(hr, ['공정', '공정구분', 'Process']) >= 0 ||
      _findHeaderIndexByNames_(hr, ['출고', '출고부서', '출고부서번호', '부서번호']) >= 0
    ) {
      return;
    }
    var specCol = _findHeaderIndexByNames_(hr, ['규격', '사양', '규격/사양', '규격 및 사양']);
    var insertAt = specCol >= 0 ? specCol + 2 : lc + 1;
    if (insertAt <= lc) {
      sheet.insertColumnBefore(insertAt);
    } else {
      sheet.insertColumnAfter(lc);
      insertAt = lc + 1;
    }
    sheet.getRange(1, insertAt).setValue('공정').setFontWeight('bold').setBackground('#f7fafc');
  }

  /** 자재등록 시트에 공정·Part No 열이 없으면 끝에 추가 */
  function _ensureMaterialRegisterProcessPartNoHeaders_(sheet) {
    if (!sheet) return;
    var lc = sheet.getLastColumn();
    if (lc < 1) return;
    var hr = sheet.getRange(1, 1, 1, lc).getValues()[0] || [];
    if (_findHeaderIndexByNames_(hr, ['공정']) < 0) {
      sheet.insertColumnAfter(lc);
      lc++;
      sheet.getRange(1, lc).setValue('공정').setFontWeight('bold').setBackground('#f7fafc');
    }
    hr = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
    if (_findHeaderIndexByNames_(hr, ['Part No.', 'Part No', 'PART NO', 'PartNo', 'part no']) < 0) {
      lc = sheet.getLastColumn();
      sheet.insertColumnAfter(lc);
      lc++;
      sheet.getRange(1, lc).setValue('Part No.').setFontWeight('bold').setBackground('#f7fafc');
    }
    hr = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
    if (_findHeaderIndexByNames_(hr, ['재고수량', '직접재고']) < 0) {
      lc = sheet.getLastColumn();
      sheet.insertColumnAfter(lc);
      sheet.getRange(1, lc + 1).setValue('재고수량').setFontWeight('bold').setBackground('#f7fafc');
    }
  }

  /** @deprecated 공급사코드 열 자동 삽입 비활성 — Part No.(MPN)만 사용 */
  function _ensureMaterialRegisterMiraeVendorCodeHeaders_(sheet) {
    return;
  }

  /** 자재등록 시트에 시장가 열이 없으면 단가 다음에 삽입 */
  function _ensureMaterialRegisterMarketPriceHeader_(sheet) {
    if (!sheet) return;
    var lc = sheet.getLastColumn();
    if (lc < 1) return;
    var hr = sheet.getRange(1, 1, 1, lc).getValues()[0] || [];
    if (_findHeaderIndexByNames_(hr, ['시장가', '시장단가', '참고시장가', 'Octopart단가']) >= 0) return;
    var priceCol = _findHeaderIndexByNames_(hr, ['단가']);
    var insertAt = priceCol >= 0 ? priceCol + 2 : lc + 1;
    if (insertAt <= lc) {
      sheet.insertColumnBefore(insertAt);
    } else {
      sheet.insertColumnAfter(lc);
      insertAt = lc + 1;
    }
    sheet.getRange(1, insertAt).setValue('시장가').setFontWeight('bold').setBackground('#f7fafc');
  }

  /** 자재등록 1행 헤더 + 데이터 행 → material 객체 (헤더 기반) */
  function _parseMaterialRegisterRow_(headerRow, dataRow, rowIndex1Based) {
    if (!headerRow || !headerRow.length) return null;
    var src = dataRow || [];
    var dr = [];
    for (var pi = 0; pi < headerRow.length; pi++) {
      dr[pi] = pi < src.length ? src[pi] : '';
    }
    var str = function(names) {
      var ix = _findHeaderIndexByNames_(headerRow, names);
      if (ix < 0 || ix >= dr.length) return '';
      return _sheetCellToPlainString_(dr[ix]);
    };
    var materialName = str(['자재명', '품목명']);
    if (!materialName) return null;
    var ixBp = _findHeaderIndexByNames_(headerRow, ['단가']);
    var basePrice = 0;
    if (ixBp >= 0 && dr[ixBp] != null && dr[ixBp] !== '') {
      basePrice = typeof dr[ixBp] === 'number' ? dr[ixBp] : parseFloat(String(dr[ixBp]).replace(/,/g, '')) || 0;
    }
    var ixMoq = _findHeaderIndexByNames_(headerRow, ['MOQ', 'moq', '최소주문량', '최소주문', '최소발주', '최소발주량']);
    var moq = 0;
    if (ixMoq >= 0 && dr[ixMoq] != null && dr[ixMoq] !== '') {
      moq = typeof dr[ixMoq] === 'number' ? dr[ixMoq] : parseFloat(String(dr[ixMoq]).replace(/,/g, '')) || 0;
    }
    var ixMarket = _findHeaderIndexByNames_(headerRow, ['시장가', '시장단가', '참고시장가', 'Octopart단가']);
    var marketPrice = '';
    if (ixMarket >= 0 && dr[ixMarket] != null && dr[ixMarket] !== '') {
      marketPrice =
        typeof dr[ixMarket] === 'number'
          ? String(dr[ixMarket])
          : _sheetCellToPlainString_(dr[ixMarket]);
    }
    var ret = {
      id: rowIndex1Based,
      materialCode: str([
        'CPN',
        '고객 CPN',
        '고객 BOM코드',
        'BOM코드',
        '고객품목코드',
        '고객 품목코드',
        '미래코드',
        '자재코드',
        '품목코드',
        '자재번호',
        'MATERIAL CODE',
        'Material Code',
        'ITEM CODE',
        'Item Code',
        'CODE'
      ]),
      vendorCode: str([
        '공급사코드',
        '공급사품번',
        '공급사 품번',
        '공급업체코드',
        '공급업체 코드',
        'Vendor Code',
        'VENDOR CODE',
        'Supplier Code',
        'SUPPLIER CODE'
      ]),
      customer: str(['고객사']),
      materialName: materialName,
      specification: str([
        '규격',
        '사양',
        '규격/사양',
        '규격 및 사양',
        'SIZE',
        'Size',
        'SIZE_DES',
        'SPEC',
        'Specification'
      ]),
      supplier: str([
        '공급업체',
        '공급사',
        '공급처',
        '거래처',
        '거래처명',
        '매입처',
        '업체명',
        'Supplier',
        'VENDOR',
        'Vendor'
      ]),
      moq: moq,
      basePrice: basePrice,
      marketPrice: marketPrice,
      unit: str(['단위']),
      supplyType: str(['도급/사급']),
      process: (function () {
        var p = str(['공정', '공정구분', 'Process']);
        if (!p) p = str(['출고', '출고부서', '출고부서번호', '부서번호']);
        return _normalizeMaterialProcess_(p);
      })(),
      supplierBarcode: str(['바코드']),
      form: '',
      mpn: _parseMaterialRegisterMpnFromRow_(headerRow, dr),
      mpn2: str(['MPN2', 'Mpn2', 'mpn2']),
      spn: (function () {
        var a = str(['SPN', 'Spn', 'spn']);
        if (a) return a;
        return str(['SPN1', 'Spn1', 'spn1', 'MPN1', 'Mpn1', 'mpn1']);
      })(),
      spn2: str(['SPN2', 'Spn2', 'spn2']),
      spn1: '',
      mpn1: '',
      note: str(['비고', '메모', '비고사항', '특이사항'])
    };
    ret.spn1 = ret.spn;
    ret.partNo = ret.mpn;
    ret.form = ret.process;
    ret.outboundDept = ret.process;
    var stockIx = _findHeaderIndexByNames_(headerRow, ['재고수량', '직접재고']);
    var stockQty = 0;
    if (stockIx >= 0 && dr[stockIx] != null && dr[stockIx] !== '') {
      stockQty =
        typeof dr[stockIx] === 'number' ? dr[stockIx] : parseFloat(String(dr[stockIx]).replace(/,/g, '')) || 0;
    }
    ret.stockQuantity = stockQty;
    return ret;
  }

  /** materialData → 자재등록 시트 현재 헤더 순서에 맞는 1행 배열 */
  function _materialDataToSheetRowByHeader_(headerRow, materialData) {
    var md = materialData || {};
    var fk = {
      cpn: _foldSheetHeader_('CPN'),
      고객bom코드: _foldSheetHeader_('고객 BOM코드'),
      bom코드: _foldSheetHeader_('BOM코드'),
      고객품목코드: _foldSheetHeader_('고객품목코드'),
      미래코드: _foldSheetHeader_('미래코드'),
      자재코드: _foldSheetHeader_('자재코드'),
      품목코드: _foldSheetHeader_('품목코드'),
      자재번호: _foldSheetHeader_('자재번호'),
      공급사코드: _foldSheetHeader_('공급사코드'),
      공급사품번: _foldSheetHeader_('공급사품번'),
      고객사: _foldSheetHeader_('고객사'),
      자재명: _foldSheetHeader_('자재명'),
      품목명: _foldSheetHeader_('품목명'),
      규격: _foldSheetHeader_('규격'),
      사양: _foldSheetHeader_('사양'),
      규격사양: _foldSheetHeader_('규격/사양'),
      규격및사양: _foldSheetHeader_('규격 및 사양'),
      공급업체: _foldSheetHeader_('공급업체'),
      moq: _foldSheetHeader_('MOQ'),
      단가: _foldSheetHeader_('단가'),
      시장가: _foldSheetHeader_('시장가'),
      시장단가: _foldSheetHeader_('시장단가'),
      참고시장가: _foldSheetHeader_('참고시장가'),
      octopart단가: _foldSheetHeader_('Octopart단가'),
      단위: _foldSheetHeader_('단위'),
      도급사급: _foldSheetHeader_('도급/사급'),
      출고: _foldSheetHeader_('출고'),
      바코드: _foldSheetHeader_('바코드'),
      공정: _foldSheetHeader_('공정'),
      mpn: _foldSheetHeader_('MPN'),
      spn: _foldSheetHeader_('SPN'),
      spn1: _foldSheetHeader_('SPN1'),
      mpn1: _foldSheetHeader_('MPN1'),
      mpn2: _foldSheetHeader_('MPN2'),
      spn2: _foldSheetHeader_('SPN2'),
      스펙: _foldSheetHeader_('스펙'),
      비고: _foldSheetHeader_('비고')
    };
    var row = [];
    for (var c = 0; c < headerRow.length; c++) {
      var hn = String(headerRow[c] || '').trim();
      var hf = _foldSheetHeader_(hn);
      var v = '';
      if (
        hf === fk.cpn ||
        hf === fk.고객bom코드 ||
        hf === fk.bom코드 ||
        hf === fk.고객품목코드 ||
        hf === fk.미래코드 ||
        hf === fk.자재코드 ||
        hf === fk.품목코드 ||
        hf === fk.자재번호 ||
        hf === 'materialcode' ||
        hf === 'itemcode'
      ) {
        v = md.materialCode || '';
      } else if (
        hf === fk.공급사코드 ||
        hf === fk.공급사품번 ||
        hf === _foldSheetHeader_('공급업체코드') ||
        hf === 'vendorcode' ||
        hf === 'suppliercode'
      ) {
        v = md.vendorCode != null ? String(md.vendorCode) : '';
      } else if (hf === fk.고객사) v = md.customer || '';
      else if (hf === fk.자재명 || hf === fk.품목명) v = md.materialName || '';
      else if (
        hf === fk.규격 ||
        hf === fk.사양 ||
        hf === fk.규격사양 ||
        hf === fk.규격및사양 ||
        hf === 'size' ||
        hf === 'sizedes' ||
        hf === 'spec' ||
        hf === 'specification' ||
        hf === fk.스펙
      ) {
        v = md.specification || '';
      } else if (hf === fk.공급업체 || hf === _foldSheetHeader_('공급사')) {
        v = md.supplier != null ? String(md.supplier) : '';
      } else if (hf === fk.moq || hf === _foldSheetHeader_('최소주문량') || hf === _foldSheetHeader_('최소주문') || hf === _foldSheetHeader_('최소발주')) {
        var mq = md.moq;
        v =
          mq !== undefined && mq !== null && mq !== ''
            ? typeof mq === 'number'
              ? mq
              : parseFloat(String(mq).replace(/,/g, '')) || 0
            : '';
      } else if (hf === fk.단가) {
        var bp = md.basePrice;
        v =
          bp !== undefined && bp !== null && bp !== ''
            ? typeof bp === 'number'
              ? bp
              : parseFloat(String(bp).replace(/,/g, '')) || 0
            : '';
      } else if (hf === fk.시장가 || hf === fk.시장단가 || hf === fk.참고시장가 || hf === fk.octopart단가) {
        v = md.marketPrice != null ? String(md.marketPrice).trim() : '';
      } else if (hf === fk.단위) v = md.unit || '';
      else if (hn === '도급/사급' || hf === fk.도급사급) v = md.supplyType || '';
      else if (hn === '공정' || hf === fk.공정 || hn === '출고' || hf === fk.출고) {
        v = _normalizeMaterialProcess_(md.process || md.form || md.outboundDept) || '';
      } else if (hf === fk.바코드) v = md.supplierBarcode || '';
      else if (hf === fk.mpn) v = md.mpn != null ? String(md.mpn) : md.partNo != null ? String(md.partNo) : '';
      else if (hf === fk.mpn2) v = md.mpn2 != null ? String(md.mpn2) : '';
      else if (hf === fk.spn) {
        v = md.spn != null ? String(md.spn) : md.spn1 != null ? String(md.spn1) : '';
      } else if (hf === fk.spn2) v = md.spn2 != null ? String(md.spn2) : '';
      else if (hf === fk.spn1 || hf === fk.mpn1) {
        v = md.spn != null ? String(md.spn) : md.spn1 != null ? String(md.spn1) : '';
      } else if (hf === 'partno') v = md.mpn != null ? String(md.mpn) : md.partNo != null ? String(md.partNo) : '';
      else if (hf === fk.비고 || hf === _foldSheetHeader_('메모')) {
        v = md.note != null ? String(md.note) : md.remark != null ? String(md.remark) : '';
      } else if (hf === _foldSheetHeader_('재고수량') || hf === _foldSheetHeader_('직접재고')) {
        var sq = md.stockQuantity;
        v =
          sq !== undefined && sq !== null && sq !== ''
            ? typeof sq === 'number'
              ? sq
              : parseFloat(String(sq).replace(/,/g, '')) || 0
            : 0;
      }
      row.push(v);
    }
    return row;
  }
  function _mrpMaterialKey_(name, spec) {
    return String(name || '').trim() + '|' + String(spec || '').trim();
  }

  function _mrpRound_(n) {
    var x = Number(n) || 0;
    return Math.round(x * 10000) / 10000;
  }

  function _getHeaderIndexMap_(headerRow) {
    var map = {};
    for (var i = 0; i < (headerRow || []).length; i++) {
      var k = String(headerRow[i] || '').trim();
      if (k) map[k] = i;
    }
    return map;
  }

  /**
   * 제품BOM에 고객사가 비어 있을 때 주문서(제품코드 일치)에서 표시용 고객사 보강
   * @param {Array<{productCode:string, customer?:string}>} products
   */
  function _enrichMrpProductCustomerFromOrders_(products) {
    if (!products || !products.length) return;
    var orders;
    try {
      orders = getOrders() || [];
    } catch (e0) {
      return;
    }
    if (!orders.length) return;
    var byCode = {};
    var i;
    for (i = orders.length - 1; i >= 0; i--) {
      var o = orders[i] || {};
      var pc = String(o.productCode || '').trim();
      if (!pc || byCode[pc]) continue;
      var cu = String(o.customer || '').trim();
      if (cu) byCode[pc] = cu;
    }
    for (i = 0; i < products.length; i++) {
      var p = products[i];
      if (!p) continue;
      if (String(p.customer || '').trim()) continue;
      var code = String(p.productCode || '').trim();
      if (code && byCode[code]) p.customer = byCode[code];
    }
  }

  function _getMrpProductOptionsFromSheet_() {
    var sheet = getProductBomSheet();
    if (!sheet) return [];
    var values = sheet.getDataRange().getValues();
    if (!values || values.length <= 1) return [];
    var header = values[0] || [];
    var idxCode = _findHeaderIndexByNames_(header, ['제품코드']);
    var idxName = _findHeaderIndexByNames_(header, ['제품명']);
    var idxCustomer = _findHeaderIndexByNames_(header, [
      '고객사',
      '거래처',
      '발주처',
      '매출처',
      '업체명',
      'Customer',
      'CLIENT'
    ]);
    if (idxCode < 0) return [];

    var byKey = {};
    for (var i = 1; i < values.length; i++) {
      var r = values[i] || [];
      var code = r[idxCode] != null ? String(r[idxCode]).trim() : '';
      if (!code) continue;
      var name = idxName >= 0 && r[idxName] != null ? String(r[idxName]).trim() : '';
      var cust =
        idxCustomer >= 0 && r[idxCustomer] != null ? _sheetCellToPlainString_(r[idxCustomer]) : '';
      var key = code;
      var row = byKey[key];
      if (!row) {
        byKey[key] = {
          productCode: code,
          productName: name || '(제품명 없음)',
          version: '',
          customer: cust
        };
      } else {
        if (!row.customer && cust) row.customer = cust;
      }
    }
    var out = [];
    for (var k in byKey) {
      if (Object.prototype.hasOwnProperty.call(byKey, k)) out.push(byKey[k]);
    }
    out.sort(function (a, b) {
      return String(a.productCode || '').localeCompare(String(b.productCode || ''), 'ko', { numeric: true });
    });
    _enrichMrpProductCustomerFromOrders_(out);
    return out;
  }


  /**
   * PO 부족분: 제품BOM 시트에서 제품코드로 대표 행 선택.
   */
  function _findMrpProductForPlan_(productCode, version) {
    var products = _getMrpProductOptionsFromSheet_();
    var code = String(productCode != null ? productCode : '').trim();
    if (!code) return null;
    for (var i = 0; i < products.length; i++) {
      if (String(products[i].productCode || '').trim() === code) return products[i];
    }
    return null;
  }

  /**
   * MRP용 제품 목록(제품BOM 시트의 제품코드·제품명·고객사)
   */
  function getMrpProductOptions() {
    try {
      return _getMrpProductOptionsFromSheet_();
    } catch (error) {
      Logger.log('getMrpProductOptions 오류: ' + error.toString());
      return [];
    }
  }

  /** 제품BOM 시트 데이터 1회 읽기 */
  function _readProductBomSheetData_() {
    if (
      __productBomSheetCache_ &&
      Date.now() - __productBomSheetCache_.loadedAt < PRODUCT_BOM_SHEET_CACHE_TTL_SEC * 1000
    ) {
      return __productBomSheetCache_.data;
    }
    var pb = getProductBomSheet();
    if (!pb) return null;
    var pv = pb.getDataRange().getValues();
    if (!pv || pv.length < 2) return null;
    var ph = pv[0] || [];
    var pIdxCode = _findHeaderIndexByNames_(ph, ['제품코드']);
    var pIdxQty = _findHeaderIndexByNames_(ph, ['소요량', '수량']);
    if (pIdxCode < 0 || pIdxQty < 0) return null;
    var result = {
      pv: pv,
      ph: ph,
      pIdxCode: pIdxCode,
      pIdxQty: pIdxQty,
      pIdxSemi: _findHeaderIndexByNames_(ph, [
        '반제품코드',
        '반제품 코드',
        '반제품/자재 코드',
        '반제품/자재코드',
        'SemiCode',
        'Semi Code'
      ]),
      pIdxMat: _findHeaderIndexByNames_(ph, ['자재코드']),
      // 반제품명 컬럼이 있으면 그걸 최우선으로 사용(semI 표시 텍스트 정확도)
      pIdxName: _findHeaderIndexByNames_(ph, ['반제품명', '자재명', '제품명']),
      pIdxSemiName: _findHeaderIndexByNames_(ph, ['반제품명', '반제품 명', 'SemiName', 'Semi Name']),
      pIdxMatName: _findHeaderIndexByNames_(ph, ['자재명']),
      pIdxProductName: _findHeaderIndexByNames_(ph, ['제품명']),
      pIdxVer: _findHeaderIndexByNames_(ph, ['버전'])
    };
    __productBomSheetCache_ = { data: result, loadedAt: Date.now() };
    return result;
  }

  /** 반제품코드 -> 표시명(BOM의 반제품명 우선) */
  function _resolveSemiDisplayNameFromBom_(sheetData, semiCode, fallbackName) {
    var fb = String(fallbackName || '').trim();
    if (!sheetData || !semiCode) return fb;
    var want = String(semiCode).trim();
    if (!want) return fb;
    var pv = sheetData.pv || [];
    var pIdxSemi = sheetData.pIdxSemi;
    var pIdxSemiName = sheetData.pIdxSemiName;
    var pIdxMatName = sheetData.pIdxMatName;
    var pIdxProductName = sheetData.pIdxProductName;
    var i;
    for (i = 1; i < pv.length; i++) {
      var rr = pv[i] || [];
      var sc = pIdxSemi >= 0 && rr[pIdxSemi] != null ? String(rr[pIdxSemi]).trim() : '';
      if (!sc || sc !== want) continue;
      var nmSemi = pIdxSemiName >= 0 && rr[pIdxSemiName] != null ? String(rr[pIdxSemiName]).trim() : '';
      if (nmSemi) return nmSemi;
      var nmMat = pIdxMatName >= 0 && rr[pIdxMatName] != null ? String(rr[pIdxMatName]).trim() : '';
      if (nmMat) return nmMat;
      var nmProd = pIdxProductName >= 0 && rr[pIdxProductName] != null ? String(rr[pIdxProductName]).trim() : '';
      if (nmProd) return nmProd;
    }
    return fb;
  }

  /** 제품BOM 버전 비교(공백·대소문자 무시) */
  function _bomVersionsMatch_(rowVer, wantVer) {
    var w = String(wantVer || '')
      .trim()
      .replace(/\s+/g, '')
      .toLowerCase();
    if (!w) return true;
    var r = String(rowVer || '')
      .trim()
      .replace(/\s+/g, '')
      .toLowerCase();
    return !r || r === w;
  }

  /**
   * 제품코드에 해당하는 BOM 구성행 (제품코드 기준 전체)
   */
  function _collectBomLinesForProduct_(sheetData, productCode, version) {
    var out = [];
    if (!sheetData) return out;
    var pv = sheetData.pv;
    var pcWant = String(productCode || '').trim();
    if (!pcWant) return out;
    var pIdxCode = sheetData.pIdxCode;
    var pIdxQty = sheetData.pIdxQty;
    var pIdxSemi = sheetData.pIdxSemi;
    var pIdxMat = sheetData.pIdxMat;
    var pIdxName = sheetData.pIdxName;

    for (var pi = 1; pi < pv.length; pi++) {
      var pr = pv[pi] || [];
      if (String(pr[pIdxCode] || '').trim() !== pcWant) continue;
      var pq = Number(pr[pIdxQty]) || 0;
      if (!(pq > 0)) continue;
      var semi = pIdxSemi >= 0 && pr[pIdxSemi] != null ? String(pr[pIdxSemi]).trim() : '';
      var matDirect = pIdxMat >= 0 && pr[pIdxMat] != null ? String(pr[pIdxMat]).trim() : '';
      var nm = pIdxName >= 0 && pr[pIdxName] != null ? String(pr[pIdxName]).trim() : '';
      var pIdxSemiName = sheetData.pIdxSemiName;
      var semiNm = pIdxSemiName >= 0 && pr[pIdxSemiName] != null ? String(pr[pIdxSemiName]).trim() : '';
      out.push({
        perUnitQty: pq,
        semi: semi,
        semiName: semiNm,
        matDirect: matDirect,
        bomName: nm || semiNm,
        rowVer: ''
      });
    }
    return out;
  }

  /** 반제품코드가 제품BOM에서 부모(제품코드)로 등록돼 있는지 */
  function _productBomHasParentCode_(sheetData, code) {
    if (!sheetData || !code) return false;
    var pv = sheetData.pv;
    var pIdxCode = sheetData.pIdxCode;
    var want = String(code).trim();
    for (var pi = 1; pi < pv.length; pi++) {
      var pr = pv[pi] || [];
      if (String(pr[pIdxCode] || '').trim() === want) return true;
    }
    return false;
  }

  /**
   * 완제품·반제품 다단 BOM 전개 → 완제품 1개당 자재 소요량(perQty) 목록
   * 반제품코드가 제품BOM에 부모로 있으면 하위 자재까지 펼치고, 없으면 자재등록 코드로 매칭 시도.
   */
  function _expandBomPlanningInputs_(productCode, version, unitFactor, visited, depth, sheetData) {
    var out = [];
    if (!sheetData) return out;
    if (depth > 12) return out;
    var pc = String(productCode || '').trim();
    if (!pc) return out;
    unitFactor = Number(unitFactor);
    if (!isFinite(unitFactor) || unitFactor <= 0) unitFactor = 1;

    visited = visited || {};
    if (visited[pc]) return out;
    visited[pc] = true;

    var lines = _collectBomLinesForProduct_(sheetData, pc, version);
    for (var li = 0; li < lines.length; li++) {
      var bl = lines[li] || {};
      var perQty = (Number(bl.perUnitQty) || 0) * unitFactor;
      if (!(perQty > 0)) continue;
      var matDirect = String(bl.matDirect || '').trim();
      var semi = String(bl.semi || '').trim();
      var nm = String(bl.bomName || '').trim();
      var sp = '';
      if (matDirect) {
        out.push({ qty: perQty, bomCode: matDirect, bomName: nm, bomSpec: sp });
      } else if (semi) {
        if (_productBomHasParentCode_(sheetData, semi)) {
          var child = _expandBomPlanningInputs_(semi, '', perQty, visited, depth + 1, sheetData);
          for (var ci = 0; ci < child.length; ci++) out.push(child[ci]);
        } else {
          out.push({ qty: perQty, bomCode: semi, bomName: nm || semi, bomSpec: sp });
        }
      }
    }

    delete visited[pc];
    return out;
  }

  /**
   * PO 부족분 계산용: 제품BOM 전개(반제품 → 하위 자재) 후 자재등록과 매칭.
   * @return {Array<{qty:number, bomCode:string, bomName:string, bomSpec:string}>}
   */
  function _getBomPlanningInputsFromProductRegister_(productCode, version) {
    var sheetData = _readProductBomSheetData_();
    if (!sheetData) return [];
    return _expandBomPlanningInputs_(productCode, version, 1, {}, 0, sheetData);
  }

  /** MRP BOM 전개 점검(완제품 행 수·반제품 하위 행 수 등) */
  function _buildBomExpansionDiagnostics_(sheetData, productCode, version, bomInputs) {
    if (!sheetData) return null;
    var ver = String(version || '').trim();
    var topLines = _collectBomLinesForProduct_(sheetData, productCode, ver);
    var semiDetails = [];
    var seenSemi = {};
    var ti;
    for (ti = 0; ti < topLines.length; ti++) {
      var bl = topLines[ti] || {};
      var mat = String(bl.matDirect || '').trim();
      if (mat) {
        semiDetails.push({ kind: 'material', code: mat, perUnitQty: bl.perUnitQty });
        continue;
      }
      var semi = String(bl.semi || '').trim();
      if (!semi) continue;
      if (seenSemi[semi]) continue;
      seenSemi[semi] = true;
      var hasChild = _productBomHasParentCode_(sheetData, semi);
      var childLines = [];
      if (hasChild) {
        childLines = _collectBomLinesForProduct_(sheetData, semi, '');
      }
      var childMat = 0;
      for (var cj = 0; cj < childLines.length; cj++) {
        if (String((childLines[cj] || {}).matDirect || '').trim()) childMat++;
      }
      semiDetails.push({
        kind: 'semi',
        code: semi,
        perUnitQty: bl.perUnitQty,
        hasChildBom: hasChild,
        childRowCount: childLines.length,
        childMaterialRowCount: childMat
      });
    }
    return {
      productCode: String(productCode || '').trim(),
      version: ver,
      topLevelRowCount: topLines.length,
      expandedBomLineCount: (bomInputs || []).length,
      semiDetails: semiDetails
    };
  }

  /**
   * BOM 전개 결과로 자재 부족분 MRP (PO 기준)
   * @param {Array<{qty:number, bomCode:string, bomName:string, bomSpec:string}>} bomInputs
   * @param {number} qty 생산·발주 기준 수량(곱)
   * @param {Object} productForReturn 응답의 product 필드
   * @return {{ok:boolean, product?:Object, quantity?:number, lines?:Array, shortageLines?:Array, error?:string}}
   */
  function _calculateMaterialPlanFromBomInputs_(bomInputs, qty, productForReturn) {
    try {
      var mats = getMaterials();
      var regMap = {};
      var regByCode = {};
      var regByCodeLoose = {};
      var foldCode = function (s) {
        return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      };
      for (var mi = 0; mi < mats.length; mi++) {
        var m = mats[mi] || {};
        var mk = _mrpMaterialKey_(m.materialName, m.specification);
        if (!regMap[mk]) regMap[mk] = m;
        var cd = _materialCpn_(m);
        if (cd && !regByCode[cd]) regByCode[cd] = m;
        var cdk = foldCode(cd);
        if (cdk && !regByCodeLoose[cdk]) regByCodeLoose[cdk] = m;
      }

      var bomAgg = {};
      for (var b = 0; b < bomInputs.length; b++) {
        var bl = bomInputs[b] || {};
        var lineQty = Number(bl.qty) || 0;
        if (!(lineQty > 0)) continue;
        var reg = null;
        var bc = String(bl.bomCode || '').trim();
        if (bc && regByCode[bc]) reg = regByCode[bc];
        if (!reg && bc) {
          var bck = foldCode(bc);
          if (bck && regByCodeLoose[bck]) reg = regByCodeLoose[bck];
        }
        if (!reg && bl.bomName) {
          reg = regMap[_mrpMaterialKey_(bl.bomName, bl.bomSpec)] || null;
        }
        var key;
        if (reg) key = _mrpMaterialKey_(reg.materialName, reg.specification);
        else key = _mrpMaterialKey_(bl.bomName || '', bl.bomSpec || '');
        if (!bomAgg[key]) {
          bomAgg[key] = { reg: reg, perQty: 0, fallback: bl };
        }
        bomAgg[key].perQty += lineQty;
      }

      var inventory = getMaterialInventory();
      var invMap = {};
      for (var ii = 0; ii < inventory.length; ii++) {
        var it = inventory[ii] || {};
        invMap[_mrpMaterialKey_(it.materialName, it.specification)] = Number(it.currentStock) || 0;
      }

      var pendingMap = _mrpBuildPendingInboundMap_();

      var lines = [];
      var shortageLines = [];
      for (var k in bomAgg) {
        var row = bomAgg[k];
        var reg = row.reg;
        var fb = row.fallback || {};
        var requiredQty = _mrpRound_((row.perQty || 0) * qty);
        var currentStock = _mrpRound_(invMap[k] || 0);
        var pendingInbound = _mrpRound_(pendingMap[k] || 0);
        var availableQty = _mrpRound_(currentStock + pendingInbound);
        var shortageQty = _mrpRound_(Math.max(0, requiredQty - availableQty));
        var unitPrice = 0;
        var supplier = '';
        var moqVal = 0;
        if (reg) {
          var bp = reg.basePrice;
          unitPrice =
            bp !== undefined && bp !== null && bp !== ''
              ? typeof bp === 'number'
                ? bp
                : parseFloat(String(bp).replace(/,/g, '')) || 0
              : 0;
          supplier = String(reg.supplier || '').trim();
          var mq0 = reg.moq;
          moqVal =
            mq0 !== undefined && mq0 !== null && mq0 !== ''
              ? typeof mq0 === 'number'
                ? mq0
                : parseFloat(String(mq0).replace(/,/g, '')) || 0
              : 0;
        }
        var displayCode = reg ? _materialCpn_(reg) : String(fb.bomCode || '').trim();
        var displayName = reg ? String(reg.materialName || '').trim() : String(fb.bomName || '').trim();
        var displaySpec = reg ? String(reg.specification || '').trim() : String(fb.bomSpec || '').trim();
        var form = reg ? String(reg.form || '').trim() : '';
        var partNo = reg ? String(_materialMpn_(reg) || '').trim() : '';

        var out = {
          materialKey: k,
          materialCode: displayCode,
          materialName: displayName,
          specification: displaySpec,
          form: form,
          partNo: partNo,
          perQty: _mrpRound_(row.perQty || 0),
          requiredQty: requiredQty,
          currentStock: currentStock,
          pendingInbound: pendingInbound,
          availableQty: availableQty,
          shortageQty: shortageQty,
          moq: moqVal,
          needOrder: shortageQty > 0,
          supplier: supplier,
          unitPrice: unitPrice,
          orderAmount: _mrpRound_(shortageQty * unitPrice)
        };
        out.warnings = [];
        if (!reg) out.warnings.push('자재등록 미매칭');
        if (out.needOrder && !out.materialCode) out.warnings.push('CPN 없음');
        lines.push(out);
        if (out.needOrder) shortageLines.push(out);
      }

      lines.sort(function (a, b) {
        return (a.materialName || '').localeCompare((b.materialName || ''), 'ko');
      });
      shortageLines.sort(function (a, b) {
        return (a.materialName || '').localeCompare((b.materialName || ''), 'ko');
      });

      return {
        ok: true,
        product: productForReturn,
        quantity: qty,
        lines: lines,
        shortageLines: shortageLines,
        warningCount: shortageLines.filter(function (x) { return x.warnings && x.warnings.length; }).length
      };
    } catch (error) {
      Logger.log('_calculateMaterialPlanFromBomInputs_ 오류: ' + error.toString());
      return { ok: false, error: error.message || String(error) };
    }
  }

  /**
   * PO 기준 부족 자재 계산
   * @param {{productCode:string, quantity:number, version?:string}} input
   * @return {{ok:boolean, product?:Object, quantity?:number, lines?:Array, shortageLines?:Array, error?:string}}
   */
  function calculateMaterialPlanForPo(input) {
    try {
      var productCode = input && input.productCode != null ? String(input.productCode).trim() : '';
      var qty = input && input.quantity != null ? Number(input.quantity) : 0;
      if (!productCode) return { ok: false, error: '제품코드를 입력하세요.' };
      if (!isFinite(qty) || qty <= 0) return { ok: false, error: 'PO 수량은 0보다 커야 합니다.' };

      var target = _findMrpProductForPlan_(productCode, '');
      if (!target) {
        target = { productCode: productCode, productName: '', version: '' };
      }

      var sheetData = _readProductBomSheetData_();
      var bomInputs = _getBomPlanningInputsFromProductRegister_(productCode, '') || [];
      if (!bomInputs.length) {
        return {
          ok: false,
          error:
            '「제품BOM」시트에서 제품코드 "' +
            productCode +
            '"에 맞는 행이 없거나, 소요량·자재코드(또는 반제품코드)가 비어 있습니다. ' +
            '반제품만 넣은 경우, 각 반제품코드를 제품코드로 하는 하위 행(자재코드·소요량)도 제품BOM에 등록해야 MRP가 전개됩니다.'
        };
      }

      var plan = _calculateMaterialPlanFromBomInputs_(bomInputs, qty, target);
      if (plan && plan.ok && sheetData) {
        plan.bomExpand = _buildBomExpansionDiagnostics_(sheetData, productCode, '', bomInputs);
        if (plan.bomExpand) plan.bomExpand.resultMaterialCount = (plan.lines || []).length;
      }
      return plan;
    } catch (error) {
      Logger.log('calculateMaterialPlanForPo 오류: ' + error.toString());
      return { ok: false, error: error.message || String(error) };
    }
  }

  /**
   * 출고 등록: 제품BOM × 수량 → 자재별 BOM 소요(requiredQty)·현재고(currentStock)
   * (출고 화면에서 기본 채울 수량은 클라이언트에서 min(소요, 현재고)로 계산)
   * @param {{productCode:string, quantity:number, version?:string}} input
   * @return {{ok:boolean, product?:Object, quantity?:number, lines?:Array, error?:string}}
   */
  function getOutboundMaterialPlanFromProductBom(input) {
    try {
      var inp = input || {};
      var productCode = String(inp.productCode != null ? inp.productCode : '').trim();
      var version = inp.version != null ? String(inp.version).trim() : '';
      var qty = inp.quantity != null ? Number(inp.quantity) : 0;
      var orderNo = inp.orderNumber != null ? String(inp.orderNumber).trim() : '';
      if (!productCode) return { ok: false, error: '제품을 선택하세요.' };
      if (!isFinite(qty) || qty <= 0) return { ok: false, error: '수량은 0보다 커야 합니다.' };

      var shippedMap = orderNo ? _buildMaterialOutboundShippedMapForOrder_(orderNo) : {};

      var plan = calculateMaterialPlanForPo({ productCode: productCode, quantity: qty, version: version });
      if (!plan || !plan.ok) {
        return { ok: false, error: plan && plan.error ? plan.error : 'BOM 소요 계산에 실패했습니다.' };
      }

      var lines = plan.lines || [];
      var out = [];
      var alreadyShippedCompleteCount = 0;
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i] || {};
        var req = Number(ln.requiredQty != null ? ln.requiredQty : 0);
        var stock = Number(ln.currentStock != null ? ln.currentStock : 0);
        var pending = Number(ln.pendingInbound != null ? ln.pendingInbound : 0);
        var avail = Number(ln.availableQty != null ? ln.availableQty : stock + pending);
        if (!isFinite(req)) req = 0;
        if (!isFinite(stock)) stock = 0;
        if (!isFinite(pending)) pending = 0;
        if (!isFinite(avail)) avail = stock + pending;
        var matCode = String(ln.materialCode != null ? ln.materialCode : '').trim();
        var matName = String(ln.materialName != null ? ln.materialName : '').trim();
        var matSpec = String(ln.specification != null ? ln.specification : '').trim();
        var lk = _materialOutboundLineKey_(matCode, matName, matSpec);
        var shipped = orderNo ? Number(shippedMap[lk]) || 0 : 0;
        var remaining = Math.max(0, req - shipped);
        if (orderNo && req > 1e-9 && remaining <= 1e-9) alreadyShippedCompleteCount++;
        out.push({
          materialCode: matCode,
          materialName: matName,
          specification: matSpec,
          partNo: String(ln.partNo != null ? ln.partNo : '').trim(),
          perQty: ln.perQty,
          requiredQty: req,
          alreadyShippedQty: shipped,
          remainingQty: remaining,
          currentStock: stock,
          pendingInbound: pending,
          availableQty: avail
        });
      }

      return {
        ok: true,
        product: plan.product,
        quantity: plan.quantity,
        orderNumber: orderNo,
        lines: out,
        alreadyShippedCompleteCount: alreadyShippedCompleteCount
      };
    } catch (error) {
      Logger.log('getOutboundMaterialPlanFromProductBom 오류: ' + error.toString());
      return { ok: false, error: error.message || String(error) };
    }
  }

  /**
   * 제품 1단위 기준 BOM 소요와 현재고로 생산 가능한 최대 대수.
   * @param {{productCode:string, version?:string}} input
   * @return {{ok:boolean, maxUnits?:number, product?:Object, bottleneck?:Object, error?:string}}
   */
  function getMaxProducibleUnitsFromBomStock(input) {
    try {
      var inp = input || {};
      var productCode = String(inp.productCode != null ? inp.productCode : '').trim();
      var version = inp.version != null ? String(inp.version).trim() : '';
      if (!productCode) return { ok: false, error: '제품코드를 입력하세요.' };

      var plan = calculateMaterialPlanForPo({ productCode: productCode, quantity: 1, version: version });
      if (!plan || !plan.ok) {
        return { ok: false, error: plan && plan.error ? plan.error : 'BOM·재고 조회에 실패했습니다.' };
      }
      var lines = plan.lines || [];
      if (!lines.length) {
        return { ok: false, error: 'BOM 구성이 없습니다.' };
      }

      var maxUnits = Number.POSITIVE_INFINITY;
      var bottleneck = null;
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i] || {};
        var per = Number(ln.perQty != null ? ln.perQty : 0);
        var stock = Number(ln.currentStock != null ? ln.currentStock : 0);
        if (!isFinite(per) || per <= 0) continue;
        if (!isFinite(stock) || stock < 0) stock = 0;
        var u = Math.floor(stock / per + 1e-9);
        if (u < maxUnits) {
          maxUnits = u;
          bottleneck = {
            materialCode: String(ln.materialCode != null ? ln.materialCode : '').trim(),
            materialName: String(ln.materialName != null ? ln.materialName : '').trim(),
            perQty: per,
            currentStock: stock,
            pendingInbound: Number(ln.pendingInbound != null ? ln.pendingInbound : 0),
            maxFromLine: u
          };
        }
      }
      if (maxUnits === Number.POSITIVE_INFINITY) {
        maxUnits = 0;
      }
      if (!isFinite(maxUnits) || maxUnits < 0) maxUnits = 0;

      return {
        ok: true,
        product: plan.product,
        maxUnits: maxUnits,
        bottleneck: bottleneck
      };
    } catch (error) {
      Logger.log('getMaxProducibleUnitsFromBomStock 오류: ' + error.toString());
      return { ok: false, error: error.message || String(error) };
    }
  }

  /**
   * 자재 발주 화면: 제품BOM 부모코드(semiCode) + 수량 → 동일 제품코드 BOM 행 기준 부족분
   * @param {{semiCode:string, quantity:number, version?:string}} payload
   * @return {{ok:boolean, product?:Object, quantity?:number, lines?:Array, shortageLines?:Array, error?:string}}
   */
  function calculateMaterialPlanForSemiFinished(payload) {
    var p = payload || {};
    var semiCode = String(p.semiCode != null ? p.semiCode : '').trim();
    var ver = p.version != null ? String(p.version).trim() : '';
    var qty = p.quantity != null ? Number(p.quantity) : 0;
    if (!semiCode) return { ok: false, error: '제품코드(BOM 부모)를 입력하세요.' };
    if (!isFinite(qty) || qty <= 0) return { ok: false, error: '수량은 0보다 커야 합니다.' };
    return calculateMaterialPlanForPo({ productCode: semiCode, quantity: qty, version: ver });
  }

  /**
   * 자재 발주 화면: 제품BOM에서 고유한 제품코드·제품명·버전 목록 (부족분 선택용)
   * 고객사: 제품BOM 열(고객사·거래처 등) 또는 동일 제품코드의 주문서 행에서 보강
   * @return {Array<{productCode:string, productName:string, version:string, customer?:string}>}
   */
  function getSemiFinishedRegisterOptions() {
    try {
      return _getMrpProductOptionsFromSheet_() || [];
    } catch (error) {
      Logger.log('getSemiFinishedRegisterOptions 오류: ' + error.toString());
      return [];
    }
  }

  /**
   * 자재 MRP — 주문서 기준 발주용 행 목록 (출하 완료 제외, 수량 직접 수정 후 MRP)
   * @return {{ok:boolean, lines?:Array, error?:string}}
   */
  function getMaterialMrpSalesOrderLines() {
    try {
      var orders = getOrders() || [];
      var shipMap = getOrderShipmentCountsMap_() || {};
      var rows = [];
      var i;
      for (i = 0; i < orders.length; i++) {
        var O = orders[i] || {};
        if (_isOrderLineFullyShipped_(O, shipMap)) continue;
        var oNum = O.orderNumber != null ? String(O.orderNumber).trim() : '';
        var pnm = O.productName != null ? String(O.productName).trim() : '';
        var code = O.productCode != null ? String(O.productCode).trim() : '';
        var qty = Math.floor(Number(O.quantity) || 0);
        if (!oNum || qty <= 0) continue;
        var vv = O.version != null ? String(O.version).trim() : '';
        var cust = O.customer != null ? String(O.customer).trim() : '';
        var sheetRow = O.sheetRow != null ? Math.floor(Number(O.sheetRow)) : 0;
        var uiKey = String(O._uiKey || oNum + '\x1e' + sheetRow + '\x1e' + String(i));
        var shipped = _dashboardShippedForOrderLine_(shipMap, O);
        rows.push({
          uiKey: uiKey,
          orderNumber: oNum,
          customer: cust,
          productCode: code,
          productName: pnm,
          version: vv,
          orderQty: qty,
          shippedQty: shipped,
          sheetRow: sheetRow,
          canMrp: !!code,
          label:
            (cust || '—') +
            ' · ' +
            oNum +
            ' · ' +
            pnm +
            (vv ? ' v' + vv : '') +
            ' · ' +
            qty +
            '개'
        });
      }
      rows.sort(function (a, b) {
        return String(b.orderNumber).localeCompare(String(a.orderNumber), undefined, { numeric: true });
      });
      return { ok: true, lines: rows };
    } catch (error) {
      Logger.log('getMaterialMrpSalesOrderLines 오류: ' + error.toString());
      return { ok: false, error: error.message || String(error), lines: [] };
    }
  }

  /**
   * BOM 부족분으로 자재발주 자동 생성(semiCode = 제품BOM 제품코드)
   * @param {{semiCode:string, quantity:number, version?:string, deliveryDate?:string, orderDate?:string, selectedMaterialKeys?:Array<string>, lineQuantities?:Object|Array}} input
   */
  function createMaterialOrdersFromSemiPlan(input) {
    try {
      var inp = input || {};
      var semiCode = String(inp.semiCode != null ? inp.semiCode : '').trim();
      var ver = inp.version != null ? String(inp.version).trim() : '';
      var qty = inp.quantity != null ? Number(inp.quantity) : 0;
      var plan = calculateMaterialPlanForSemiFinished({ semiCode: semiCode, quantity: qty, version: ver });
      return _createMaterialOrdersFromComputedPlan_(plan, inp);
    } catch (error) {
      Logger.log('createMaterialOrdersFromSemiPlan 오류: ' + error.toString());
      return { ok: false, error: error.message || String(error) };
    }
  }

  /**
   * 클라이언트에서 넘긴 발주 수량 맵 정규화 (객체 또는 {materialKey, quantity} 배열)
   * @param {*} raw
   * @return {Object<string, *>}|null
   */
  function _normalizeLineQuantitiesInput_(raw) {
    if (raw == null || typeof raw !== 'object') return null;
    var out = {};
    if (Array.isArray(raw)) {
      for (var i = 0; i < raw.length; i++) {
        var it = raw[i];
        if (!it || typeof it !== 'object') continue;
        var mk = String(it.materialKey != null ? it.materialKey : '').trim();
        if (!mk) continue;
        out[mk] = it.quantity;
      }
      return out;
    }
    for (var k in raw) {
      if (Object.prototype.hasOwnProperty.call(raw, k)) {
        out[String(k)] = raw[k];
      }
    }
    return out;
  }

  /**
   * @param {{ok:boolean, shortageLines?:Array, error?:string}} plan
   * @param {Object} input
   * @param {Object<string, number|string>|Array<{materialKey:string, quantity:number}>} [input.lineQuantities] 발주 수량(자재키별). 비어 있지 않으면 필수.
   */
  function _createMaterialOrdersFromComputedPlan_(plan, input) {
    try {
      if (!plan || !plan.ok) return { ok: false, error: (plan && plan.error) || '부족분 계산 실패' };
      var shortage = plan.shortageLines || [];
      var selectedMap = {};
      if (input && input.selectedMaterialKeys && Array.isArray(input.selectedMaterialKeys)) {
        for (var si = 0; si < input.selectedMaterialKeys.length; si++) {
          selectedMap[String(input.selectedMaterialKeys[si])] = true;
        }
        shortage = shortage.filter(function (x) {
          return !!selectedMap[String(x.materialKey || '')];
        });
      }
      if (!shortage.length) {
        return { ok: true, createdGroups: [], createdCount: 0, skippedCount: 0 };
      }

      var qtyByKey = _normalizeLineQuantitiesInput_(input && input.lineQuantities);
      var qtyStrict = qtyByKey && Object.keys(qtyByKey).length > 0;

      var orderDate = input && input.orderDate ? String(input.orderDate) : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      var deliveryDate = input && input.deliveryDate ? String(input.deliveryDate) : '';
      var grouped = {};
      var warningSkipped = [];
      for (var i = 0; i < shortage.length; i++) {
        var s = shortage[i];
        if (!(Number(s.shortageQty) > 0)) continue;
        if (!s.materialCode) {
          warningSkipped.push({
            materialKey: s.materialKey || '',
            materialName: s.materialName || '',
            specification: s.specification || '',
            reason: 'CPN 없음'
          });
          continue;
        }
        var supplier = String(s.supplier || '').trim() || '미정';
        if (!grouped[supplier]) grouped[supplier] = [];
        var mk = String(s.materialKey || '');
        var orderQ = NaN;
        if (qtyStrict && mk && qtyByKey[mk] != null && qtyByKey[mk] !== '') {
          orderQ = Number(qtyByKey[mk]);
        }
        if (!qtyStrict) {
          orderQ = Number(s.shortageQty) || 0;
        }
        if (!isFinite(orderQ) || orderQ <= 0) {
          warningSkipped.push({
            materialKey: mk,
            materialName: s.materialName || '',
            specification: s.specification || '',
            reason: qtyStrict ? '발주수량 미입력 또는 0' : '부족수량 없음'
          });
          continue;
        }
        grouped[supplier].push({
          productCode: s.materialCode || '',
          materialName: s.materialName || '',
          specification: s.specification || '',
          quantity: orderQ,
          unitPrice: Number(s.unitPrice) || 0,
          orderAmount: _mrpRound_(orderQ * (Number(s.unitPrice) || 0))
        });
      }

      var createdGroups = [];
      var createdCount = 0;
      var skippedCount = 0;
      for (var supplierKey in grouped) {
        var materials = grouped[supplierKey];
        if (!materials || !materials.length) continue;
        var res = saveMaterialOrders({
          orderDate: orderDate,
          deliveryDate: deliveryDate,
          supplier: supplierKey,
          materials: materials
        });
        if (res && res.success) {
          createdGroups.push({ supplier: supplierKey, orderNumber: res.orderNumber || '', lineCount: materials.length });
          createdCount += materials.length;
        } else {
          skippedCount += materials.length;
        }
      }
      return {
        ok: true,
        createdGroups: createdGroups,
        createdCount: createdCount,
        skippedCount: skippedCount + warningSkipped.length,
        warningSkipped: warningSkipped
      };
    } catch (error) {
      Logger.log('_createMaterialOrdersFromComputedPlan_ 오류: ' + error.toString());
      return { ok: false, error: error.message || String(error) };
    }
  }

  /**
   * PO 부족분으로 자재발주 자동 생성(공급업체별 발주번호 분리)
   * @param {{productCode:string, quantity:number, version?:string, deliveryDate?:string, orderDate?:string}} input
   * @return {{ok:boolean, createdGroups?:Array, createdCount?:number, skippedCount?:number, error?:string}}
   */
  function createMaterialOrdersFromPoPlan(input) {
    try {
      return _createMaterialOrdersFromComputedPlan_(calculateMaterialPlanForPo(input || {}), input || {});
    } catch (error) {
      Logger.log('createMaterialOrdersFromPoPlan 오류: ' + error.toString());
      return { ok: false, error: error.message || String(error) };
    }
  }

  // ========== 자재 발주 템플릿 관련 함수 ==========

  function getMaterialOrderTemplateSheet() {
    try {
      const ss = getSpreadsheet();
      let sheet = ss.getSheetByName('자재발주템플릿');
      
      if (!sheet) {
        sheet = ss.insertSheet('자재발주템플릿');
        const headers = ['템플릿ID', '템플릿명', '공급업체', '템플릿데이터', '생성일시'];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length)
          .setBackground('#f7fafc')
          .setFontColor('#4a5568')
          .setFontWeight('bold');
      }
      
      return sheet;
    } catch (error) {
      Logger.log('자재 발주 템플릿 시트 가져오기 오류: ' + error.toString());
      throw error;
    }
  }

  function generateTemplateId() {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const hours = String(today.getHours()).padStart(2, '0');
      const minutes = String(today.getMinutes()).padStart(2, '0');
      const seconds = String(today.getSeconds()).padStart(2, '0');
      
      return `TMP${year}${month}${day}${hours}${minutes}${seconds}`;
    } catch (error) {
      Logger.log('템플릿 ID 생성 오류: ' + error.toString());
      return 'TMP' + Date.now();
    }
  }

  function saveMaterialOrderTemplate(templateData) {
    try {
      const sheet = getMaterialOrderTemplateSheet();
      const templateId = generateTemplateId();
      const now = new Date();
      const createdAt = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      
      const rowData = [
        templateId,
        templateData.name || '',
        templateData.supplier || '',
        JSON.stringify(templateData),
        createdAt
      ];
      
      sheet.appendRow(rowData);
      return true;
    } catch (error) {
      Logger.log('자재 발주 템플릿 저장 오류: ' + error.toString());
      throw error;
    }
  }

  function getMaterialOrderTemplates() {
    try {
      const sheet = getMaterialOrderTemplateSheet();
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      if (values.length <= 1) {
        return [];
      }
      
      const templates = [];
      
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        
        if (!row[0] || row[0].toString().trim() === '') {
          continue;
        }
        
        let templateData = {};
        if (row[3] && row[3].toString().trim() !== '') {
          try {
            templateData = JSON.parse(row[3].toString());
          } catch (e) {
            Logger.log('템플릿 데이터 JSON 파싱 오류: ' + e.toString());
            continue;
          }
        }
        
        templates.push({
          id: row[0] ? row[0].toString() : '',
          name: row[1] ? row[1].toString() : '',
          supplier: row[2] ? row[2].toString() : '',
          materials: templateData.materials || [],
          createdAt: row[4] ? row[4].toString() : ''
        });
      }
      
      // 생성일시 기준 내림차순 정렬 (최신순)
      templates.sort(function(a, b) {
        return b.createdAt.localeCompare(a.createdAt);
      });
      
      return templates;
    } catch (error) {
      Logger.log('자재 발주 템플릿 목록 가져오기 오류: ' + error.toString());
      throw error;
    }
  }

  function getMaterialOrderTemplate(templateId) {
    try {
      const sheet = getMaterialOrderTemplateSheet();
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        
        if (row[0] && row[0].toString() === templateId) {
          let templateData = {};
          if (row[3] && row[3].toString().trim() !== '') {
            try {
              templateData = JSON.parse(row[3].toString());
            } catch (e) {
              Logger.log('템플릿 데이터 JSON 파싱 오류: ' + e.toString());
              return null;
            }
          }
          
          return {
            id: row[0] ? row[0].toString() : '',
            name: row[1] ? row[1].toString() : '',
            supplier: row[2] ? row[2].toString() : '',
            materials: templateData.materials || []
          };
        }
      }
      
      return null;
    } catch (error) {
      Logger.log('자재 발주 템플릿 조회 오류: ' + error.toString());
      throw error;
    }
  }

  function deleteMaterialOrderTemplate(templateId) {
    try {
      const sheet = getMaterialOrderTemplateSheet();
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      for (var i = 1; i < values.length; i++) {
        if (values[i][0] && values[i][0].toString() === templateId) {
          sheet.deleteRow(i + 1);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      Logger.log('자재 발주 템플릿 삭제 오류: ' + error.toString());
      throw error;
    }
  }


