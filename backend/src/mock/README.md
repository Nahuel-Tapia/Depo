# Usuarios de Prueba (Mock Data)

Este directorio contiene datos de prueba para desarrollo y testing sin necesidad de insertarlos en la base de datos.

## 📋 Usuarios Disponibles

| ID | Rol | Email | Contraseña | Descripción |
|----|-----|-------|------------|-------------|
| 1 | admin | admin@depo.test | admin123 | Administrador con acceso completo |
| 2 | control_ministerio | control@ministry.test | control123 | Control del ministerio |
| 3 | directivo | director@school1.test | director123 | Directivo de institución (Escuela Primaria N°1) |
| 4 | supervisor | supervisor@zone1.test | supervisor123 | Supervisor Zona Norte (Nivel Primario) |
| 5 | director_area | director.area@primary.test | directorarea123 | Director de Área Primario |
| 6 | operador | operador@depo.test | operador123 | Operador de depósito |
| 7 | consulta | consulta@depo.test | consulta123 | Usuario de solo consulta |
| 8 | area_compras | compras@depo.test | compras123 | Área de compras |
| 9 | director_area | director.area@secondary.test | directorarea123 | Director de Área Secundario |
| 10 | supervisor | supervisor@zone2.test | supervisor123 | Supervisor Zona Sur (Nivel Secundario) |

## 🚀 Cómo Usar

### Importar el módulo

```javascript
const { 
  TEST_USERS, 
  TEST_INSTITUTIONS,
  getMockUser, 
  getMockUserById,
  getMockUserByEmail,
  getMockToken,
  getMockUsersByRole,
  getMockActiveUsers,
  getMockPermissionsMatrix,
  validateMockCredentials,
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS
} = require('./mock/test_users');
```

### Ejemplos de Uso

#### 1. Obtener todos los usuarios de prueba

```javascript
console.log(TEST_USERS);
// Array con los 10 usuarios de prueba
```

#### 2. Obtener un usuario por rol

```javascript
const admin = getMockUser('admin');
console.log(admin);
// { id: 1, nombre: 'Administrador', apellido: 'Sistema', ... }

const directivo = getMockUser('directivo');
console.log(directivo);
// { id: 3, nombre: 'Director', apellido: 'Escuela', ... }
```

#### 3. Obtener un usuario por email

```javascript
const user = getMockUserByEmail('operador@depo.test');
console.log(user);
// { id: 6, nombre: 'Operador', apellido: 'Deposito', ... }
```

#### 4. Obtener un usuario por ID

```javascript
const user = getMockUserById(5);
console.log(user);
// { id: 5, nombre: 'Director', apellido: 'Area Primario', ... }
```

#### 5. Validar credenciales de prueba

```javascript
const user = validateMockCredentials('admin@depo.test', 'admin123');
if (user) {
  console.log('Credenciales válidas:', user.nombre, user.apellido);
} else {
  console.log('Credenciales inválidas');
}
```

#### 6. Generar token JWT mock para testing

```javascript
const admin = getMockUser('admin');
const token = getMockToken(admin);
console.log(token);
// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYWRtaW5AZGVwby50ZXN0Iiwicm9sZSI6ImFkbWluIiwicGVybWlzb3MiOltdLCJpYXQiOjE2ODI2MTQ0MDAsImV4cCI6MTY4MjcwMDgwMH0.mock-signature
```

#### 7. Obtener usuarios por rol

```javascript
const directoresArea = getMockUsersByRole('director_area');
console.log(directoresArea);
// Array con los 2 directores de área (Primario y Secundario)

const supervisores = getMockUsersByRole('supervisor');
console.log(supervisores);
// Array con los 2 supervisores (Zona Norte y Zona Sur)
```

#### 8. Obtener matriz de permisos

```javascript
const matrix = getMockPermissionsMatrix();
console.log(matrix.admin.permisos);
// Array con todos los permisos del rol admin

console.log(matrix.directivo.descripcion);
// "Directivo de institución educativa - puede crear pedidos y ver auditoría"
```

#### 9. Obtener instituciones de prueba

```javascript
console.log(TEST_INSTITUTIONS);
/*
[
  { id: 1, nombre: 'Escuela Primaria N°1', cue: 'CUE001', nivel_educativo: 'Primario' },
  { id: 2, nombre: 'Escuela Secundaria N°2', cue: 'CUE002', nivel_educativo: 'Secundario' },
  { id: 3, nombre: 'Jardin de Infantes N°3', cue: 'CUE003', nivel_educativo: 'Inicial' }
]
*/
```

## 🔧 Casos de Uso Típicos

### Testing de Autenticación

```javascript
// Simular login con usuario mock
const testLogin = async (email, password) => {
  const user = validateMockCredentials(email, password);
  if (!user) {
    return { error: 'Credenciales inválidas' };
  }
  
  const token = getMockToken(user);
  return { token, user };
};

// Probar login
const result = await testLogin('admin@depo.test', 'admin123');
console.log(result);
```

### Testing de Autorización

```javascript
// Verificar permisos de un rol
const admin = getMockUser('admin');
console.log('Permisos del admin:', admin.permisos.length);

const consulta = getMockUser('consulta');
console.log('Permisos de consulta:', consulta.permisos.length);

// Comparar permisos
console.log('Admin tiene más permisos:', admin.permisos.length > consulta.permisos.length);
```

### Testing de Endpoints

```javascript
// Simular request con usuario mock
const mockRequest = (user) => ({
  user: {
    sub: user.id,
    email: user.email,
    role: user.role,
    permisos: user.permisos
  }
});

// Probar endpoint que requiere autenticación
const admin = getMockUser('admin');
const req = mockRequest(admin);
console.log('User ID from request:', req.user.sub);
```

## ⚠️ Advertencias Importantes

1. **SOLO PARA DESARROLLO Y TESTING**: Estos datos mock NO deben usarse en producción.
2. **Contraseñas en texto plano**: Las contraseñas están en texto plano solo para facilitar el testing.
3. **Tokens no válidos criptográficamente**: Los tokens JWT generados son simulados y no deben usarse para autenticación real.
4. **No modificar para producción**: Este archivo está diseñado específicamente para evitar inserciones en la base de datos.

## 📊 Estructura de Roles y Jerarquías

```
admin (Acceso completo)
├── control_ministerio (Control y auditoría)
├── director_area (Gestión de usuarios y supervisión)
│   ├── supervisor (Gestión de zona)
│   └── supervisor (Gestión de zona)
├── directivo (Gestión de institución)
├── operador (Gestión de depósito)
├── area_compras (Gestión de compras)
└── consulta (Solo lectura)
```

## 🔄 Integración con Tests Existentes

Si ya tenés tests que usan la base de datos, podés usar estos mocks como alternativa más rápida:

```javascript
// En lugar de crear usuario en DB
// const user = await createUserInDB({ nombre: 'Test', ... });

// Usar usuario mock
const user = getMockUser('admin');

// Tus tests serán más rápidos y no dependerán de la DB
```

## 📝 Notas

- Los IDs de los usuarios mock son consecutivos (1-10) para facilitar la referencia.
- Las relaciones entre usuarios (como `director_area_id`) están configuradas para reflejar la jerarquía real.
- Los emails usan el dominio `.test` para evitar colisiones con emails reales.
- Todos los usuarios están marcados como `activo: true` por defecto.