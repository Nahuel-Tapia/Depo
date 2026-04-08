-- Alterar los campos de la tabla edificio para permitir datos más largos
ALTER TABLE edificio ALTER COLUMN calle TYPE VARCHAR(150);
ALTER TABLE edificio ALTER COLUMN direccion TYPE VARCHAR(200);
ALTER TABLE edificio ALTER COLUMN localidad TYPE VARCHAR(100);
ALTER TABLE edificio ALTER COLUMN departamento TYPE VARCHAR(100);
