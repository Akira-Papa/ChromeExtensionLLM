document.addEventListener('DOMContentLoaded', () => {
    const menuItemsContainer = document.getElementById('menu-items')
    const addItemButton = document.getElementById('add-item')
    const saveButton = document.getElementById('saveButton')
    const statusMessage = document.getElementById('statusMessage')
    // const updateMenuButton = document.getElementById('updateMenuButton') // メニュー更新ボタン
    const reorderButton = document.getElementById('reorderButton')
    const confirmReorderButton = document.getElementById('confirmReorderButton')


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
        if (event.target.classList.contains('move-up')) {
            const item = event.target.closest('.menu-item')
            if (item.previousElementSibling) {
                menuItemsContainer.insertBefore(item, item.previousElementSibling)
            }
        } else if (event.target.classList.contains('move-down')) {
            const item = event.target.closest('.menu-item')
            if (item.nextElementSibling) {
                menuItemsContainer.insertBefore(item.nextElementSibling, item)
            }
        } else if (event.target.classList.contains('remove-item')) {
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

    // メニュー更新ボタンのイベントリスナー
    // デバッグ用
    // updateMenuButton.addEventListener('click', () => {
    //     console.log('メニュー更新ボタンがクリックされました。') // デバッグ用ログ
    //     chrome.storage.local.get('menuItems', (data) => {
    //         const menuItems = data.menuItems || []
    //         console.log('メニュー項目:', menuItems) // デバッグ用ログ
    //         chrome.runtime.sendMessage({ action: 'updateContextMenus', menuItems }, (response) => {
    //             console.log('メッセージ送信後のレスポンス:', response) // デバッグ用ログ
    //             if (response && response.success) {
    //                 statusMessage.textContent = 'メニューが更新されました。'
    //                 statusMessage.style.color = 'green'
    //             } else {
    //                 statusMessage.textContent = 'メニューの更新中にエラーが発生しました。'
    //                 statusMessage.style.color = 'red'
    //             }
    //         })
    //     })
    // })

    // エクスポート関数
    document.getElementById('exportButton').addEventListener('click', function () {
        chrome.storage.local.get('menuItems', function (data) {
            const blob = new Blob([JSON.stringify(data.menuItems, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'menuItems.json'
            a.click()
            URL.revokeObjectURL(url)
            document.getElementById('statusMessage').textContent = 'エクスポートされました。'
        })
    })

    // インポート関数
    document.getElementById('importButton').addEventListener('click', function () {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'application/json'
        input.onchange = function (event) {
            const file = event.target.files[0]
            const reader = new FileReader()
            reader.onload = function (e) {
                const menuItems = JSON.parse(e.target.result)
                chrome.storage.local.set({ menuItems: menuItems }, function () {
                    console.log('メニュー項目がインポートされました。')
                    document.getElementById('statusMessage').textContent = 'インポートされました。'
                    createContextMenus(menuItems) // メニューを再作成
                })
            }
            reader.readAsText(file)
        }
        input.click()
    })

    // 使われていない？
    function getMenuItemsFromUI() {
        const items = []
        document.querySelectorAll('.menu-item').forEach((item) => {
            const name = item.querySelector('.menu-name').value
            const prompt = item.querySelector('.menu-prompt').value
            items.push({ name, prompt })
        })
        return items
    }

    let isReorderMode = false

    reorderButton.addEventListener('click', () => {
        isReorderMode = !isReorderMode
        reorderButton.style.display = isReorderMode ? 'none' : 'block'
        confirmReorderButton.style.display = isReorderMode ? 'block' : 'none'
        document.querySelectorAll('.move-buttons').forEach(btn => {
            btn.style.display = isReorderMode ? 'block' : 'none'
        })
    })

    confirmReorderButton.addEventListener('click', () => {
        const menuItems = getMenuItemsFromUI()
        chrome.storage.local.set({ menuItems }, () => {
            createContextMenus(menuItems)
            statusMessage.textContent = '順番が更新されました。'
            statusMessage.style.color = 'green'
        })
        reorderButton.style.display = 'block'
        confirmReorderButton.style.display = 'none'
        document.querySelectorAll('.move-buttons').forEach(btn => {
            btn.style.display = 'none'
        })
    })

    function addMenuItem(name = '', prompt = '') {
        const menuItem = document.createElement('div')
        menuItem.classList.add('menu-item')
        menuItem.innerHTML = `
        <input type="text" class="menu-name" value="${name}" placeholder="メニュー名">
        <textarea class="menu-prompt" rows="4" cols="50" placeholder="プロンプト">${prompt}</textarea>
        <button class="remove-item">削除</button>
        <div class="move-buttons" style="display:none;">
            <button class="move-up">↑</button>
            <button class="move-down">↓</button>
        </div>
      `
        menuItemsContainer.appendChild(menuItem)
    }

});
