// グローバル変数でデータを保持
let baseData = null;
let historyData = null;
let maxAttempts = 100;
let allDiseases = []; // 全疾患リスト（キャッシュ）
let selectedDiseases = new Set(); // 選択された疾患

// ページ読み込み時にデータを初期化
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setupEventListeners();
});

// JSONファイルからデータを読み込む
async function loadData() {
  try {
    // basedata.json を読み込む
    const baseResponse = await fetch(chrome.runtime.getURL('interface/data/basedata.json'));
    baseData = await baseResponse.json();

    // history.json を読み込む（IndexedDBから、なければファイルから）
    historyData = await loadHistoryData();

    // 演習回数の最大値を計算
    calculateMaxAttempts();

    // ヘッダーを更新
    updateLearningHeader();

    // 全疾患を抽出
    extractAllDiseases();

    console.log('データ読み込み成功');
    // 初期表示
    executeFilter();
  } catch (error) {
    console.error('データ読み込みエラー:', error);
    showResults('エラー: 学習履歴が見つかりません(history.json)');
  }
}

// history.jsonを読み込む（IndexedDBから、なければファイルから）
async function loadHistoryData() {
  try {
    // IndexedDBから取得を試みる
    const savedData = await new Promise((resolve, reject) => {
      const openRequest = indexedDB.open('creampi_db', 1);

      openRequest.onerror = () => {
        reject(new Error('IndexedDBを開けません'));
      };

      openRequest.onsuccess = () => {
        const db = openRequest.result;
        const transaction = db.transaction(['history'], 'readonly');
        const store = transaction.objectStore('history');
        const getRequest = store.get('history');

        getRequest.onsuccess = () => {
          if (getRequest.result) {
            resolve(getRequest.result.content);
          } else {
            resolve(null);
          }
        };

        getRequest.onerror = () => {
          reject(new Error('IndexedDBからのデータ取得に失敗'));
        };
      };
    });

    if (savedData) {
      console.log('✅ IndexedDBからhistory.jsonを読み込みました');
      return savedData;
    }

    // IndexedDBにデータがない場合、ファイルから読み込む
    console.log('⚠️ IndexedDBにデータがありません。ファイルから読み込みます');
    const historyResponse = await fetch(chrome.runtime.getURL('interface/data/history.json'));
    return await historyResponse.json();
  } catch (error) {
    console.warn('⚠️ IndexedDBからの読み込みに失敗。ファイルから読み込みます:', error);
    const historyResponse = await fetch(chrome.runtime.getURL('interface/data/history.json'));
    return await historyResponse.json();
  }
}

// 学習履歴ヘッダーを更新
function updateLearningHeader() {
  const user = historyData.ユーザ || '';
  const lastUpdate = historyData.最終更新 || '';
  const header = document.getElementById('learningHeader');

  let formattedDate = lastUpdate;
  if (lastUpdate) {
    const date = new Date(lastUpdate);
    // JSTに変換
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 0始まりなので +1
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    // 2桁揃える
    const pad = n => n.toString().padStart(2, '0');
    formattedDate = `${year}年${month}月${day}日 ${pad(hours)}時${pad(minutes)}分${pad(seconds)}秒`;
  }

  header.textContent = `${user}さんの学習履歴（${formattedDate}）`;
}

// 演習回数の最大値を計算
function calculateMaxAttempts() {
  let max = 0;
  for (const attempts of Object.values(historyData.data || {})) {
    if (attempts.length > max) {
      max = attempts.length;
    }
  }
  maxAttempts = max;
  document.getElementById('attemptsMin').max = maxAttempts;
  document.getElementById('attemptsMax').max = maxAttempts;
  document.getElementById('attemptsMax').value = maxAttempts;
  document.getElementById('attemptsMaxLabel').value = maxAttempts;
  document.getElementById('attemptsMaxLabel').max = maxAttempts;
  updateAttemptsLabel();
  generateSliderGuide();
}

