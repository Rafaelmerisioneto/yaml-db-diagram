# Visualizador de modelos YAML

Página estática e independente para analisar YAML no formato **Laravel Shift Blueprint**.
Usa React 18, js-yaml e Dagre, com versões fixas e hashes de integridade via CDN. Não instala pacotes,
não gera Models/migrations e não acessa o banco, backend ou Docker.

## Abrir

Abra `index.html` no navegador. Use **Abrir YAML**, arraste um arquivo para o editor ou
cole o conteúdo e clique em **Renderizar diagrama** (`Ctrl+Enter` / `⌘+Enter`).
Selecione o arquivo atual:

`specs/001-especificacao-funcional-mobile/blueprint-diagram.yaml`

Para usar o botão **Modelo do projeto**, sirva a **raiz do repositório** com um servidor
estático, sem iniciar a aplicação. Uma opção, executada manualmente na raiz, é:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Depois abra `http://127.0.0.1:8080/docs/schema-viewer/`. Esse servidor disponibiliza os
arquivos da raiz localmente; use apenas em ambiente confiável e encerre-o ao terminar.
O botão de modelo apenas lê o YAML por HTTP na mesma origem. A abertura de arquivo e a
colagem funcionam também sem servidor estático.

## Análise

- Roda do mouse: zoom no ponto do cursor. Arraste o fundo para navegar.
- Arraste uma tabela para ajustar sua posição. Clique nela para ver as definições completas.
- **Localizar modelo**: centraliza uma tabela e abre detalhes sem precisar procurá-la no grafo.
- Clique em uma ligação para inspecionar origem, destino e cardinalidade estimada.
- **Só chaves**: filtra as colunas mostradas, sem alterar o YAML.
- **Horizontal/Vertical**, **Reorganizar** e **Enquadrar**: controles de layout.
- **Exportar SVG**: diagrama completo com as posições atuais, independentemente do zoom.
- **Baixar YAML**: salva o texto do editor, inclusive alterações ainda não renderizadas.
- Os comentários do arquivo permanecem disponíveis em **Comentários e pendências do YAML**.
- Erros de sintaxe indicam linha/coluna; o último diagrama válido é preservado. Alterações
  no editor só entram no diagrama após renderizar.

## Limites e interpretação

Aceita a seção `models`, colunas Blueprint, `meta.table`, índices/PKs compostas, referências
`foreign:tabela.coluna` e `id:Modelo`, relações simples e N:N declaradas. Colunas automáticas
de ID/timestamps e colunas de `belongsTo` inferidas são identificadas com `~`; não são
aprovações do modelo físico. Relações polimórficas são avisadas, sem inventar FKs SQL.

Linhas contínuas representam FKs explícitas. Tracejadas representam relações declaradas ou
inferidas sem FK explícita. As setas apontam da origem para o modelo referenciado.
Cardinalidades são estimativas de chaves simples/NULL, não regras temporais ou de negócio.

Não interpreta SQL, CHECKs, FKs compostas em comentários, índices parciais/de expressão,
triggers ou coordenação transacional. Comentários **não** se tornam constraints.
Não valida compatibilidade de uma versão do gerador Blueprint nem corrige o schema.
O modelo DirectChannel continua sujeito às aprovações e pendências das specs.

Limites: 256 KiB de entrada, 80 modelos, 100 colunas por modelo e 500 relações. YAML deve
ser válido; atalhos textuais do gerador que não sejam YAML válido precisam ser expandidos.
Não aceita tags YAML executáveis. Conteúdo inserido é renderizado como texto pelo React,
sem `eval` ou inserção de HTML fornecido pelo usuário.

## Privacidade e dependências

O aplicativo não envia o YAML para serviços externos, não usa analytics e não salva
automaticamente no armazenamento do navegador. As bibliotecas são obtidas do CDN ao abrir
a página; portanto, precisa de internet e não é uma ferramenta totalmente offline. As
bibliotecas carregadas executam no mesmo navegador; não use dados secretos em ferramentas
com dependências externas sem a avaliação de segurança pertinente. Não há fontes remotas.

## Testes do interpretador

Sem instalar dependências, execute com Node.js 18 ou superior:

```bash
node --test docs/schema-viewer/blueprint.test.cjs
```

Os testes cobrem conversão de objetos já lidos do YAML. Não substituem testes visuais em
navegador nem validação de migrations/constraints PostgreSQL.
