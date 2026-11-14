const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDiagram, LIMITS } = require('./blueprint.js');

test('exige a seção models e modelos em formato de mapa', () => {
  for (const value of [null, [], {}, { models: {} }, { models: { User: null } }]) {
    assert.throws(() => buildDiagram(value));
  }
});

test('mantém colunas e infere FK usando a tabela explicitamente nomeada', () => {
  const graph = buildDiagram({ models: {
    User: { meta: { table: 'users' }, id: 'id', timestamps: false },
    Report: { reporter_id: 'id:User nullable foreign:users.id', timestamps: false },
  } });
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].kind, 'foreign');
  assert.equal(graph.edges[0].parentCardinality, '0..1');
  assert.equal(graph.edges[0].childCardinality, '0..N');
  assert.equal(graph.edges[0].targetColumn, 'id');
});

test('resolve papéis diferentes para a mesma tabela sem mesclar as arestas', () => {
  const graph = buildDiagram({ models: {
    User: { id: 'id', timestamps: false },
    Report: { reporter_user_id: 'id:User', reported_user_id: 'id:User', reviewer_user_id: 'id:User nullable', timestamps: false },
  } });
  assert.equal(graph.edges.length, 3);
  assert.equal(new Set(graph.edges.map(edge => edge.column)).size, 3);
  assert.ok(graph.edges.every(edge => edge.kind === 'inferred'));
});

test('desabilita id automático e mantém todos os componentes da PK', () => {
  const graph = buildDiagram({ models: {
    Receipt: { id: false, message_id: 'bigInteger', recipient_id: 'bigInteger', timestamps: false, indexes: [{ primary: 'message_id, recipient_id' }] },
  } });
  assert.deepEqual(graph.nodes[0].primaryKey, ['message_id', 'recipient_id']);
  assert.equal(graph.nodes[0].fields.length, 2);
  assert.ok(graph.warnings.some(warning => warning.includes('PK composta')));
});

test('PK composta não transforma cada referência isolada em um-para-um', () => {
  const graph = buildDiagram({ models: {
    Message: { id: 'id', timestamps: false },
    Receipt: { id: false, message_id: 'id:Message', recipient_id: 'bigInteger', timestamps: false, indexes: [{ primary: 'message_id, recipient_id' }] },
  } });
  assert.equal(graph.edges[0].childCardinality, '0..N');
});

test('PK compartilhada é marcada sem gerar uma coluna id extra', () => {
  const graph = buildDiagram({ models: {
    Participant: { id: 'id', timestamps: false },
    Member: { id: false, participant_id: 'id:Participant primary foreign:Participant.id', timestamps: false },
  } });
  assert.deepEqual(graph.nodes[1].primaryKey, ['participant_id']);
  assert.equal(graph.edges[0].childCardinality, '0..1');
});

test('relações inversas não duplicam a FK', () => {
  const graph = buildDiagram({ models: {
    Conversation: { id: 'id', timestamps: false, relationships: { hasOne: 'Group' } },
    Group: { id: 'id', conversation_id: 'id:Conversation unique', timestamps: false },
  } });
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].childCardinality, '0..1');
});

test('relações sem colunas geram inferência sinalizada, não nome físico inventado', () => {
  const graph = buildDiagram({ models: {
    User: { timestamps: false },
    TemporaryUpload: { id: false, timestamps: false, relationships: { belongsTo: 'User' } },
  } });
  assert.equal(graph.nodes[1].table, '');
  assert.equal(graph.nodes[1].fields[0].name, 'user_id');
  assert.equal(graph.nodes[1].fields[0].inferred, true);
  assert.equal(graph.edges[0].kind, 'declared');
  assert.ok(graph.warnings.some(warning => warning.includes('não aprovada')));
});

test('polimorfismo não é apresentado como FK SQL para users', () => {
  const graph = buildDiagram({ models: {
    User: { timestamps: false },
    Token: { tokenable_id: 'bigInteger', tokenable_type: 'string:255', timestamps: false, relationships: { morphTo: 'tokenable' } },
  } });
  assert.equal(graph.edges.length, 0);
  assert.ok(graph.warnings.some(warning => warning.includes('polimórfica')));
});

test('destino ausente produz aviso sem criar outra tabela', () => {
  const graph = buildDiagram({ models: { Message: { author_id: 'id:Missing foreign:missing.id', timestamps: false } } });
  assert.equal(graph.nodes.length, 1);
  assert.equal(graph.edges.length, 0);
  assert.ok(graph.warnings.some(warning => warning.includes('destino não encontrado')));
});

test('coluna de destino ausente é sinalizada sem inventá-la', () => {
  const graph = buildDiagram({ models: {
    User: { id: 'id', timestamps: false },
    Report: { reviewer_id: 'id:User foreign:User.missing_key', timestamps: false },
  } });
  assert.equal(graph.edges[0].targetColumn, 'missing_key');
  assert.ok(graph.warnings.some(warning => warning.includes('coluna referenciada não declarada')));
  assert.equal(graph.nodes[0].fields.length, 1);
});

test('N:N é apenas relação visual, sem criar pivot', () => {
  const graph = buildDiagram({ models: { User: { relationships: { belongsToMany: 'Group' } }, Group: {} } });
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges[0].relation, 'belongsToMany');
  assert.equal(graph.edges[0].parentCardinality, 'N');
});

test('nomes maliciosos são tratados apenas como dados e não usados como IDs do SVG', () => {
  const name = '<script>alert(1)</script>';
  const graph = buildDiagram({ models: { [name]: { id: 'id', timestamps: false } } });
  assert.equal(graph.nodes[0].name, name);
  assert.equal(graph.nodes[0].id, 'model-0');
});

test('nomes como __proto__ não alteram protótipos', () => {
  const input = JSON.parse('{"models":{"__proto__":{"id":"id","timestamps":false},"Other":{"value":"text","timestamps":false}}}');
  const graph = buildDiagram(input);
  assert.equal(graph.nodes.length, 2);
  assert.equal({}.polluted, undefined);
});

test('rejeita valores de colunas ou índices inválidos sem recursão em aliases', () => {
  const cyclic = {}; cyclic.value = cyclic;
  assert.throws(() => buildDiagram({ models: { Bad: { value: cyclic } } }));
  assert.throws(() => buildDiagram({ models: { Bad: { indexes: 'id' } } }));
  assert.throws(() => buildDiagram({ models: { Bad: { relationships: { belongsTo: [] } } } }));
});

test('limita modelos e colunas para evitar layouts excessivos', () => {
  const models = Object.fromEntries(Array.from({ length: LIMITS.models + 1 }, (_, index) => [`M${index}`, {}]));
  assert.throws(() => buildDiagram({ models }), /Limite/);
  const fields = Object.fromEntries(Array.from({ length: LIMITS.fields + 1 }, (_, index) => [`c${index}`, 'text']));
  assert.throws(() => buildDiagram({ models: { Large: fields } }), /limite/);
});
