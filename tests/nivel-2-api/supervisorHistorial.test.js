const request = require('supertest');
const app = require('../src/server'); // Asumiendo el entry point del servidor
const { getMockToken, getMockUser } = require('../src/mock/test_users');

describe('Supervisor: Historial de Consumo', () => {
  let supervisorToken;
  const escuelaId = 1; // Escuela Primaria N°1 de los mocks

  beforeAll(() => {
    const supervisor = getMockUser('supervisor');
    supervisorToken = getMockToken(supervisor);
  });

  it('Debe retornar el historial consolidado de una institución para el supervisor', async () => {
    const response = await request(app)
      .get(`/api/supervisor/instituciones/${escuelaId}/historial`)
      .set('Authorization', `Bearer ${supervisorToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('historial');
    expect(Array.isArray(response.body.historial)).toBe(true);

    // Validar estructura de un registro de consumo
    const registro = response.body.historial[0];
    if (registro) {
      expect(registro).toHaveProperty('producto_nombre');
      expect(registro).toHaveProperty('cantidad_solicitada');
      expect(registro).toHaveProperty('cantidad_entregada');
      expect(registro).toHaveProperty('fecha');
      expect(registro).toHaveProperty('tipo_pedido'); // 'anual' o 'refuerzo'
    }
  });

  it('Debe denegar el acceso si el token pertenece a un Directivo (Unauthorized Role)', async () => {
    const directivo = getMockUser('directivo');
    const directivoToken = getMockToken(directivo);

    const response = await request(app)
      .get(`/api/supervisor/instituciones/${escuelaId}/historial`)
      .set('Authorization', `Bearer ${directivoToken}`);

    expect(response.status).toBe(403);
  });
});