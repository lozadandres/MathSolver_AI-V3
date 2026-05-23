import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('chat routes require group access and ABAC/PBAC policies when groupId is used', () => {
  const source = read('routes/chatRoutes.js');

  assert.match(source, /router\.get\('\/context\/:groupId'.*requireGroupAccess/s);
  assert.match(source, /router\.post\('\/'.*checkPolicy\('clase_debe_estar_activa'\).*requireGroupAccess.*checkPolicy\('horario_chat_estudiante'\)/s);
  assert.match(source, /router\.post\('\/with-file'.*checkPolicy\('clase_debe_estar_activa'\).*requireGroupAccess.*checkPolicy\('horario_chat_estudiante'\)/s);
});

test('student join route applies PBAC policies before joining a class', () => {
  const source = read('routes/estudianteRoutes.js');

  assert.match(source, /router\.post\('\/unirse'.*checkPolicy\('solo_estudiante_puede_unirse'\).*checkPolicy\('codigo_con_usos_disponibles'\).*checkPolicy\('codigo_no_expirado'\).*checkPolicy\('limite_alumnos_clase'\).*checkPolicy\('clase_debe_estar_activa'\)/s);
});

test('document endpoint is no longer a demo route in app.js', () => {
  const source = read('app.js');

  assert.match(source, /app\.use\('\/api\/documentos', documentoRoutes\)/);
  assert.doesNotMatch(source, /app\.get\('\/api\/documentos\/:id'/);
});

test('RBAC and ReBAC denials are audited', () => {
  const source = read('middleware/authMiddleware.js');

  assert.match(source, /accion:\s*'RBAC_DENIED'/);
  assert.match(source, /accion:\s*'REBAC_DENIED'/);
});
