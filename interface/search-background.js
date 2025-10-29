// 拡張機能アイコンがクリックされたとき、新規タブでsearch.htmlを開く
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('interface/search.html')
  });
});
