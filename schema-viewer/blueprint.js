/* Conversão de dados Blueprint em um grafo de análise. Não gera código ou SQL. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BlueprintDiagram = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LIMITS = Object.freeze({ bytes: 262144, models: 80, fields: 100, edges: 500 });
  const reserved = new Set(['meta', 'relationships', 'indexes', 'timestamps', 'timestampsTz', 'softDeletes', 'softDeletesTz']);
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const baseName = name => String(name).split('\\').filter(Boolean).pop() || String(name);
  const snake = name => baseName(name).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  const normalized = name => String(name).replace(/[\\_\s-]/g, '').toLowerCase();
  const split = value => value.split(',').map(part => part.trim()).filter(Boolean);
  const tokens = value => value.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  function shortName(value, context) {
    if (typeof value !== 'string' || !value.trim() || value.length > 160) {
      throw new Error(`${context}: o nome deve ter de 1 a 160 caracteres.`);
    }
    return value;
  }
  function field(name, definition, inferred = false) {
    shortName(name, 'Coluna');
    if (typeof definition !== 'string' || definition.length > 4096) {
      throw new Error(`Coluna ${name}: use uma definição textual, por exemplo "text nullable".`);
    }
    const parts = tokens(definition);
    const type = parts.find(part => /^(id|uuid|ulid|string|text|longText|mediumText|binary|boolean|integer|bigInteger|unsignedBigInteger|smallInteger|decimal|float|double|date|dateTime|dateTimeTz|timestamp|timestampTz|time|json|jsonb|enum|bigIncrements)(:|$)/i.test(part)) || parts[0] || 'indefinido';
    return {
      name, definition, type, inferred, primary: parts.includes('primary'),
      unique: parts.includes('unique'), nullable: parts.includes('nullable'),
      foreign: false, tokens: parts,
    };
  }
  function buildDiagram(document) {
    if (!record(document) || !record(document.models) || !Object.keys(document.models).length) {
      throw new Error('O YAML precisa ter uma seção "models:" com pelo menos um modelo Blueprint.');
    }
    const entries = Object.entries(document.models);
    if (entries.length > LIMITS.models) throw new Error(`Limite de ${LIMITS.models} modelos por diagrama.`);
    const warnings = new Set();
    const nodes = entries.map(([name, model], index) => {
      shortName(name, 'Modelo');
      if (!record(model)) throw new Error(`Modelo ${name}: a definição precisa ser um mapa de colunas.`);
      const table = model.meta && model.meta.table;
      if (table !== undefined) shortName(table, `Tabela de ${name}`);
      const node = { id: `model-${index}`, name, table: table || '', fields: [], indexes: [], primaryKey: [], raw: model };
      if (!own(model, 'id')) node.fields.push(field('id', 'id primary', true));
      for (const [column, definition] of Object.entries(model)) {
        if (reserved.has(column) || (column === 'id' && definition === false)) continue;
        const value = field(column, definition);
        if (column === 'id') value.primary = true;
        node.fields.push(value);
      }
      if (model.timestamps !== false) {
        const type = own(model, 'timestampsTz') ? 'timestampTz' : 'timestamp';
        for (const name of ['created_at', 'updated_at']) {
          if (!node.fields.some(item => item.name === name)) node.fields.push(field(name, `${type} nullable`, true));
        }
      }
      for (const [option, type] of [['softDeletes', 'timestamp'], ['softDeletesTz', 'timestampTz']]) {
        if (own(model, option) && model[option] !== false && !node.fields.some(item => item.name === 'deleted_at')) {
          node.fields.push(field('deleted_at', `${type} nullable`, true));
        }
      }
      if (model.indexes !== undefined && !Array.isArray(model.indexes)) throw new Error(`${name}.indexes deve ser uma lista.`);
      for (const item of model.indexes || []) {
        if (!record(item) || Object.keys(item).length !== 1 || typeof Object.values(item)[0] !== 'string') {
          throw new Error(`${name}.indexes: use itens como "- primary: message_id, recipient_id".`);
        }
        const [kind, columns] = Object.entries(item)[0];
        const names = split(columns);
        node.indexes.push({ kind, columns: names });
        for (const column of names) {
          const item = node.fields.find(item => item.name === column);
          if (!item) warnings.add(`${name}: índice ${kind} referencia coluna não declarada: ${column}.`);
          else if (kind === 'primary') item.primary = true;
          else if (kind === 'unique' && names.length === 1) item.unique = true;
        }
      }
      node.primaryKey = node.fields.filter(item => item.primary).map(item => item.name);
      if (node.primaryKey.length > 1) warnings.add(`${name}: PK composta; identidade de Model Eloquent convencional exige tratamento específico.`);
      if (!node.fields.length) warnings.add(`${name}: sem colunas físicas declaradas; relações podem ser apenas conceituais.`);
      return node;
    });
    const aliases = new Map();
    for (const node of nodes) {
      for (const alias of [node.name, baseName(node.name), node.table].filter(Boolean)) {
        const key = normalized(alias);
        if (aliases.has(key) && aliases.get(key) !== node) warnings.add(`Referência ambígua entre modelos: ${alias}.`);
        else aliases.set(key, node);
      }
    }
    function resolve(value) {
      const key = normalized(value);
      if (aliases.has(key)) return aliases.get(key);
      // Convenções comuns, sem converter tokenable_id polimórfico em FK de usuário.
      for (const candidate of [key.replace(/ies$/, 'y'), key.replace(/s$/, ''), `${key}s`, `${key.replace(/y$/, 'ie')}s`]) {
        if (aliases.has(candidate)) return aliases.get(candidate);
      }
      return null;
    }
    const edges = [];
    function addEdge(from, to, column, targetColumn, kind, relation, many = false, one = false) {
      const existing = edges.find(edge => edge.from === from.id && edge.to === to.id && edge.column === column);
      if (existing) return;
      if (edges.length >= LIMITS.edges) throw new Error(`Limite de ${LIMITS.edges} relações por diagrama.`);
      const value = from.fields.find(item => item.name === column);
      if (value) value.foreign = true;
      if (targetColumn && !to.fields.some(item => item.name === targetColumn)) {
        warnings.add(`${from.name}.${column}: coluna referenciada não declarada: ${to.name}.${targetColumn}.`);
      }
      const unique = value && (value.unique || (from.primaryKey.length === 1 && from.primaryKey[0] === column));
      edges.push({
        id: `edge-${edges.length}`, from: from.id, to: to.id, column, targetColumn,
        kind, relation, parentCardinality: many ? 'N' : value && value.nullable ? '0..1' : '1',
        childCardinality: one || unique ? '0..1' : '0..N',
      });
    }
    for (const node of nodes) {
      for (const value of node.fields) {
        const foreign = value.tokens.find(token => /^foreign(?::|$)/i.test(token));
        const idType = value.tokens.find(token => /^(id|uuid|ulid)(?::|$)/i.test(token));
        if (!foreign && (!idType || value.name === 'id')) continue;
        const explicit = foreign && foreign.includes(':') ? foreign.slice(foreign.indexOf(':') + 1) : '';
        const typed = idType && idType.includes(':') ? idType.slice(idType.indexOf(':') + 1) : '';
        const reference = explicit || typed || value.name.replace(/_id$/, '');
        const [model, key = 'id'] = reference.split('.');
        const target = resolve(model);
        if (!target) warnings.add(`${node.name}.${value.name}: destino não encontrado (${reference}); aresta não inventada.`);
        else addEdge(node, target, value.name, key, foreign ? 'foreign' : 'inferred', 'belongsTo');
      }
    }
    for (const node of nodes) {
      if (node.raw.relationships !== undefined && !record(node.raw.relationships)) throw new Error(`${node.name}.relationships deve ser um mapa.`);
      for (const [type, relationships] of Object.entries(node.raw.relationships || {})) {
        if (typeof relationships !== 'string') throw new Error(`${node.name}.relationships.${type} deve ser texto.`);
        if (/^morph/i.test(type)) {
          warnings.add(`${node.name}: relação ${type} polimórfica (${relationships}); não equivale a uma FK SQL simples.`);
          continue;
        }
        if (!['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(type)) {
          warnings.add(`${node.name}: relação ${type} não interpretada.`);
          continue;
        }
        for (const reference of split(relationships)) {
          const [name, alias] = reference.split(':');
          const target = resolve(name);
          if (!target) { warnings.add(`${node.name}: modelo de relação não encontrado: ${name}.`); continue; }
          if (type === 'belongsToMany') {
            warnings.add(`${node.name} ↔ ${target.name}: N:N declarada; nenhuma tabela pivot foi criada pelo visualizador.`);
            addEdge(node, target, alias || 'N:N', '', 'declared', type, true);
          } else if (type === 'belongsTo') {
            const column = `${snake(alias || name)}_id`;
            if (!node.fields.some(item => item.name === column)) {
              node.fields.push(field(column, `id:${name}`, true));
              warnings.add(`${node.name}.${column}: coluna inferida de belongsTo para visualização, não aprovada como campo físico.`);
            }
            addEdge(node, target, column, 'id', 'declared', type);
          } else {
            const column = `${snake(node.name)}_id`;
            addEdge(target, node, column, 'id', 'declared', type, false, type === 'hasOne');
          }
        }
      }
    }
    for (const node of nodes) {
      if (node.fields.length > LIMITS.fields) throw new Error(`${node.name}: limite de ${LIMITS.fields} colunas, incluindo inferências.`);
      delete node.raw;
      for (const value of node.fields) delete value.tokens;
    }
    return { nodes, edges, warnings: Array.from(warnings) };
  }
  return { buildDiagram, LIMITS };
});
