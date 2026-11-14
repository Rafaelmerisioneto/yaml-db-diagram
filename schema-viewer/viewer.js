(function () {
  'use strict';
  if (!window.React || !window.ReactDOM || !window.jsyaml || !window.dagre || !window.BlueprintDiagram) {
    const message = document.createElement('p');
    message.className = 'error';
    message.textContent = 'Não foi possível carregar as bibliotecas. Verifique sua conexão e o acesso a cdn.jsdelivr.net e recarregue a página.';
    document.getElementById('root').appendChild(message);
    return;
  }
  const { createElement: h, useState, useRef, useEffect, useLayoutEffect, useMemo } = React;
  const { buildDiagram, LIMITS } = BlueprintDiagram;
  const EXAMPLE = `# Exemplo de sintaxe; não é o modelo completo do DirectChannel.
# Use "Modelo do projeto" ou abra blueprint-diagram.yaml para analisar o modelo atual.
models:
  User:
    meta:
      table: users
    id: id
    name: string:255
    email: string:255 unique
    timestamps: false

  Conversation:
    meta:
      table: conversations
    id: id
    kind: text
    timestamps: false

  ConversationParticipant:
    meta:
      table: conversation_participants
    id: id
    user_id: id:User foreign:users.id
    conversation_id: id:Conversation foreign:conversations.id
    joined_at: timestampTz:6
    left_at: timestampTz:6 nullable
    timestamps: false

  Message:
    meta:
      table: messages
    id: id
    sender_participant_id: id:ConversationParticipant
    encrypted_body: binary
    accepted_at: timestampTz:6
    timestamps: false
`;
  const WIDTH = 350;
  const ROW = 24;
  const clip = (text, length) => String(text).length > length ? `${String(text).slice(0, length - 1)}…` : String(text);
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  function parse(source) {
    if (new TextEncoder().encode(source).length > LIMITS.bytes) throw new Error('O YAML excede o limite de 256 KiB.');
    // JSON_SCHEMA não instancia objetos/custom tags; buildDiagram também limita a estrutura.
    const document = jsyaml.load(source, { schema: jsyaml.JSON_SCHEMA, json: false });
    return {
      ...buildDiagram(document),
      notes: source.split('\n').filter(line => /^\s*#/.test(line)).map(line => line.replace(/^\s*# ?/, '')).join('\n'),
    };
  }
  function arrange(graph, direction, keysOnly) {
    const g = new dagre.graphlib.Graph({ multigraph: true });
    g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 140, marginx: 50, marginy: 50, edgesep: 18 });
    g.setDefaultEdgeLabel(() => ({}));
    const nodes = graph.nodes.map(node => {
      const visibleFields = keysOnly ? node.fields.filter(field => field.primary || field.foreign) : node.fields;
      const height = 78 + Math.max(visibleFields.length, 1) * ROW;
      g.setNode(node.id, { width: WIDTH, height });
      return { ...node, visibleFields, width: WIDTH, height };
    });
    for (const edge of graph.edges) g.setEdge(edge.to, edge.from, {}, edge.id);
    dagre.layout(g);
    return nodes.map(node => {
      const position = g.node(node.id);
      return { ...node, x: position.x - WIDTH / 2, y: position.y - node.height / 2 };
    });
  }
  function bounds(nodes) {
    if (!nodes.length) return { x: 0, y: 0, width: 800, height: 500 };
    const x = Math.min(...nodes.map(node => node.x)) - 45;
    const y = Math.min(...nodes.map(node => node.y)) - 45;
    return { x, y, width: Math.max(...nodes.map(node => node.x + node.width)) - x + 45, height: Math.max(...nodes.map(node => node.y + node.height)) - y + 45 };
  }
  function download(content, type, filename) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const EXPORT_STYLE = `
    .node-frame{fill:#fff;stroke:#ccdbe3;stroke-width:1.3}.node.selected .node-frame{stroke:#087f8c;stroke-width:3}
    .node-title{fill:#15364b}.node-name{fill:#fff;font:600 13px sans-serif}.node-table{fill:#c4d9e5;font:10px monospace}
    .field-name{fill:#284252;font:11px monospace}.field-type{fill:#738593;font:10px monospace}
    .field-badge{fill:#087f8c;font:bold 9px monospace}.inferred{fill:#b07919}.row-line{stroke:#edf2f5}
    .edge{fill:none;stroke:#9baebc;stroke-width:1.5}.edge.inferred,.edge.declared{stroke-dasharray:5 4}
    .edge.active{stroke:#087f8c;stroke-width:2.6}.edge-hit{display:none}
    .edge-label{fill:#087f8c;font:11px sans-serif;paint-order:stroke;stroke:#f4f8fa;stroke-width:4}
  `;
  function App() {
    const [text, setText] = useState(EXAMPLE);
    const [graph, setGraph] = useState(() => parse(EXAMPLE));
    const [renderedText, setRenderedText] = useState(EXAMPLE);
    const [nodes, setNodes] = useState([]);
    const [direction, setDirection] = useState('LR');
    const [keysOnly, setKeysOnly] = useState(false);
    const [selected, setSelected] = useState(null);
    const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
    const [error, setError] = useState('');
    const [status, setStatus] = useState('Exemplo carregado. Abra o YAML do seu modelo para começar.');
    const [dragOver, setDragOver] = useState(false);
    const [loading, setLoading] = useState(false);
    const canvas = useRef(null);
    const svg = useRef(null);
    const fileInput = useRef(null);
    const pointer = useRef(null);
    const readSequence = useRef(0);
    const nodeMap = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);
    const dirty = text !== renderedText;
    function renderSource(source = text, message = 'Diagrama atualizado.') {
      try {
        const parsed = parse(source);
        setGraph(parsed); setRenderedText(source); setError(''); setStatus(message);
        return true;
      } catch (failure) {
        const mark = failure.mark;
        const location = mark ? `Linha ${mark.line + 1}, coluna ${mark.column + 1}: ` : '';
        setError(location + (failure.reason || failure.message));
        setStatus('O diagrama anterior foi preservado; corrija o YAML e renderize novamente.');
        return false;
      }
    }
    function fit(items = nodes) {
      if (!canvas.current || !items.length) return;
      const { width, height } = canvas.current.getBoundingClientRect();
      const area = bounds(items);
      const scale = clamp(Math.min((width - 60) / area.width, (height - 90) / area.height), .04, 1.15);
      setView({ x: (width - area.width * scale) / 2 - area.x * scale, y: (height - area.height * scale) / 2 - area.y * scale, scale });
    }
    function focusNode(id) {
      const node = nodeMap.get(id);
      if (!node || !canvas.current) return;
      const { width, height } = canvas.current.getBoundingClientRect();
      const available = width > 740 ? width - 360 : width;
      const scale = clamp(Math.min((available - 50) / WIDTH, (height - 80) / node.height), .15, 1.2);
      setSelected({ type: 'node', id });
      setView({ x: available / 2 - (node.x + WIDTH / 2) * scale, y: height / 2 - (node.y + node.height / 2) * scale, scale });
    }
    useLayoutEffect(() => {
      try {
        const next = arrange(graph, direction, keysOnly);
        setNodes(next); setSelected(null);
        const frame = requestAnimationFrame(() => fit(next));
        return () => cancelAnimationFrame(frame);
      } catch (failure) { setError(`Não foi possível organizar o grafo: ${failure.message}`); }
    }, [graph, direction, keysOnly]);
    function zoom(factor, point) {
      if (!canvas.current) return;
      const rect = canvas.current.getBoundingClientRect();
      const x = point ? point.x - rect.left : rect.width / 2;
      const y = point ? point.y - rect.top : rect.height / 2;
      setView(current => {
        const scale = clamp(current.scale * factor, .04, 3);
        const ratio = scale / current.scale;
        return { x: x - (x - current.x) * ratio, y: y - (y - current.y) * ratio, scale };
      });
    }
    useEffect(() => {
      const element = svg.current;
      const wheel = event => { event.preventDefault(); zoom(Math.exp(-event.deltaY * .0015), { x: event.clientX, y: event.clientY }); };
      element.addEventListener('wheel', wheel, { passive: false });
      return () => element.removeEventListener('wheel', wheel);
    }, []);
    useEffect(() => {
      const shortcut = event => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); renderSource(); }
        if (event.key === 'Escape') setSelected(null);
      };
      window.addEventListener('keydown', shortcut);
      return () => window.removeEventListener('keydown', shortcut);
    }, [text]);
    async function openFile(file) {
      if (!file) return;
      const sequence = ++readSequence.current;
      if (file.size > LIMITS.bytes) { setError('O arquivo excede o limite de 256 KiB.'); return; }
      try {
        const source = await file.text();
        if (sequence !== readSequence.current) return;
        setText(source); renderSource(source, `Arquivo carregado: ${file.name}`);
      } catch (failure) { setError(`Não foi possível ler o arquivo: ${failure.message}`); }
    }
    async function loadProject() {
      if (location.protocol === 'file:') {
        setError('Para carregar o modelo do projeto por caminho, abra esta página por um servidor estático. Você também pode usar “Abrir YAML” e escolher specs/001-especificacao-funcional-mobile/blueprint-diagram.yaml.');
        return;
      }
      setLoading(true);
      const sequence = ++readSequence.current;
      try {
        const response = await fetch('../../specs/001-especificacao-funcional-mobile/blueprint-diagram.yaml', { credentials: 'omit', cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}. Sirva a raiz do repositório ou use “Abrir YAML”.`);
        const source = await response.text();
        if (sequence !== readSequence.current) return;
        setText(source); renderSource(source, 'Modelo atual do DirectChannel carregado.');
      } catch (failure) { setError(`Falha ao carregar o modelo: ${failure.message}`); }
      finally { setLoading(false); }
    }
    function startPointer(event, node) {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      svg.current.setPointerCapture(event.pointerId);
      pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view, node: node && { id: node.id, x: node.x, y: node.y } };
      setSelected(node ? { type: 'node', id: node.id } : null);
    }
    function movePointer(event) {
      const drag = pointer.current;
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x; const dy = event.clientY - drag.y;
      if (drag.node) {
        setNodes(current => current.map(node => node.id === drag.node.id ? { ...node, x: drag.node.x + dx / drag.view.scale, y: drag.node.y + dy / drag.view.scale } : node));
      } else setView({ ...drag.view, x: drag.view.x + dx, y: drag.view.y + dy });
    }
    function exportSvg() {
      try {
        const copy = svg.current.cloneNode(true);
        const area = bounds(nodes);
        // XMLSerializer inclui o namespace SVG; um atributo xmlns sem namespace o duplicaria.
        copy.setAttribute('width', Math.ceil(area.width)); copy.setAttribute('height', Math.ceil(area.height));
        copy.setAttribute('viewBox', `${area.x} ${area.y} ${area.width} ${area.height}`);
        copy.removeAttribute('class');
        copy.querySelector('[data-viewport]').removeAttribute('transform');
        const ns = 'http://www.w3.org/2000/svg';
        const style = document.createElementNS(ns, 'style'); style.textContent = EXPORT_STYLE;
        const background = document.createElementNS(ns, 'rect');
        for (const [key, value] of Object.entries({ ...area, fill: '#f4f8fa' })) background.setAttribute(key, value);
        copy.insertBefore(background, copy.firstChild); copy.insertBefore(style, copy.firstChild);
        download(new XMLSerializer().serializeToString(copy), 'image/svg+xml;charset=utf-8', 'diagrama.svg');
        setStatus('SVG exportado com o diagrama completo e as posições atuais.');
      } catch (failure) { setError(`Não foi possível exportar: ${failure.message}`); }
    }
    const selectedNode = selected && selected.type === 'node' ? nodeMap.get(selected.id) : null;
    const selectedEdge = selected && selected.type === 'edge' ? graph.edges.find(edge => edge.id === selected.id) : null;
    const related = new Set(selectedNode ? [selectedNode.id] : []);
    if (selectedNode) for (const edge of graph.edges) {
      if (edge.from === selectedNode.id || edge.to === selectedNode.id) { related.add(edge.from); related.add(edge.to); }
    }
    function edgeElement(edge) {
      const from = nodeMap.get(edge.from); const to = nodeMap.get(edge.to);
      if (!from || !to) return null;
      const fieldY = (node, name) => {
        const index = node.visibleFields.findIndex(field => field.name === name);
        return index < 0 ? node.y + 29 : node.y + 66 + index * ROW;
      };
      const x1 = from.x; const y1 = fieldY(from, edge.column);
      const x2 = to.x + to.width; const y2 = fieldY(to, edge.targetColumn);
      const self = from.id === to.id;
      const bend = self ? 90 : Math.max(55, Math.abs(x1 - x2) * .4);
      const path = self ? `M ${from.x + from.width} ${y1} C ${x2 + bend} ${y1 - 80}, ${x2 + bend} ${y2 + 80}, ${x2} ${y2}` : `M ${x1} ${y1} C ${x1 - bend} ${y1}, ${x2 + bend} ${y2}, ${x2} ${y2}`;
      const active = (selectedEdge && selectedEdge.id === edge.id) || (selectedNode && (edge.from === selectedNode.id || edge.to === selectedNode.id));
      const dim = selectedNode && !active;
      return h('g', { key: edge.id, opacity: dim ? .16 : 1 },
        h('title', null, `${from.name}.${edge.column} → ${to.name}.${edge.targetColumn || '?'} · ${edge.kind}`),
        h('path', { d: path, className: `edge ${edge.kind}${active ? ' active' : ''}`, markerEnd: 'url(#reference-arrow)' }),
        h('path', { d: path, className: 'edge-hit', onPointerDown: event => event.stopPropagation(), onClick: event => { event.stopPropagation(); setSelected({ type: 'edge', id: edge.id }); } }),
        active && h('text', { x: x1 - 8, y: y1 - 9, textAnchor: 'end', className: 'edge-label' }, edge.childCardinality),
        active && h('text', { x: x2 + 8, y: y2 - 9, className: 'edge-label' }, edge.parentCardinality));
    }
    function nodeElement(node) {
      const active = selectedNode && selectedNode.id === node.id;
      return h('g', {
        key: node.id, transform: `translate(${node.x} ${node.y})`, className: `node${active ? ' selected' : ''}`,
        opacity: selectedNode && !related.has(node.id) ? .25 : 1, tabIndex: 0, role: 'button',
        'aria-label': `Inspecionar ${node.name}, ${node.fields.length} colunas`,
        onPointerDown: event => startPointer(event, node),
        onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected({ type: 'node', id: node.id }); } },
      },
      h('title', null, `${node.name}${node.table ? ` · ${node.table}` : ''}`),
      h('rect', { width: WIDTH, height: node.height, rx: 9, className: 'node-frame' }),
      h('path', { d: `M9 0 H${WIDTH - 9} Q${WIDTH} 0 ${WIDTH} 9 V48 H0 V9 Q0 0 9 0`, className: 'node-title' }),
      h('text', { x: 13, y: 20, className: 'node-name' }, clip(node.name, 39)),
      h('text', { x: 13, y: 37, className: 'node-table' }, clip(node.table || 'Nome físico não declarado', 49)),
      node.visibleFields.map((field, index) => h('g', { key: field.name },
        h('title', null, `${field.name}: ${field.definition}${field.inferred ? ' [inferido pelo Blueprint]' : ''}`),
        h('line', { x1: 0, x2: WIDTH, y1: 53 + (index + 1) * ROW, y2: 53 + (index + 1) * ROW, className: 'row-line' }),
        h('text', { x: 12, y: 69 + index * ROW, className: `field-badge${field.inferred ? ' inferred' : ''}` }, [field.primary && 'PK', field.foreign && 'FK', field.unique && 'UQ', field.inferred && '~'].filter(Boolean).join(' ')),
        h('text', { x: 68, y: 69 + index * ROW, className: 'field-name' }, clip(field.name, 25)),
        h('text', { x: WIDTH - 12, y: 69 + index * ROW, textAnchor: 'end', className: 'field-type' }, clip(field.type, 13) + (field.nullable ? ' ?' : '')))),
      !node.visibleFields.length && h('text', { x: 13, y: 70, className: 'field-type' }, 'Sem colunas declaradas nesta visualização'),
      h('text', { x: 13, y: node.height - 11, className: 'field-type' }, `${node.fields.length} colunas · ${node.indexes.length} índices declarados`));
    }
    function inspector() {
      if (!selectedNode && !selectedEdge) return null;
      return h('aside', { className: 'inspector', 'aria-label': 'Detalhes da seleção' },
        h('div', { className: 'section-title' }, h('h3', null, selectedNode ? selectedNode.name : 'Relação selecionada'), h('button', { className: 'close', onClick: () => setSelected(null), 'aria-label': 'Fechar detalhes' }, '✕')),
        selectedNode ? h(React.Fragment, null,
          h('p', { className: 'muted' }, selectedNode.table || 'Tabela física não especificada no YAML.'),
          h('p', { className: 'muted' }, `Chave primária: ${selectedNode.primaryKey.join(' + ') || 'não declarada'}`),
          h('dl', null, selectedNode.fields.map(field => h(React.Fragment, { key: field.name },
            h('dt', null, field.name + (field.inferred ? ' · inferido' : '')),
            h('dd', null, field.definition)))),
          selectedNode.indexes.length > 0 && h('div', null, h('h3', null, 'Índices declarados'), h('ul', null, selectedNode.indexes.map((index, i) => h('li', { key: i }, `${index.kind}: ${index.columns.join(', ')}`))))) :
          h('div', null,
            h('p', { className: 'muted' }, `${nodeMap.get(selectedEdge.from).name}.${selectedEdge.column} → ${nodeMap.get(selectedEdge.to).name}.${selectedEdge.targetColumn || '?'}`),
            h('p', null, selectedEdge.kind === 'foreign' ? 'FK declarada no YAML.' : 'Relação visual declarada/inferida; não comprova constraint SQL.'),
            h('p', { className: 'muted' }, `Lado referenciado: ${selectedEdge.parentCardinality}. Ocorrências na origem: ${selectedEdge.childCardinality}.`),
            h('p', { className: 'muted' }, 'Cardinalidades derivadas apenas de campos/chaves simples. Regras temporais e de negócio podem restringi-las.')));
    }
    return h('div', { className: 'app' },
      h('header', { className: 'topbar' },
        h('div', { className: 'brand' }, h('div', { className: 'brand-mark', 'aria-hidden': true }, '◇'), h('div', null, h('h1', null, 'DirectChannel / Schema Studio'), h('p', null, 'YAML Blueprint → diagrama interativo para análise'))),
        h('span', { className: 'privacy' }, 'Processamento local · sem upload do YAML')),
      h('main', { className: 'main' },
        h('section', {
          className: `editor${dragOver ? ' dragging' : ''}`, 'aria-label': 'Editor YAML',
          onDragOver: event => { if (Array.from(event.dataTransfer.types).includes('Files')) { event.preventDefault(); setDragOver(true); } },
          onDragLeave: event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragOver(false); },
          onDrop: event => { if (event.dataTransfer.files.length) { event.preventDefault(); setDragOver(false); openFile(event.dataTransfer.files[0]); } },
        },
        h('div', null, h('div', { className: 'eyebrow' }, '01 / Entrada'), h('div', { className: 'section-title' }, h('h2', null, 'Seu modelo, em YAML'), h('span', { className: 'muted' }, 'Até 256 KiB'))),
        h('div', { className: 'toolbar' },
          h('button', { onClick: () => fileInput.current.click() }, 'Abrir YAML'),
          h('button', { onClick: loadProject, disabled: loading }, loading ? 'Carregando…' : 'Modelo do projeto'),
          h('button', { onClick: () => { ++readSequence.current; setText(EXAMPLE); renderSource(EXAMPLE, 'Exemplo de sintaxe carregado.'); } }, 'Exemplo')),
        h('input', { ref: fileInput, type: 'file', accept: '.yaml,.yml,text/yaml,application/yaml', hidden: true, onChange: event => { openFile(event.target.files[0]); event.target.value = ''; } }),
        h('label', { htmlFor: 'yaml-source' }, 'Cole o YAML ou arraste um arquivo aqui'),
        h('textarea', { id: 'yaml-source', value: text, spellCheck: false, autoCapitalize: 'off', autoCorrect: 'off', onChange: event => { ++readSequence.current; setText(event.target.value); }, 'aria-describedby': 'source-status' }),
        error && h('div', { className: 'error', role: 'alert' }, error),
        h('button', { className: 'primary render', onClick: () => renderSource() }, 'Renderizar diagrama', h('span', { className: 'shortcut' }, 'Ctrl / ⌘ + Enter')),
        h('div', { id: 'source-status', className: 'status', role: 'status' }, dirty ? 'Há alterações ainda não renderizadas. ' + status : status),
        h('div', { className: 'notice' }, 'Visualização não é validação de migrations. Constraints em comentários, índices parciais, FKs compostas e invariantes de negócio precisam de revisão específica.')),
        h('section', { className: 'workspace', 'aria-label': 'Diagrama renderizado' },
          h('div', { className: 'graphbar' },
            h('div', null, h('div', { className: 'eyebrow' }, '02 / Diagrama'), h('div', { className: 'stats' }, h('span', null, h('b', null, graph.nodes.length), 'modelos'), h('span', null, h('b', null, graph.edges.length), 'relações'), h('span', null, h('b', null, graph.warnings.length), 'avisos'))),
            h('div', { className: 'toolbar' },
              h('select', { value: selectedNode ? selectedNode.id : '', onChange: event => focusNode(event.target.value), 'aria-label': 'Localizar modelo' }, h('option', { value: '' }, 'Localizar modelo…'), graph.nodes.map(node => h('option', { key: node.id, value: node.id }, node.name))),
              h('select', { value: direction, onChange: event => setDirection(event.target.value), 'aria-label': 'Direção do layout' }, h('option', { value: 'LR' }, 'Horizontal'), h('option', { value: 'TB' }, 'Vertical')),
              h('label', null, h('input', { type: 'checkbox', checked: keysOnly, onChange: event => setKeysOnly(event.target.checked) }), 'Só chaves'),
              h('button', { onClick: () => { const next = arrange(graph, direction, keysOnly); setNodes(next); setSelected(null); requestAnimationFrame(() => fit(next)); } }, 'Reorganizar'),
              h('button', { onClick: exportSvg, disabled: !nodes.length }, 'Exportar SVG'),
              h('button', { onClick: () => download(text, 'text/yaml;charset=utf-8', 'modelo.yaml') }, 'Baixar YAML'))),
          h('div', { className: 'canvas', ref: canvas },
            h('svg', { ref: svg, className: 'diagram', 'aria-label': 'Grafo de entidades e relações. Use as tabelas para inspecionar e arrastar.', onPointerDown: event => startPointer(event), onPointerMove: movePointer, onPointerUp: () => { pointer.current = null; }, onPointerCancel: () => { pointer.current = null; } },
              h('defs', null, h('marker', { id: 'reference-arrow', viewBox: '0 0 10 10', refX: 10, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, h('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#7f9aa9' }))),
              h('g', { 'data-viewport': true, transform: `translate(${view.x} ${view.y}) scale(${view.scale})` }, graph.edges.map(edgeElement), nodes.map(nodeElement))),
            h('div', { className: 'zoom-controls' }, h('button', { onClick: () => zoom(.8), 'aria-label': 'Diminuir zoom' }, '−'), h('span', { className: 'zoom-value' }, `${Math.round(view.scale * 100)}%`), h('button', { onClick: () => zoom(1.25), 'aria-label': 'Aumentar zoom' }, '+'), h('button', { onClick: () => fit(), title: 'Enquadrar todo o diagrama' }, 'Enquadrar')),
            inspector(),
            h('div', { className: 'hint' }, 'Arraste o fundo para navegar · role para zoom · arraste tabelas · clique para inspecionar')),
          h('div', { className: 'analysis' },
            h('details', null, h('summary', null, `Avisos de interpretação (${graph.warnings.length})`), graph.warnings.length ? h('ul', null, graph.warnings.map((warning, index) => h('li', { key: index }, warning))) : h('p', { className: 'muted' }, 'Sem avisos do interpretador. Isso não comprova integridade física ou prontidão para migrations.')),
            h('details', null, h('summary', null, 'Comentários e pendências do YAML'), h('pre', null, graph.notes || 'Nenhum comentário encontrado.'))))),
      h('footer', { className: 'footer' }, h('span', null, 'PK = chave primária · FK = referência · UQ = unicidade simples · ? = aceita NULL · ~ = inferido · tracejado = relação sem FK explícita'), h('span', null, 'React + js-yaml + Dagre via CDN. Sem persistência automática.')));
  }
  ReactDOM.createRoot(document.getElementById('root')).render(h(App));
})();
