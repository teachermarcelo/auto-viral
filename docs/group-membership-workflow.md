# Fluxo de participação em grupos — AutoViral AI

## Fluxo operacional

1. **Mapear:** a extensão lê links de grupos visíveis na página do Facebook e acompanha rolagem/carregamento.
2. **Separar:** os registros sincronizados aparecem na Central de Grupos e podem ser filtrados por estado.
3. **Solicitar entrada:** abra o grupo pelo botão da extensão ou pela Central de Grupos. A solicitação é enviada manualmente pelo usuário, na interface oficial do Facebook.
4. **Pendente:** depois de enviar a solicitação, registre "Solicitação enviada / pendente" no popup ou na Central de Grupos.
5. **Decisão do administrador:** quando o Facebook permitir acesso ao grupo, confirme "Aceito". Se a solicitação for negada, confirme "Recusado". A extensão não tenta ler mensagens privadas nem inferir a decisão automaticamente.
6. **Campanhas:** campanhas de grupos filtram somente comunidades com revisão interna aprovada e participação confirmada (membership_status=joined), além da plataforma/canal correto.
7. **Organização:** na Central de Grupos é possível selecionar vários registros, encaminhar para Públicos, editar nome/categoria/observações e excluir registros.

## Estados de participação

- `mapped`: grupo mapeado.
- `not_requested`: ainda não foi solicitada entrada.
- `request_pending`: solicitação enviada e aguardando administrador.
- `joined`: entrada confirmada pelo operador.
- `rejected`: recusa confirmada pelo operador.

## Segurança e limites

- A extensão não clica automaticamente em "Participar", "Solicitar entrada" ou "Publicar".
- Não há mecanismo de clique oculto via CDP/debugger.
- Não há leitura de membros, conversas, posts privados ou decisão do administrador por scraping.
- A seleção de "Aceito" ou "Recusado" é uma confirmação humana e atualiza o Supabase no workspace conectado.
- O intervalo de 5 minutos da fila assistida é apenas uma cadência de abertura/revisão, não uma garantia contra restrições da plataforma.
