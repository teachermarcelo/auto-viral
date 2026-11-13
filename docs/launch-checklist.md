# AutoViral — lançamento e integrações de vendas

## Produtos ativos no workspace

- KIT PSICOPEDAGÓGICO 360° — VOLUME 01 | ANAMNESE E DOCUMENTAÇÃO PROFISSIONAL
  - Kiwify: https://pay.kiwify.com.br/uutmLKq
  - Preço confirmado na Kiwify: R$ 27,90
- Caderno de Atividades de Coordenação Motora
  - Kiwify: https://pay.kiwify.com.br/GA5kkg5
  - Preço consultado na Kiwify: R$ 9,99 (o preço citado pelo operador foi R$ 9,90; alinhar o checkout antes de anunciar o valor).

## Rastreamento

Os links rastreáveis por campanha são exibidos em Campanhas. O endpoint `av-click` registra o clique e redireciona para o checkout. Não atribua uma venda a uma origem se o checkout/webhook não trouxer um identificador que permita essa associação.

## Vendas Kiwify

A Edge Function `av-kiwify-webhook` recebe eventos POST da Kiwify, valida um token secreto na URL, identifica o produto pelo ID Kiwify, grava o pedido em `av_sales` com chave idempotente e não armazena dados pessoais do comprador.

Configuração:
1. No Dashboard Kiwify, abra Apps → Webhooks → Criar Webhook.
2. Selecione os dois produtos e os eventos de compra aprovada, reembolso e chargeback.
3. Use a URL pública do endpoint `https://nuyzvpkvawixidotuuio.supabase.co/functions/v1/av-kiwify-webhook`. Depois de criar o webhook, copie o token de segurança gerado pela Kiwify e salve-o em AutoViral → Integrações → Rastreamento de vendas Kiwify. O token fica guardado no Supabase Vault; não o publique em repositórios, capturas de tela ou mensagens.
4. Use o botão de teste da Kiwify e confirme a resposta 2xx nos logs do webhook. O teste técnico não cria uma venda real; confirme vendas em Analytics somente após um pedido real aprovado.
5. Se um evento falhar, confira o log do webhook na Kiwify e reenvie-o.

A Kiwify envia payload JSON e espera resposta HTTP 2xx; eventos sem resposta 2xx podem ser reenviados. Não cadastre o endpoint com redirecionamento 3xx.

## Instagram Stories

A Edge Function `av-meta-publish-story` publica Stories por meio da API oficial da Meta. Pré-requisitos:
- Conta Instagram profissional elegível vinculada a uma Página Meta.
- Aplicativo Meta configurado, com `META_APP_ID` e `META_APP_SECRET` nos secrets do Supabase.
- Autorização concedida pelo usuário e permissão de publicação.
- URL HTTPS pública da imagem ou vídeo no registro do post.
- Post do calendário com canal `instagram_story`.

A tela Posts oferece o botão “Publicar Story agora” para registros compatíveis. O agendador Supabase já está ativo a cada minuto: posts `instagram_story` com status `scheduled` e horário vencido são enviados automaticamente. O worker marca cada registro como `publishing`, `published` ou `failed`.

## WhatsApp

A plataforma pode criar links e textos para compartilhamento e, com WhatsApp Business Platform, enviar mensagens individuais para pessoas que deram consentimento e dentro das regras de templates/janelas da Meta. A Meta já oferece uma Groups API, mas ela é um produto separado, com elegibilidade e fluxo de criação/convite de grupos; ela não autoriza o AutoViral a entrar e publicar em qualquer grupo existente do usuário. Para divulgar nas comunidades existentes, a plataforma abre o compartilhamento do WhatsApp com o link rastreável, e o usuário escolhe os grupos em que tem autorização para compartilhar.

## Critério de comprovação

- Captura: grupo aparece em Grupos e oportunidades.
- Clique: contador do link aumenta após um acesso real.
- Lead: formulário registra consentimento e lead.
- Venda: evento pago da Kiwify aparece em Analytics como venda confirmada.
- Publicação: o post recebe status publicado e ID retornado pela Meta.

Nunca tratar “sessão conectada”, “lembrete criado” ou “grupo capturado” como prova de publicação ou venda.
