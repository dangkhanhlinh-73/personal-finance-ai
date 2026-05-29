# Hướng dẫn cài đặt PostgreSQL & khởi tạo Database

> Hướng dẫn này dùng **giao diện đồ họa (pgAdmin 4)**, không cần gõ lệnh terminal.

---

## Mục lục
1. [Cài đặt PostgreSQL](#1-cài-đặt-postgresql)
2. [Cài đặt pgAdmin 4 (giao diện quản lý)](#2-cài-đặt-pgadmin-4)
3. [Kết nối pgAdmin vào PostgreSQL](#3-kết-nối-pgadmin-vào-postgresql)
4. [Tạo user `admin`](#4-tạo-user-admin)
5. [Tạo database `personal_finance_ai`](#5-tạo-database-personal_finance_ai)
6. [Import file schema.sql để tạo bảng và dữ liệu mẫu](#6-import-file-schemasql)
7. [Kiểm tra kết quả](#7-kiểm-tra-kết-quả)
8. [Thông tin kết nối cho backend](#8-thông-tin-kết-nối-cho-backend)

---

## 1. Cài đặt PostgreSQL

### Windows
1. Truy cập: https://www.postgresql.org/download/windows/
2. Nhấn **Download the installer** → chọn phiên bản mới nhất (16.x hoặc 17.x), chọn **Windows x86-64**
3. Chạy file `.exe` vừa tải về
4. Trong wizard cài đặt:
   - **Installation Directory**: giữ mặc định
   - **Components**: tích chọn tất cả (PostgreSQL Server, pgAdmin 4, Command Line Tools)
   - **Data Directory**: giữ mặc định
   - **Password**: nhập `admin123` (mật khẩu cho user `postgres` mặc định)
   - **Port**: giữ `5432`
   - **Locale**: giữ mặc định
5. Nhấn **Next** → **Finish** để hoàn tất

### macOS
1. Truy cập: https://www.postgresql.org/download/macosx/
2. Nhấn **Download the installer** → chọn phiên bản mới nhất, chọn **macOS**
3. Chạy file `.dmg` → kéo vào Applications
4. Làm theo wizard, đặt password là `admin123`, port `5432`

> **Lưu ý**: Sau khi cài xong, pgAdmin 4 đã được cài kèm trong cùng bộ cài — không cần cài riêng. Chuyển sang bước 3.

---

## 2. Cài đặt pgAdmin 4

> Nếu đã cài pgAdmin kèm theo PostgreSQL ở bước 1, **bỏ qua bước này**.

Nếu muốn cài riêng:
1. Truy cập: https://www.pgadmin.org/download/
2. Chọn hệ điều hành → tải bộ cài → cài đặt bình thường

---

## 3. Kết nối pgAdmin vào PostgreSQL

1. Mở **pgAdmin 4** (tìm trong Start Menu / Applications)
2. Lần đầu mở, pgAdmin sẽ yêu cầu đặt **Master Password** — đây là mật khẩu để bảo vệ pgAdmin, đặt tùy ý (ví dụ: `pgadmin123`)
3. Ở cột trái, nhấn chuột phải vào **Servers** → chọn **Register → Server...**
4. Tab **General**:
   - **Name**: `SmartFinance Local` (đặt tên tùy ý)
5. Tab **Connection**:
   - **Host name/address**: `localhost`
   - **Port**: `5432`
   - **Maintenance database**: `postgres`
   - **Username**: `postgres`
   - **Password**: `admin123` (mật khẩu đặt lúc cài PostgreSQL)
   - Tích **Save password**
6. Nhấn **Save**

Sau khi lưu, server sẽ xuất hiện ở cột trái. Nhấn vào mũi tên để mở rộng.

---

## 4. Tạo user `admin`

Backend kết nối bằng user `admin`, không phải `postgres`. Cần tạo user này trong pgAdmin.

1. Trong pgAdmin, mở rộng server vừa tạo → nhấn chuột phải vào **Login/Group Roles** → **Create → Login/Group Role...**
2. Tab **General**:
   - **Name**: `admin`
3. Tab **Definition**:
   - **Password**: `admin123`
   - **Password expiration date**: để trống
4. Tab **Privileges**:
   - Bật **Can login?**: Yes
   - Bật **Superuser?**: Yes *(để tiện cho môi trường dev)*
5. Nhấn **Save**

---

## 5. Tạo database `personal_finance_ai`

1. Trong pgAdmin, nhấn chuột phải vào **Databases** → **Create → Database...**
2. Tab **General**:
   - **Database**: `personal_finance_ai`
   - **Owner**: `admin`
3. Nhấn **Save**

Database mới sẽ xuất hiện trong danh sách.

---

## 6. Import file schema.sql

File `schema.sql` sẽ tạo toàn bộ bảng, quan hệ, trigger và dữ liệu danh mục mặc định.

File này nằm tại: `database/schema.sql` trong thư mục gốc của project.

### Cách thực hiện trong pgAdmin:

1. Trong cột trái, mở rộng **Databases** → nhấn vào **`personal_finance_ai`** để chọn database này
2. Trên thanh công cụ trên cùng, nhấn vào biểu tượng **Query Tool** (biểu tượng hình chớp ⚡ hoặc menu **Tools → Query Tool**)
3. Trong cửa sổ Query Tool vừa mở, nhấn biểu tượng **Open File** (📂) trên thanh công cụ
4. Tìm đến file `database/schema.sql` trong thư mục project → **Open**
5. Toàn bộ nội dung SQL sẽ hiện ra trong khung soạn thảo
6. Nhấn nút **Execute / Run** (▶ hoặc phím `F5`)
7. Chờ khoảng vài giây — phía dưới sẽ hiển thị thông báo `Query returned successfully`

### Kết quả sau khi import thành công:
- 15 bảng được tạo: `users`, `financial_accounts`, `categories`, `transactions`, v.v.
- 13 nhóm danh mục và ~60 danh mục chi tiêu mặc định được thêm vào

---

## 7. Kiểm tra kết quả

Sau khi import, kiểm tra nhanh trong pgAdmin:

1. Trong cột trái: **personal_finance_ai → Schemas → public → Tables**
2. Bạn sẽ thấy danh sách ~15 bảng

Để xem dữ liệu danh mục đã được seed:
1. Nhấn chuột phải vào bảng **`categories`** → **View/Edit Data → All Rows**
2. Phía phải sẽ hiển thị ~60 danh mục đã được tạo sẵn

---

## 8. Thông tin kết nối cho backend

Backend đã được cấu hình sẵn trong `backend/app/config.py`:

```
Host:     localhost
Port:     5432
Database: personal_finance_ai
Username: admin
Password: admin123
```

Không cần chỉnh sửa gì thêm — chạy backend bình thường là kết nối được.

---

## Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-------------|------------|
| `could not connect to server` | PostgreSQL chưa chạy | Mở Services (Windows) hoặc System Preferences → PostgreSQL → Start |
| `role "admin" does not exist` | Chưa tạo user admin | Làm lại bước 4 |
| `database "personal_finance_ai" does not exist` | Chưa tạo database | Làm lại bước 5 |
| `permission denied` | User admin chưa có quyền | Vào bước 4, bật Superuser = Yes |
| `ERROR: type "user_role" already exists` | Đã import schema trước đó | Bình thường — script có `DROP TYPE IF EXISTS` nên chạy lại sẽ tự xóa và tạo lại |
