// ===== Shadow DOM作成関数 =====

function createContentShadowDOM(container, content, cssUrl, className) {
  const wrapper = document.createElement('div');
  wrapper.className = className;
  const shadow = wrapper.attachShadow({ mode: 'open' });

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

function createMainContainer(questionInfo) {
  const container = document.createElement('div');
  container.className = 'injected-content-container';
  container.setAttribute('data-question-id', questionInfo.id);

  const shadow = container.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      :host {
        display: block;
        margin-bottom: 20px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      .collapsible-container {
        border: 1px solid #dee2e6;
        border-radius: 8px;
        overflow: hidden;
        background: white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transition: box-shadow 0.3s ease;
      }

      .collapsible-container:has(.content-wrapper.expanded) {
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      }

      .toggle-button {
        width: 100%;
        padding: 12px 20px;
        background: linear-gradient(135deg, #0a8c95 0%, #0a8c95 50%, #deeb4e 80%, #0a8c95 100%);
        color: white;
        border: none;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background 0.3s ease, transform 0.1s ease;
      }

      .toggle-button:hover {
        background: linear-gradient(135deg, #0a8c95 0%, #0a8c95 50%, #deeb4e 70%, #0a8c95 100%);
      }

      .toggle-button:active {
        transform: scale(0.99);
      }

      .toggle-info {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .question-type {
        background: rgba(255,255,255,0.2);
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
      }

      .toggle-arrow {
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid white;
        transition: transform 0.4s cubic-bezier(0.4, 0.0, 0.2, 1);
      }

      .toggle-arrow.expanded {
        transform: rotate(180deg);
      }

      .content-wrapper {
        max-height: 0;
        overflow: hidden;
        opacity: 0;
        transform: translateY(-10px);
        transition: max-height 0.4s cubic-bezier(0.4, 0.0, 0.2, 1),
                    opacity 0.3s ease-out,
                    transform 0.3s ease-out;
        background: #f8f9fa;
      }

      .content-wrapper.expanded {
        overflow: visible; /* スクロールバーを表示しない */
        opacity: 1;
        transform: translateY(0);
        transition: max-height 0.4s cubic-bezier(0.4, 0.0, 0.2, 1),
                    opacity 0.4s ease-in,
                    transform 0.4s ease-out;
      }

      .content-columns {
        display: flex;
        gap: 20px;
        padding: 15px;
        min-height: 100px;
        animation: fadeIn 0.3s ease-out;
        box-sizing: border-box;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-5px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .content-column {
        flex: 1;
        min-width: 0; /* フレックスアイテムの縮小を許可 */
        box-sizing: border-box;
      }

      .single-column {
        justify-content: center;
      }

      .single-column .content-column {
        flex: 0 1 50%;
        max-width: 600px;
      }

      .error-message {
        padding: 20px;
        background: #fff;
        border: 1px solid #dc3545;
        border-radius: 4px;
        color: #dc3545;
        text-align: center;
      }

      .loading-message {
        padding: 20px;
        background: #fff;
        color: #6c757d;
        text-align: center;
      }

      .retry-message {
        padding: 15px;
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 4px;
        color: #856404;
        text-align: center;
        font-size: 13px;
      }
    </style>

    <div class="collapsible-container">
      <button class="toggle-button" id="toggleBtn">
        <span class="toggle-info">
          <span class="question-type">${questionInfo.type === 'multi' ? '連問' : '単問'}</span>
          <span>${questionInfo.fileName}</span>
          <span>解説コンテンツ</span><span style="opacity:0.6;font-size:0.8em;"：>Eキーで開閉</span>
        </span>
        <span class="toggle-arrow" id="toggleArrow"></span>
      </button>

      <div class="content-wrapper" id="contentWrapper">
        <div class="content-columns" id="contentColumns">
          <div class="loading-message">コンテンツを読み込み中...</div>
        </div>
      </div>
    </div>
  `;

  // トグル機能
  const toggleBtn = shadow.getElementById('toggleBtn');
  const contentWrapper = shadow.getElementById('contentWrapper');
  const toggleArrow = shadow.getElementById('toggleArrow');

  // トグル処理を関数化
  const toggleContent = () => {
    const isExpanding = !contentWrapper.classList.contains('expanded');

    if (isExpanding) {
      // 展開時: コンテンツの実際の高さを計算
      contentWrapper.style.maxHeight = 'none';
      const actualHeight = contentWrapper.scrollHeight;
      contentWrapper.style.maxHeight = '0';

      // 少し遅延させてから高さを設定（アニメーションのため）
      requestAnimationFrame(() => {
        contentWrapper.classList.add('expanded');
        contentWrapper.style.maxHeight = actualHeight + 'px';
        toggleArrow.classList.add('expanded');
      });
    } else {
      // 折りたたみ時
      contentWrapper.style.maxHeight = '0';
      contentWrapper.classList.remove('expanded');
      toggleArrow.classList.remove('expanded');
    }

    console.log(isExpanding ? '📖 展開' : '📕 折りたたみ');
  };

  // クリックで展開/折りたたみ
  toggleBtn.addEventListener('click', toggleContent);

  // Eキーで展開/折りたたみ（コンテナにdata属性を設定して識別）
  container.setAttribute('data-toggle-enabled', 'true');

  return { container, shadow };
}
