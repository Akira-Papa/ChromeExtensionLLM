/**
 * DOMContentLoadedイベントが発生したときに実行される関数。
 * メニュー項目を格納するコンテナ要素を取得する。
 */
document.addEventListener('DOMContentLoaded', () => {
    const menuItemsContainer = document.getElementById('menu-items') // メニュー項目を格納するコンテナ要素を取得
    const addItemButton = document.getElementById('add-item') // 項目追加ボタンを取得
    // const saveButton = document.getElementById('saveButton') // 保存ボタンを取得
    const statusMessage = document.getElementById('statusMessage') // ステータスメッセージ要素を取得
    // const updateMenuButton = document.getElementById('updateMenuButton') // メニュー更新ボタン（コメントアウト）
    const exportButton = document.getElementById('exportButton') // 保存ボタンを取得
    const importButton = document.getElementById('importButton') // 保存ボタンを取得
    const reorderButton = document.getElementById('reorderButton') // 項目並び替えボタンを取得
    const confirmReorderButton = document.getElementById('confirmReorderButton') // 並び替え確定ボタンを取得

    // メニュー項目の変更を監視し、自動保存する
    menuItemsContainer.addEventListener('input', () => {
        const menuItems = getMenuItemsFromUI()
        chrome.storage.local.set({ menuItems }, () => {
            statusMessage.textContent = '自動保存されました。'
            statusMessage.style.color = 'green'
        })
    })

    /**
     * 設定を読み込む関数。
     * chrome.storage.localから'menuItems'を取得し、メニュー項目を初期化する。
     */
    // chrome.storage.localから'menuItems'を取得する
    chrome.storage.local.get('menuItems', (data) => {
        // 取得したデータが存在しない場合は空の配列を使用
        const menuItems = data.menuItems || []
        // 各メニュー項目を追加する
        menuItems.forEach((item) => {
            addMenuItem(item.name, item.prompt)
        })
    })

    /**
     * 項目を追加する関数。
     * メニュー項目の名前とプロンプトを受け取り、新しいメニュー項目を作成してコンテナに追加する。
     * @param {string} name - メニュー項目の名前（デフォルトは空文字列）。
     * @param {string} prompt - メニュー項目のプロンプト（デフォルトは空文字列）。
     */
    function addMenuItem(name = '', prompt = '') {
        // 新しいメニュー項目のコンテナ要素を作成
        const menuItem = document.createElement('div')
        menuItem.classList.add('menu-item')

        // メニュー項目のHTMLを設定
        menuItem.innerHTML = `
        <input type="text" class="menu-name" value="${name}" placeholder="メニュー名">
        <textarea class="menu-prompt" rows="4" cols="50" placeholder="プロンプト">${prompt}</textarea>
        <button class="remove-item">削除</button>
      `
        // メニュー項目をコンテナに追加
        menuItemsContainer.appendChild(menuItem)
    }

    /**
     * 項目を追加するイベントリスナーを設定する。
     * 'add-item'ボタンがクリックされたときに、新しいメニュー項目を追加する。
     */
    addItemButton.addEventListener('click', () => {
        addMenuItem()
    })

    /**
     * メニュー項目の削除、上移動、下移動を処理するイベントリスナー。
     * メニュー項目の削除ボタン、上移動ボタン、下移動ボタンがクリックされたときに対応する処理を実行する。
     * @param {Event} event - クリックイベント。
     */
    menuItemsContainer.addEventListener('click', (event) => {
        // メニュー項目の上移動を処理
        if (event.target.classList.contains('move-up')) {
            const item = event.target.closest('.menu-item')
            if (item && item.previousElementSibling) {
                menuItemsContainer.insertBefore(item, item.previousElementSibling)
            }
        }
        // メニュー項目の下移動を処理
        if (event.target.classList.contains('move-down')) {
            const item = event.target.closest('.menu-item')
            if (item && item.nextElementSibling) {
                menuItemsContainer.insertBefore(item.nextElementSibling, item)
            }
        }
        // メニュー項目の削除を処理
        if (event.target.classList.contains('remove-item')) {
            const item = event.target.closest('.menu-item')
            if (item) {
                menuItemsContainer.removeChild(item)
            }
        }
    })

    // 保存ボタンのイベントリスナーを削除
    // saveButton.addEventListener('click', () => {
    //     const menuItems = getMenuItemsFromUI()
    //     chrome.storage.local.set({ menuItems }, () => {
    //         statusMessage.textContent = '保存されました。'
    //         statusMessage.style.color = 'green'
    //     })
    // })

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

    /**
     * エクスポート関数
     * 'exportButton'がクリックされたときに、ローカルストレージからメニュー項目を取得し、
     * JSONファイルとしてエクスポートする。
     */
    document.getElementById('exportButton').addEventListener('click', function () {
        // ローカルストレージからメニュー項目を取得
        chrome.storage.local.get('menuItems', function (data) {
            // メニュー項目をJSON形式に変換し、Blobオブジェクトを作成
            const blob = new Blob([JSON.stringify(data.menuItems, null, 2)], { type: 'application/json' })
            // BlobオブジェクトのURLを作成
            const url = URL.createObjectURL(blob)
            // ダウンロード用のリンク要素を作成
            const a = document.createElement('a')
            a.href = url
            a.download = 'menuItems.json'
            // リンクをクリックしてダウンロードを開始
            a.click()
            // 作成したURLを解放
            URL.revokeObjectURL(url)
            // ステータスメッセージを更新
            document.getElementById('statusMessage').textContent = 'エクスポートされました。'
        })
    })

    /**
     * インポート関数
     * 'importButton'がクリックされたときに、JSONファイルを選択し、
     * ローカルストレージにメニュー項目をインポートする。
     */
    document.getElementById('importButton').addEventListener('click', function () {
        // ファイル入力要素を作成
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'application/json'
        // ファイルが選択されたときの処理を設定
        input.onchange = function (event) {
            const file = event.target.files[0]
            const reader = new FileReader()
            // ファイルの読み込みが完了したときの処理を設定
            reader.onload = function (e) {
                const menuItems = JSON.parse(e.target.result)
                // メニュー項目をローカルストレージに保存
                chrome.storage.local.set({ menuItems: menuItems }, function () {
                    console.log('メニュー項目がインポートされました。')
                    document.getElementById('statusMessage').textContent = 'インポートされました。'
                    // メニューを再作成
                    createContextMenus(menuItems)
                })
            }
            // ファイルをテキストとして読み込む
            reader.readAsText(file)
        }
        // ファイル入力ダイアログを表示
        input.click()
    })

    /**
     * ユーザーインターフェースからメニュー項目を取得する関数。
     * 各メニュー項目の名前とプロンプトをオブジェクトとして配列に格納し、返却する。
     * 
     * @returns {Array} メニュー項目のオブジェクト配列
     */
    function getMenuItemsFromUI() {
        const menuItems = Array.from(menuItemsContainer.children).map(
            (item) => ({
                name: item.querySelector('.menu-name').value,
                prompt: item.querySelector('.menu-prompt').value,
            })
        )
        return menuItems
    }

    /**
     * 順番変更モードの状態を保持するフラグ。
     * falseの場合、順番変更モードは無効。
     * trueの場合、順番変更モードは有効。
     */
    let isReorderMode = false
    /**
     * 順番変更ボタンがクリックされたときに呼び出されるイベントリスナー。
     * 順番変更モードの有効/無効を切り替える。
     */
    reorderButton.addEventListener('click', () => {
        // 順番変更モードの有効/無効を切り替える
        isReorderMode = !isReorderMode
        // 順番変更ボタンの表示/非表示を切り替える
        reorderButton.style.display = isReorderMode ? 'none' : 'block'
        // 順番確定ボタンの表示/非表示を切り替える
        confirmReorderButton.style.display = isReorderMode ? 'block' : 'none'
        // 各メニュー項目の移動ボタンの表示/非表示を切り替える
        document.querySelectorAll('.move-buttons').forEach(btn => {
            btn.style.display = isReorderMode ? 'block' : 'none'
        })
    })

    /**
     * 順番確定ボタンがクリックされたときに呼び出されるイベントリスナー。
     * ユーザーインターフェースからメニュー項目を取得し、ストレージに保存してメニューを再作成する。
     */
    confirmReorderButton.addEventListener('click', () => {
        // ユーザーインターフェースからメニュー項目を取得
        const menuItems = getMenuItemsFromUI()
        // メニュー項目をストレージに保存し、メニューを再作成
        chrome.storage.local.set({ menuItems }, () => {
            createContextMenus(menuItems)
            // ステータスメッセージを更新
            statusMessage.textContent = '順番が更新されました。'
            statusMessage.style.color = 'green'
        })
        // ボタンの表示状態を更新
        reorderButton.style.display = 'block'
        confirmReorderButton.style.display = 'none'
        document.querySelectorAll('.move-buttons').forEach(btn => {
            btn.style.display = 'none'
        })
    })

    /**
     * 新しいメニュー項目をユーザーインターフェースに追加する関数。
     * 
     * @param {string} name - メニュー項目の名前（デフォルトは空文字列）。
     * @param {string} prompt - メニュー項目のプロンプト（デフォルトは空文字列）。
     */
    function addMenuItem(name = '', prompt = '') {
        // 新しいメニュー項目のコンテナ要素を作成
        const menuItem = document.createElement('div')
        menuItem.classList.add('menu-item')
        // メニュー項目のHTML内容を設定
        menuItem.innerHTML = `
        <input type="text" class="menu-name" value="${name}" placeholder="メニュー名">
        <textarea class="menu-prompt" rows="4" cols="50" placeholder="プロンプト">${prompt}</textarea>
        <button class="remove-item">削除</button>
        <div class="move-buttons" style="display:none;">
            <button class="move-up">↑</button>
            <button class="move-down">↓</button>
        </div>
      `
        // メニュー項目をコンテナに追加
        menuItemsContainer.appendChild(menuItem)
    }
});
