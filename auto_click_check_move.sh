#!/bin/bash

# --- 設定 ---
INTERVAL=0.001  # クリック間隔（秒）
TOLERANCE=10   # 許容するマウスの移動量（ピクセル単位）。この値を超えて動いたら停止。値を大きくすると鈍感に、小さくすると敏感になります。
# --- 設定終わり ---

echo "Auto Clickerを開始します (移動量が ${TOLERANCE} ピクセルを超えたら停止)。"
echo "クリック間隔: ${INTERVAL} 秒"
echo "手動停止: Ctrl + C または設定した停止用ショートカット"
echo "--------------------------------------------------"

# 最初の座標を取得して記録
coords=$(cliclick p:.) # "x,y" 形式で座標を取得
# エラーチェック: cliclick p:. が座標を返さなかった場合
if [[ -z "$coords" ]]; then
    echo "エラー: 初期座標を取得できませんでした。cliclickが動作しているか確認してください。"
    exit 1
fi
prev_x=$(echo "$coords" | cut -d',' -f1)
prev_y=$(echo "$coords" | cut -d',' -f2)

# 座標が数字か基本的なチェック
if ! [[ "$prev_x" =~ ^[0-9]+$ && "$prev_y" =~ ^[0-9]+$ ]]; then
  echo "エラー: 取得した初期座標が無効です ($coords)。停止します。"
  exit 1
fi

echo "最初のクリック座標: ($prev_x, $prev_y)"
# 最初のクリックを実行
cliclick c:.
sleep $INTERVAL

# ループ開始
while true; do
  # 現在の座標を取得
  coords=$(cliclick p:.)
  # エラーチェック
  if [[ -z "$coords" ]]; then
      echo "エラー: 現在座標を取得できませんでした。停止します。"
      break
  fi
  current_x=$(echo "$coords" | cut -d',' -f1)
  current_y=$(echo "$coords" | cut -d',' -f2)

  # 座標が数字か基本的なチェック
  if ! [[ "$current_x" =~ ^[0-9]+$ && "$current_y" =~ ^[0-9]+$ ]]; then
    echo "エラー: 取得した現在座標が無効です ($coords)。停止します。"
    break
  fi

  # 前回の座標との差を計算
  dx=$((current_x - prev_x))
  dy=$((current_y - prev_y))

  # 移動量が許容範囲を超えたかチェック (X方向またはY方向の絶対値で判定)
  if (( dx > TOLERANCE || dx < -TOLERANCE || dy > TOLERANCE || dy < -TOLERANCE )); then
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
