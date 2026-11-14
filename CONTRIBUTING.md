# Guia de contribuição

Obrigado pelo interesse em contribuir com o YAML DB Diagram! Aceitamos melhorias de código, testes, documentação, usabilidade e acessibilidade.

## Antes de começar

- Leia o [README](README.md) para entender o formato suportado e as limitações.
- Procure issues e pull requests existentes para evitar trabalho duplicado.
- Para mudanças grandes, proponha a ideia em uma issue antes de implementá-la.
- Mantenha a discussão respeitosa e focada no problema e nas soluções.

O repositório é [Rafaelmerisioneto/yaml-db-diagram](https://github.com/Rafaelmerisioneto/yaml-db-diagram). Enquanto estiver privado, somente pessoas com acesso poderão interagir; forks e contribuições públicas dependem da publicação do repositório.

## Relatar bugs e propor melhorias

Abra uma issue descrevendo:

1. O problema ou a necessidade.
2. Passos para reproduzir, com um YAML mínimo quando aplicável.
3. Resultado esperado e resultado observado.
4. Navegador, versão e sistema operacional.
5. Capturas de tela ou mensagens do console, se ajudarem.

Use dados fictícios. Não publique credenciais, informações pessoais ou schemas confidenciais. Não exponha detalhes exploráveis de uma vulnerabilidade em uma issue pública; use o canal privado de reporte de segurança do GitHub caso esteja habilitado. Na ausência dele, combine um canal privado com o mantenedor antes de compartilhar detalhes.

## Preparar o ambiente

Requisitos:

- Git para trabalhar com o repositório.
- Navegador moderno e internet para carregar as bibliotecas via CDN.
- Node.js 18 ou superior para executar os testes.
- Python 3, opcional, para servir os arquivos localmente.

Não há instalação de pacotes nem etapa de build.

Faça um fork no GitHub, clone seu fork e crie uma branch:

```bash
git clone https://github.com/SEU-USUARIO/yaml-db-diagram.git
cd yaml-db-diagram
git switch -c feat/minha-melhoria
```

Se tiver acesso direto ao repositório, também pode cloná-lo e trabalhar em uma branch própria.

Abra `schema-viewer/index.html` ou execute na raiz:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Acesse <http://127.0.0.1:8080/schema-viewer/> e encerre o servidor com `Ctrl+C` ao terminar.

## Organização e padrões

- `schema-viewer/blueprint.js`: interpretação dos modelos e geração da estrutura do diagrama.
- `schema-viewer/viewer.js`: editor, estado da interface, layout e exportação.
- `schema-viewer/styles.css`: apresentação e responsividade.
- `schema-viewer/index.html`: página e carregamento das dependências.
- `schema-viewer/blueprint.test.cjs`: testes automatizados do interpretador.

Siga o estilo do arquivo alterado: JavaScript sem etapa de compilação, indentação de dois espaços e mensagens de interface em português. Evite refatorações sem relação com a proposta.

Preserve o processamento local do YAML, os limites de entrada e a renderização segura de conteúdo. Não introduza `eval`, HTML de usuário sem tratamento, telemetria ou envio de YAML a terceiros. Discuta novas dependências previamente; alterações nas URLs de CDN devem manter versões fixas e hashes de integridade corretos.

## Validar uma alteração

Execute na raiz:

```bash
node --test schema-viewer/blueprint.test.cjs
git diff --check
```

Para mudanças no interpretador, acrescente testes de casos válidos, erros e regressões relevantes. Os testes trabalham com objetos já lidos do YAML; eles não verificam o carregamento pelo js-yaml nem a interface.

Para mudanças visuais ou de interação, verifique manualmente:

- Renderização do exemplo integrado e de um YAML próprio.
- Importação de arquivo e colagem no editor.
- Erros de sintaxe e preservação do último diagrama válido.
- Zoom, navegação, movimentação de tabelas e alternância de layout.
- Busca de modelos, filtro de chaves e inspeção de relações.
- Exportação SVG e download do YAML.
- Navegação por teclado e exibição em diferentes tamanhos de tela.

O botão **Modelo do projeto** depende de um arquivo externo ausente nesta distribuição; essa limitação conhecida não deve impedir os demais testes.

## Enviar um pull request

1. Faça alterações pequenas e focadas em um objetivo.
2. Atualize a documentação quando houver mudança de comportamento.
3. Execute as verificações e revise o diff para evitar arquivos locais ou dados sensíveis.
4. Crie commits com mensagens claras e envie sua branch ao fork.
5. Abra um pull request para `main` no repositório original.

Na descrição, informe o problema resolvido, o que mudou, como testou e eventuais limitações. Vincule a issue correspondente e inclua capturas de tela para mudanças visuais. Informe quando uma verificação não puder ser executada.

## Licenciamento das contribuições

Ao enviar uma contribuição, você concorda que ela seja distribuída sob a [licença MIT](LICENSE.md) do projeto. Envie apenas conteúdo que você tenha direito de compartilhar e preserve avisos de autoria e licenças de terceiros quando aplicáveis.