// イベントリスナーの設定
function setupEventListeners() {
  // 回数フィルター
  document.getElementById('yearMin').addEventListener('input', executeFilter);
  document.getElementById('yearMax').addEventListener('input', executeFilter);

  // attemptsMin/Max スライダーのイベント
  document.getElementById('attemptsMin').addEventListener('input', () => {
    syncAttemptsInput();
    updateAttemptsLabel();
    executeFilter();
  });

  document.getElementById('attemptsMax').addEventListener('input', () => {
    syncAttemptsInput();
    updateAttemptsLabel();
    executeFilter();
  });

  // attemptsMinLabel/MaxLabel 入力フィールドのイベント
  document.getElementById('attemptsMinLabel').addEventListener('input', () => {
    syncAttemptsSlider();
    updateAttemptsLabel();
    executeFilter();
  });

  document.getElementById('attemptsMaxLabel').addEventListener('input', () => {
    syncAttemptsSlider();
    updateAttemptsLabel();
    executeFilter();
  });

  // QB正答率スライダー
  document.getElementById('qbRateSliderMin').addEventListener('input', () => {
    syncQBRateInput();
    executeFilter();
  });

  document.getElementById('qbRateSliderMax').addEventListener('input', () => {
    syncQBRateInput();
    executeFilter();
  });

  // QB正答率入力フィールド
  document.getElementById('qbRateMin').addEventListener('input', () => {
    syncQBRateSlider();
    executeFilter();
  });

  document.getElementById('qbRateMax').addEventListener('input', () => {
    syncQBRateSlider();
    executeFilter();
  });

  // MEC正答率スライダー
  document.getElementById('mecRateSliderMin').addEventListener('input', () => {
    syncMECRateInput();
    executeFilter();
  });

  document.getElementById('mecRateSliderMax').addEventListener('input', () => {
    syncMECRateInput();
    executeFilter();
  });

  // MEC正答率入力フィールド
  document.getElementById('mecRateMin').addEventListener('input', () => {
    syncMECRateSlider();
    executeFilter();
  });

  document.getElementById('mecRateMax').addEventListener('input', () => {
    syncMECRateSlider();
    executeFilter();
  });

  // すべてのチェックボックスにイベントリスナーを設定
  document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', executeFilter);
  });

  // 正答率
  document.getElementById('correctRateMin').addEventListener('input', executeFilter);
  document.getElementById('correctRateMax').addEventListener('input', executeFilter);

  // 直近誤答
  document.getElementById('recentWrongCount').addEventListener('input', () => {
    updateRecentWrongFilter();
    executeFilter();
  });

  // リセットボタン
  document.getElementById('resetBtn').addEventListener('click', resetFilters);

  // 各セクションのリセットボタン
  document.querySelectorAll('.filter-section .reset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const section = btn.closest('.filter-section');
      const filterType = section.dataset.filter;
      handleSectionReset(filterType);
    });
  });

  // 疾患検索ボックスのイベントリスナー
  const diseaseSearchInput = document.getElementById('diseaseSearch');
  if (diseaseSearchInput) {
    diseaseSearchInput.addEventListener('input', handleDiseaseSearch);
  }
}

// スライダーと入力フィールドの同期（演習回数）
function syncAttemptsInput() {
  const minVal = parseInt(document.getElementById('attemptsMin').value);
  const maxVal = parseInt(document.getElementById('attemptsMax').value);

  if (minVal > maxVal) {
    document.getElementById('attemptsMin').value = maxVal;
  }
}

function syncAttemptsSlider() {
  const minVal = parseInt(document.getElementById('attemptsMinLabel').value) || 0;
  const maxVal = parseInt(document.getElementById('attemptsMaxLabel').value) || 0;

  if (minVal > maxVal) {
    document.getElementById('attemptsMinLabel').value = maxVal;
    return;
  }

  document.getElementById('attemptsMin').value = minVal;
  document.getElementById('attemptsMax').value = maxVal;
}

// QB正答率のスライダーと入力フィールドの同期
function syncQBRateInput() {
  const minVal = parseInt(document.getElementById('qbRateSliderMin').value);
  const maxVal = parseInt(document.getElementById('qbRateSliderMax').value);

  if (minVal > maxVal) {
    document.getElementById('qbRateSliderMin').value = maxVal;
    return;
  }

  // スライダーが変更されたとき、対応する入力フィールドを更新
  if (minVal > 0) {
    document.getElementById('qbRateMin').value = minVal;
  }
  if (maxVal < 100) {
    document.getElementById('qbRateMax').value = maxVal;
  }
}

