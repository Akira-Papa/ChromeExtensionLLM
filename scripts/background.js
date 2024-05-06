chrome.runtime.onInstalled.addListener(function () {
    // 拡張機能がインストールされたときに、既存の設定を読み込んでコンテキストメニューを作成する
    chrome.storage.local.get('menuItems', (data) => {
        const menuItems = data.menuItems || []
        createContextMenus(menuItems)
    })
})

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

        // 設定に基づいて子メニューを作成
        menuItems.forEach((item, index) => {
            chrome.contextMenus.create({
                id: `menu-item-${index}`,
                title: item.name,
                parentId: 'myClaudeExtension',
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

chrome.contextMenus.onClicked.addListener(async function (info, tab) {
    const menuItemId = info.menuItemId
    const selectedText = info.selectionText

    // クリックされたメニューが拡張機能のものであるかをチェック
    if (menuItemId.startsWith('menu-item-')) {
        const index = parseInt(menuItemId.split('-')[2])

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

        // 新しいタブでClaude AIを開く
        const newTab = await new Promise((resolve) => {
            chrome.tabs.create({ url: 'https://claude.ai/chats' }, resolve)
        })

        // 新しいタブが完全に読み込まれるまで待機
        await new Promise((resolve) => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === newTab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener)
                    resolve()
                }
            })
        })

        await new Promise((resolve) => setTimeout(resolve, 1000))

        await pasteAndSendMessage(newTab.id, message)
    }
})
