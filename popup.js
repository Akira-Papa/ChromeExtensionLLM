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
