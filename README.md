# YAML DB Diagram

Visualizador que transforma definições YAML no formato **Laravel Shift Blueprint** em diagramas de banco de dados interativos.

A aplicação roda no navegador, sem backend, instalação de pacotes ou conexão com banco de dados. Utiliza React 18, js-yaml e Dagre, carregados via CDN.

## Como usar

Abra `schema-viewer/index.html` no navegador. Carregue um arquivo YAML, arraste-o para o editor ou cole seu conteúdo e clique em **Renderizar diagrama** (`Ctrl+Enter` / `⌘+Enter`).

Também é possível servir a pasta do projeto localmente:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Acesse <http://127.0.0.1:8080/schema-viewer/>. Encerre o servidor ao terminar.

## Exemplo de YAML

```yaml
models:
  User:
    meta:
      table: users
    id: id
    name: string:255
    email: string:255 unique
    timestamps: false

  Post:
    meta:
      table: posts
    id: id
    user_id: id:User foreign:users.id
    title: string:255
    timestamps: false
```

## Funcionalidades

- Visualização de tabelas, colunas, chaves e relacionamentos.
- Zoom, navegação e reposicionamento de tabelas.
- Layout horizontal ou vertical e filtro para exibir somente chaves.
- Inspeção de modelos, relações e avisos de interpretação.
- Exportação do diagrama em SVG e download do YAML editado.
- Indicação de erros de sintaxe sem perder o último diagrama válido.

## Formato e limitações

O interpretador espera uma seção `models` no formato Blueprint; não converte qualquer estrutura YAML arbitrária em banco de dados. Relações e cardinalidades inferidas são estimativas, não validações do modelo físico. A ferramenta não gera migrations nem executa SQL.

Limites: 256 KiB de entrada, 80 modelos, 100 colunas por modelo e 500 relações.

O código e a documentação original em `schema-viewer/` ainda contêm referências ao projeto DirectChannel e a um arquivo de modelo externo. Esse arquivo não faz parte deste repositório; use a abertura de arquivos, a colagem de YAML ou o exemplo integrado em vez do botão **Modelo do projeto**.

## Privacidade

O YAML é processado no navegador e não é enviado pela aplicação a serviços externos. As dependências são carregadas de um CDN e exigem internet; avalie o uso de dados sensíveis com bibliotecas externas.

## Testes

Com Node.js 18 ou superior, execute na raiz:

```bash
node --test schema-viewer/blueprint.test.cjs
```

Os testes cobrem o interpretador, não a interface no navegador nem a execução de migrations.

## Estrutura

```text
schema-viewer/
  index.html          # Página e dependências via CDN
  styles.css          # Estilos da interface
  viewer.js           # Editor e renderização do diagrama
  blueprint.js        # Interpretação dos modelos Blueprint
  blueprint.test.cjs  # Testes do interpretador
  README.md           # Documentação original do visualizador
```