function syncQBRateSlider() {
  const minVal = parseInt(document.getElementById('qbRateMin').value) || 0;
  const maxVal = parseInt(document.getElementById('qbRateMax').value) || 0;

  if (minVal > maxVal) {
    document.getElementById('qbRateMin').value = maxVal;
    return;
  }

  document.getElementById('qbRateSliderMin').value = minVal;
  document.getElementById('qbRateSliderMax').value = maxVal;
}

// MEC正答率のスライダーと入力フィールドの同期
function syncMECRateInput() {
  const minVal = parseInt(document.getElementById('mecRateSliderMin').value);
  const maxVal = parseInt(document.getElementById('mecRateSliderMax').value);

  if (minVal > maxVal) {
    document.getElementById('mecRateSliderMin').value = maxVal;
    return;
  }

  // スライダーが変更されたとき、対応する入力フィールドを更新
  if (minVal > 0) {
    document.getElementById('mecRateMin').value = minVal;
  }
  if (maxVal < 100) {
    document.getElementById('mecRateMax').value = maxVal;
  }
}

function syncMECRateSlider() {
  const minVal = parseInt(document.getElementById('mecRateMin').value) || 0;
  const maxVal = parseInt(document.getElementById('mecRateMax').value) || 0;

  if (minVal > maxVal) {
    document.getElementById('mecRateMin').value = maxVal;
    return;
  }

  document.getElementById('mecRateSliderMin').value = minVal;
  document.getElementById('mecRateSliderMax').value = maxVal;
}

// スライドバーのガイドを生成
function generateSliderGuide() {
  const guide = document.getElementById('sliderGuide');
  const step = Math.ceil(maxAttempts / 5) || 1;
  const values = [];

  for (let i = 0; i <= maxAttempts; i += step) {
    values.push(i);
  }
  if (values[values.length - 1] !== maxAttempts) {
    values.push(maxAttempts);
  }

  let html = '';
  values.forEach(val => {
    html += `<span>${val}</span>`;
  });
  guide.innerHTML = html;
}

// 演習回数のラベルを更新
function updateAttemptsLabel() {
  const minVal = parseInt(document.getElementById('attemptsMin').value);
  const maxVal = parseInt(document.getElementById('attemptsMax').value);

  document.getElementById('attemptsMinLabel').value = minVal;
  document.getElementById('attemptsMaxLabel').value = maxVal;
}

// 直近誤答フィルターの更新（演習回数の最小値を自動調整）
function updateRecentWrongFilter() {
  const recentWrongCount = document.getElementById('recentWrongCount').value;

  if (recentWrongCount) {
    const count = parseInt(recentWrongCount);
    if (count > 0) {
      document.getElementById('attemptsMin').value = count;
      document.getElementById('attemptsMinLabel').value = count;
      updateAttemptsLabel();
    }
  } else {
    // 直近誤答がクリアされたときは、演習回数の最小値を0に戻す
    document.getElementById('attemptsMin').value = 0;
    document.getElementById('attemptsMinLabel').value = 0;
    updateAttemptsLabel();
  }
}

