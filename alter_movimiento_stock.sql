-- Agregar campos adicionales a movimiento_stock para movimientos directos
ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS estado_producto VARCHAR(50);
ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS cargo_retira VARCHAR(50);
ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS id_institucion INT REFERENCES institucion(id_institucion);
ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS id_usuario INT REFERENCES usuario(id_usuario);
ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS motivo TEXT;