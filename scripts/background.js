/*
 * llmConfigsは、各LLM（大規模言語モデル）の設定を保持するオブジェクトです。
 * 新たなLLMを追加する際には、以下の形式に従って設定を追加してください。
 * 
 * 各LLMの設定には以下のプロパティが含まれます:
 * - url: LLMのチャットページのURL
 * - textAreaSelector: メッセージを入力するテキストエリアのCSSセレクタ
 * - enterKeyConfig: メッセージ送信に使用するEnterキーの設定
 * - specialPasteFunction: （オプション）特別な貼り付け機能を実装する関数
 * 
 * manifest.jsonの"host_permissions"へURLの登録も必要です。忘れないで。
 */
const llmConfigs = {
    claude: {
        url: 'https://claude.ai/chats',
        textAreaSelector: 'div[contenteditable="true"].ProseMirror',
        enterKeyConfig: { key: 'Enter', keyCode: 13, bubbles: true },
        specialPasteFunction: async function (message, textAreaSelector) {
            const textArea = document.querySelector(textAreaSelector);
            if (textArea) {
                textArea.focus();
                const pElement = textArea.querySelector('p');
                if (pElement) {
                    pElement.textContent = message;
                    pElement.dispatchEvent(new Event('input', { bubbles: true }));
                    return true;
                }
            }
            return false;
        }
    },
    chatgpt: {
        url: 'https://chat.openai.com/',
        textAreaSelector: '#prompt-textarea',
        enterKeyConfig: { key: 'Enter', keyCode: 13, bubbles: true },
    },
    gemini: {
        url: 'https://aistudio.google.com/app/prompts/new_chat',
        textAreaSelector: 'textarea[placeholder="Type something"]',
        enterKeyConfig: { key: 'Enter', keyCode: 13, ctrlKey: true, bubbles: true },
    },
    perplexity: {
        url: 'https://www.perplexity.ai/',
        textAreaSelector: 'textarea[placeholder]',
        enterKeyConfig: { key: 'Enter', keyCode: 13, bubbles: true },
    },
};

/*
 * 拡張機能がインストールされたときに、既存の設定を読み込んでコンテキストメニューを作成する関数。
 */
chrome.runtime.onInstalled.addListener(async function () {
    // 拡張機能がインストールされたときに、既存の設定を読み込んでコンテキストメニューを作成する
    chrome.storage.local.get('menuItems', async (data) => {
        let menuItems = data.menuItems;
        if (!menuItems) {
            // chrome.storage.localにデータがない場合は、prompts.jsonから読み込む
            const response = await fetch(chrome.runtime.getURL('prompts.json'));
            menuItems = await response.json();
            chrome.storage.local.set({ menuItems });
        }
        createContextMenus(menuItems);
    });
});

/*
 * メッセージリスナーを追加して、メニュー更新を処理する関数。
 * 受信したメッセージに基づいてコンテキストメニューを更新する。
 * 
 * @param {Object} request - 受信したメッセージの内容。
 * @param {Object} sender - メッセージを送信したオブジェクト。
 * @param {Function} sendResponse - レスポンスを送信するためのコールバック関数。
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('メッセージを受信しました:', request); // デバッグ用ログ
    if (request.action === 'updateContextMenus') {
        createContextMenus(request.menuItems);
        sendResponse({ success: true });
    }
});


/*
 * 指定されたメニューアイテムに基づいて、コンテキストメニューを作成する関数。
 * 既存のコンテキストメニューをすべて削除し、新しいメニューを作成する。
 * 
 * @param {Array} menuItems - 作成するメニューアイテムの配列。
 */
// Start of Selection
function createContextMenus(menuItems) {
    // 既存のコンテキストメニューをすべて削除
    chrome.contextMenus.removeAll(() => {
        // llmConfigsの各キーに対して処理を行う
        Object.keys(llmConfigs).forEach(llm => {
            // 各LLM用の親メニューを作成
            chrome.contextMenus.create({
                id: `my${llm.charAt(0).toUpperCase() + llm.slice(1)}Extension`,
                title: `${llm.charAt(0).toUpperCase() + llm.slice(1)}へ送信`,
                contexts: ['selection'],
            });

            // 「開く」メニューアイテムを親メニューの子として作成
            chrome.contextMenus.create({
                id: `${llm}-menu-item-open`,
                title: '開く',
                parentId: `my${llm.charAt(0).toUpperCase() + llm.slice(1)}Extension`,
                contexts: ['selection'],
            });

            // 各メニューアイテムを親メニューの子として作成
            menuItems.forEach((item, index) => {
                chrome.contextMenus.create({
                    id: `${llm}-menu-item-${index}`,
                    title: item.name,
                    parentId: `my${llm.charAt(0).toUpperCase() + llm.slice(1)}Extension`,
                    contexts: ['selection'],
                });
            });
        });
    });
}