// フィルター実行
function executeFilter() {
  if (!baseData || !historyData) {
    return;
  }

  // basedata.json 関連フィルター
  const baseFilters = {
    yearMin: document.getElementById('yearMin').value ? parseInt(document.getElementById('yearMin').value) : null,
    yearMax: document.getElementById('yearMax').value ? parseInt(document.getElementById('yearMax').value) : null,
    divisions: getDivisionsFilter(),
    specials: getSpecialsFilter(),
    qbRateMin: document.getElementById('qbRateMin').value !== '' ? parseInt(document.getElementById('qbRateMin').value) : null,
    qbRateMax: document.getElementById('qbRateMax').value !== '' ? parseInt(document.getElementById('qbRateMax').value) : null,
    mecRateMin: document.getElementById('mecRateMin').value !== '' ? parseInt(document.getElementById('mecRateMin').value) : null,
    mecRateMax: document.getElementById('mecRateMax').value !== '' ? parseInt(document.getElementById('mecRateMax').value) : null,
    qb1Only: document.getElementById('filterByQB1').checked,
    subjects: getSelectedSubjects(),
    mecFrequentOnly: document.getElementById('filterByMECFrequent').checked,
    diseases: getSelectedDiseases()
  };

  // history.json 関連フィルター
  const historyFilters = {
    attemptsMin: parseInt(document.getElementById('attemptsMin').value),
    attemptsMax: parseInt(document.getElementById('attemptsMax').value),
    correctRateMin: document.getElementById('correctRateMin').value ? parseInt(document.getElementById('correctRateMin').value) : null,
    correctRateMax: document.getElementById('correctRateMax').value ? parseInt(document.getElementById('correctRateMax').value) : null,
    recentWrongCount: document.getElementById('recentWrongCount').value ? parseInt(document.getElementById('recentWrongCount').value) : null
  };

  const results = filterQuestions(baseFilters, historyFilters);
  displayResults(results);
}

// 区分フィルターを取得
function getDivisionsFilter() {
  const selected = [];
  let found = false;
  document.querySelectorAll('.filter-section').forEach(section => {
    const h3 = section.querySelector('h3');
    if (h3 && h3.textContent === '区分') {
      found = true;
      section.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        selected.push(cb.value);
      });
    }
  });
  return selected;
}

// 特殊フィルターを取得
function getSpecialsFilter() {
  const selected = [];
  let found = false;
  document.querySelectorAll('.filter-section').forEach(section => {
    const h3 = section.querySelector('h3');
    if (h3 && h3.textContent === '特殊') {
      found = true;
      section.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        selected.push(cb.value);
      });
    }
  });
  return selected;
}

// 選択されたQB科目を取得
function getSelectedSubjects() {
  const selected = [];
  document.querySelectorAll('.grid-checkbox input[type="checkbox"]:checked').forEach(checkbox => {
    selected.push(checkbox.value);
  });
  return selected;
}

