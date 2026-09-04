const testSqls = [
  'INSERT INTO pedido (id_usuario_solicitante) VALUES (1)',
  'INSERT INTO public.pedido (id_usuario_solicitante) VALUES (1)',
  'INSERT INTO "pedido" (id_usuario_solicitante) VALUES (1)',
  'INSERT INTO "public"."pedido" (id_usuario_solicitante) VALUES (1)',
  'INSERT INTO detalle_pedido (id_pedido) VALUES (1)',
  'INSERT INTO public.detalle_pedido (id_pedido) VALUES (1)'
]

console.log('--- VIEJA REGEX EN DB.PG.JS ---')
testSqls.forEach(sql => {
  const tableMatch = sql.match(/INSERT\s+INTO\s+(\w+)/i)
  const table = tableMatch ? tableMatch[1].toLowerCase() : ''
  console.log(`SQL: ${sql}`)
  console.log(`Tabla extraída: "${table}"`)
})

console.log('\n--- NUEVA REGEX ROBUSTA ---')
testSqls.forEach(sql => {
  const tableMatch = sql.match(/INSERT\s+INTO\s+(?:(?:"?\w+"?\.)?"?)(\w+)"?/i)
  const table = tableMatch ? tableMatch[1].toLowerCase() : ''
  console.log(`SQL: ${sql}`)
  console.log(`Tabla extraída: "${table}"`)
})
