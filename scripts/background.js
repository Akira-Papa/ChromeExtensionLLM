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

// メッセージリスナーを追加して、メニュー更新を処理する
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('メッセージを受信しました:', request); // デバッグ用ログ
    if (request.action === 'updateContextMenus') {
        createContextMenus(request.menuItems);
        sendResponse({ success: true });
    }
});

// コンテキストメニューを作成する関数
function createContextMenus(menuItems) {
    // 既存のコンテキストメニューをすべて削除
    chrome.contextMenus.removeAll(() => {
        // 親メニューを作成
        chrome.contextMenus.create({
            id: 'myClaudeExtension',
            title: 'Claudeへ送信',
            contexts: ['selection'],
        })

        chrome.contextMenus.create({
            id: 'myChatGPTExtension',
            title: 'ChatGPTへ送信',
            contexts: ['selection'],
        })

        chrome.contextMenus.create({
            id: 'myGeminiExtension',
            title: 'Geminiへ送信',
            contexts: ['selection'],
        })
        
        // 設定に基づいて子メニューを作成
        menuItems.forEach((item, index) => {
            chrome.contextMenus.create({
                id: `claude-menu-item-${index}`,
                title: item.name,
                parentId: 'myClaudeExtension',
                contexts: ['selection'],
            })

            chrome.contextMenus.create({
                id: `chatgpt-menu-item-${index}`,
                title: item.name,
                parentId: 'myChatGPTExtension',
                contexts: ['selection'],
            })
            chrome.contextMenus.create({
                id: `gemini-menu-item-${index}`,
                title: item.name,
                parentId: 'myGeminiExtension',
                contexts: ['selection'],
            })
        })
    })
}

// 設定が変更された場合に、コンテキストメニューを再作成する
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.menuItems) {
        const menuItems = changes.menuItems.newValue
        createContextMenus(menuItems)
    }
})

const llmConfigs = {
    claude: {
        url: 'https://claude.ai/chats',
        textAreaSelector: 'div[contenteditable="true"].ProseMirror',
        enterKeyConfig: {
            key: 'Enter',
            keyCode: 13,
            bubbles: true,
        },
        specialPasteFunction: async function (message, textAreaSelector) {
            const textArea = document.querySelector(textAreaSelector);
            if (textArea) {
                textArea.focus();
                const pElement = textArea.querySelector('p');
                if (pElement) {
                    pElement.textContent = message;
                    pElement.dispatchEvent(new Event('input', { bubbles: true }));
                    console.log('テキストエリアへのメッセージのペーストが成功しました。');
                    return true;
                } else {
                    console.warn('テキストエリア内の<p>要素が見つかりませんでした。');
                    return false;
                }
            } else {
                console.warn('テキストエリアが見つかりませんでした。');
                return false;
            }
        }
    },
    chatgpt: {
        url: 'https://chat.openai.com/',
        textAreaSelector: '#prompt-textarea',
        enterKeyConfig: {
            key: 'Enter',
            keyCode: 13,
            bubbles: true,
        },
    },
    gemini: {
        url: 'https://aistudio.google.com/app/prompts/new_chat',
        textAreaSelector: 'textarea[placeholder="Type something"]',
        enterKeyConfig: {
            key: 'Enter',
            keyCode: 13,
            ctrlKey: true, // Ctrl+Enterで「Run」ボタン押下
            bubbles: true,
        },
    },
};


async function pasteAndSendMessage(tabId, message, config) {
    const { textAreaSelector, enterKeyConfig, maxRetries = 3, retryDelay = 1000, specialPasteFunction } = config;
    let retries = 0;

    while (retries < maxRetries) {
        try {
            console.log(
                `試行回数 ${retries + 1} / ${maxRetries}: メッセージをテキストエリアにペーストする処理を開始します。`
            );
            // テキストエリアにメッセージをペースト
            await chrome.scripting.executeScript({
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

            console.log('メッセージをペーストした後、500ミリ秒待機しています。');
            await new Promise((resolve) => setTimeout(resolve, 500));

            console.log('Enterキーを押してメッセージの送信を試みます。');
            // Enterキーを押してメッセージを送信
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: async function (textAreaSelector, enterKeyConfig) {
                    try {
                        console.log('テキストエリアを探しています...');
                        const textArea = document.querySelector(textAreaSelector);
                        if (textArea) {
                            textArea.dispatchEvent(
                                new KeyboardEvent('keydown', enterKeyConfig)
                            );
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


chrome.contextMenus.onClicked.addListener(async function (info, tab) {
    const menuItemId = info.menuItemId;
    const selectedText = info.selectionText;

    // クリックされたメニューが拡張機能のものであるかをチェック
    if (
        menuItemId.startsWith('claude-menu-item-') ||
        menuItemId.startsWith('chatgpt-menu-item-') ||
        menuItemId.startsWith('gemini-menu-item-')
    ) {
        const index = parseInt(menuItemId.split('-')[3]);

        // 設定からプロンプトを取得
        const { menuItems } = await new Promise((resolve) => {
            chrome.storage.local.get('menuItems', resolve);
        });

        const prompt = menuItems[index].prompt;
        const message = `${prompt}:\n${selectedText}`;

        // メッセージをクリップボードにコピー
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async function (message) {
                await navigator.clipboard.writeText(message);
            },
            args: [message],
            world: 'MAIN',
        });

        let llmConfig;
        if (menuItemId.startsWith('claude-menu-item-')) {
            llmConfig = llmConfigs.claude;
        } else if (menuItemId.startsWith('chatgpt-menu-item-')) {
            llmConfig = llmConfigs.chatgpt;
        } else {
            llmConfig = llmConfigs.gemini;
        }

        // 新しいタブでLLMを開く
        const newTab = await new Promise((resolve) => {
            chrome.tabs.create({ url: llmConfig.url }, resolve);
        });

        // 新しいタブが完全に読み込まれるまで待機
        await new Promise((resolve) => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === newTab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            });
        });

        // 貼り付けスクリプトを実行
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await pasteAndSendMessage(newTab.id, message, llmConfig);
    }
});