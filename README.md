# [Projeto descontinuado] Mailbox Game

Decidimos descontinuar este protótipo de caixa de entrada em Java e navegador. A proposta é que os jogadores recebam as mensagens do jogo e respondam pelo próprio e-mail, usando o serviço de e-mail que já utilizam. Assim, o jogo dispensa uma interface de caixa de entrada própria.

## Executar

No Windows, execute:

```bat
run.bat
```

Ou compile e inicie manualmente:

```bat
javac -d build\classes src\main\java\com\mailboxgame\MailboxServer.java
java -cp build\classes com.mailboxgame.MailboxServer
```

Acesse `http://localhost:8080`.

Estado inicial: caixa vazia, botão de resposta desabilitado, nova mensagem disponível com autocomplete de destinatários.
