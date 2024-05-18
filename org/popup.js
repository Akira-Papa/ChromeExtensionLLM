document.addEventListener('DOMContentLoaded', () => {
    const menuItemsContainer = document.getElementById('menu-items')
    const addItemButton = document.getElementById('add-item')
    const saveButton = document.getElementById('saveButton')
    const statusMessage = document.getElementById('statusMessage')

    // 設定を読み込む
    chrome.storage.local.get('menuItems', (data) => {
        const menuItems = data.menuItems || []
        menuItems.forEach((item) => {
            addMenuItem(item.name, item.prompt)
        })
    })

    // 項目を追加する関数
    function addMenuItem(name = '', prompt = '') {
        const menuItem = document.createElement('div')
        menuItem.classList.add('menu-item')
        menuItem.innerHTML = `
        <input type="text" class="menu-name" value="${name}" placeholder="メニュー名">
        <textarea class="menu-prompt" rows="4" cols="50" placeholder="プロンプト">${prompt}</textarea>
        <button class="remove-item">削除</button>
      `
        menuItemsContainer.appendChild(menuItem)
    }

    // 項目を追加するイベントリスナー
    addItemButton.addEventListener('click', () => {
        addMenuItem()
    })

    // 項目を削除するイベントリスナー
    menuItemsContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-item')) {
            event.target.closest('.menu-item').remove()
        }
    })

    // 設定を保存するイベントリスナー
    saveButton.addEventListener('click', () => {
        const menuItems = Array.from(menuItemsContainer.children).map(
            (item) => ({
                name: item.querySelector('.menu-name').value,
                prompt: item.querySelector('.menu-prompt').value,
            })
        )

        chrome.storage.local.set({ menuItems }, () => {
            if (chrome.runtime.lastError) {
                statusMessage.textContent =
                    'データの保存中にエラーが発生しました。'
                statusMessage.style.color = 'red'
            } else {
                statusMessage.textContent = 'データが正常に保存されました。'
                statusMessage.style.color = 'green'
            }
        })
    })
})

document.getElementById('savePrompts').addEventListener('click', savePrompts);
document.getElementById('loadPrompts').addEventListener('click', loadPrompts);

function savePrompts() {
    chrome.storage.local.get(['prompts'], (result) => {
        const prompts = result.prompts || [];
        if (prompts.length === 0) {
            console.error('No prompts found in storage.');
            return;
        }
        const data = {
            timestamp: new Date().toISOString(),
            prompts: prompts
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'prompts.json';
        a.click();
        URL.revokeObjectURL(url);
    });
}

function loadPrompts() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = JSON.parse(e.target.result);
                const promptsTimestamp = new Date(data.timestamp);
                chrome.storage.local.get(['promptsTimestamp'], (result) => {
                    const localTimestamp = new Date(result.promptsTimestamp || 0);
                    if (promptsTimestamp > localTimestamp) {
                        chrome.storage.local.set({ prompts: data.prompts, promptsTimestamp: promptsTimestamp.toISOString() }, () => {
                            createContextMenus(data.prompts);
                        });
                    } else {
                        // 既存のプロンプトを保持するか、マージするかの処理を追加
                        // ここでは単純にマージする例を示します
                        chrome.storage.local.get(['prompts'], (result) => {
                            const localPrompts = result.prompts || [];
                            const mergedPrompts = [...new Set([...localPrompts, ...data.prompts])];
                            chrome.storage.local.set({ prompts: mergedPrompts, promptsTimestamp: promptsTimestamp.toISOString() }, () => {
                                createContextMenus(mergedPrompts);
                            });
                        });
                    }
                });
            };
            reader.readAsText(file);
        }
    };
    input.click();
}