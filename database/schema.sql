-- =============================================================================
-- Personal Finance AI — PostgreSQL Schema
-- =============================================================================
-- Tạo database trước: CREATE DATABASE personal_finance_ai;
-- Chạy file: psql -U postgres -d personal_finance_ai -f schema.sql
-- =============================================================================


-- =============================================================================
-- CLEANUP (re-runnable)
-- =============================================================================
DROP TABLE IF EXISTS debt_payment              CASCADE;
DROP TABLE IF EXISTS debts                     CASCADE;
DROP TABLE IF EXISTS investments               CASCADE;
DROP TABLE IF EXISTS investment_source         CASCADE;
DROP TABLE IF EXISTS ai_classification_history CASCADE;
DROP TABLE IF EXISTS ocr_jobs                  CASCADE;
DROP TABLE IF EXISTS transfers                 CASCADE;
DROP TABLE IF EXISTS transactions              CASCADE;
DROP TABLE IF EXISTS user_hidden_categories    CASCADE;
DROP TABLE IF EXISTS categories                CASCADE;
DROP TABLE IF EXISTS category_group            CASCADE;
DROP TABLE IF EXISTS financial_accounts        CASCADE;
DROP TABLE IF EXISTS users                     CASCADE;

DROP TYPE IF EXISTS user_role;
DROP TYPE IF EXISTS user_status;
DROP TYPE IF EXISTS group_type;
DROP TYPE IF EXISTS account_type;
DROP TYPE IF EXISTS transaction_type;
DROP TYPE IF EXISTS source_type;
DROP TYPE IF EXISTS transaction_status;
DROP TYPE IF EXISTS debt_type;
DROP TYPE IF EXISTS debt_status;
DROP TYPE IF EXISTS investment_direction;


-- =============================================================================
-- ENUM TYPES
-- =============================================================================
CREATE TYPE user_role            AS ENUM ('user', 'admin');
CREATE TYPE user_status          AS ENUM ('active', 'inactive', 'locked');
CREATE TYPE group_type           AS ENUM ('income', 'expense', 'debt', 'investment');
CREATE TYPE account_type         AS ENUM ('cash', 'bank', 'ewallet');
CREATE TYPE transaction_type     AS ENUM ('income', 'expense');
CREATE TYPE source_type          AS ENUM ('manual', 'image', 'ai');
CREATE TYPE transaction_status   AS ENUM ('pending', 'confirmed', 'cancelled');
CREATE TYPE debt_type            AS ENUM ('borrow', 'lend');
CREATE TYPE debt_status          AS ENUM ('active', 'paid', 'overdue');
CREATE TYPE investment_direction AS ENUM ('invest', 'withdraw');


