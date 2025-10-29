// ===== バックグラウンドスクリプト =====

// ===== IndexedDB管理機能 =====

const DB_NAME = 'creampi_db';
const DB_VERSION = 2;
const STORE_NAME = 'history';
const TEMP_STORE_NAME = 'history_temp';

class DatabaseManager {
  constructor() {
    this.db = null;
  }

  // IndexedDBを初期化
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ IndexedDBを開けません:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDBを初期化しました');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          console.log('✅ オブジェクトストア（history）を作成しました');
        }
        if (!db.objectStoreNames.contains(TEMP_STORE_NAME)) {
          db.createObjectStore(TEMP_STORE_NAME, { keyPath: 'id' });
          console.log('✅ オブジェクトストア（history_temp）を作成しました');
        }
      };
    });
  }

  // history.jsonデータを保存
  async saveHistoryData(historyData) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const data = {
        id: 'history',
        timestamp: Date.now(),
        content: historyData
      };

      const request = store.put(data);

      request.onerror = () => {
        console.error('❌ データ保存エラー:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log('✅ history.jsonデータをIndexedDBに保存しました');
        resolve(data);
      };
    });
  }

  // history.jsonデータを取得
  async getHistoryData() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.get('history');

      request.onerror = () => {
        console.error('❌ データ取得エラー:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        if (request.result) {
          console.log('✅ history.jsonデータをIndexedDBから取得しました');
          resolve(request.result.content);
        } else {
          console.log('⚠️ 保存されたhistory.jsonデータが見つかりません');
          resolve(null);
        }
      };
    });
  }

  // 一時データ（history_temp）を保存
  async saveTempHistoryData(tempData) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TEMP_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(TEMP_STORE_NAME);

      const data = {
        id: 'history_temp',
        timestamp: Date.now(),
        content: tempData
      };

      const request = store.put(data);

      request.onerror = () => {
        console.error('❌ 一時データ保存エラー:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log('✅ 一時データ（history_temp）をIndexedDBに保存しました');
        resolve(data);
      };
    });
  }

  // 一時データ（history_temp）を取得
  async getTempHistoryData() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TEMP_STORE_NAME], 'readonly');
      const store = transaction.objectStore(TEMP_STORE_NAME);

      const request = store.get('history_temp');

      request.onerror = () => {
        console.error('❌ 一時データ取得エラー:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        if (request.result) {
          console.log('✅ 一時データ（history_temp）をIndexedDBから取得しました');
          resolve(request.result.content);
        } else {
          console.log('⚠️ 保存された一時データが見つかりません');
          resolve(null);
        }
      };
    });
  }

  // 一時データ（history_temp）を削除
  async deleteTempHistoryData() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TEMP_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(TEMP_STORE_NAME);

      const request = store.delete('history_temp');

      request.onerror = () => {
        console.error('❌ 一時データ削除エラー:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log('✅ 一時データ（history_temp）を削除しました');
        resolve(true);
      };
    });
  }

  // history_temp.json を chrome.storage.local に保存
  async saveTempHistoryFile(tempData) {
    return new Promise((resolve, reject) => {
      const tempFile = {
        timestamp: new Date().toISOString(),
        data: tempData
      };

      chrome.storage.local.set({ 'history_temp.json': tempFile }, () => {
        if (chrome.runtime.lastError) {
          console.error('❌ history_temp.json 保存エラー:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('✅ history_temp.json を chrome.storage.local に保存しました');
          resolve(tempFile);
        }
      });
    });
  }

  // history_temp.json を chrome.storage.local から取得
  async getTempHistoryFile() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get('history_temp.json', (result) => {
        if (chrome.runtime.lastError) {
          console.error('❌ history_temp.json 取得エラー:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else if (result['history_temp.json']) {
          console.log('✅ history_temp.json を chrome.storage.local から取得しました');
          resolve(result['history_temp.json']);
        } else {
          console.log('⚠️ 保存された history_temp.json が見つかりません');
          resolve(null);
        }
      });
    });
  }

  // history_temp.json を chrome.storage.local から削除
  async deleteTempHistoryFile() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove('history_temp.json', () => {
        if (chrome.runtime.lastError) {
          console.error('❌ history_temp.json 削除エラー:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('✅ history_temp.json を chrome.storage.local から削除しました');
          resolve(true);
        }
      });
    });
  }
}

const dbManager = new DatabaseManager();

// ===== メッセージリスナー =====

