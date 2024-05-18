chrome.runtime.onInstalled.addListener(function () {
    // 拡張機能がインストールされたときに、既存の設定を読み込んでコンテキストメニューを作成する
    initializePrompts();
})

function initializePrompts() {
    fetch(chrome.runtime.getURL('prompts.json'))
        .then(response => response.json())
        .then(data => {
            const promptsTimestamp = new Date(data.timestamp);
            chrome.storage.local.get(['promptsTimestamp'], (result) => {
                const localTimestamp = new Date(result.promptsTimestamp || 0);
                if (promptsTimestamp > localTimestamp) {
                    // prompts.json の内容で storage.local を更新
                    chrome.storage.local.set({ prompts: data.prompts, promptsTimestamp: promptsTimestamp.toISOString() }, () => {
                        createContextMenus(data.prompts);
                    });
                } else {
                    // storage.local の内容でコンテキストメニューを作成
                    chrome.storage.local.get(['prompts'], (result) => {
                        createContextMenus(result.prompts);
                    });
                }
            });
        });
}

// コンテキストメニューを作成する関数
function createContextMenus(menuItems) {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'myClaudeExtension',
            title: 'Claudeへ送信',
            contexts: ['selection'],
        });

        chrome.contextMenus.create({
            id: 'myChatGPTExtension',
            title: 'ChatGPTへ送信',
            contexts: ['selection'],
        });

        menuItems.forEach((item, index) => {
            chrome.contextMenus.create({
                id: `claude-menu-item-${index}`,
                title: item.name,
                parentId: 'myClaudeExtension',
                contexts: ['selection'],
            });

            chrome.contextMenus.create({
                id: `chatgpt-menu-item-${index}`,
                title: item.name,
                parentId: 'myChatGPTExtension',
                contexts: ['selection'],
            });
        });
    });
}

// 設定が変更された場合に、コンテキストメニューを再作成する
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.prompts) {
        const menuItems = changes.prompts.newValue;
        createContextMenus(menuItems);
    }
});

async function pasteAndSendMessage(
    tabId,
    message,
    maxRetries = 3,
    retryDelay = 1000
) {
    let retries = 0

    while (retries < maxRetries) {
        try {
            // テキストエリアにメッセージをペースト
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: async function (message) {
                    const textArea = document.querySelector(
                        'div[contenteditable="true"].ProseMirror'
                    )
                    if (textArea) {
                        textArea.focus()
                        textArea.innerHTML = message
                        return true
                    }
                    return false
                },
                args: [message],
                world: 'MAIN',
            })

            await new Promise((resolve) => setTimeout(resolve, 500))

            // Enterキーを押してメッセージを送信
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: async function () {
                    const editableDiv = document.querySelector(
                        'div[contenteditable="true"]'
                    )
                    if (editableDiv) {
                        editableDiv.dispatchEvent(
                            new KeyboardEvent('keydown', {
                                key: 'Enter',
                                keyCode: 13,
                                bubbles: true,
                            })
                        )
                        return true
                    }
                    return false
                },
                world: 'MAIN',
            })

            return
        } catch (error) {
            console.error('エラーが発生しました:', error.message)
            retries++
            await new Promise((resolve) => setTimeout(resolve, retryDelay))
        }
    }

    console.error('貼り付けと送信に失敗しました。')
}

