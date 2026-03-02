# Tài liệu tính năng — Bảng điều khiển CSDL

Ứng dụng đo hiệu năng PostgreSQL: so sánh **gọi Function/Stored Procedure trực tiếp từ DB** với **chạy truy vấn SQL tương đương từ backend (code)**. Được xây dựng bằng Next.js 16 App Router, Shadcn/UI, và PostgreSQL.

---

## Cơ sở dữ liệu

| Bảng | Số bản ghi | Mô tả |
|------|-----------|-------|
| `fin_trans` | 1.056.331 | Giao dịch ngân hàng |
| `fin_account` | 4.500 | Tài khoản |
| `fin_loan` | 682 | Khoản vay |
| `fin_order` | ~6.471 | Lệnh chi thường xuyên |
| `fin_client` | ~5.369 | Khách hàng |
| `fin_card` | ~892 | Thẻ ngân hàng |
| `fin_disp` | ~5.369 | Quyền truy cập tài khoản |
| `fin_district` | ~77 | Quận/huyện |

---

## 1. Sơ đồ quan hệ thực thể (ER Diagram)

**Đường dẫn:** `/`

Hiển thị sơ đồ ER tương tác được sinh ra từ file `sql/bank.sql` — không introspect DB runtime.

### Tính năng
- **Parse tĩnh từ SQL**: đọc `bank.sql`, trích xuất bảng, cột, khóa chính (PK), khóa ngoại (FK) bằng regex parser tùy chỉnh (`lib/sql-parser.ts`)
- **Hiển thị tương tác**: dùng `@xyflow/react` (ReactFlow) để kéo, zoom, pan
- **Node bảng song ngữ**: hiển thị tên Việt ngữ (phía trên) + tên kỹ thuật (phía dưới), tên cột cũng được dịch sang tiếng Việt
- **Màu sắc phân biệt**: PK màu vàng, FK màu xanh, cạnh kết nối màu tím có animation
- **MiniMap**: bản đồ thu nhỏ góc dưới phải để điều hướng nhanh

### Dữ liệu nguồn
File `sql/bank.sql` → `lib/sql-parser.ts` → `lib/schema.ts` (cache) → component `ErDiagram`

---

## 2. Benchmark Hàm (Functions)

**Đường dẫn:** `/functions/<tên-hàm>`

Mỗi hàm PostgreSQL trong `sql/functions.sql` có một trang riêng.

### Danh sách hàm

| Hàm | Mô tả | Tham số bắt buộc |
|-----|-------|-----------------|
| `fn_account_summary` | Tổng thu, tổng chi, số dư ròng theo tài khoản và khoảng ngày | account_id, date_from, date_to |
| `fn_balance_as_of` | Số dư tài khoản tính đến một ngày cụ thể | account_id, as_of_date |
| `fn_cashflow_report` | Báo cáo dòng tiền theo kỳ (tháng/quý/năm) | *(tùy chọn: period)* |
| `fn_loan_stats_by_region` | Thống kê khoản vay theo vùng miền, top N | *(tùy chọn: top_n)* |
| `fn_loan_stats_by_status` | Thống kê khoản vay theo trạng thái A/B/C/D | *(không có)* |
| `fn_order_stats_by_category` | Thống kê lệnh chi theo danh mục | *(không có)* |
| `fn_trans_stats_by_type_operation` | Giao dịch theo loại và thao tác | account_id |

### Luồng hoạt động

```
Người dùng nhấn "Chạy cả hai"
        ↓
Modal nhập tham số hiện ra (nếu hàm có tham số)
  - Giá trị mặc định được điền sẵn từ lib/default-params.ts
  - Trường bắt buộc đánh dấu * đỏ, nút "Xác nhận" bị khóa nếu thiếu
        ↓
Nhấn "Xác nhận & Chạy"
        ↓
Gọi song song POST /api/execute (mode: "db") và POST /api/execute (mode: "backend")
  - mode "db":      SELECT * FROM fn_name($1, $2, ...)
  - mode "backend": SQL tương đương định nghĩa sẵn trong lib/equivalent-queries.ts
        ↓
Hiển thị kết quả: bảng dữ liệu + thống kê thời gian
```

### Kết quả trả về
- **Bảng dữ liệu** với tiêu đề cột tiếng Việt (ánh xạ từ `lib/vi-labels.ts`)
- **Thống kê**: thời gian trung bình, min, max (ms)
- **Biểu đồ sparkline** Cold vs Warm theo từng lần chạy

---

## 3. Benchmark Thủ tục (Stored Procedures)

**Đường dẫn:** `/procedures/<tên-thủ-tục>`

### Danh sách thủ tục

