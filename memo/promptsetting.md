プロンプトの利用場所

1. コンテキストメニューの作成:
ユーザーが設定したプロンプトのタイトルは、コンテキストメニューの項目として利用されます。

function createContextMenus(menuItems) {
    chrome.contextMenus.removeAll(() => {
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

        menuItems.forEach((item, index) => {
            chrome.contextMenus.create({
                id: `claude-menu-item-${index}`,
                title: item.name,  // プロンプトのタイトルを利用
                parentId: 'myClaudeExtension',
                contexts: ['selection'],
            })

            chrome.contextMenus.create({
                id: `chatgpt-menu-item-${index}`,
                title: item.name,  // プロンプトのタイトルを利用
                parentId: 'myChatGPTExtension',
                contexts: ['selection'],
            })
        })
    })
}

2. メッセージの送信:
ユーザーが設定したプロンプトの中身は、選択したテキストと共にメッセージとして送信されます。

chrome.contextMenus.onClicked.addListener(async function (info, tab) {
    const menuItemId = info.menuItemId
    const selectedText = info.selectionText

    if (menuItemId.startsWith('claude-menu-item-') || menuItemId.startsWith('chatgpt-menu-item-')) {
        const index = parseInt(menuItemId.split('-')[3])

        const { menuItems } = await new Promise((resolve) => {
            chrome.storage.local.get('menuItems', resolve)
        })

        const prompt = menuItems[index].prompt  // プロンプトの中身を利用
        const message = `${prompt}:\n${selectedText}`

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async function (message) {
                await navigator.clipboard.writeText(message)
            },
            args: [message],
            world: 'MAIN',
        })

        if (menuItemId.startsWith('claude-menu-item-')) {
            const newTab = await new Promise((resolve) => {
                chrome.tabs.create({ url: 'https://claude.ai/chats' }, resolve)
            })

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
        } else {
            const newTab = await new Promise((resolve) => {
                chrome.tabs.create({ url: 'https://chat.openai.com/' }, resolve)
            })

            await new Promise((resolve) => {
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
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

プロンプトの保存場所
1. ローカルストレージ:
プロンプトはChromeのローカルストレージに保存されます。

document.getElementById('saveButton').addEventListener('click', function () {
    const menuItems = getMenuItemsFromUI()
    chrome.storage.local.set({ menuItems: menuItems }, function () {
        console.log('メニュー項目が保存されました。')
        document.getElementById('statusMessage').textContent = '保存されました。'
    })
})

function getMenuItemsFromUI() {
    const items = []
    document.querySelectorAll('.menu-item').forEach((item) => {
        const name = item.querySelector('.menu-name').value
        const prompt = item.querySelector('.menu-prompt').value
        items.push({ name, prompt })
    })
    return items
}

2. 設定変更時の再保存:
設定が変更された場合に、コンテキストメニューを再作成する部分です。

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.menuItems) {
        const menuItems = changes.menuItems.newValue
        createContextMenus(menuItems)
    }
})