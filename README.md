# PenaltyX2 - Disputa de Pênaltis Online
- Um jogo simples de disputa de penaltis de navegador
## Comandos úteis para PowerShell

### Iniciar o servidor na porta padrão (3000):
```
node src/server.js
```

### Iniciar o servidor em uma porta específica (exemplo: 3009):
```
node src/server.js 3009
```

### Encerrar todos os processos Node.js (caso a porta esteja ocupada):
```
taskkill /F /IM node.exe /T
```

### Instalar dependências do projeto (se necessário):
```
npm install
```

### Acessar o jogo pelo navegador
- Local: http://localhost:3009
- Rede local: http://<seu-ip-local>:3009

<!-- //http://localhost:3009 ; http://172.16.1.195:3009 -->

## Observações
- Certifique-se de que o servidor está rodando na mesma porta configurada no cliente (index.html/game.js).
- Se ocorrer erro de porta ocupada (EADDRINUSE), use o comando de encerramento acima e tente iniciar novamente.