| Thủ tục | Mô tả | Ghi chú |
|---------|-------|---------|
| `sp_add_transaction` | Thêm giao dịch mới, tự tính số dư | Kiểm tra đủ tiền khi ghi nợ |
| `sp_transfer_money` | Chuyển tiền giữa 2 tài khoản | Gọi nội bộ `sp_add_transaction` 2 lần |

### Rollback tự động
Thủ tục **KHÔNG lưu dữ liệu thật** trong quá trình benchmark. Mỗi lần chạy được bọc trong:
```sql
BEGIN;
  CALL sp_ten_thu_tuc($1, $2, ...);  -- đo thời gian ở đây
ROLLBACK;                             -- hủy bỏ hoàn toàn
```
Điều này đảm bảo benchmark có thể chạy nhiều lần mà không tạo dữ liệu rác.

### Mã giao dịch tự động
Các trường `trans_id` được tự động điền bằng `MAX(trans_id) + 1` (gọi `/api/next-id`) mỗi khi modal mở ra, tránh lỗi duplicate key.

---

## 4. Đo nhiều lần (Iterations)

**Vị trí:** Trên mỗi trang Function/Procedure

### Cách hoạt động
- Nhập số lần chạy (1–100), mặc định 5
- Backend chạy **tuần tự** N lần, trả về mảng `timings[]`
- Kết quả: **Trung bình / Min / Max** (ms)

### Cold vs Warm Cache
Lần chạy đầu tiên thường chậm hơn (cold cache) vì PostgreSQL chưa có dữ liệu trong `shared_buffers`. Từ lần 2 trở đi nhanh hơn (warm cache). Biểu đồ sparkline hiển thị sự khác biệt này rõ ràng.

```
Lần 1: ████████ 8.2ms  ← cold (data chưa được cache)
Lần 2: ████ 3.1ms      ← warm
Lần 3: ███ 2.8ms
Lần 4: ███ 2.9ms
Lần 5: ███ 3.0ms
```

---

## 5. EXPLAIN ANALYZE — Kế hoạch thực thi

**Vị trí:** Nút "Phân tích kế hoạch SQL" trên mỗi trang Function/Procedure

### Mô tả
Chạy `EXPLAIN (ANALYZE, FORMAT JSON, BUFFERS, VERBOSE)` cho cả 2 mode (DB Function và Backend Query) song song, hiển thị dạng cây có thể mở/đóng từng node.

### Thông tin hiển thị mỗi node
| Trường | Ý nghĩa |
|--------|---------|
| **Node Type** | Loại thao tác: `Seq Scan`, `Index Scan`, `Hash Join`, `Aggregate`... |
| **Thời gian thực** (màu) | Đỏ nếu > 10ms, xanh nếu ≤ 10ms |
| **Dòng thực / ước tính** | `actual rows / planned rows` — nếu chênh lệch lớn → thống kê cũ |
| **Cost** | Chi phí ước tính của PostgreSQL planner |
| **Relation / Index** | Tên bảng hoặc index được sử dụng |

### Ví dụ phát hiện được
- **Seq Scan thay vì Index Scan**: query không dùng được index → cần xem lại điều kiện WHERE
- **Estimated rows quá sai**: `ANALYZE` bảng để cập nhật thống kê
- **Hash Join vs Nested Loop**: phụ thuộc kích thước bảng và `work_mem`

### Lưu ý kỹ thuật
Explain cũng được chạy trong transaction rollback để an toàn với các thủ tục ghi dữ liệu.

---

## 6. Benchmark Index — Có vs Không có Index

**Đường dẫn:** `/index-benchmark`

### Mô tả
Tự động DROP index tạm thời, đo hiệu năng, rồi CREATE lại — giúp thấy trực tiếp index tác động như thế nào.

### Các index có thể test

| Index | Bảng | Cột | Truy vấn mẫu |
|-------|------|-----|--------------|
| `idx_trans_account_id` | `fin_trans` | `account_id` | `SELECT ... WHERE account_id = 8261` (1M+ dòng) |
| `idx_loan_account_id` | `fin_loan` | `account_id` | `SELECT ... WHERE account_id = 8261` |
| `idx_order_account_id` | `fin_order` | `account_id` | `SELECT ... WHERE account_id = 8261` |
| `idx_account_district` | `fin_account` | `district_id` | `SELECT ... WHERE district_id = 1` |

### Quy trình
```
1. Chạy N lần WITH index  → ghi lại timings
2. DROP INDEX tên_index
3. Chạy N lần WITHOUT index → ghi lại timings
4. CREATE INDEX tên_index  → khôi phục về trạng thái ban đầu
5. Hiển thị so sánh + % tăng tốc
```

### Kết quả
- **% tăng tốc**: `(without - with) / without × 100%`
- **Bảng chi tiết** từng lần chạy (ms) cột xanh (có index) vs đỏ (không có)
- **Biểu đồ sparkline** cho cả 2 series

