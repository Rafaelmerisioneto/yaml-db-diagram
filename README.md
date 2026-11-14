# YAML DB Diagram

**Do YAML ao diagrama de banco de dados, direto no navegador.**

YAML DB Diagram é um projeto open source para visualizar e explorar modelos de dados escritos no formato **Laravel Shift Blueprint**. Veja tabelas, colunas e relacionamentos em um diagrama interativo, sem configurar um backend ou conectar um banco de dados.

A aplicação é estática: usa JavaScript, React 18, js-yaml e Dagre, com bibliotecas carregadas via CDN. Não exige instalação de pacotes nem etapa de build.

[Começar](#como-usar) · [Contribuir](CONTRIBUTING.md) · [Licença MIT](LICENSE.md)

## Funcionalidades

- Visualização de tabelas, colunas, chaves e relacionamentos.
- Zoom, navegação e reposicionamento de tabelas.
- Layout horizontal ou vertical e filtro para exibir somente chaves.
- Busca de modelos e inspeção de relações e avisos de interpretação.
- Importação por arquivo, arrastar e soltar ou colagem de YAML.
- Exportação do diagrama em SVG e download do YAML editado.
- Indicação de erros de sintaxe sem perder o último diagrama válido.

## Como usar

### Abrir diretamente

Com os arquivos do projeto em sua máquina, abra `schema-viewer/index.html` em um navegador moderno com acesso à internet. Carregue um arquivo YAML ou cole seu conteúdo e clique em **Renderizar diagrama** (`Ctrl+Enter` / `⌘+Enter`).

Use o exemplo integrado para explorar a interface antes de carregar seu próprio modelo.

### Usar um servidor local

Se preferir, clone o repositório e sirva seus arquivos com Python 3:

```bash
git clone https://github.com/Rafaelmerisioneto/yaml-db-diagram.git
cd yaml-db-diagram
python3 -m http.server 8080 --bind 127.0.0.1
```

Acesse <http://127.0.0.1:8080/schema-viewer/>. Encerre o servidor com `Ctrl+C` ao terminar. Ele disponibiliza os arquivos da pasta localmente; utilize-o apenas em ambiente confiável.

> Enquanto o repositório estiver privado, o clone exige uma conta com acesso.

### Explorar o diagrama

- Use a roda do mouse para aplicar zoom no ponto do cursor e arraste o fundo para navegar.
- Arraste uma tabela para ajustar sua posição e clique nela para ver as definições completas.
- Use **Localizar modelo** para centralizar uma tabela e abrir seus detalhes.
- Clique em uma ligação para inspecionar origem, destino e cardinalidade estimada.
- Ative **Só chaves** para filtrar as colunas mostradas sem alterar o YAML.
- Use **Horizontal/Vertical**, **Reorganizar** e **Enquadrar** para ajustar o layout.
- **Exportar SVG** salva o diagrama completo com as posições atuais, independentemente do zoom.
- **Baixar YAML** salva o texto do editor, inclusive alterações ainda não renderizadas.
- Consulte os comentários em **Comentários e pendências do YAML**.

Alterações no editor só entram no diagrama após clicar em **Renderizar diagrama**. Erros de sintaxe indicam linha e coluna e preservam o último diagrama válido.

## Exemplo de YAML

O documento deve conter uma seção `models`. Salve o exemplo abaixo em um arquivo `.yaml` ou cole-o no editor:

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

Nesse exemplo, `Post.user_id` referencia `User.id`, conectando as tabelas `posts` e `users` no diagrama.

## Formato e limitações

O projeto interpreta modelos Blueprint, **não qualquer estrutura YAML arbitrária**. Aceita a seção `models`, definições de colunas, nomes de tabela via `meta.table`, índices e chaves primárias compostas, referências `foreign:tabela.coluna` e `id:Modelo`, além de relações simples e N:N declaradas.

- Cardinalidades são estimativas baseadas em chaves simples e nulabilidade, não validações do modelo físico nem regras temporais ou de negócio.
- Colunas automáticas de ID/timestamps e colunas de `belongsTo` inferidas são identificadas com `~`; não representam aprovação do modelo físico.
- Linhas contínuas representam FKs explícitas; tracejadas representam relações declaradas ou inferidas sem FK explícita. As setas apontam da origem para o modelo referenciado.
- Relações polimórficas geram avisos, sem inventar FKs SQL.
- Não gera Models ou migrations, não executa SQL e não acessa bancos de dados, backend ou Docker.
- Não interpreta CHECKs, FKs compostas em comentários, índices parciais/de expressão, triggers ou coordenação transacional. Comentários **não** se tornam constraints.
- Não valida compatibilidade com uma versão do gerador Blueprint nem corrige o schema.
- O YAML deve ser válido; atalhos textuais do gerador que não sejam YAML válido precisam ser expandidos.
- A entrada está limitada a **256 KiB**, **80 modelos**, **100 colunas por modelo** e **500 relações**.

### Referências herdadas

O visualizador ainda contém referências ao projeto de origem, DirectChannel, e a um arquivo de modelo externo que **não acompanha este repositório**. O botão **Modelo do projeto** depende desse arquivo e não funciona nesta distribuição. Use a abertura de arquivos, a colagem de YAML ou o exemplo integrado.

Na integração original, o modelo ficava em `specs/001-especificacao-funcional-mobile/blueprint-diagram.yaml`. O botão apenas lê o YAML por HTTP na mesma origem, exigindo que o arquivo esteja disponível no caminho esperado e que a raiz seja servida por um servidor estático. A abertura de arquivos e a colagem não exigem servidor. As aprovações e pendências daquele modelo pertencem às especificações do projeto de origem, não a este visualizador.

## Privacidade e dependências

O YAML é processado no navegador: a aplicação não o envia a serviços externos, não usa analytics e não salva automaticamente seu conteúdo no armazenamento do navegador.

React, js-yaml e Dagre são obtidos de um CDN, com versões fixas e hashes de integridade. Por isso, a aplicação exige internet e **não é totalmente offline**. Essas bibliotecas executam no mesmo navegador; avalie os riscos antes de abrir modelos com informações sensíveis.

Não são carregadas fontes remotas. O interpretador não aceita tags YAML executáveis, e o conteúdo inserido é renderizado como texto pelo React, sem `eval` ou inserção de HTML fornecido pelo usuário.

## Testes

Para os testes automatizados, é necessário **Node.js 18 ou superior**. Na raiz do projeto, execute:

```bash
node --test schema-viewer/blueprint.test.cjs
```

Não é necessário instalar dependências. Os testes cobrem a conversão de objetos já lidos do YAML pelo interpretador de modelos. Não substituem testes visuais no navegador nem a validação de migrations ou constraints PostgreSQL.

## Estrutura

```text
README.md             # Apresentação e instruções de uso
CONTRIBUTING.md       # Guia para contribuir
LICENSE.md            # Licença MIT
schema-viewer/
  index.html          # Página e dependências via CDN
  styles.css          # Estilos da interface
  viewer.js           # Editor e renderização do diagrama
  blueprint.js        # Interpretação dos modelos Blueprint
  blueprint.test.cjs  # Testes do interpretador
```

## Como contribuir

Contribuições de código, testes, documentação, acessibilidade e relatos de bugs são bem-vindas. Consulte o [guia de contribuição](CONTRIBUTING.md) para preparar o ambiente e enviar uma proposta.

## Licença

Distribuído sob a [licença MIT](LICENSE.md). Você pode usar, modificar e redistribuir o código, inclusive comercialmente, preservando os avisos exigidos pela licença. As dependências de terceiros mantêm suas próprias licenças.