-- =============================================================================
-- TRIGGER FUNCTION — auto updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- TABLE: users
-- =============================================================================
CREATE TABLE users (
    user_id       BIGSERIAL    PRIMARY KEY,
    full_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone         VARCHAR(20),
    role          user_role    NOT NULL DEFAULT 'user',
    status        user_status  NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();


-- =============================================================================
-- TABLE: financial_accounts
-- =============================================================================
CREATE TABLE financial_accounts (
    account_id   BIGSERIAL      PRIMARY KEY,
    user_id      BIGINT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    account_name VARCHAR(100)   NOT NULL,
    account_type account_type   NOT NULL,
    balance      NUMERIC(18, 2) NOT NULL DEFAULT 0,
    currency     VARCHAR(10)    NOT NULL DEFAULT 'VND',
    is_default   BOOLEAN        NOT NULL DEFAULT FALSE,
    is_archived  BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_financial_accounts_user_id ON financial_accounts(user_id);
CREATE TRIGGER trg_financial_accounts_updated_at
    BEFORE UPDATE ON financial_accounts FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();


-- =============================================================================
-- TABLE: category_group
-- user_id = NULL  → nhóm mặc định của hệ thống
-- user_id = X     → nhóm tự tạo của user X
-- =============================================================================
CREATE TABLE category_group (
    group_id    BIGSERIAL    PRIMARY KEY,
    group_name  VARCHAR(100) NOT NULL UNIQUE,
    group_type  group_type   NOT NULL,
    description TEXT,
    user_id     BIGINT       REFERENCES users(user_id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_category_group_updated_at
    BEFORE UPDATE ON category_group FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();


-- =============================================================================
-- TABLE: categories
-- user_id = NULL  → danh mục mặc định của hệ thống
-- user_id = X     → danh mục tự tạo của user X
-- =============================================================================
CREATE TABLE categories (
    category_id   BIGSERIAL    PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL,
    group_id      BIGINT       NOT NULL REFERENCES category_group(group_id) ON DELETE RESTRICT,
    user_id       BIGINT       REFERENCES users(user_id) ON DELETE CASCADE,
    description   TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_categories_group_id ON categories(group_id);
CREATE INDEX idx_categories_user_id  ON categories(user_id);
CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();


-- =============================================================================
-- TABLE: user_hidden_categories
-- User có thể ẩn các danh mục mặc định họ không dùng
-- =============================================================================
CREATE TABLE user_hidden_categories (
    user_id     BIGINT    NOT NULL REFERENCES users(user_id)      ON DELETE CASCADE,
    category_id BIGINT    NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, category_id)
);


-- =============================================================================
-- TABLE: ocr_jobs
-- Mỗi ảnh upload tạo 1 job; pipeline chạy background và cập nhật status.
-- scan_type: 'bank_noti' | 'invoice'
-- status:    'pending' | 'processing' | 'done' | 'error'
-- =============================================================================
CREATE TABLE ocr_jobs (
    job_id          BIGSERIAL      PRIMARY KEY,
    user_id         BIGINT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    scan_type       VARCHAR(20)    NOT NULL DEFAULT 'bank_noti',
    status          VARCHAR(20)    NOT NULL DEFAULT 'pending',
    image_path      VARCHAR(500),
    detected_format VARCHAR(50),
    extracted_json  JSONB,
    error_message   TEXT,
    created_at      TIMESTAMP      NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMP
);
CREATE INDEX idx_ocr_jobs_user_id ON ocr_jobs(user_id);
CREATE INDEX idx_ocr_jobs_status  ON ocr_jobs(status);


-- =============================================================================
-- TABLE: transactions
-- source_type='image' → được tạo từ flow OCR + AI
-- status='pending'    → chờ user xác nhận (chưa ảnh hưởng balance)
-- status='confirmed'  → đã xác nhận, đã cập nhật balance
-- ocr_job_id / txn_index → liên kết ngược về job OCR nguồn
-- =============================================================================
CREATE TABLE transactions (
    transaction_id   BIGSERIAL          PRIMARY KEY,
    user_id          BIGINT             NOT NULL REFERENCES users(user_id)             ON DELETE CASCADE,
    account_id       BIGINT             NOT NULL REFERENCES financial_accounts(account_id) ON DELETE RESTRICT,
    category_id      BIGINT             NOT NULL REFERENCES categories(category_id)    ON DELETE RESTRICT,
    amount           NUMERIC(18, 2)     NOT NULL CHECK (amount > 0),
    transaction_type transaction_type   NOT NULL,
    transaction_date TIMESTAMP          NOT NULL,
    description      TEXT,
    merchant_name    VARCHAR(150),
    source_type      source_type        NOT NULL DEFAULT 'manual',
    status           transaction_status NOT NULL DEFAULT 'confirmed',
    ocr_job_id       BIGINT             REFERENCES ocr_jobs(job_id) ON DELETE SET NULL,
    txn_index        INTEGER,
    created_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_transactions_user_id        ON transactions(user_id);
CREATE INDEX idx_transactions_account_id     ON transactions(account_id);
CREATE INDEX idx_transactions_category_id    ON transactions(category_id);
CREATE INDEX idx_transactions_date           ON transactions(transaction_date);
CREATE INDEX idx_transactions_user_type_date ON transactions(user_id, transaction_type, transaction_date);
CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();


-- =============================================================================
-- TABLE: transfers
-- from_account.balance -= amount
-- to_account.balance   += amount
-- =============================================================================
CREATE TABLE transfers (
    transfer_id     BIGSERIAL      PRIMARY KEY,
    user_id         BIGINT         NOT NULL REFERENCES users(user_id)                 ON DELETE CASCADE,
    from_account_id BIGINT         NOT NULL REFERENCES financial_accounts(account_id) ON DELETE RESTRICT,
    to_account_id   BIGINT         NOT NULL REFERENCES financial_accounts(account_id) ON DELETE RESTRICT,
    amount          NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    transfer_date   TIMESTAMP      NOT NULL,
    note            TEXT,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_transfers_different_accounts CHECK (from_account_id <> to_account_id)
);
CREATE INDEX idx_transfers_user_id         ON transfers(user_id);
CREATE INDEX idx_transfers_from_account_id ON transfers(from_account_id);
CREATE INDEX idx_transfers_to_account_id   ON transfers(to_account_id);
CREATE TRIGGER trg_transfers_updated_at
    BEFORE UPDATE ON transfers FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();


-- =============================================================================
-- TABLE: ai_classification_history
-- Ghi lại quyết định phân loại AI khi user lưu giao dịch từ OCR review.
-- was_accepted = TRUE nếu user giữ nguyên category AI gợi ý.
-- =============================================================================
CREATE TABLE ai_classification_history (
    history_id               BIGSERIAL      PRIMARY KEY,
    ocr_job_id               BIGINT         REFERENCES ocr_jobs(job_id)       ON DELETE SET NULL,
    transaction_id           BIGINT         REFERENCES transactions(transaction_id) ON DELETE CASCADE,
    txn_index                INTEGER        NOT NULL DEFAULT 0,
    predicted_category_name  VARCHAR(150),
    predicted_confidence     NUMERIC(5, 4),
    chosen_category_id       BIGINT         REFERENCES categories(category_id) ON DELETE SET NULL,
    was_accepted             BOOLEAN,
    created_at               TIMESTAMP      NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_history_ocr_job_id  ON ai_classification_history(ocr_job_id);
CREATE INDEX idx_ai_history_txn_id      ON ai_classification_history(transaction_id);


-- =============================================================================
-- TABLE: investment_source
-- Nguồn đầu tư của user (Finhay, VPS, Vàng SJC...)
-- initial_balance: user tự nhập khi tạo (số dư ban đầu, có thể = 0)
-- current_balance: cộng/trừ mỗi khi tạo investments record
-- interest_rate:   lãi suất kỳ vọng (% / năm), chỉ để hiển thị
-- =============================================================================
CREATE TABLE investment_source (
    source_id       BIGSERIAL      PRIMARY KEY,
    user_id         BIGINT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    source_name     VARCHAR(150)   NOT NULL,
    initial_balance NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (initial_balance >= 0),
    current_balance NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (current_balance >= 0),
    interest_rate   NUMERIC(5, 2)  NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_investment_source_user_id ON investment_source(user_id);
CREATE TRIGGER trg_investment_source_updated_at
    BEFORE UPDATE ON investment_source FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();


-- =============================================================================
-- TABLE: investments
-- direction='invest'   → account.balance -= amount, source.current_balance += amount
-- direction='withdraw' → account.balance += amount, source.current_balance -= amount
-- =============================================================================
CREATE TABLE investments (
    investment_id        BIGSERIAL            PRIMARY KEY,
    user_id              BIGINT               NOT NULL REFERENCES users(user_id)                ON DELETE CASCADE,
    investment_source_id BIGINT               NOT NULL REFERENCES investment_source(source_id)  ON DELETE RESTRICT,
    account_id           BIGINT               NOT NULL REFERENCES financial_accounts(account_id) ON DELETE RESTRICT,
    amount               NUMERIC(18, 2)       NOT NULL CHECK (amount > 0),
    direction            investment_direction  NOT NULL,
    note                 TEXT,
    invested_at          TIMESTAMP            NOT NULL,
    created_at           TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_investments_user_id              ON investments(user_id);
CREATE INDEX idx_investments_investment_source_id ON investments(investment_source_id);
CREATE INDEX idx_investments_account_id           ON investments(account_id);
CREATE TRIGGER trg_investments_updated_at
    BEFORE UPDATE ON investments FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();


-- =============================================================================
-- TABLE: debts
-- debt_type='borrow': tôi mượn → tạo debt: account.balance += total_amount
-- debt_type='lend':   tôi cho mượn → tạo debt: account.balance -= total_amount
-- =============================================================================
CREATE TABLE debts (
    debt_id          BIGSERIAL      PRIMARY KEY,
    user_id          BIGINT         NOT NULL REFERENCES users(user_id)                 ON DELETE CASCADE,
    account_id       BIGINT         NOT NULL REFERENCES financial_accounts(account_id) ON DELETE RESTRICT,
    debt_type        debt_type      NOT NULL,
    partner_name     VARCHAR(150)   NOT NULL,
    total_amount     NUMERIC(18, 2) NOT NULL CHECK (total_amount > 0),
    remaining_amount NUMERIC(18, 2) NOT NULL CHECK (remaining_amount >= 0),
    interest_rate    NUMERIC(5, 2)  NOT NULL DEFAULT 0 CHECK (interest_rate >= 0),
    start_date       DATE           NOT NULL,
    due_date         DATE,
    status           debt_status    NOT NULL DEFAULT 'active',
    note             TEXT,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_debts_remaining CHECK (remaining_amount <= total_amount),
    CONSTRAINT chk_debts_dates     CHECK (due_date IS NULL OR due_date >= start_date)
);
CREATE INDEX idx_debts_user_id    ON debts(user_id);
CREATE INDEX idx_debts_account_id ON debts(account_id);
CREATE INDEX idx_debts_status     ON debts(status);
CREATE TRIGGER trg_debts_updated_at
    BEFORE UPDATE ON debts FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();


-- =============================================================================
-- TABLE: debt_payment
-- borrow: account.balance -= payment_amount, debts.remaining_amount -= payment_amount
-- lend:   account.balance += payment_amount, debts.remaining_amount -= payment_amount
-- =============================================================================
CREATE TABLE debt_payment (
    payment_id     BIGSERIAL      PRIMARY KEY,
    debt_id        BIGINT         NOT NULL REFERENCES debts(debt_id)                    ON DELETE CASCADE,
    account_id     BIGINT         NOT NULL REFERENCES financial_accounts(account_id)    ON DELETE RESTRICT,
    payment_amount NUMERIC(18, 2) NOT NULL CHECK (payment_amount > 0),
    payment_date   TIMESTAMP      NOT NULL,
    note           TEXT,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_debt_payment_debt_id    ON debt_payment(debt_id);
CREATE INDEX idx_debt_payment_account_id ON debt_payment(account_id);
CREATE TRIGGER trg_debt_payment_updated_at
    BEFORE UPDATE ON debt_payment FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();


-- =============================================================================
-- SEED DATA: category_group (system defaults — user_id = NULL)
-- =============================================================================
INSERT INTO category_group (group_name, group_type, description, user_id) VALUES
('Ăn uống',            'expense',    'Chi phí ăn uống hàng ngày',              NULL),
('Di chuyển',          'expense',    'Chi phí đi lại, xăng xe, taxi',           NULL),
('Mua sắm',            'expense',    'Chi phí mua sắm quần áo, đồ dùng',        NULL),
('Giải trí',           'expense',    'Chi phí giải trí, du lịch, phim ảnh',     NULL),
('Sức khỏe',           'expense',    'Chi phí y tế, thuốc men, gym',            NULL),
('Hóa đơn & Tiện ích', 'expense',    'Điện, nước, internet, điện thoại',        NULL),
('Giáo dục',           'expense',    'Học phí, sách vở, khóa học',              NULL),
('Gia đình',           'expense',    'Chi phí gia đình, nhà cửa',               NULL),
('Lương & Thu nhập',   'income',     'Tiền lương, thưởng',                      NULL),
('Kinh doanh',         'income',     'Thu nhập từ kinh doanh, freelance',        NULL),
('Đầu tư',             'income',     'Thu nhập từ đầu tư, cổ tức',              NULL),
('Tiết kiệm',          'investment', 'Khoản tiết kiệm, quỹ dự phòng',           NULL),
('Vay mượn',           'debt',       'Các khoản vay, nợ phải trả',              NULL);


-- =============================================================================
-- SEED DATA: categories (user_id = NULL = system default)
--
-- Nhóm 1  = Ăn uống            (group_id 1)
-- Nhóm 2  = Di chuyển          (group_id 2)
-- Nhóm 3  = Mua sắm            (group_id 3)
-- Nhóm 4  = Giải trí           (group_id 4)
-- Nhóm 5  = Sức khỏe           (group_id 5)
-- Nhóm 6  = Hóa đơn & Tiện ích (group_id 6)
-- Nhóm 7  = Giáo dục           (group_id 7)
-- Nhóm 8  = Gia đình           (group_id 8)
-- Nhóm 9  = Lương & Thu nhập   (group_id 9)
-- Nhóm 10 = Kinh doanh         (group_id 10)
-- Nhóm 11 = Đầu tư             (group_id 11)
-- Nhóm 12 = Tiết kiệm          (group_id 12)
-- Nhóm 13 = Vay mượn           (group_id 13)
-- =============================================================================
INSERT INTO categories (category_name, group_id, user_id, description) VALUES
-- ── Ăn uống ──────────────────────────────────────────────────────────────────
('Ăn sáng',               1, NULL, NULL),
('Ăn trưa',               1, NULL, NULL),
('Ăn tối',                1, NULL, NULL),
('Cà phê & Trà',          1, NULL, NULL),
('Đồ ăn nhanh',           1, NULL, NULL),
('Đi ăn nhà hàng',        1, NULL, NULL),
-- AI bank label
('Ăn uống',               1, NULL, 'Nhãn AI — chi tiêu ăn uống chung'),
-- AI invoice labels
('Bánh kẹo',              1, NULL, 'Nhãn AI — bánh kẹo, snack'),
('Rau củ quả',            1, NULL, 'Nhãn AI — rau củ quả tươi'),
('Thịt cá hải sản',       1, NULL, 'Nhãn AI — thịt, cá, hải sản'),
('Trái cây',              1, NULL, 'Nhãn AI — trái cây tươi'),
('Đồ khô / Gia vị',       1, NULL, 'Nhãn AI — gạo, mì, gia vị khô'),
('Đồ uống',               1, NULL, 'Nhãn AI — nước ngọt, bia, nước đóng chai'),

-- ── Di chuyển ────────────────────────────────────────────────────────────────
('Xăng xe',               2, NULL, NULL),
('Grab / Taxi',            2, NULL, NULL),
('Xe buýt / Metro',        2, NULL, NULL),
('Gửi xe',                2, NULL, NULL),
-- AI bank label
('Di chuyển',             2, NULL, 'Nhãn AI — di chuyển chung'),

-- ── Mua sắm ──────────────────────────────────────────────────────────────────
('Quần áo & Giày dép',    3, NULL, NULL),
('Điện tử & Công nghệ',   3, NULL, NULL),
('Đồ dùng gia đình',      3, NULL, NULL),
('Mỹ phẩm & Làm đẹp',    3, NULL, NULL),
-- AI bank / invoice labels
('Mua sắm cá nhân',       3, NULL, 'Nhãn AI — mua sắm cá nhân chung'),
('Gia dụng',              3, NULL, 'Nhãn AI — đồ gia dụng'),
('Khác',                  3, NULL, 'Nhãn AI — danh mục khác'),
('Đồ vệ sinh cá nhân',    3, NULL, 'Nhãn AI — sản phẩm vệ sinh cá nhân'),

-- ── Giải trí ─────────────────────────────────────────────────────────────────
('Phim & Âm nhạc',        4, NULL, NULL),
('Du lịch',               4, NULL, NULL),
('Thể thao',              4, NULL, NULL),
('Sách & Báo',            4, NULL, NULL),
-- AI bank labels
('Giải trí & Quan hệ',    4, NULL, 'Nhãn AI — giải trí & quan hệ xã hội'),
('Quỹ nhóm',              4, NULL, 'Nhãn AI — đóng quỹ nhóm, hội'),

-- ── Sức khỏe ─────────────────────────────────────────────────────────────────
('Khám bệnh',             5, NULL, NULL),
('Thuốc men',             5, NULL, NULL),
('Gym & Fitness',         5, NULL, NULL),
-- AI bank label
('Sức khoẻ',              5, NULL, 'Nhãn AI — sức khoẻ chung'),

-- ── Hóa đơn & Tiện ích ───────────────────────────────────────────────────────
('Tiền điện',             6, NULL, NULL),
('Tiền nước',             6, NULL, NULL),
('Internet & Điện thoại', 6, NULL, NULL),
('Thuê nhà',              6, NULL, NULL),
-- AI bank label
('Sinh hoạt & Nhà ở',     6, NULL, 'Nhãn AI — sinh hoạt & nhà ở chung'),

-- ── Giáo dục ─────────────────────────────────────────────────────────────────
('Học phí',               7, NULL, NULL),
('Sách & Tài liệu',       7, NULL, NULL),
('Khóa học online',       7, NULL, NULL),

-- ── Gia đình ─────────────────────────────────────────────────────────────────
('Tiền biếu gia đình',    8, NULL, NULL),
('Đồ dùng sinh hoạt',     8, NULL, NULL),
-- AI bank label
('Gia đình',              8, NULL, 'Nhãn AI — chi tiêu gia đình chung'),

-- ── Lương & Thu nhập ─────────────────────────────────────────────────────────
('Lương cơ bản',          9, NULL, NULL),
('Thưởng',                9, NULL, NULL),
('Thu nhập phụ',          9, NULL, NULL),
-- AI bank label
('Thu nhập chính',        9, NULL, 'Nhãn AI — thu nhập chính'),

-- ── Kinh doanh ───────────────────────────────────────────────────────────────
('Doanh thu bán hàng',   10, NULL, NULL),
('Freelance',            10, NULL, NULL),
-- AI bank label
('Công việc & Khác',     10, NULL, 'Nhãn AI — công việc & thu nhập khác'),

-- ── Đầu tư ───────────────────────────────────────────────────────────────────
('Cổ tức',               11, NULL, NULL),
('Lãi tiết kiệm',        11, NULL, NULL),
-- AI bank label
('Lãi đầu tư',           11, NULL, 'Nhãn AI — lợi nhuận đầu tư'),

-- ── Tiết kiệm ────────────────────────────────────────────────────────────────
('Quỹ khẩn cấp',         12, NULL, NULL),
('Tiết kiệm dài hạn',    12, NULL, NULL),

-- ── Vay mượn ─────────────────────────────────────────────────────────────────
('Vay ngân hàng',        13, NULL, NULL),
('Vay cá nhân',          13, NULL, NULL);
