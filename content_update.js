// ===== データ更新ボタンの追加 =====

(function() {
  'use strict';

  // ページのURL確認
  function isHistoryPage() {
    return window.location.pathname === '/rpv/home/history.aspx';
  }

  // データ用ページ（arbitrary_learning_check.aspx）かどうかを確認
  function isDataPage() {
    return window.location.pathname === '/rpv/home/arbitrary_learning_check.aspx';
  }

  // データ用のリストアイテムを見つける
  function findDataListItem() {
    const listItems = document.querySelectorAll('li.mec-list-title');
    for (const item of listItems) {
      const link = item.querySelector('a');
      if (link && link.textContent.trim() === '⌘データ用⌘') {
        return item;
      }
    }
    return null;
  }

  // データ更新ボタンを作成
  function createUpdateButton() {
    const button = document.createElement('button');
    button.textContent = 'データを更新する';
    button.className = 'creampi-update-button';
    button.style.cssText = `
      display: inline-block;
      margin-left: 10px;
      padding: 6px 14px;
      background: #0a8c95;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: background 0.3s ease;
      vertical-align: middle;
    `;

    button.addEventListener('mouseover', () => {
      button.style.background = '#078089';
    });

    button.addEventListener('mouseout', () => {
      button.style.background = '#0a8c95';
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      handleUpdateClick(button);
    });

    return button;
  }

  // ボタンクリック時の処理
  function handleUpdateClick(button) {
    console.log('📊 データ更新ボタンがクリックされました');

    const confirmed = confirm('データを更新しますか？更新には時間がかかります');
    if (!confirmed) {
      console.log('⏭️ ユーザーがデータ更新をキャンセルしました');
      return;
    }

    // ローディング画面を表示（ページ遷移前）
    console.log('🔄 ローディング画面を表示します');
    showLoadingScreen();

    // ページ遷移中もローディング画面を保持するためのフラグをセット
    sessionStorage.setItem('creampi-loading', 'true');

    // ページ遷移の準備
    const dataLink = findDataListItem()?.querySelector('a');
    if (dataLink && dataLink.href) {
      console.log('🔗 データ用ページを開いています:', dataLink.href);
      // わずかな遅延を入れて、ローディング画面が表示されるようにする
      setTimeout(() => {
        window.location.href = dataLink.href;
      }, 300);
    } else {
      hideLoadingScreen();
      sessionStorage.removeItem('creampi-loading');
      console.error('❌ データ用ページのリンクが見つかりません');
      alert('リンクが見つかりません。ページをリロードしてください。');
    }
  }

  // 有効な履歴ボタンを検出
  function findValidHistoryButtons() {
    const allButtons = document.querySelectorAll('a.btn.btn-xs.btn-default');
    const validButtons = [];

    allButtons.forEach((button) => {
      if (!button.hasAttribute('disabled') && button.textContent.trim() === '履歴') {
        validButtons.push(button);
      }
    });

    console.log(`🔍 ${validButtons.length}個の履歴ボタンを検出しました`);
    return validButtons;
  }

  // 履歴データを直接AJAXで取得（showHistoryModalを模倣）
  function fetchHistory(contentsId) {
  return fetch('https://mec-itutor.jp/rpv/home/question/contents_history.ashx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents_id: contentsId }),
    credentials: 'include'
  })
  .then(r => r.json());
}

  // 問題IDを正規化（例: "115A-9" → "115A009"）
  function normalizeProblemId(stateExamNo) {
    const match = stateExamNo.match(/(\d+[A-Z])-(\d+)/);
    if (match) {
      const prefix = match[1];
      const number = match[2].padStart(3, '0');
      return `ID${prefix}${number}`;
    }
    return stateExamNo;
  }

  // contents_history.ashx のデータを history.json 形式に変換
  function transformHistoryData(ashxData) {
    if (!ashxData || !ashxData.items || ashxData.items.length === 0) return [];

    const transformed = ashxData.items.map(item => {
      const implementDate = new Date(item.implement_date.replace(/\//g, '-')).toISOString().replace('Z', '').replace('.000', '');
      const learningClassification = parseInt(item.learning_classification || '0') || 0;
      const certaintyFactor = parseInt(item.certainty_factor || '0') || 0;
      const answer = item.answer || '';
      const falsehood = parseInt(item.falsehood || '0') || 0;
      const learningSecond = parseInt(item.learning_sec || '0') || 0;

      return [implementDate, learningClassification, certaintyFactor, answer, falsehood, learningSecond];
    });

    transformed.sort((a, b) => b[0].localeCompare(a[0]));
    return transformed;
  }

  // 問題番号から ID を取得
  function getQuestionIdFromAshx(ashxData) {
    if (!ashxData || !ashxData.items || ashxData.items.length === 0) return null;
    const stateExamNo = ashxData.items[0].state_exam_no;
    if (!stateExamNo) return null;
    return normalizeProblemId(stateExamNo);
  }

  // history.json に保存（バックグラウンド通信）
  function updateHistoryFile(newHistoryData) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'updateHistoryFile',
        data: newHistoryData
      }, (response) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(response || { success: false, error: '応答がありません' });
      });
    });
  }

  // history_temp.json に一時保存（バックグラウンド通信）
  function saveTempHistoryFile(tempHistoryData) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'saveTempHistoryFile',
        data: tempHistoryData
      }, (response) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(response || { success: false, error: '応答がありません' });
      });
    });
  }

  // history_temp.json から取得（バックグラウンド通信）
  function getTempHistoryFile() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'getTempHistoryFile'
      }, (response) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(response || { success: false, error: '応答がありません' });
      });
    });
  }

  // history_temp.json を削除（バックグラウンド通信）
  function deleteTempHistoryFile() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'deleteTempHistoryFile'
      }, (response) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(response || { success: false, error: '応答がありません' });
      });
    });
  }

  // ローディング画面を表示
  function showLoadingScreen() {
    // 既存のローディング画面があれば削除
    const existingLoading = document.getElementById('creampi-loading-screen');
    if (existingLoading) {
      existingLoading.remove();
    }

    // ローディングスクリーンを作成
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'creampi-loading-screen';
    loadingScreen.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    // ローディングコンテンツ
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;

    // スピナー
    const spinner = document.createElement('div');
    spinner.id = 'creampi-spinner';
    spinner.style.cssText = `
      border: 4px solid #f3f3f3;
      border-top: 4px solid #0a8c95;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    `;

    // アニメーションスタイルを追加
    const style = document.createElement('style');
    style.id = 'creampi-spinner-style';
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    if (!document.getElementById('creampi-spinner-style')) {
      document.head.appendChild(style);
    }

    content.appendChild(spinner);

    // テキスト（進捗率を含む）
    const text = document.createElement('div');
    text.id = 'creampi-progress-text';
    text.style.cssText = `
      font-size: 16px;
      color: #333;
      font-weight: 600;
      margin-bottom: 10px;
    `;

    // 「処理中...」ラベル
    const label = document.createElement('span');
    label.textContent = '処理中...';

    // 数字部分
    const number = document.createElement('span');
    number.id = 'creampi-progress-number';
    number.style.cssText = `
      font-family: monospace;
      display: inline-block;
      min-width: 4em;
      text-align: right;
    `;
    number.textContent = '0.0%';

    // 組み立て
    text.appendChild(label);
    text.appendChild(number);
    content.appendChild(text);

    // サブテキスト
    const subtext = document.createElement('div');
    subtext.style.cssText = `
      font-size: 14px;
      color: #666;
    `;
    subtext.textContent = 'データを取得・処理しています。しばらくお待ちください。';
    content.appendChild(subtext);

    loadingScreen.appendChild(content);
    document.body.appendChild(loadingScreen);

    return loadingScreen;
  }

  // 進捗率を更新
  function updateLoadingProgress(processed, total) {
    const progressText = document.getElementById('creampi-progress-text');
    if (progressText) {
      const percentage = (processed / total * 100);
      // 小数点1桁を常に表示
      const formattedPercentage = percentage.toFixed(1);
      progressText.textContent = `処理中...${formattedPercentage}%`;
    }
  }

  // ローディング画面を非表示
  function hideLoadingScreen() {
    const loadingScreen = document.getElementById('creampi-loading-screen');
    if (loadingScreen) {
      loadingScreen.remove();
    }
    // ローディングフラグをクリア
    sessionStorage.removeItem('creampi-loading');
  }

  // モーダルダイアログを作成
  function createModal(changes, downloadData, formattedJson) {
    // ローディング画面を非表示
    hideLoadingScreen();

    // 既存のモーダルがあれば削除
    const existingModal = document.getElementById('creampi-update-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // モーダルコンテナを作成
    const modal = document.createElement('div');
    modal.id = 'creampi-update-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    // モーダルコンテンツを作成
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      padding: 30px;
    `;

    // タイトル
    const title = document.createElement('h2');
    title.textContent = '📊 データ更新サマリー';
    title.style.cssText = `
      margin: 0 0 20px 0;
      font-size: 20px;
      color: #333;
      border-bottom: 3px solid #0a8c95;
      padding-bottom: 10px;
    `;
    content.appendChild(title);

    // 統計情報
    const stats = document.createElement('div');
    stats.style.cssText = `
      background: #f5f5f5;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
    `;

    const newQuestionsHtml = `
      <div style="margin-bottom: 10px;">
        <strong>📌 新規追加問題数:</strong> ${changes.newQuestions.length}
        ${changes.newQuestions.length > 0 ? `<div style="margin-left: 20px; margin-top: 5px; color: #666;">${changes.newQuestions.join(', ')}</div>` : ''}
      </div>
    `;

    const updatedQuestionsHtml = `
      <div style="margin-bottom: 10px;">
        <strong>📌 更新された問題数:</strong> ${changes.updatedQuestions.length}
        ${changes.updatedQuestions.length > 0 ? `<div style="margin-left: 20px; margin-top: 5px; color: #666;">${changes.updatedQuestions.join(', ')}</div>` : ''}
      </div>
    `;

    const totalRecordsHtml = `
      <div>
        <strong>📌 追加されたレコード総数:</strong> ${changes.totalNewRecords}
      </div>
    `;

    stats.innerHTML = newQuestionsHtml + updatedQuestionsHtml + totalRecordsHtml;
    content.appendChild(stats);

    // ガイドテキスト
    const guide = document.createElement('div');
    guide.style.cssText = `
      background: #e8f4f8;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
      border-left: 4px solid #0a8c95;
    `;
    guide.innerHTML = `
      <strong>次のステップ:</strong>
      <ol style="margin: 10px 0 0 0; padding-left: 20px;">
        <li>下の「ダウンロード」ボタンをクリックして history.json をダウンロード</li>
        <li>ダウンロードされたファイルを確認</li>
        <li>creampi/interface/data/ フォルダの history.json を置き換え</li>
        <li>ブラウザで拡張機能を再読み込み</li>
      </ol>
    `;
    content.appendChild(guide);

    // ボタンコンテナ
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    `;

    // キャンセルボタン
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'キャンセル';
    cancelButton.style.cssText = `
      padding: 10px 20px;
      background: #ccc;
      color: #333;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: background 0.3s ease;
    `;
    cancelButton.addEventListener('mouseover', () => {
      cancelButton.style.background = '#bbb';
    });
    cancelButton.addEventListener('mouseout', () => {
      cancelButton.style.background = '#ccc';
    });
    cancelButton.addEventListener('click', () => {
      modal.remove();
      console.log('⏭️ ユーザーがキャンセルしました。history.aspx に移動します');
      window.location.href = 'https://mec-itutor.jp/rpv/home/history.aspx';
    });
    buttonContainer.appendChild(cancelButton);

    // ダウンロードボタン
    const downloadButton = document.createElement('button');
    downloadButton.textContent = 'ダウンロード';
    downloadButton.style.cssText = `
      padding: 10px 20px;
      background: #0a8c95;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: background 0.3s ease;
    `;
    downloadButton.addEventListener('mouseover', () => {
      downloadButton.style.background = '#078089';
    });
    downloadButton.addEventListener('mouseout', () => {
      downloadButton.style.background = '#0a8c95';
    });
    downloadButton.addEventListener('click', () => {
      // formattedJsonが存在すれば使用、なければdownloadDataを使用（下位互換性）
      const dataToDownload = formattedJson || downloadData;
      downloadHistoryJson(dataToDownload);
      modal.remove();
      console.log('✅ history.json をダウンロードしました。history.aspx に移動します');
      // ダウンロード処理を完了させるため、少し遅延を入れる
      setTimeout(() => {
        window.location.href = 'https://mec-itutor.jp/rpv/home/history.aspx';
      }, 1000);
    });
    buttonContainer.appendChild(downloadButton);

    content.appendChild(buttonContainer);
    modal.appendChild(content);

    // ページに追加
    document.body.appendChild(modal);

    console.log('✅ 変更サマリーモーダルを表示しました');
  }

  // history.jsonをダウンロード（文字列形式を受け取る）
  function downloadHistoryJson(jsonString) {
    try {
      // jsonStringが既にフォーマット済みの文字列の場合
      let formattedJsonString;
      if (typeof jsonString === 'string') {
        formattedJsonString = jsonString;
      } else {
        // オブジェクトの場合は整形（下位互換性のため）
        formattedJsonString = JSON.stringify(jsonString, null, 2);
      }

      const blob = new Blob([formattedJsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'history.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('✅ history.json をダウンロードしました');
    } catch (error) {
      console.error('❌ ダウンロードエラー:', error);
      alert('ダウンロードに失敗しました。ブラウザのコンソールを確認してください。');
    }
  }

  // データ収集のメイン処理
  async function startDataCollection() {
    const startTime = Date.now();
    console.log('🔄 データ取得を開始します');

    // ローディング画面を表示
    showLoadingScreen();

    try {
      const validButtons = findValidHistoryButtons();
      if (validButtons.length === 0) {
        console.warn('⚠️ 有効な履歴ボタンが見つかりません');
        hideLoadingScreen();
        alert('有効な履歴ボタンが見つかりません。ページをリロードしてください。');
        return;
      }

    const questionIds = validButtons.map(btn => {
      const match = btn.getAttribute('href').match(/showHistoryModal\((\d+)\)/);
      return match ? parseInt(match[1], 10) : null;
    }).filter(id => id !== null);

    const collectedData = {};
    for (let i = 0; i < questionIds.length; i++) {
      const id = questionIds[i];
      try {
        const data = await fetchHistory(id);
        const problemId = getQuestionIdFromAshx(data);
        if (problemId) {
          collectedData[problemId] = transformHistoryData(data);
          console.log(`✅ ${problemId} (${collectedData[problemId].length}件)`);
        } else {
          console.warn(`⚠️ 問題ID取得失敗:`, data);
        }
      } catch (e) {
        console.error(`❌ ID=${id} の取得失敗`, e);
      }

      // 進捗を更新
      updateLoadingProgress(i + 1, questionIds.length);

      // 任意で数件ごとに一時保存も可能
      if ((i + 1) % 50 === 0) {
        console.log(`💾 ${i + 1}件を一時保存中（history_temp）...`);
        await saveTempHistoryFile(collectedData);
      }
    }

      // 残りを一時保存してから、本処理
      if (Object.keys(collectedData).length > 0) {
        console.log(`💾 全データを一時保存中...`);
        await saveTempHistoryFile(collectedData);

        console.log(`🔄 全データを処理中...`);
        const response = await updateHistoryFile(collectedData);

        // ユーザーに変更内容を表示してダウンロードを促す
        // レスポンスは { success: true, result: { success: true, changes, downloadData } } の形式
        const resultData = response && response.result ? response.result : response;

        if (resultData && resultData.success && resultData.changes && resultData.downloadData) {
          console.log('✅ レスポンスを受け取りました:', resultData);
          createModal(resultData.changes, resultData.downloadData, resultData.formattedJson);
        } else {
          hideLoadingScreen();
          console.error('❌ 予期しないレスポンス:', response);
          alert('データ処理に失敗しました。ブラウザのコンソールを確認してください。');
        }
      } else {
        hideLoadingScreen();
        alert('データが取得できませんでした。');
      }

      console.log(`🎉 データ収集完了！（全${questionIds.length}件、${Date.now() - startTime}ms）`);
    } catch (error) {
      hideLoadingScreen();
      console.error('❌ データ処理中にエラーが発生しました:', error);
      alert(`エラーが発生しました:\n${error.message}`);
    }
  }

  // データ更新ボタンを追加
  function addUpdateButton() {
    const listItem = findDataListItem();
    if (listItem && !listItem.querySelector('.creampi-update-button')) {
      listItem.appendChild(createUpdateButton());
      console.log('✅ データ更新ボタンを追加しました');
    }
  }

  // 初期化
  function init() {
    console.log('🚀 content_update.jsを初期化中...');
    console.log('📄 現在のパス:', window.location.pathname);

    // ページ遷移中のローディング画面を確認
    const isLoading = sessionStorage.getItem('creampi-loading') === 'true';
    if (isLoading) {
      console.log('🔄 ページ遷移中のローディング画面を再表示します');
      showLoadingScreen();
    }

    if (isHistoryPage()) {
      console.log('📍 history.aspxページを検出しました');
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addUpdateButton);
      else addUpdateButton();
      return;
    }

    if (isDataPage()) {
      console.log('📍 arbitrary_learning_check.aspxページを検出しました');
      // ローディング画面が表示中の場合は、そのまま使用
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startDataCollection);
      else startDataCollection();
      return;
    }

    // ローディング画面が表示されていた場合は非表示（対応ページではない）
    if (isLoading) {
      hideLoadingScreen();
      sessionStorage.removeItem('creampi-loading');
    }

    console.log('⏭️ 対応していないページです');
  }

  init();
})();