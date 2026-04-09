-- Agregar campos adicionales a movimiento_stock para movimientos directos
ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS estado_producto VARCHAR(50);
ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS cargo_retira VARCHAR(50);
ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS id_institucion INT REFERENCES institucion(id_institucion);
ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS id_usuario INT REFERENCES usuario(id_usuario);
ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS motivo TEXT;
ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS id_proveedor INT REFERENCES proveedor(id_proveedor);

-- Ajustar el constraint para permitir movimientos directos sin detalle de ingreso/orden
ALTER TABLE movimiento_stock DROP CONSTRAINT IF EXISTS chk_movimiento_origen;
ALTER TABLE movimiento_stock ADD CONSTRAINT chk_movimiento_origen CHECK (
  NOT (id_detalle_ingreso IS NOT NULL AND id_detalle_orden IS NOT NULL)
);