// 問題をフィルター
function filterQuestions(baseFilters, historyFilters) {
  const results = [];
  const attemptedIds = new Set(Object.keys(historyData.data || {}));

  for (const [questionId, questionData] of Object.entries(baseData.data)) {
    const basic = questionData['基本'];
    const classification = questionData['分類'];
    const stats = questionData['統計'];
    const qbInfo = questionData['QB情報'];
    const mecInfo = questionData['MEC情報'];

    // ======== basedata.json 関連フィルター ========

    // 回数でフィルター（範囲指定）
    if (baseFilters.yearMin !== null && basic[0] < baseFilters.yearMin) {
      continue;
    }
    if (baseFilters.yearMax !== null && basic[0] > baseFilters.yearMax) {
      continue;
    }

    // 区分でフィルター
    if (baseFilters.divisions.length > 0) {
      const divisionArray = classification[0];
      let matchDivision = false;
      for (const div of divisionArray) {
        if (baseFilters.divisions.includes(div)) {
          matchDivision = true;
          break;
        }
      }
      if (!matchDivision) {
        continue;
      }
    }

    // 特殊でフィルター（分類[1]）
    if (baseFilters.specials.length > 0) {
      const special = classification[1];
      let matchSpecial = false;
      if (Array.isArray(special) && special.length > 0) {
        for (const s of special) {
          if (baseFilters.specials.includes(s)) {
            matchSpecial = true;
            break;
          }
        }
      }
      if (!matchSpecial) {
        continue;
      }
    }

    // QB正答率でフィルター
    if (stats[0] !== null) {
      const qbRate = stats[0];
      if (baseFilters.qbRateMin !== null && qbRate < baseFilters.qbRateMin) {
        continue;
      }
      if (baseFilters.qbRateMax !== null && qbRate > baseFilters.qbRateMax) {
        continue;
      }
    } else {
      if (baseFilters.qbRateMin !== null || baseFilters.qbRateMax !== null) {
        continue;
      }
    }

    // MEC正答率でフィルター
    if (stats[1] !== null) {
      const mecRate = stats[1];
      if (baseFilters.mecRateMin !== null && mecRate < baseFilters.mecRateMin) {
        continue;
      }
      if (baseFilters.mecRateMax !== null && mecRate > baseFilters.mecRateMax) {
        continue;
      }
    } else {
      if (baseFilters.mecRateMin !== null || baseFilters.mecRateMax !== null) {
        continue;
      }
    }

    // QB1周目でフィルター
    if (baseFilters.qb1Only && !qbInfo[0]) {
      continue;
    }

    // QB科目でフィルター（複数選択）
    if (baseFilters.subjects.length > 0 && !baseFilters.subjects.includes(qbInfo[1][0])) {
      continue;
    }

    // MEC頻出問題でフィルター
    if (baseFilters.mecFrequentOnly && !mecInfo[0]) {
      continue;
    }

    // 疾患名でフィルター
    if (baseFilters.diseases.length > 0) {
      const mecDiseases = mecInfo[2] || [];
      let matchDisease = false;
      for (const selectedDisease of baseFilters.diseases) {
        if (mecDiseases.includes(selectedDisease)) {
          matchDisease = true;
          break;
        }
      }
      if (!matchDisease) {
        continue;
      }
    }

    // ======== history.json 関連フィルター ========

    let attempts = [];
    let correctCount = 0;

    if (attemptedIds.has(questionId)) {
      attempts = historyData.data[questionId];
      correctCount = attempts.filter(a => a[4] === 1).length;
    }

    // 演習回数でフィルター
    if (attempts.length < historyFilters.attemptsMin || attempts.length > historyFilters.attemptsMax) {
      continue;
    }

    // 正答率でフィルター
    if (attempts.length > 0) {
      const correctRate = (correctCount / attempts.length) * 100;
      if (historyFilters.correctRateMin !== null && correctRate < historyFilters.correctRateMin) {
        continue;
      }
      if (historyFilters.correctRateMax !== null && correctRate > historyFilters.correctRateMax) {
        continue;
      }
    } else {
      if (historyFilters.correctRateMin !== null || historyFilters.correctRateMax !== null) {
        continue;
      }
    }

    // 直近N回誤答でフィルター
    if (historyFilters.recentWrongCount !== null && attempts.length > 0) {
      const recentCount = historyFilters.recentWrongCount;
      const recentAttempts = attempts.slice(0, recentCount);

      if (recentAttempts.length < recentCount) {
        continue;
      }

      const allWrong = recentAttempts.every(a => a[4] === 0);
      if (!allWrong) {
        continue;
      }
    }

    results.push({
      id: questionId,
      year: basic[0],
      block: basic[1],
      number: basic[2],
      division: classification[0][0],
      subject: qbInfo[1][0],
      attempts: attempts.length,
      correctRate: attempts.length > 0 ? ((correctCount / attempts.length) * 100).toFixed(1) : 'N/A',
      history: attempts.map((a, idx) => ({
        date: a[0],
        answer: a[3],
        correct: a[4] === 1
      })).reverse()
    });
  }

  // 問題番号でソート
  results.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.block !== b.block) return a.block.localeCompare(b.block);
    return a.number - b.number;
  });

  return results;
}

// 結果を表示
function displayResults(results) {
  const resultsDiv = document.getElementById('results');

  if (results.length === 0) {
    resultsDiv.innerHTML = '<div class="no-results">マッチする問題がありません</div>';
    return;
  }

  let html = `<div class="result-count">マッチした問題: ${results.length}件</div>`;

  results.forEach(item => {
    const attemptInfo = item.attempts > 0 ? `${item.attempts}回・${item.correctRate}%` : '未演習';

    let historyHtml = '';
    if (item.history.length > 0) {
      historyHtml = '<div class="result-history">履歴：';
      item.history.forEach((h, idx) => {
        const className = h.correct ? 'correct' : 'wrong';
        const date = new Date(h.date);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        historyHtml += `<div class="history-item ${className}" title="${dateStr}">${h.answer}</div>`;
      });
      historyHtml += '</div>';
    }

    html += `
      <div class="result-item">
        <strong class="result-id-link" data-question-id="${item.id}">${item.id}</strong>
        <div>第${item.year}回 ${item.block}ブロック 第${item.number}問</div>
        <div>${item.division} / ${item.subject}</div>
        <div style="color: #666; font-size: 10px;">演習: ${attemptInfo}</div>
        ${historyHtml}
      </div>
    `;
  });

  resultsDiv.innerHTML = html;

  // 問題IDリンクのイベントリスナーを設定
  resultsDiv.querySelectorAll('.result-id-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      const questionId = link.dataset.questionId;
      await openQuestionInViewer(questionId);
    });
  });
}

