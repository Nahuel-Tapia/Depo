-- Inserción de productos
INSERT INTO producto (nombre, unidad_medida) VALUES
  ('Lavandina concentrada (Cloro)', 'litros'),
  ('Limpiador de pisos aromatizado', 'litros'),
  ('Limpiador multiuso', 'litros'),
  ('Jabón líquido para manos', 'litros'),
  ('Papel higiénico', 'rollos'),
  ('Toallas de papel para manos', 'paquetes'),
  ('Bolsas de residuos (reforzadas)', 'unidades'),
  ('Detergente lavavajillas (uso profesional)', 'litros'),
  ('Desengrasante de superficies', 'litros'),
  ('Limpiador de pisos neutro', 'litros'),
  ('Toallas de papel interfoliadas', 'paquetes'),
  ('Jabón líquido para ropa (Baja espuma)', 'litros'),
  ('Suavizante textil', 'litros'),
  ('Detergente y Desengrasante', 'litros'),
  ('Limpia sarro/Desincrustante', 'litros'),
  ('Jabón líquido o de tocador', 'litros'),
  ('Pastillas desodorantes/Desinfectantes de inodoro', 'unidades'),
  ('Bolsas de residuos (Consorcio)', 'unidades grandes'),
  ('Escobillones', 'unidades'),
  ('Mopas de algodón', 'unidades'),
  ('Paños de microfibra', 'unidades'),
  ('Baldes con prensa', 'unidades');

-- Inserción de kits
INSERT INTO producto_kit (nombre, tipo_escuela, descripcion) VALUES
  ('Kit Jornada Normal (100 alumnos / Mes)', 'normal', 'Mantenimiento rápido de aulas y baños entre turnos'),
  ('Kit Jornada Completa (100 alumnos / Mes)', 'jornada_extendida', 'Desengrase de cocina, mayor higiene en comedor y refuerzo de baños'),
  ('Kit Escuela Albergue (100 alumnos / Mes)', 'albergue', 'Residencia completa, lavado de ropa de cama y desinfección de duchas'),
  ('Herramientas recomendadas (cada 100 alumnos)', 'normal', 'Herramientas proporcionales a 100 alumnos');

-- Relacionar productos con kits (producto_kit_detalle)
-- Debes obtener los id de producto y de kit generados para completar estos inserts
-- Ejemplo:
-- INSERT INTO producto_kit_detalle (kit_id, id_producto, cantidad) VALUES (1, 1, 10); -- Kit 1, Producto 1, 10 litros
-- Repite para cada producto y kit según corresponda

-- Puedes consultar los ids con:
-- SELECT id FROM producto_kit WHERE nombre LIKE '%Jornada Normal%';
-- SELECT id_producto FROM producto WHERE nombre LIKE '%Lavandina%';

-- Ejemplo de inserción para Kit Jornada Normal (ajusta los ids según tu base):
-- INSERT INTO producto_kit_detalle (kit_id, id_producto, cantidad) VALUES (kit_id, producto_id, cantidad);
-- ...
