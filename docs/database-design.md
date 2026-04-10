# database-design.md

## 1. 目的
このドキュメントは、レストラン予約システムの基本データベース設計を定義する。  
MVPで必要なテーブルを中心に、将来拡張しやすい構成を前提とする。

---

## 2. 設計方針
- 顧客情報、予約情報、メニュー情報、営業時間、通知履歴を分けて管理する
- 個人情報は必要最小限にする
- 空き枠判定に必要な情報を正しく保持する
- 将来的な複数店舗対応を考慮できるようにする
- ステータス管理を明確にする

---

## 3. テーブル一覧
- customers
- menus
- business_hours
- special_business_days
- reservations
- reservation_status_logs
- notifications
- admin_users
- audit_logs

---

## 4. customers

### 役割
顧客情報を保持する

### カラム案
- id
- name
- phone
- email
- created_at
- updated_at

### 補足
- 氏名、電話番号、メールアドレスのみを基本とする
- 住所、生年月日などは初期では持たない

---

## 5. menus

### 役割
予約可能メニューを管理する

### カラム案
- id
- name
- description
- price
- duration_minutes
- min_people
- max_people
- is_active
- sort_order
- created_at
- updated_at

### 補足
- duration_minutes は空き枠計算に使用する
- is_active で公開/非公開を制御する

---

## 6. business_hours

### 役割
通常の曜日ごとの営業時間を管理する

### カラム案
- id
- day_of_week
- open_time
- close_time
- is_closed
- created_at
- updated_at

### 補足
- day_of_week は 0〜6 などで管理
- 曜日ごとの通常営業時間を保持する

---

## 7. special_business_days

### 役割
臨時休業日、特別営業日を管理する

### カラム案
- id
- target_date
- open_time
- close_time
- is_closed
- note
- created_at
- updated_at

### 補足
- 通常営業時間よりこちらを優先する
- 臨時休業もここで表現する

---

## 8. reservations

### 役割
予約本体を保持する

### カラム案
- id
- reservation_number
- customer_id
- menu_id
- reservation_date
- start_time
- end_time
- people_count
- status
- note
- reminder_confirmed_at
- created_at
- updated_at
- cancelled_at
- visited_at

### status の候補
- pending
- confirmed
- cancelled
- visited
- no_show

### 補足
- start_time と end_time の両方を持つ
- end_time は menu.duration_minutes から計算して保存してもよい
- reservation_number は顧客向け確認番号

---

## 9. reservation_status_logs

### 役割
予約ステータスの変更履歴を保持する

### カラム案
- id
- reservation_id
- old_status
- new_status
- changed_by
- change_reason
- created_at

### 補足
- 誰がいつ変更したか追跡できる
- 無断キャンセルや来店済み変更の履歴管理に使う

---

## 10. notifications

### 役割
通知送信履歴を管理する

### カラム案
- id
- reservation_id
- notification_type
- channel
- scheduled_at
- sent_at
- status
- error_message
- created_at
- updated_at

### notification_type の候補
- reservation_created
- reminder_3days
- reminder_1day
- reminder_same_day
- cancellation_notice

### channel の候補
- email
- sms
- line

### status の候補
- scheduled
- sent
- failed
- cancelled

---

## 11. admin_users

### 役割
管理画面利用者を管理する

### カラム案
- id
- name
- email
- role
- is_active
- created_at
- updated_at

### role の候補
- admin
- staff

### 補足
- 認証自体は Supabase Auth など外部認証と連携してもよい
- このテーブルには業務上必要な管理情報を保持する

---

## 12. audit_logs

### 役割
重要操作の監査ログを管理する

### カラム案
- id
- actor_type
- actor_id
- action
- target_table
- target_id
- metadata
- created_at

### 補足
- 個人情報を過剰に入れない
- 予約詳細閲覧、変更、削除、CSV出力などを記録する

---

## 13. テーブル関係

### customers と reservations
- customers.id = reservations.customer_id
- 1人の顧客が複数予約を持てる

### menus と reservations
- menus.id = reservations.menu_id
- 1つのメニューが複数予約で使われる

### reservations と notifications
- reservations.id = notifications.reservation_id
- 1件の予約に複数通知が紐づく

### reservations と reservation_status_logs
- reservations.id = reservation_status_logs.reservation_id
- 1件の予約に複数履歴が紐づく

---

## 14. 初期ERイメージ

```text
customers
  └─< reservations >─ menus
          ├─< notifications
          └─< reservation_status_logs

business_hours
special_business_days
admin_users
audit_logs
```
