-- 010_hapus_tipe_kamar.sql
-- Bersihkan label VIP / AC / Standar pada database yang sudah ada menjadi periode_default kamar.
UPDATE kamar SET tipe = periode_default WHERE tipe IN ('VIP', 'AC', 'Standar');

