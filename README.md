# 身近なものをギャンブルに（架空通貨）
## セットアップ
1. Firebaseで プロジェクト作成 → Realtime Database を作成
2. ルールを一旦これに（身内テスト用）: {"rules":{".read":true,".write":true}}
3. プロジェクト設定でウェブアプリを登録し、config.js に値を貼り付け
4. `file://`では動かないので `npx serve .` で起動、またはGitHub Pagesに公開
