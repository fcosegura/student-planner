Consola D1 (dashboard): suele permitir UNA sentencia SQL por ejecución (no pegues schema.sql entero).

Ejecuta en orden: 01 … 13, luego 14 (schedule_slots con FK). Si 14 falla, usa 14b (misma tabla sin FOREIGN KEY) y después 15.

Si un CREATE INDEX falla con "no such table", falta el CREATE TABLE anterior.