// ファイルの存在をチェック（popup.jsのロジックを流用）
async function checkFileExists(fileName) {
  try {
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
    console.error('ファイルチェックエラー:', error.message);
    return { pages: false, mec: false, any: false };
  }
}

// viewer.htmlで問題を開く（popup.jsと同じロジック）
async function openQuestionInViewer(questionId) {
  try {
    // ファイルの存在をチェック
    const exists = await checkFileExists(questionId);

    if (!exists.any) {
      console.error(`コンテンツが見つかりません: ${questionId}`);
      return;
    }

    // viewer.htmlを新規タブで開く
    const viewerUrl = chrome.runtime.getURL(
      `interface/viewer.html?id=${questionId}&pages=${exists.pages}&mec=${exists.mec}`
    );
    chrome.tabs.create({ url: viewerUrl });
  } catch (error) {
    console.error('エラーが発生しました:', error.message);
  }
}

// 結果を表示 (文字列版)
function showResults(message) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = `<div class="no-results">${message}</div>`;
}

// セクションごとのリセット関数
function handleSectionReset(filterType) {
  switch(filterType) {
    case 'division':
      document.querySelectorAll('[data-filter="division"] input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
      });
      break;
    case 'special':
      document.querySelectorAll('[data-filter="special"] input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
      });
      break;
    case 'qbrate':
      document.getElementById('qbRateMin').value = '';
      document.getElementById('qbRateMax').value = '';
      document.getElementById('qbRateSliderMin').value = 0;
      document.getElementById('qbRateSliderMax').value = 100;
      break;
    case 'mecrate':
      document.getElementById('mecRateMin').value = '';
      document.getElementById('mecRateMax').value = '';
      document.getElementById('mecRateSliderMin').value = 0;
      document.getElementById('mecRateSliderMax').value = 100;
      break;
    case 'qbmec':
      document.getElementById('filterByQB1').checked = false;
      document.getElementById('filterByMECFrequent').checked = false;
      break;
    case 'disease':
      document.getElementById('diseaseSearch').value = '';
      document.getElementById('diseaseSearchResults').innerHTML = '';
      selectedDiseases.clear();
      updateSelectedDiseasesDisplay();
      break;
    case 'subject':
      document.querySelectorAll('[data-filter="subject"] input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
      });
      break;
    case 'attempts':
      document.getElementById('attemptsMin').value = 0;
      document.getElementById('attemptsMax').value = maxAttempts;
      document.getElementById('attemptsMinLabel').value = 0;
      document.getElementById('attemptsMaxLabel').value = maxAttempts;
      updateAttemptsLabel();
      break;
    case 'correctrate':
      document.getElementById('correctRateMin').value = '';
      document.getElementById('correctRateMax').value = '';
      break;
    case 'recentwrong':
      document.getElementById('recentWrongCount').value = '';
      document.getElementById('attemptsMin').value = 0;
      document.getElementById('attemptsMinLabel').value = 0;
      updateAttemptsLabel();
      break;
  }
  executeFilter();
}

