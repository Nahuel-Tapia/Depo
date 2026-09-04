# DEPO — Test de coincidencia Supabase vs Sistema

Dos scripts independientes:

- **`compare-schema.js`** → compara el **esquema** (tablas, columnas, tipos, PK/FK/UNIQUE/CHECK, índices).
- **`check-data.js`** → chequea **datos**: conteo de filas, FKs huérfanas, y (opcional) valores fuera de lo esperado (ej. estados inválidos).

## 1. Instalación

```bash
npm install
cp .env.example .env
# completá DATABASE_URL con la connection string de Supabase
```

La connection string está en Supabase: **Settings → Database → Connection string → URI**.
Para `compare-schema.js` usá un usuario con permisos de `CREATE SCHEMA` / `DROP SCHEMA`
(el usuario `postgres` de Supabase sirve). `check-data.js` solo necesita lectura.

## 2. Preparar tus migraciones

Poné todos tus `.sql` (los que crean las tablas de DEPO) en una carpeta, por ejemplo `./migrations`,
nombrados en orden (`001_solicitudes.sql`, `002_licitaciones.sql`, etc.) porque se ejecutan
en orden alfabético.

**Importante:** si tus `.sql` usan `public.tabla` en vez de `tabla` a secas (schema-qualified),
el script los va a correr igual dentro de un schema temporal gracias a `SET search_path`,
*siempre que no tengan el `public.` hardcodeado*. Si lo tienen hardcodeado, decime y te dejo
una variante que hace `sed` sobre una copia temporal antes de correrlos.

## 3. Comparar esquema

```bash
node compare-schema.js --migrations ./migrations
```

Qué hace:
1. Crea un schema temporal (`schema_check_tmp`) en la misma base.
2. Corre ahí tus `.sql` tal cual los tenés (no toca `public`, no toca datos).
3. Compara `information_schema` entre `public` y el schema temporal: tablas, columnas
   (tipo, nullable, longitud, precisión), constraints e índices.
4. Imprime el diff y borra el schema temporal al final.
5. Sale con código `1` si hay diferencias (útil para CI), `0` si coincide 100%.

Si querés inspeccionar el schema temporal a mano antes de que se borre:

```bash
node compare-schema.js --migrations ./migrations --keep-shadow
```

## 4. Chequear datos

```bash
node check-data.js
```

Con validación de valores esperados (por ejemplo los estados del state machine
de solicitudes/licitaciones que mencionás en la documentación de DEPO):

```bash
cp data-checks.example.json data-checks.json
# ajustá los nombres reales de tabla/columna en data-checks.json
node check-data.js --config data-checks.json
```

**Ojo:** `data-checks.example.json` tiene nombres de tabla/columna de ejemplo
(`solicitudes.estado`, `licitaciones.estado`). Cambialos por los reales de tu
esquema antes de usarlo — no los inventé a partir de tu base, sino de lo que
tenía anotado sobre el proyecto.

## 5. Integrarlo como test (opcional)

Ambos scripts terminan con `process.exit(1)` si encuentran diferencias/problemas,
así que se pueden usar directo como step de CI:

```yaml
- run: node compare-schema.js --migrations ./migrations
- run: node check-data.js --config ./data-checks.json
```
