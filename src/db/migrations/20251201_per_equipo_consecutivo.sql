-- Migración para cambiar consecutivo global a consecutivo por equipo
-- Ejecutar en TiDB / MySQL antes de usar endpoints per-equipo.
-- IMPORTANTE: Verifique que no existan colisiones de consecutivo por equipo.

START TRANSACTION;

-- HISTORIAL: cambiar PK
ALTER TABLE historial_hv DROP PRIMARY KEY;
ALTER TABLE historial_hv ADD PRIMARY KEY (equipo_id, consecutivo);

-- INTERVALO: cambiar PK
ALTER TABLE intervalo_hv DROP PRIMARY KEY;
ALTER TABLE intervalo_hv ADD PRIMARY KEY (equipo_id, consecutivo);

COMMIT;

-- Si se desea mantener una clave surrogate global, puede añadirse:
-- ALTER TABLE historial_hv ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST; (omitir si no se necesita)
-- ALTER TABLE intervalo_hv ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST; (omitir si no se necesita)

-- Validación rápida post-migración:
-- SELECT equipo_id, MAX(consecutivo) FROM historial_hv GROUP BY equipo_id;
-- SELECT equipo_id, MAX(consecutivo) FROM intervalo_hv GROUP BY equipo_id;