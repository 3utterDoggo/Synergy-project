// content_ui.js をインポート（UI関連機能）
// manifest.jsonでcontent_ui.jsとcontent_main.jsを順に読み込むため、
// content_ui.jsの関数が先に定義された状態でこのスクリプトが実行されます

(function() {
  'use strict';

  // ===== グローバル状態管理 =====
  const state = {
    container: null,
    mappingData: null,
    currentQuestionId: null,
    pollInterval: null,
    retryCount: 0,
    maxRetries: 10
  };

  // ===== 定数定義 =====
  const SELECTORS = {
    TARGET: '#ctl00_cplPageContent_upd1 > div.container.pb70 > div.col-xs-12.col-md-6.mb20',
    EXPLANATION: {
      SUCCESS: '#ctl00_cplPageContent_upd1 > div.container.pb70 > p.h4.text-success',
      DANGER: '#ctl00_cplPageContent_upd1 > div.container.pb70 > p.h4.text-danger',
      CAUTION: '#ctl00_cplPageContent_upd1 > div.container.pb70 > p.h4.text-caution'
    },
    QUESTION_NUMBER: [
      '#divTime',
      '#ctl00_cplPageContent_upd1 > div.container.pb70 > div.well.mec-bg-none.mt40 > p:nth-child(3)'
    ]
  };

  const PATTERNS = {
    QUESTION_NUMBER: /(\d{3}[A-Z]-\d{2,3})/,
    QUESTION_PARTS: /(\d+)([A-Z])-(\d+)/,
    IMAGE_UUID: /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
    IMAGE_PATH: /\/rpv\/contents\//
  };

  const CONFIG = {
    POLL_INTERVAL: 500,  // ポーリング間隔（ms）
    MAX_RETRIES: 10      // 最大リトライ回数
  };

  // リソースの利用可能性キャッシュ
  const resourceCache = new Map();

  // ===== ユーティリティ関数 =====
  
  function getExtensionURL(path) {
    // Safari/Chrome両対応のURL取得
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL(path);
    }
    // フォールバック
    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.getURL) {
      return browser.runtime.getURL(path);
    }
    // 最終フォールバック
    return path;
  }

  // エクスポネンシャルバックオフでリトライ
  async function fetchWithRetry(url, maxRetries = 3, initialDelay = 100) {
    let lastError = null;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        // 複数の方法を試す
        let response;
        
        // 方法1: 標準のfetch
        try {
          response = await fetch(url);
          if (response.ok) {
            return await response.text();
          }
        } catch (fetchError) {
          // fetchが失敗した場合、次の方法を試す
          if (i === 0) { // 初回のみログ
            console.log(`方法1 (fetch) 失敗: ${url.split('/').pop()}`);
          }
        }
        
        // 方法2: XMLHttpRequest（Safari互換性が高い）
        if (!response || !response.ok) {
          response = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.onload = () => {
              if (xhr.status === 200) {
                resolve({ ok: true, text: () => xhr.responseText });
              } else {
                reject(new Error(`XHR failed: ${xhr.status}`));
              }
            };
            xhr.onerror = () => reject(new Error('XHR network error'));
            xhr.send();
          });
          
          if (response.ok) {
            return response.text();
          }
        }
        
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) { // 最後のリトライ以外は待機
          const delay = initialDelay * Math.pow(2, i); // エクスポネンシャルバックオフ
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // 全てのリトライが失敗
    throw lastError || new Error('Fetch failed after retries');
  }

  function convertPaths(html) {
    const baseUrl = getExtensionURL('data/graphics/');
    return html
      .replace(/href="\.\.\/graphics\//g, `href="${baseUrl}`)
      .replace(/src="\.\.\/graphics\//g, `src="${baseUrl}`)
      .replace(/url\(["']?\.\.\/graphics\//g, `url("${baseUrl}`)
      .replace(/href="graphics\//g, `href="${baseUrl}`)
      .replace(/src="graphics\//g, `src="${baseUrl}`);
  }

  async function fetchHTML(url) {
    try {
      const content = await fetchWithRetry(url, 3, 100);
      return content ? convertPaths(content) : null;
    } catch (error) {
      console.warn(`Failed to fetch ${url.split('/').pop()}:`, error.message);
      return null;
    }
  }

  // リソースの利用可能性を事前チェック
  async function preloadResourceAvailability(fileName) {
    // キャッシュチェック
    if (resourceCache.has(fileName)) {
      return resourceCache.get(fileName);
    }
    
    const resources = {
      pages: null,
      mec: null
    };
    
    // 並列で可用性チェック（軽量なチェック）
    const checkPromises = [
      fetchWithRetry(getExtensionURL(`data/qb/${fileName}.html`), 1, 50)
        .then(() => { resources.pages = true; })
        .catch(() => { resources.pages = false; }),
      fetchWithRetry(getExtensionURL(`data/mec/${fileName}.html`), 1, 50)
        .then(() => { resources.mec = true; })
        .catch(() => { resources.mec = false; })
    ];
    
    await Promise.all(checkPromises);
    resourceCache.set(fileName, resources);
    
    return resources;
  }

  // ===== 問題識別関数 =====

  function getQuestionNumber() {
    for (const selector of SELECTORS.QUESTION_NUMBER) {
      const element = document.querySelector(selector);
      if (element) {
        const match = element.textContent.match(PATTERNS.QUESTION_NUMBER);
        if (match) return match[1];
      }
    }
    return null;
  }

  function convertQuestionNumber(questionNumber) {
    const match = questionNumber.match(PATTERNS.QUESTION_PARTS);
    if (!match) return null;
    
    const [, num, letter, subNum] = match;
    return `ID${num.padStart(3, '0')}${letter}${subNum.padStart(3, '0')}`;
  }

  function getImageUUID() {
    const images = document.querySelectorAll(`img[src*="${PATTERNS.IMAGE_PATH.source}"]`);
    for (const img of images) {
      const match = img.src.match(PATTERNS.IMAGE_UUID);
      if (match) return match[1];
    }
    return null;
  }

  function identifyQuestion() {
    // 1. まず問題番号で試す（最も確実）
    const questionNumber = getQuestionNumber();
    if (questionNumber) {
      const fileName = convertQuestionNumber(questionNumber);
      if (fileName) {
        console.log('📚 連問:', questionNumber, '→', fileName);
        return { type: 'multi', fileName, id: questionNumber };
      }
    }
    
    // 2. 画像UUIDで試す
    const uuid = getImageUUID();
    if (uuid && state.mappingData?.[uuid]) {
      console.log('📄 単問: UUID', uuid, '→', state.mappingData[uuid]);
      return { type: 'single', fileName: state.mappingData[uuid], id: uuid };
    }
    
    return null;
  }

  function isExplanationPage() {
    return Object.values(SELECTORS.EXPLANATION).some(sel => document.querySelector(sel));
  }


  // ===== コンテンツ注入 =====

  async function injectContent(questionInfo) {
    try {
      // 既存のコンテンツを削除
      removeContent();
      
      const targetElement = document.querySelector(SELECTORS.TARGET);
      if (!targetElement) {
        console.warn('⚠️ ターゲット要素が見つかりません');
        return false;
      }

      // リソースの可用性を事前チェック
      const availability = await preloadResourceAvailability(questionInfo.fileName);
      
      // 両方とも利用不可の場合は早期リターン
      if (!availability.pages && !availability.mec) {
        console.warn('⚠️ 利用可能なリソースがありません:', questionInfo.fileName);
        
        // エラー表示用のコンテナを作成
        const { container, shadow } = createMainContainer(questionInfo);
        const columnsContainer = shadow.getElementById('contentColumns');
        columnsContainer.innerHTML = `
          <div class="retry-message">
            リソースの読み込みに失敗しました。<br>
            ページをリロードするか、しばらく待ってから再試行してください。
          </div>
        `;
        targetElement.parentNode.insertBefore(container, targetElement);
        state.container = container;
        
        return false;
      }
      
      const { container, shadow } = createMainContainer(questionInfo);
      const columnsContainer = shadow.getElementById('contentColumns');
      
      // 利用可能なリソースのみ取得
      const fetchPromises = [];
      if (availability.pages) {
        fetchPromises.push(
          fetchHTML(getExtensionURL(`data/qb/${questionInfo.fileName}.html`))
            .catch(() => null) // エラー時はnullで続行
        );
      } else {
        fetchPromises.push(Promise.resolve(null));
      }
      
      if (availability.mec) {
        fetchPromises.push(
          fetchHTML(getExtensionURL(`data/mec/${questionInfo.fileName}.html`))
            .catch(() => null) // エラー時はnullで続行
        );
      } else {
        fetchPromises.push(Promise.resolve(null));
      }
      
      const [pagesContent, mecContent] = await Promise.all(fetchPromises);
      
      // コンテンツをクリア
      columnsContainer.innerHTML = '';
      
      // レイアウト調整とコンテンツ表示
      const hasPages = !!pagesContent;
      const hasMec = !!mecContent;
      
      if (!hasPages && !hasMec) {
        columnsContainer.innerHTML = `
          <div class="error-message">
            コンテンツの読み込みに失敗しました。<br>
            再度お試しください。
          </div>
        `;
      } else {
        if (!hasPages || !hasMec) {
          columnsContainer.classList.add('single-column');
        }
        
        // 独立したShadow DOMで各コンテンツを作成
        if (hasPages) {
          createContentShadowDOM(
            columnsContainer,
            pagesContent,
            getExtensionURL('data/graphics/styles/app.css'),
            'content-column pages-wrapper'
          );
        }
        
        if (hasMec) {
          createContentShadowDOM(
            columnsContainer,
            mecContent,
            getExtensionURL('data/graphics/styles/module.css'),
            'content-column mec-wrapper'
          );
        }
      }
      
      targetElement.parentNode.insertBefore(container, targetElement);
      state.container = container;
      
      console.log(`✅ 注入完了: ${questionInfo.fileName} [${hasPages ? 'qb' : ''}${hasPages && hasMec ? ', ' : ''}${hasMec ? 'mec' : ''}]`);
      return true;
      
    } catch (error) {
      console.error('❌ 注入エラー:', error);
      return false;
    }
  }

  function removeContent() {
    if (state.container?.parentNode) {
      state.container.parentNode.removeChild(state.container);
      state.container = null;
    }
  }

  // ===== ポーリングベースの監視 =====

  function startPolling() {
    // 既存のポーリングをクリア
    if (state.pollInterval) {
      clearInterval(state.pollInterval);
      state.pollInterval = null;
    }

    state.pollInterval = setInterval(async () => {
      try {
        // 解説ページでない場合はコンテンツを削除
        if (!isExplanationPage()) {
          if (state.currentQuestionId) {
            console.log('📝 解説ページを離れました');
            removeContent();
            state.currentQuestionId = null;
            state.retryCount = 0;
          }
          return;
        }

        // 既に注入済みの場合は何もしない
        if (state.currentQuestionId) {
          return;
        }

        // 問題を同定（未注入の場合のみ）
        const questionInfo = identifyQuestion();
        
        if (questionInfo) {
          // 新しい問題を検出した場合のみ処理
          if (state.currentQuestionId !== questionInfo.id) {
            console.log('🔍 新しい問題を検出:', questionInfo.id);
            
            const success = await injectContent(questionInfo);
            if (success) {
              state.currentQuestionId = questionInfo.id;
              state.retryCount = 0;
            } else {
              console.warn('⚠️ 注入に失敗しました。リトライします...');
            }
          }
        } else {
          // 同定失敗時のリトライロジック
          if (isExplanationPage()) {
            state.retryCount++;
            
            if (state.retryCount <= CONFIG.MAX_RETRIES) {
              if (state.retryCount % 3 === 1) {  // 3回に1回だけログ出力
                console.log(`⏳ 問題の同定待機中... (${state.retryCount}/${CONFIG.MAX_RETRIES})`);
              }
            } else if (state.retryCount === CONFIG.MAX_RETRIES + 1) {
              console.warn('❌ 問題の同定に失敗しました');
            }
          }
        }
      } catch (error) {
        console.error('❌ ポーリングエラー:', error);
      }
    }, CONFIG.POLL_INTERVAL);
    
    console.log('🔄 ポーリング開始（間隔: ' + CONFIG.POLL_INTERVAL + 'ms）');
  }

  function stopPolling() {
    if (state.pollInterval) {
      clearInterval(state.pollInterval);
      state.pollInterval = null;
      console.log('⏹️ ポーリング停止');
    }
  }

  // ===== 初期化 =====

  async function init() {
    console.log('🚀 拡張機能を初期化中...');
    
    try {
      // 1. マッピングデータを読み込み（リトライ付き）
      let mappingLoaded = false;
      try {
        const mappingUrl = getExtensionURL('data/mapping.json');
        const mappingContent = await fetchWithRetry(mappingUrl, 5, 200);
        state.mappingData = JSON.parse(mappingContent);
        mappingLoaded = true;
        console.log('📚 Mapping loaded:', Object.keys(state.mappingData).length, 'entries');
      } catch (error) {
        console.error('❌ mapping.json読み込みエラー:', error);
        // マッピングが読めない場合も継続（連問は動作可能）
        state.mappingData = {};
      }
      
      // 2. ポーリング開始
      startPolling();
      
      // 3. Eキーで展開/折りたたみのグローバルイベントリスナー
      document.addEventListener('keydown', (event) => {
        // Eキー（大文字・小文字両対応）が押された場合
        if (event.key === 'e' || event.key === 'E') {
          // 入力フィールドなどでは動作しない
          if (event.target.tagName === 'INPUT' || 
              event.target.tagName === 'TEXTAREA' || 
              event.target.contentEditable === 'true') {
            return;
          }
          
          // 現在表示されているコンテナを探す
          const activeContainer = document.querySelector('.injected-content-container[data-toggle-enabled="true"]');
          if (activeContainer && activeContainer.shadowRoot) {
            const toggleBtn = activeContainer.shadowRoot.getElementById('toggleBtn');
            if (toggleBtn) {
              toggleBtn.click();
              event.preventDefault(); // デフォルトの動作を防ぐ
            }
          }
        }
      });
      
      // 4. ページ遷移時の再初期化
      window.addEventListener('popstate', () => {
        console.log('🔄 ページ遷移を検出');
        state.currentQuestionId = null;
        state.retryCount = 0;
      });
      
      // 5. ページアンロード時のクリーンアップ
      window.addEventListener('beforeunload', () => {
        stopPolling();
      });
      
    } catch (error) {
      console.error('❌ 初期化エラー:', error);
    }
  }

  // ===== 実行 =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();