// content_update.jsからのメッセージを受け取る
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateHistoryFile') {
    updateHistoryFile(request.data)
      .then((result) => {
        sendResponse({ success: true, result });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

    // 非同期処理のため、trueを返す
    return true;
  }

  if (request.action === 'saveTempHistoryFile') {
    // IndexedDB と chrome.storage.local の両方に保存
    Promise.all([
      dbManager.saveTempHistoryData(request.data),
      dbManager.saveTempHistoryFile(request.data)
    ])
      .then((results) => {
        sendResponse({ success: true, results });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

    // 非同期処理のため、trueを返す
    return true;
  }

  if (request.action === 'getTempHistoryFile') {
    dbManager.getTempHistoryFile()
      .then((result) => {
        sendResponse({ success: true, result });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

    // 非同期処理のため、trueを返す
    return true;
  }

  if (request.action === 'deleteTempHistoryFile') {
    // IndexedDB と chrome.storage.local の両方から削除
    Promise.all([
      dbManager.deleteTempHistoryData(),
      dbManager.deleteTempHistoryFile()
    ])
      .then((results) => {
        sendResponse({ success: true, results });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

    // 非同期処理のため、trueを返す
    return true;
  }
});

// ===== history.json更新処理 =====

// history.jsonを更新する（新規データ取得時の処理）
async function updateHistoryFile(newHistoryData) {
  try {
    console.log('🔄 データ処理を開始中...');

    // 1. 新規データを一時保存（IndexedDB）
    console.log('💾 新規データを一時保存中...');
    await dbManager.saveTempHistoryData(newHistoryData);

    // 2. 既存のhistory.jsonを取得
    let existingHistoryJson;
    try {
      existingHistoryJson = await fetch(chrome.runtime.getURL('interface/data/history.json'))
        .then(res => res.json());
    } catch (error) {
      console.warn('⚠️ 既存history.jsonの取得に失敗:', error);
      existingHistoryJson = { data: {}, columns: ["実施日時", "学習区分", "確信度", "解答", "正誤", "実施時間"] };
    }

    // 3. 新規データをhistory.json形式に変換
    console.log('🔀 データをhistory.json形式に変換中...');
    const newHistoryJson = convertToHistoryJsonFormat(existingHistoryJson, newHistoryData);

    // 4. 変更点を分析
    console.log('📊 変更点を分析中...');
    const changes = analyzeHistoryChanges(existingHistoryJson, newHistoryData);

    // 変更内容をログ出力
    console.log('=' .repeat(50));
    console.log('📈 データ更新サマリー');
    console.log('=' .repeat(50));
    console.log(`📌 新規追加問題数: ${changes.newQuestions.length}`);
    if (changes.newQuestions.length > 0) {
      console.log(`   ${changes.newQuestions.join(', ')}`);
    }
    console.log(`📌 更新された問題数: ${changes.updatedQuestions.length}`);
    if (changes.updatedQuestions.length > 0) {
      console.log(`   ${changes.updatedQuestions.join(', ')}`);
    }
    console.log(`📌 追加されたレコード総数: ${changes.totalNewRecords}`);
    console.log('=' .repeat(50));

    console.log('✅ データ処理が完了しました。ダウンロード準備完了');

    return {
      success: true,
      message: 'データが準備完了しました',
      changes: changes,
      downloadData: newHistoryJson,  // オブジェクトとして返す
      formattedJson: formatHistoryJson(newHistoryJson)  // フォーマット済み文字列も追加
    };
  } catch (error) {
    console.error('❌ データ処理エラー:', error);
    throw error;
  }
}

// JSONを配列1行フォーマットで文字列化する関数
function formatHistoryJson(data) {
  // キーの順序を保証したオブジェクトを作成
  const orderedData = {
    "ユーザ": data["ユーザ"],
    "最終更新": data["最終更新"],
    "columns": data["columns"],
    "data": data["data"]
  };

  // 手動でJSON文字列を構築（キー順序と配列の1行フォーマットを確保）
  let jsonString = '{\n';

  // 1. "ユーザ" キー
  jsonString += `  "ユーザ": "${orderedData["ユーザ"]}",\n`;

  // 2. "最終更新" キー
  jsonString += `  "最終更新": "${orderedData["最終更新"]}",\n`;

  // 3. "columns" キー（配列）
  const columnsJson = JSON.stringify(orderedData["columns"]);
  jsonString += `  "columns": ${columnsJson},\n`;

  // 4. "data" キー（オブジェクト内に配列）
  jsonString += '  "data": {\n';

  const dataObj = orderedData["data"];
  const questionIds = Object.keys(dataObj);

  for (let i = 0; i < questionIds.length; i++) {
    const questionId = questionIds[i];
    const records = dataObj[questionId];

    // 配列の長さに応じてフォーマットを決定
    const recordsJson = JSON.stringify(records);

    // 一定の長さ以上の場合は複数行にフォーマット
    const THRESHOLD = 100;  // 文字数のしきい値
    let formattedRecords;

    if (recordsJson.length > THRESHOLD) {
      // 複数行フォーマット：各要素を改行で区切る
      formattedRecords = '[\n';
      for (let j = 0; j < records.length; j++) {
        const recordStr = JSON.stringify(records[j]);
        formattedRecords += `      ${recordStr}`;
        if (j < records.length - 1) {
          formattedRecords += ',';
        }
        formattedRecords += '\n';
      }
      formattedRecords += '    ]';
    } else {
      // 1行フォーマット
      formattedRecords = recordsJson;
    }

    jsonString += `    "${questionId}": ${formattedRecords}`;

    // 最後以外はカンマを追加
    if (i < questionIds.length - 1) {
      jsonString += ',';
    }
    jsonString += '\n';
  }

  jsonString += '  }\n';
  jsonString += '}';

  return jsonString;
}

// 新規データをhistory.json形式に変換してマージ
function convertToHistoryJsonFormat(existingHistoryJson, newHistoryData) {
  // 既存のhistory.jsonをコピー
  const existingData = JSON.parse(JSON.stringify(existingHistoryJson));

  // 必須フィールドの確認と初期化
  const userData = existingData.ユーザ || "ユーザ情報なし";
  const columns = existingData.columns || ["実施日時", "学習区分", "確信度", "解答", "正誤", "実施時間"];
  const data = existingData.data || {};

  // 新規データをマージ
  for (const [questionId, newHistory] of Object.entries(newHistoryData)) {
    if (data[questionId]) {
      // 既存の履歴がある場合は、新規データと統合
      // 重複排除：実施日時が同じものは除外
      const existingDates = new Set(data[questionId].map(item => item[0]));
      const uniqueNewHistory = newHistory.filter(item => !existingDates.has(item[0]));

      // 既存データと新規データを統合
      data[questionId] = [...data[questionId], ...uniqueNewHistory];
    } else {
      // 新規の問題
      data[questionId] = newHistory;
    }

    // 実施日時で降順ソート
    data[questionId].sort((a, b) => {
      return new Date(b[0]) - new Date(a[0]);
    });
  }

  // 最終更新日時を現在時刻に更新（形式: "2025-10-26T14:54:04"）
  const now = new Date();
  const jstTime = new Date(now.getTime() + 9*60*60*1000);
  const isoString = jstTime.toISOString();
  const formattedDate = isoString.split('T')[0] + 'T' + isoString.split('T')[1].split('.')[0];

  // 希望の順序でオブジェクトを作成
  const result = {
    "ユーザ": userData,
    "最終更新": formattedDate,
    "columns": columns,
    "data": data
  };
  
  return result;
}

// データの変更点を分析
function analyzeHistoryChanges(existingData, newHistoryData) {
  const changes = {
    newQuestions: [],      // 新規追加された問題
    updatedQuestions: [],  // 更新された問題
    addedRecords: {},      // 各問題に追加されたレコード数
    totalNewRecords: 0
  };

  for (const [questionId, newHistory] of Object.entries(newHistoryData)) {
    if (!existingData.data || !existingData.data[questionId]) {
      // 新規の問題
      changes.newQuestions.push(questionId);
      changes.addedRecords[questionId] = newHistory.length;
      changes.totalNewRecords += newHistory.length;
    } else {
      // 既存の問題に新規レコードがあるか確認
      const existingDates = new Set(existingData.data[questionId].map(item => item[0]));
      const uniqueNewHistory = newHistory.filter(item => !existingDates.has(item[0]));

      if (uniqueNewHistory.length > 0) {
        changes.updatedQuestions.push(questionId);
        changes.addedRecords[questionId] = uniqueNewHistory.length;
        changes.totalNewRecords += uniqueNewHistory.length;
      }
    }
  }

  return changes;
}

// 既存のhistory.jsonデータと新規データをマージ
function mergeHistoryData(existingData, newHistoryData) {
  // 新規データで既存データを上書き（マージ）
  const merged = { ...existingData };
  merged.data = { ...existingData.data };

  // 各問題の履歴をマージ
  for (const [questionId, newHistory] of Object.entries(newHistoryData)) {
    // 既存の履歴がある場合は、新規データと統合
    if (merged.data[questionId]) {
      // 重複排除：実施日時が同じものは除外
      const existingDates = new Set(merged.data[questionId].map(item => item[0]));
      const uniqueNewHistory = newHistory.filter(item => !existingDates.has(item[0]));

      // 既存データと新規データを統合
      merged.data[questionId] = [...merged.data[questionId], ...uniqueNewHistory];
    } else {
      merged.data[questionId] = newHistory;
    }

    // 統合後、実施日時で降順ソート
    merged.data[questionId].sort((a, b) => {
      return new Date(b[0]) - new Date(a[0]);
    });
  }

  // 最終更新日時を現在時刻に更新
  merged['最終更新'] = new Date().toISOString();

  return merged;
}