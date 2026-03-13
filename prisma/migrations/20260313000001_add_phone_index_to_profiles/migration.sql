-- BUG-001修复: 新增 phone_index 字段
-- 用途: 存储 HMAC-SHA256(phone) 的确定性哈希，用于登录时检索用户
-- 背景: phone_enc 使用随机IV加密，每次加密结果不同，无法直接作为查询条件
--       phone_index 使用 HMAC 生成确定性索引，保证同一手机号 HMAC 值固定可查

-- AlterTable: 为 profiles 表新增 phone_index 列
ALTER TABLE "profiles" ADD COLUMN "phone_index" TEXT;

-- CreateIndex: 为 phone_index 建立唯一索引（一个手机号对应一个账户）
CREATE UNIQUE INDEX "profiles_phone_index_key" ON "profiles"("phone_index");