/*
 * 設定が変更された場合に、コンテキストメニューを再作成するリスナーを追加する。
 * 
 * @param {Object} changes - 変更されたストレージデータ。
 * @param {string} namespace - 変更が発生したストレージの名前空間。
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.menuItems) {
        const menuItems = changes.menuItems.newValue
        createContextMenus(menuItems)
    }
})


/**
 * 指定されたタブのテキストエリアにメッセージをペーストし、Enterキーを押して送信する関数。
 * 
 * @param {number} tabId - メッセージを送信するタブのID。
 * @param {string} message - テキストエリアにペーストするメッセージ。
 * @param {Object} config - テキストエリアのセレクタ、Enterキーの設定、リトライ回数、リトライ間隔、特別なペースト関数を含む設定オブジェクト。
 * @param {string} config.textAreaSelector - テキストエリアを特定するためのCSSセレクタ。
 * @param {Object} config.enterKeyConfig - Enterキーのイベント設定。
 * @param {number} [config.maxRetries=3] - メッセージのペーストと送信を試みる最大回数。
 * @param {number} [config.retryDelay=1000] - リトライ間隔（ミリ秒）。
 * @param {Function} [config.specialPasteFunction] - 特別なペースト関数（オプション）。
 */
async function pasteAndSendMessage(tabId, message, config) {
    const { textAreaSelector, enterKeyConfig, maxRetries = 3, retryDelay = 1000, specialPasteFunction } = config;
    let retries = 0;

    while (retries < maxRetries) {
        try {
            console.log(`試行回数 ${retries + 1} / ${maxRetries}: メッセージをテキストエリアにペーストする処理を開始します。`);

            // テキストエリアにメッセージをペースト
            const pasteResult = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: specialPasteFunction || async function (message, textAreaSelector) {
                    const textArea = document.querySelector(textAreaSelector);
                    if (textArea) {
                        textArea.focus();
                        textArea.value = message;
                        textArea.dispatchEvent(new Event('input', { bubbles: true }));
                        console.log('テキストエリアへのメッセージのペーストが成功しました。');
                        return true;
                    } else {
                        console.warn('テキストエリアが見つかりませんでした。');
                        return false;
                    }
                },
                args: [message, textAreaSelector],
                world: 'MAIN',
            });

            if (!pasteResult[0].result) {
                throw new Error('テキストエリアへのペーストに失敗しました。');
            }

            console.log('メッセージをペーストした後、500ミリ秒待機しています。');
            await new Promise((resolve) => setTimeout(resolve, 500));

            if (enterKeyConfig) {
                console.log('Enterキーを押してメッセージの送信を試みます。');

                // Enterキーを押してメッセージを送信
                const sendResult = await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: async function (textAreaSelector, enterKeyConfig) {
                        try {
                            console.log('テキストエリアを探しています...');
                            const textArea = document.querySelector(textAreaSelector);
                            if (textArea) {
                                textArea.dispatchEvent(new KeyboardEvent('keydown', enterKeyConfig));
                                console.log('Enterキーのイベントが正常に発火しました。メッセージの送信を試みました。');
                                return true;
                            } else {
                                console.warn('メッセージの送信に必要なテキストエリアが見つかりませんでした。');
                                return false;
                            }
                        } catch (error) {
                            console.error('エラーが発生しました:', error);
                            return false;
                        }
                    },
                    args: [textAreaSelector, enterKeyConfig],
                    world: 'MAIN',
                });

                if (!sendResult[0].result) {
                    throw new Error('メッセージの送信に失敗しました。');
                }
            }

            console.log('メッセージの送信処理が完了しました。処理を終了します。');
            return;
        } catch (error) {
            console.error(`エラーが発生しました。試行回数: ${retries + 1} / ${maxRetries}, エラー詳細: ${error.message}`);
            retries++;
            console.log(`${retryDelay}ミリ秒後に再試行します。`);
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
    }

    console.error(`最大試行回数 ${maxRetries} を超えました。メッセージの貼り付けと送信に失敗しました。`);
}

/*
 * コンテキストメニューがクリックされたときに呼び出されるリスナー関数。
 * 選択されたメニューアイテムIDと選択されたテキストを取得する。
 *
 * @param {Object} info - コンテキストメニューのクリック情報。
 * @param {Object} tab - クリックされたタブの情報。
 */
chrome.contextMenus.onClicked.addListener(async function (info, tab) {
    // メニューアイテムIDと選択されたテキストを取得
    const menuItemId = info.menuItemId;
    const selectedText = info.selectionText;

    // 選択されたメニューアイテムに対応するLLMを特定
    const llm = Object.keys(llmConfigs).find(llm => menuItemId.startsWith(`${llm}-menu-item-`));
    if (llm) {
        if (menuItemId.endsWith('-open')) {
            const llmConfig = llmConfigs[llm];
            const newTab = await new Promise(resolve => chrome.tabs.create({ url: llmConfig.url }, resolve));
            await new Promise(resolve => {
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (tabId === newTab.id && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                });
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            await pasteAndSendMessage(newTab.id, selectedText, { ...llmConfig, enterKeyConfig: null });
        } else {
            const index = parseInt(menuItemId.split('-')[3]);
            const { menuItems } = await new Promise(resolve => chrome.storage.local.get('menuItems', resolve));
            const prompt = menuItems[index].prompt;
            const message = `${prompt}:\n${selectedText}`;
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async function (message) {
                    await navigator.clipboard.writeText(message);
                },
                args: [message],
                world: 'MAIN',
            });
            const llmConfig = llmConfigs[llm];
            const newTab = await new Promise(resolve => chrome.tabs.create({ url: llmConfig.url }, resolve));
            await new Promise(resolve => {
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (tabId === newTab.id && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                });
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            await pasteAndSendMessage(newTab.id, message, llmConfig);
        }
    }
});