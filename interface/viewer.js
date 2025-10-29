// viewer.js - コンテンツ表示ロジック

(function() {
  'use strict';

  // デバッグ用ログ関数
  const debug = (message, data = null) => {
    console.log(`[Viewer] ${message}`, data || '');
    const debugEl = document.getElementById('debugInfo');
    if (debugEl) {
      const time = new Date().toLocaleTimeString();
      debugEl.innerHTML = `${time}: ${message}<br>${data ? JSON.stringify(data) : ''}`;
    }
  };

  // URLパラメータを取得
  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      id: params.get('id'),
      pages: params.get('pages') === 'true',
      mec: params.get('mec') === 'true'
    };
  }

  // パスを変換する関数（content-script.jsから流用）
  function convertPaths(html) {
    const baseUrl = chrome.runtime.getURL('data/graphics/');
    return html
      .replace(/href="\.\.\/graphics\//g, `href="${baseUrl}`)
      .replace(/src="\.\.\/graphics\//g, `src="${baseUrl}`)
      .replace(/url\(["']?\.\.\/graphics\//g, `url("${baseUrl}`)
      .replace(/href="graphics\//g, `href="${baseUrl}`)
      .replace(/src="graphics\//g, `src="${baseUrl}`);
  }

  // HTMLを取得
  async function fetchHTML(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const html = await response.text();
      return convertPaths(html);
    } catch (error) {
      debug('Fetch error:', error.message);
      return null;
    }
  }

  // Shadow DOMでコンテンツを作成
  function createContentShadowDOM(container, content, cssUrl, label) {
    const wrapper = document.createElement('div');
    wrapper.className = 'content-column';
    
    // ラベルを追加
    const labelEl = document.createElement('div');
    labelEl.className = 'column-label';
    labelEl.textContent = label;
    wrapper.appendChild(labelEl);
    
    // Shadow DOMを作成
    const shadowWrapper = document.createElement('div');
    shadowWrapper.className = 'content-wrapper';
    wrapper.appendChild(shadowWrapper);
    
    const shadow = shadowWrapper.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        @import url("${cssUrl}");
        :host {
          display: block;
          width: 100%;
        }
      </style>
      <div class="content">${content}</div>
    `;
    
    container.appendChild(wrapper);
    return wrapper;
  }

  // エラー表示
  function showError(message) {
    const container = document.getElementById('contentContainer');
    container.innerHTML = `
      <div class="error-container">
        <h2>⚠️ エラー</h2>
        <p>${message}</p>
      </div>
    `;
  }

  // コンテンツを読み込んで表示
  async function loadContent() {
    const params = getUrlParams();
    debug('パラメータ:', params);
    
    if (!params.id) {
      showError('IDが指定されていません');
      return;
    }
    
    // ヘッダー更新
    document.getElementById('questionId').textContent = params.id;
    
    // コンテンツコンテナ準備
    const container = document.getElementById('contentContainer');
    container.innerHTML = '<div class="content-columns" id="contentColumns"></div>';
    const columnsContainer = document.getElementById('contentColumns');
    
    // 利用可能なコンテンツを確認
    const hasPages = params.pages;
    const hasMec = params.mec;
    
    if (!hasPages && !hasMec) {
      showError('利用可能なコンテンツがありません');
      return;
    }
    
    // ステータス更新
    const statusParts = [];
    if (hasPages) statusParts.push('QB');
    if (hasMec) statusParts.push('MEC');
    document.getElementById('status').textContent = `表示中: ${statusParts.join(' & ')}`;
    
    // 単一カラムの場合のスタイル調整
    if (!hasPages || !hasMec) {
      columnsContainer.style.justifyContent = 'center';
    }
    
    try {
      // QBコンテンツ
      if (hasPages) {
        const qbUrl = chrome.runtime.getURL(`data/qb/${params.id}.html`);
        const qbContent = await fetchHTML(qbUrl);
        
        if (qbContent) {
          const wrapper = createContentShadowDOM(
            columnsContainer,
            qbContent,
            chrome.runtime.getURL('data/graphics/styles/app.css'),
            'QB'
          );
          if (!hasMec) wrapper.classList.add('single');
          debug('QB loaded');
        } else {
          debug('QB content failed to load');
        }
      }
      
      // MECコンテンツ
      if (hasMec) {
        const mecUrl = chrome.runtime.getURL(`data/mec/${params.id}.html`);
        const mecContent = await fetchHTML(mecUrl);
        
        if (mecContent) {
          const wrapper = createContentShadowDOM(
            columnsContainer,
            mecContent,
            chrome.runtime.getURL('data/graphics/styles/module.css'),
            'MEC'
          );
          if (!hasPages) wrapper.classList.add('single');
          debug('MEC loaded');
        } else {
          debug('MEC content failed to load');
        }
      }
      
      debug('Content loaded successfully');
      
    } catch (error) {
      debug('Load error:', error);
      showError('コンテンツの読み込み中にエラーが発生しました');
    }
  }

  // デバッグパネルのトグル（Dキーで表示/非表示）
  document.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') {
      const panel = document.getElementById('debugPanel');
      if (panel) {
        panel.classList.toggle('hidden');
      }
    }
  });

  // 初期化
  document.addEventListener('DOMContentLoaded', () => {
    debug('Viewer初期化');
    loadContent();
  });
})();