> ⚠️ Trong thời gian DROP index, các query khác trên bảng đó sẽ không dùng được index. Không nên dùng trên DB production đang có traffic cao.

---

## 7. Kiểm tra tải đồng thời (Concurrent Load)

**Vị trí:** Section "Kiểm tra tải đồng thời" trên mỗi trang Function/Procedure

### Sự khác biệt với "Số lần chạy"

| | Số lần chạy (tuần tự) | Tải đồng thời |
|--|--|--|
| Thứ tự | Chạy 1 → chờ → chạy 2 | Gửi N request cùng lúc |
| DB trạng thái | Phục vụ 1 request tại 1 thời điểm | Phải xử lý N connection đồng thời |
| Đo được | Hiệu năng 1 request đơn lẻ | Throughput, latency dưới tải cao |
| Phản ánh | 1 user dùng nhiều lần | Nhiều user dùng cùng lúc |

### Kết quả hiển thị

| Chỉ số | Ý nghĩa |
|--------|---------|
| **Throughput** | Số request hoàn thành mỗi giây (req/s) |
| **P50** | 50% request hoàn thành trong thời gian này |
| **P95** | 95% request hoàn thành trong thời gian này |
| **P99** | 99% request hoàn thành trong thời gian này |
| **Lỗi** | Số request thất bại |

### Phân tích
- **P50 gần P99**: hệ thống ổn định, không có request bị treo
- **P99 >> P50**: có hiện tượng "tail latency" — một số request bị chậm bất thường (lock contention, GC...)
- **DB Function có throughput cao hơn Backend Query**: function tận dụng execution plan cache của PostgreSQL

---

## 8. Kiểm tra quy mô dữ liệu (Data Volume Scaling)

**Đường dẫn:** `/scale-test`

### Mô tả
Chạy cùng một hàm với các tham số khác nhau để xem hiệu năng thay đổi theo quy mô dữ liệu đầu vào như thế nào.

### Các kịch bản có sẵn

| Hàm | Biến | Các mức |
|-----|------|---------|
| `fn_loan_stats_by_region` | Số vùng trả về (p_top_n) | 5 / 10 / 20 / Tất cả |
| `fn_cashflow_report` | Kỳ báo cáo | Năm / Quý / Tháng (nhiều nhóm nhất) |
| `fn_account_summary` | Khoảng thời gian | 1 năm / 3 năm / 5 năm / Toàn bộ |

### Kết quả
- **Bảng so sánh**: mỗi mức quy mô là 1 dòng, cột DB vs Backend, hiển thị TB (min–max)
- **Biểu đồ bar ngang**: thanh màu xanh (DB) và vàng (Backend) được vẽ tỉ lệ theo giá trị lớn nhất
- **Badge kết luận**: "DB nhanh hơn X ms" hoặc "DB chậm hơn X ms" cho từng mức

### Mục đích
- Phát hiện điểm **linear scaling** (thời gian tỉ lệ với dữ liệu) vs **non-linear** (tăng đột ngột)
- So sánh xem function hay backend query "chịu tải" tốt hơn khi data lớn

---

## Kiến trúc kỹ thuật

```
sql/bank.sql
sql/functions.sql          → lib/sql-parser.ts → lib/schema.ts
sql/stored_procedures.sql

lib/equivalent-queries.ts  → định nghĩa SQL backend tương đương
lib/default-params.ts      → giá trị mặc định cho tham số (từ query DB thực)
lib/vi-labels.ts           → ánh xạ tên cột/tham số/bảng sang tiếng Việt
lib/db.ts                  → Pool kết nối, timedQuery(), timedQueryRollback()

app/api/execute/route.ts         → benchmark tuần tự (iterations)
app/api/explain/route.ts         → EXPLAIN ANALYZE
app/api/index-benchmark/route.ts → so sánh có/không có index
app/api/scale-test/route.ts      → test theo quy mô dữ liệu
app/api/next-id/route.ts         → lấy trans_id tiếp theo

components/benchmark-panel.tsx   → UI chính: modal tham số, nút chạy, kết quả, concurrent
components/er-diagram.tsx        → sơ đồ ER với ReactFlow
components/data-table.tsx        → hiển thị kết quả dạng bảng (tiêu đề tiếng Việt)
components/spark-line.tsx        → biểu đồ sparkline SVG tùy chỉnh
```

---

## Môi trường cài đặt

### Yêu cầu
- Node.js 18+
- PostgreSQL 14+ đang chạy local
- pnpm

### Cài đặt
```bash
pnpm install
```

### Cấu hình
Tạo file `.env.local`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bankdb
```

### Chạy development
```bash
pnpm dev
```

### Build production
```bash
pnpm build
pnpm start
```
