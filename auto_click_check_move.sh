#!/bin/bash

# --- 設定 ---
INTERVAL=0.001  # クリック間隔（秒）
TOLERANCE=10   # 許容するマウスの移動量（ピクセル単位）。この値を超えて動いたら停止。値を大きくすると鈍感に、小さくすると敏感になります。
# --- 設定終わり ---

# --- 関数定義 ---
# cliclickコマンドの存在チェック
check_cliclick() {
  if ! command -v cliclick &> /dev/null; then
    echo "エラー: cliclick コマンドが見つかりません。" >&2
    echo "Homebrew でインストールしてください: brew install cliclick" >&2
    exit 1
  fi
}

# 現在のマウス座標を取得し、XとYを返す関数
# グローバル変数 current_x, current_y に値を設定する
get_current_coords() {
  local coords
  coords=$(cliclick p:.)
  if [[ -z "$coords" ]]; then
    echo "エラー: 現在座標を取得できませんでした。" >&2
    return 1 # エラーを示すために非ゼロを返す
  fi

  # 座標が "数値,数値" の形式かチェック
  if ! [[ "$coords" =~ ^[0-9]+,[0-9]+$ ]]; then
      echo "エラー: 取得した座標の形式が無効です ($coords)。" >&2
      return 1
  fi

  current_x=$(echo "$coords" | cut -d',' -f1)
  current_y=$(echo "$coords" | cut -d',' -f2)
  return 0 # 成功
}
# --- 関数定義終わり ---

# --- メイン処理 ---
check_cliclick # cliclickの存在確認

echo "Auto Clickerを開始します (移動量が ${TOLERANCE} ピクセルを超えたら停止)。"
echo "クリック間隔: ${INTERVAL} 秒"
echo "手動停止: Ctrl + C"
echo "--------------------------------------------------"

# 最初の座標を取得して記録
echo "最初の座標を取得中..."
if ! get_current_coords; then
    echo "エラー: 初期座標を取得できませんでした。スクリプトを終了します。" >&2
    exit 1
fi
prev_x=$current_x
prev_y=$current_y

echo "最初のクリック座標: ($prev_x, $prev_y)"
# 最初のクリックを実行
cliclick c:.
sleep $INTERVAL

# ループ開始
while true; do
  # 現在の座標を取得
  if ! get_current_coords; then
      echo "エラー: 現在座標を取得できませんでした。クリックを停止します。" >&2
      break
  fi

  # 前回の座標との差を計算
  dx=$((current_x - prev_x))
  dy=$((current_y - prev_y))

  # 移動量が許容範囲を超えたかチェック (X方向またはY方向の絶対値で判定)
  # X方向またはY方向の移動量が許容範囲を超えたかチェック
  # Bashには直接的な絶対値関数がないため、正負両方の比較を行う
  if (( dx > TOLERANCE || dx < -TOLERANCE || dy > TOLERANCE || dy < -TOLERANCE )); then
    echo # 改行
    echo "マウスが大きく移動しました (しきい値: ${TOLERANCE} ピクセル)。"
    echo "  移動前の座標: ($prev_x, $prev_y)"
    echo "  現在の座標: ($current_x, $current_y)"
    echo "クリックを停止します。"
    break # ループを抜ける
  fi

  # --- 移動量が許容範囲内ならクリックを実行 ---
  # echo "座標 ($current_x, $current_y) でクリックします。" # デバッグ用
  cliclick c:. # 現在位置でクリック

  # 現在の座標を次回の比較のために保存
  prev_x=$current_x
  prev_y=$current_y

  # 指定した間隔だけ待機
  sleep $INTERVAL
done

echo "スクリプトが終了しました。"
# --- メイン処理終わり ---