async function pasteAndSendMessageToChatGPT(
    tabId,
    message,
    maxRetries = 3,
    retryDelay = 1000
) {
    let retries = 0

    while (retries < maxRetries) {
        try {
            console.log(
                `試行回数 ${
                    retries + 1
                } / ${maxRetries}: メッセージをテキストエリアにペーストする処理を開始します。`
            )
            // テキストエリアにメッセージをペースト
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: async function (message) {
                    const textArea = document.getElementById('prompt-textarea')
                    if (textArea) {
                        textArea.value = message
                        textArea.dispatchEvent(
                            new Event('input', { bubbles: true })
                        )
                        console.log(
                            'テキストエリアへのメッセージのペーストが成功しました。'
                        )
                        return true
                    } else {
                        console.warn('テキストエリアが見つかりませんでした。')
                        return false
                    }
                },
                args: [message],
                world: 'MAIN',
            })

            console.log('メッセージをペーストした後、500ミリ秒待機しています。')
            await new Promise((resolve) => setTimeout(resolve, 500))

            console.log('Enterキーを押してメッセージの送信を試みます。')
            // Enterキーを押してメッセージを送信
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: async function () {
                    const textArea = document.getElementById('prompt-textarea')
                    if (textArea) {
                        textArea.dispatchEvent(
                            new KeyboardEvent('keydown', {
                                key: 'Enter',
                                keyCode: 13,
                                bubbles: true,
                            })
                        )
                        console.log(
                            'Enterキーのイベントが正常に発火しました。メッセージの送信を試みました。'
                        )
                        return true
                    } else {
                        console.warn(
                            'メッセージの送信に必要なテキストエリアが見つかりませんでした。'
                        )
                        return false
                    }
                },
                world: 'MAIN',
            })

            console.log(
                'メッセージの送信処理が完了しました。処理を終了します。'
            )
            return
        } catch (error) {
            console.error(
                `エラーが発生しました。試行回数: ${
                    retries + 1
                } / ${maxRetries}, エラー詳細: ${error.message}`
            )
            retries++
            console.log(`${retryDelay}ミリ秒後に再試行します。`)
            await new Promise((resolve) => setTimeout(resolve, retryDelay))
        }
    }

    console.error(
        `最大試行回数 ${maxRetries} を超えました。メッセージの貼り付けと送信に失敗しました。`
    )
}

chrome.contextMenus.onClicked.addListener(async function (info, tab) {
    const menuItemId = info.menuItemId
    const selectedText = info.selectionText

    // クリックされたメニューが拡張機能のものであるかをチェック
    if (
        menuItemId.startsWith('claude-menu-item-') ||
        menuItemId.startsWith('chatgpt-menu-item-')
    ) {
        const index = parseInt(menuItemId.split('-')[3])

        // 設定からプロンプトを取得
        const { menuItems } = await new Promise((resolve) => {
            chrome.storage.local.get('menuItems', resolve)
        })

        const prompt = menuItems[index].prompt
        const message = `${prompt}:\n${selectedText}`

        // メッセージをクリップボードにコピー
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async function (message) {
                await navigator.clipboard.writeText(message)
            },
            args: [message],
            world: 'MAIN',
        })

        if (menuItemId.startsWith('claude-menu-item-')) {
            // 新しいタブでClaude AIを開く
            const newTab = await new Promise((resolve) => {
                chrome.tabs.create({ url: 'https://claude.ai/chats' }, resolve)
            })

            // 新しいタブが完全に読み込まれるまで待機
            await new Promise((resolve) => {
                chrome.tabs.onUpdated.addListener(function listener(
                    tabId,
                    info
                ) {
                    if (tabId === newTab.id && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener)
                        resolve()
                    }
                })
            })

            await new Promise((resolve) => setTimeout(resolve, 1000))

            await pasteAndSendMessage(newTab.id, message)
        } else {
            // 新しいタブでChatGPTを開く
            const newTab = await new Promise((resolve) => {
                chrome.tabs.create({ url: 'https://chat.openai.com/' }, resolve)
            })

            // 新しいタブが完全に読み込まれるまで待機
            await new Promise((resolve) => {
                chrome.tabs.onUpdated.addListener(function listener(
                    tabId,
                    info
                ) {
                    if (tabId === newTab.id && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener)
                        resolve()
                    }
                })
            })

            await new Promise((resolve) => setTimeout(resolve, 1000))

            await pasteAndSendMessageToChatGPT(newTab.id, message)
        }
    }
})
