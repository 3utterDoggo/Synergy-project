// popup.js - 問題検索ロジック

(function() {
  'use strict';

  // デバッグ用ログ関数
  const debug = (message, data = null) => {
    console.log(`[Popup] ${message}`, data || '');
    const debugEl = document.getElementById('debug');
    if (debugEl) {
      debugEl.textContent = `${message} ${data ? JSON.stringify(data) : ''}`;
    }
  };

  // 問題番号を正規化する関数
  // 116A-01, 116A1, 116a-1, 116a1 → ID116A001
  function normalizeQuestionId(input) {
    debug('入力値:', input);
    
    // 空白を除去し、大文字に変換
    const cleaned = input.trim().toUpperCase();
    
    // すでにID形式の場合はそのまま返す
    if (/^ID\d{3}[A-Z]\d{3}$/.test(cleaned)) {
      debug('既にID形式:', cleaned);
      return cleaned;
    }
    
    // 問題番号形式をパース (例: 116A-01, 116A1)
    const patterns = [
      /^(\d{3})([A-Z])-(\d{1,3})$/,  // 116A-01
      /^(\d{3})([A-Z])(\d{1,3})$/,    // 116A01, 116A1
    ];
    
    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const [, num, letter, subNum] = match;
        const normalized = `ID${num.padStart(3, '0')}${letter}${subNum.padStart(3, '0')}`;
        debug('正規化成功:', normalized);
        return normalized;
      }
    }
    
    debug('正規化失敗');
    return null;
  }

  // ファイルの存在をチェック（簡易版）
  async function checkFileExists(fileName) {
    try {
      // qbとmecの両方をチェック
      const urls = [
        chrome.runtime.getURL(`data/qb/${fileName}.html`),
        chrome.runtime.getURL(`data/mec/${fileName}.html`)
      ];
      
      const results = await Promise.all(
        urls.map(url => 
          fetch(url, { method: 'HEAD' })
            .then(() => true)
            .catch(() => false)
        )
      );
      
      return {
        pages: results[0],
        mec: results[1],
        any: results[0] || results[1]
      };
    } catch (error) {
      debug('ファイルチェックエラー:', error.message);
      return { pages: false, mec: false, any: false };
    }
  }

  // 検索を実行
  async function performSearch() {
    const input = document.getElementById('searchInput');
    const button = document.getElementById('searchButton');
    const errorEl = document.getElementById('errorMessage');
    
    // エラー表示をクリア
    errorEl.classList.remove('show');
    errorEl.textContent = '';
    
    // 入力値を正規化
    const questionId = normalizeQuestionId(input.value);
    
    if (!questionId) {
      errorEl.textContent = '無効な入力形式です';
      errorEl.classList.add('show');
      return;
    }
    
    // ボタンを無効化
    button.disabled = true;
    button.textContent = '検索中...';
    
    try {
      // ファイルの存在をチェック
      const exists = await checkFileExists(questionId);
      
      if (!exists.any) {
        errorEl.textContent = 'ファイルが見つかりません';
        errorEl.classList.add('show');
        debug('ファイルなし:', questionId);
      } else {
        // viewer.htmlを新しいタブで開く
        const viewerUrl = chrome.runtime.getURL(
          `interface/viewer.html?id=${questionId}&pages=${exists.pages}&mec=${exists.mec}`
        );
        chrome.tabs.create({ url: viewerUrl });
        debug('Viewer opened:', viewerUrl);
        
        // ポップアップを閉じる（オプション）
        // window.close();
      }
    } catch (error) {
      errorEl.textContent = 'エラーが発生しました';
      errorEl.classList.add('show');
      debug('エラー:', error.message);
    } finally {
      // ボタンを再度有効化
      button.disabled = false;
      button.textContent = '検索';
    }
  }

  // 国試検索ページを開く
  function openSearchPage() {
    const searchUrl = chrome.runtime.getURL('interface/search.html');
    chrome.tabs.create({ url: searchUrl });
    debug('Search page opened:', searchUrl);
  }

  // イベントリスナーの設定
  document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    const examSearchLink = document.getElementById('examSearchLink');

    // 検索ボタンクリック
    searchButton.addEventListener('click', performSearch);

    // 国試検索ボタンクリック
    examSearchLink.addEventListener('click', (e) => {
      e.preventDefault();
      openSearchPage();
    });

    // エンターキーで検索
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performSearch();
      }
    });

    // フォーカスを入力フィールドに
    searchInput.focus();

    debug('初期化完了');
  });
})();