// フィルターをリセット
function resetFilters() {
  // basedata.json 関連
  document.getElementById('yearMin').value = '';
  document.getElementById('yearMax').value = '';
  document.querySelectorAll('.filter-section').forEach(section => {
    const h3 = section.querySelector('h3');
    if (h3 && (h3.textContent === '区分' || h3.textContent === '特殊')) {
      section.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
      });
    }
  });
  document.getElementById('qbRateMin').value = '';
  document.getElementById('qbRateMax').value = '';
  document.getElementById('qbRateSliderMin').value = 0;
  document.getElementById('qbRateSliderMax').value = 100;
  document.getElementById('mecRateMin').value = '';
  document.getElementById('mecRateMax').value = '';
  document.getElementById('mecRateSliderMin').value = 0;
  document.getElementById('mecRateSliderMax').value = 100;
  document.getElementById('filterByQB1').checked = false;
  document.querySelectorAll('.grid-checkbox input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });
  document.getElementById('filterByMECFrequent').checked = false;

  // 疾患検索のリセット
  document.getElementById('diseaseSearch').value = '';
  document.getElementById('diseaseSearchResults').innerHTML = '';
  selectedDiseases.clear();
  updateSelectedDiseasesDisplay();

  // history.json 関連
  document.getElementById('recentWrongCount').value = '';
  document.getElementById('attemptsMin').value = 0;
  document.getElementById('attemptsMax').value = maxAttempts;
  document.getElementById('attemptsMinLabel').value = 0;
  document.getElementById('attemptsMaxLabel').value = maxAttempts;
  document.getElementById('correctRateMin').value = '';
  document.getElementById('correctRateMax').value = '';

  executeFilter();
}

// 疾患検索関連の関数

// basedata.jsonから全疾患を抽出
function extractAllDiseases() {
  const diseaseSet = new Set();
  for (const questionData of Object.values(baseData.data)) {
    const mecInfo = questionData['MEC情報'];
    if (mecInfo && mecInfo[2] && Array.isArray(mecInfo[2])) {
      for (const disease of mecInfo[2]) {
        if (disease) {
          diseaseSet.add(disease);
        }
      }
    }
  }
  allDiseases = Array.from(diseaseSet).sort();
  console.log(`全疾患数: ${allDiseases.length}`);
}

// 疾患検索ハンドラー
function handleDiseaseSearch() {
  const searchInput = document.getElementById('diseaseSearch');
  const keyword = searchInput.value.trim().toLowerCase();
  const resultsContainer = document.getElementById('diseaseSearchResults');

  if (keyword.length === 0) {
    resultsContainer.innerHTML = '';
    return;
  }

  // キーワードで部分一致する疾患を検索（制限なし）
  const matchedDiseases = allDiseases.filter(disease =>
    disease.toLowerCase().includes(keyword)
  );

  // 検索結果を表示
  let html = '';
  matchedDiseases.forEach(disease => {
    const isChecked = selectedDiseases.has(disease);
    html += `
      <div class="disease-search-item">
        <input type="checkbox" class="disease-checkbox" value="${disease}" ${isChecked ? 'checked' : ''}>
        <span>${disease}</span>
      </div>
    `;
  });

  resultsContainer.innerHTML = html;

  // チェックボックスのイベントリスナーを設定
  resultsContainer.querySelectorAll('.disease-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', handleDiseaseCheckboxChange);
  });
}

// 疾患チェックボックスの変更ハンドラー
function handleDiseaseCheckboxChange(e) {
  const disease = e.target.value;
  if (e.target.checked) {
    selectedDiseases.add(disease);
  } else {
    selectedDiseases.delete(disease);
  }
  updateSelectedDiseasesDisplay();
  executeFilter();
}

// 選択された疾患を表示
function updateSelectedDiseasesDisplay() {
  const container = document.getElementById('selectedDiseases');
  if (selectedDiseases.size === 0) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  for (const disease of selectedDiseases) {
    html += `
      <div class="selected-disease" data-disease="${disease}">
        <span>${disease}</span>
        <button type="button" class="disease-remove-btn" data-disease="${disease}">×</button>
      </div>
    `;
  }
  container.innerHTML = html;

  // 削除ボタンのイベントリスナーを設定
  container.querySelectorAll('.disease-remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const disease = btn.dataset.disease;
      removeSelectedDisease(disease);
    });
  });
}

// 選択された疾患を削除
function removeSelectedDisease(disease) {
  selectedDiseases.delete(disease);
  updateSelectedDiseasesDisplay();

  // 検索ボックスに入力がある場合は検索結果を再表示
  const searchInput = document.getElementById('diseaseSearch');
  if (searchInput.value.trim()) {
    handleDiseaseSearch();
  }

  executeFilter();
}

// 疾患フィルターを取得
function getSelectedDiseases() {
  return Array.from(selectedDiseases);
}
