const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

// Configurações para o ambiente de produção
const PORT = process.env.PORT || 3000;
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || null;

const app = express();
const server = http.createServer(app);

// Configuração do Socket.IO com opções específicas para ambientes de produção como Render
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  },
  transports: ['websocket', 'polling'], // Garantir que ambos os modos de transporte estejam disponíveis
  pingTimeout: 60000, // Aumentar o timeout para 60 segundos
  pingInterval: 25000, // Intervalo de ping para manter a conexão ativa
  allowUpgrades: true,
  upgrade: true,
  cookie: false
});

// Servindo arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, '../public')));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Rota de status para monitoramento
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    rooms: Object.keys(rooms).length,
    stats: serverStats
  });
});

// Armazenar salas de jogo
const rooms = {};

// Armazenar estatísticas do servidor
const serverStats = {
  startTime: new Date(),
  totalGames: 0,
  activePlayers: 0,
  completedMatches: 0,
  lastConnections: []
};

// Gerenciador de conexões Socket.IO
io.on('connection', (socket) => {
  console.log(`Novo usuário conectado: ${socket.id}`);
  serverStats.activePlayers++;
  serverStats.lastConnections.push({
    id: socket.id,
    time: new Date()
  });

  // Mantemos apenas as últimas 10 conexões para debug
  if (serverStats.lastConnections.length > 10) {
    serverStats.lastConnections.shift();
  }

  // Criação ou entrada em sala
  socket.on('joinRoom', (roomId) => {
    console.log(`Usuário ${socket.id} tentando entrar na sala: ${roomId}`);

    // Se a sala não existir, cria uma nova
    if (!rooms[roomId]) {
      rooms[roomId] = {
        id: roomId,
        players: [],
        scores: {
          player1: 0,
          player2: 0
        },
        kicks: {
          player1: 0,
          player2: 0
        },
        round: 1,
        maxRounds: 5,
        suddenDeathMode: false,
        player1Position: null,
        player2Position: null,
        player1Ready: false,
        player2Ready: false,
        player1Team: null,  // Nova propriedade para armazenar o time do jogador 1
        player2Team: null,  // Nova propriedade para armazenar o time do jogador 2
        player1TeamConfirmed: false,  // Nova propriedade para confirmar o time do jogador 1
        player2TeamConfirmed: false,  // Nova propriedade para confirmar o time do jogador 2
        currentAttacker: 'player1', // Começa com player1 como atacante
        turnInRound: 1, // Para rastrear o turno dentro da rodada (1 = primeiro jogador, 2 = segundo jogador)
        createdAt: new Date()
      };
      serverStats.totalGames++;
      console.log(`Nova sala criada: ${roomId}`);
    }

    // Se a sala já tiver 2 jogadores, impede a entrada
    const room = rooms[roomId];
    if (room.players.length >= 2) {
      socket.emit('roomFull');
      console.log(`Sala ${roomId} está cheia. Entrada negada para ${socket.id}`);
      return;
    }

    // Adiciona o jogador à sala
    const playerId = room.players.length === 0 ? 'player1' : 'player2';
    room.players.push({
      id: socket.id,
      playerId,
      joinedAt: new Date()
    });
    console.log(`Jogador ${socket.id} entrou como ${playerId} na sala ${roomId}`);

    // Junta o socket à sala
    socket.join(roomId);
    socket.roomId = roomId;
    socket.playerId = playerId;

    // Notifica o jogador sobre sua entrada
    socket.emit('playerAssigned', {
      playerId,
      roomId
    });

    // Envia atualização sobre jogadores na sala
    io.to(roomId).emit('roomUpdate', {
      playersCount: room.players.length
    });
    console.log(`Atualização da sala ${roomId}: ${room.players.length} jogadores`);

    // Se o outro jogador já escolheu e confirmou seu time, informar esse jogador
    if (playerId === 'player2' && room.player1TeamConfirmed) {
      socket.emit('opponentTeamInfo', {
        player: 'player1',
        team: room.player1Team,
        confirmed: true
      });
      console.log(`Informando jogador 2 sobre o time do jogador 1: ${room.player1Team}`);
    } else if (playerId === 'player1' && room.player2TeamConfirmed) {
      socket.emit('opponentTeamInfo', {
        player: 'player2',
        team: room.player2Team,
        confirmed: true
      });
      console.log(`Informando jogador 1 sobre o time do jogador 2: ${room.player2Team}`);
    }
  });

  // Novo evento para quando um jogador seleciona um time
  socket.on('teamSelected', (data) => {
    const { team } = data;
    const room = rooms[socket.roomId];

    if (!room) return;

    if (socket.playerId === 'player1') {
      room.player1Team = team;
      socket.emit('teamConfirmation', {
        team,
        playerNumber: 1
      });

      // Notifica o outro jogador se ele estiver na sala
      if (room.players.length > 1) {
        socket.to(socket.roomId).emit('opponentSelectedTeam', {
          player: 'player1',
          team: team
        });
      }
    } else if (socket.playerId === 'player2') {
      room.player2Team = team;
      socket.emit('teamConfirmation', {
        team,
        playerNumber: 2
      });

      // Notifica o outro jogador
      socket.to(socket.roomId).emit('opponentSelectedTeam', {
        player: 'player2',
        team: team
      });
    }
  });

  // Novo evento para quando um jogador confirma seu time
  socket.on('confirmTeam', () => {
    const room = rooms[socket.roomId];

    if (!room) return;

    if (socket.playerId === 'player1') {
      room.player1TeamConfirmed = true;
      io.to(socket.roomId).emit('playerConfirmedTeam', {
        player: 'player1',
        team: room.player1Team
      });
    } else if (socket.playerId === 'player2') {
      room.player2TeamConfirmed = true;
      io.to(socket.roomId).emit('playerConfirmedTeam', {
        player: 'player2',
        team: room.player2Team
      });
    }

    // Se ambos os jogadores confirmaram seus times E estão presentes na sala, inicia o jogo
    if (room.player1TeamConfirmed && room.player2TeamConfirmed && room.players.length === 2) {
      // Pequeno atraso para dar tempo aos jogadores de verem a mensagem de confirmação
      setTimeout(() => {
        io.to(socket.roomId).emit('gameStart', {
          round: 1,
          turn: 1,
          attacker: 'player1',
          player1Team: room.player1Team,
          player2Team: room.player2Team
        });
      }, 1500);
    }
  });

  // Evento para quando o jogador está pronto com sua escolha
  socket.on('playerReady', (data) => {
    const { position } = data;
    const room = rooms[socket.roomId];

    if (!room) return;

    // Armazena a escolha do jogador e marca como pronto
    if (socket.playerId === 'player1') {
      room.player1Position = position;
      room.player1Ready = true;

      // Notifica o outro jogador que este está pronto, usando nome do time
      socket.to(socket.roomId).emit('opponentReady', {
        player: 'player1',
        message: `${getTeamName(room.player1Team)} confirmou sua escolha!`
      });
    } else {
      room.player2Position = position;
      room.player2Ready = true;

      // Notifica o outro jogador que este está pronto, usando nome do time
      socket.to(socket.roomId).emit('opponentReady', {
        player: 'player2',
        message: `${getTeamName(room.player2Team)} confirmou sua escolha!`
      });
    }

    // Se ambos os jogadores estão prontos, processa o resultado
    if (room.player1Ready && room.player2Ready) {
      processRound(room);
    }
  });

  // Função auxiliar para obter o nome do time
  function getTeamName(teamCode) {
    const teamNames = {
      'team1': 'Brasil',
      'team2': 'Argentina',
      'team3': 'França',
      'team4': 'Itália'
    };
    return teamNames[teamCode] || teamCode;
  }

  // Função para verificar se um time já venceu por diferença de gols
  function checkForWinByGoalDifference(room) {
    // Se estamos no modo morte súbita, não aplicamos a regra de vantagem matemática
    if (room.suddenDeathMode) {
      return null;
    }

    // Rodadas completas restantes (não inclui a rodada atual)
    const completedRounds = room.round - 1; // Rodadas já completadas
    const remainingFullRounds = room.maxRounds - room.round; // Rodadas que ainda faltam completar

    // Cálculo do total de cobranças de pênalti restantes para cada jogador
    let player1RemainingKicks = 0;
    let player2RemainingKicks = 0;

    // Adiciona pênaltis das rodadas completas que ainda vão ocorrer
    player1RemainingKicks += remainingFullRounds;
    player2RemainingKicks += remainingFullRounds;

    // Ajusta com base no turno atual dentro da rodada atual
    if (room.turnInRound === 1) {
      // Se estamos no primeiro turno, nenhum jogador chutou nesta rodada
      player1RemainingKicks += 1; // Jogador 1 ainda chutará nesta rodada
      player2RemainingKicks += 1; // Jogador 2 ainda chutará nesta rodada
    } else if (room.turnInRound === 2) {
      // Se estamos no segundo turno, apenas o jogador 2 ainda tem pênalti nesta rodada
      // Jogador 1 já chutou, então não incrementamos seu contador
      player2RemainingKicks += 1; // Apenas o jogador 2 ainda chutará nesta rodada
    }

    // Debug detalhado
    console.log(`Verificando diferença de gols - Placar: ${room.scores.player1} x ${room.scores.player2}`);
    console.log(`Rodada ${room.round}/${room.maxRounds}, Turno ${room.turnInRound}`);
    console.log(`Pênaltis restantes: P1: ${player1RemainingKicks}, P2: ${player2RemainingKicks}`);

    // Verificação se o jogo já pode acabar antecipadamente
    if (player1RemainingKicks === 0 && room.scores.player1 > room.scores.player2) {
      console.log(`** VITÓRIA do Jogador 1: Player 1 não tem mais chutes e está à frente`);
      return 'player1';
    }

    if (player2RemainingKicks === 0 && room.scores.player2 > room.scores.player1) {
      console.log(`** VITÓRIA do Jogador 2: Player 2 não tem mais chutes e está à frente`);
      return 'player2';
    }

    // Verificações de vitória matemática

    // Jogador 1 vence se tiver mais pontos que o máximo que o Jogador 2 pode conseguir
    if (room.scores.player1 > room.scores.player2 + player2RemainingKicks) {
      console.log(`** VITÓRIA MATEMÁTICA do Jogador 1: ${room.scores.player1} > ${room.scores.player2} + ${player2RemainingKicks}`);
      return 'player1';
    }

    // Jogador 2 vence se tiver mais pontos que o máximo que o Jogador 1 pode conseguir
    if (room.scores.player2 > room.scores.player1 + player1RemainingKicks) {
      console.log(`** VITÓRIA MATEMÁTICA do Jogador 2: ${room.scores.player2} > ${room.scores.player1} + ${player1RemainingKicks}`);
      return 'player2';
    }

    // Ninguém venceu ainda por diferença de gols
    return null;
  }

  // Função para processar o resultado da rodada
  function processRound(room) {
    // Determina quem é o atacante e o goleiro neste turno
    const attacker = room.currentAttacker;
    const defender = attacker === 'player1' ? 'player2' : 'player1';
    const attackerPosition = attacker === 'player1' ? room.player1Position : room.player2Position;
    const defenderPosition = defender === 'player1' ? room.player1Position : room.player2Position;

    // Verifica se o gol foi defendido (posições iguais = defesa)
    const isGoal = attackerPosition !== defenderPosition;

    // Se for gol, aumenta o placar do atacante
    if (isGoal) {
      room.scores[attacker]++;
    }

    // Incrementa o número de pênaltis cobrados pelo atacante atual
    room.kicks[attacker]++;

    console.log(`Turno ${room.turnInRound} da Rodada ${room.round} processado - Placar: ${room.scores.player1} x ${room.scores.player2}`);

    // Verifica imediatamente se alguém já venceu por diferença de gols após este chute
    const winnerByDifference = checkForWinByGoalDifference(room);
    if (winnerByDifference) {
      // Um time já venceu por diferença de gols
      console.log(`Jogo finalizado antecipadamente após o chute de ${attacker} - Time ${winnerByDifference} venceu por diferença de gols`);

      // Envia primeiro o resultado da cobrança atual
      io.to(room.id).emit('roundResult', {
        attacker,
        kick: attackerPosition,
        defense: defenderPosition,
        isGoal,
        scores: room.scores,
        suddenDeath: room.suddenDeathMode
      });

      // Depois envia o game over
      setTimeout(() => {
        io.to(room.id).emit('gameOver', {
          winner: winnerByDifference,
          scores: room.scores,
          message: `${winnerByDifference === 'player1' ? 'Jogador 1' : 'Jogador 2'} venceu!`
        });

        setTimeout(() => {
          delete rooms[room.id];
        }, 5000);
      }, 2000);

      return;
    }

    // Envia o resultado para ambos os jogadores, informando quem foi atacante
    io.to(room.id).emit('roundResult', {
      attacker,
      kick: attackerPosition,
      defense: defenderPosition,
      isGoal,
      scores: room.scores,
      suddenDeath: room.suddenDeathMode
    });

    // Verifica se é o fim da rodada (ambos jogadores já chutaram)
    if (room.turnInRound === 2) {
      // Fim da rodada completa - verificação de vitória por diferença de gols já foi feita acima

      // Verifica se é o fim das cobranças normais ou da morte súbita
      if (room.round >= room.maxRounds || room.suddenDeathMode) {
        // Situação de fim de jogo potencial

        // Se estamos no modo normal (não morte súbita)
        if (!room.suddenDeathMode) {
          // Verifica se houve empate após as 5 cobranças
          if (room.scores.player1 === room.scores.player2) {
            // Empate! Ativa o modo morte súbita
            room.suddenDeathMode = true;
            room.round = 1; // Reset da contagem de rodadas para morte súbita
            room.turnInRound = 1;
            room.currentAttacker = 'player1';
            room.player1Position = null;
            room.player2Position = null;
            room.player1Ready = false;
            room.player2Ready = false;

            setTimeout(() => {
              io.to(room.id).emit('suddenDeathStart', {
                round: room.round,
                turn: room.turnInRound,
                scores: room.scores,
                attacker: room.currentAttacker,
                message: "Empate após as 5 cobranças! Iniciando morte súbita!"
              });

              io.to(room.id).emit('nextRound', {
                round: room.round,
                turn: room.turnInRound,
                scores: room.scores,
                attacker: room.currentAttacker,
                suddenDeath: true
              });
            }, 3000);
            return;
          }

          // Não houve empate, determinamos o vencedor normalmente
          let winner = null;
          if (room.scores.player1 > room.scores.player2) {
            winner = 'player1';
          } else if (room.scores.player2 > room.scores.player1) {
            winner = 'player2';
          }

          console.log(`Jogo finalizado - Resultado final: ${room.scores.player1} x ${room.scores.player2}, vencedor: ${winner || 'empate'}`);

          io.to(room.id).emit('gameOver', {
            winner,
            scores: room.scores
          });

          setTimeout(() => {
            delete rooms[room.id];
          }, 5000);
        }
        // Modo morte súbita
        else {
          // No modo morte súbita, se após ambos terem chutado houver diferença no placar, temos um vencedor
          if (room.scores.player1 !== room.scores.player2) {
            const winner = room.scores.player1 > room.scores.player2 ? 'player1' : 'player2';

            io.to(room.id).emit('gameOver', {
              winner,
              scores: room.scores,
              suddenDeath: true,
              message: `${winner === 'player1' ? 'Jogador 1' : 'Jogador 2'} venceu na morte súbita!`
            });

            setTimeout(() => {
              delete rooms[room.id];
            }, 5000);
          } else {
            // Continua a morte súbita para próxima rodada
            room.round++;
            room.turnInRound = 1;
            room.currentAttacker = 'player1';
            room.player1Position = null;
            room.player2Position = null;
            room.player1Ready = false;
            room.player2Ready = false;

            setTimeout(() => {
              io.to(room.id).emit('nextRound', {
                round: room.round,
                turn: room.turnInRound,
                scores: room.scores,
                attacker: room.currentAttacker,
                suddenDeath: true
              });
            }, 3000);
          }
        }
      }
      // Ainda não chegamos ao final das 5 rodadas normais
      else {
        // Prepara para a próxima rodada
        room.round++;
        room.turnInRound = 1;
        room.currentAttacker = 'player1'; // Reset para o primeiro jogador da nova rodada
        room.player1Position = null;
        room.player2Position = null;
        room.player1Ready = false;
        room.player2Ready = false;

        setTimeout(() => {
          io.to(room.id).emit('nextRound', {
            round: room.round,
            turn: room.turnInRound,
            scores: room.scores,
            attacker: room.currentAttacker
          });
        }, 3000);
      }
    } else {
      // Ainda falta um jogador chutar nesta rodada
      room.turnInRound = 2;
      room.currentAttacker = room.currentAttacker === 'player1' ? 'player2' : 'player1';
      room.player1Position = null;
      room.player2Position = null;
      room.player1Ready = false;
      room.player2Ready = false;

      setTimeout(() => {
        io.to(room.id).emit('nextTurn', {
          round: room.round,
          turn: room.turnInRound,
          scores: room.scores,
          attacker: room.currentAttacker,
          suddenDeath: room.suddenDeathMode
        });
      }, 3000);
    }
  }

  // Evento para quando o jogador solicita um novo jogo (após "Jogar novamente")
  socket.on('requestNewGame', (data) => {
    const { roomId } = data;
    const room = rooms[roomId];

    if (!room) return; // Se a sala não existe mais, ignorar

    // Reset completo do estado da sala
    room.scores = {
      player1: 0,
      player2: 0
    };
    room.kicks = {
      player1: 0,
      player2: 0
    };
    room.round = 1;
    room.suddenDeathMode = false;
    room.player1Position = null;
    room.player2Position = null;
    room.player1Ready = false;
    room.player2Ready = false;
    room.player1Team = null;  // Resetando a seleção de time
    room.player2Team = null;  // Resetando a seleção de time
    room.player1TeamConfirmed = false;  // Resetando a confirmação de time
    room.player2TeamConfirmed = false;  // Resetando a confirmação de time
    room.currentAttacker = 'player1'; // Sempre inicia com player1 como atacante
    room.turnInRound = 1;

    // Notifica que o jogador está aguardando para iniciar um novo jogo
    socket.to(roomId).emit('opponentRequestedNewGame', {
      message: 'O outro jogador quer jogar novamente! Entre na sala novamente para iniciar.',
      playerId: socket.playerId
    });

    console.log(`Jogador ${socket.id} solicitou novo jogo na sala ${roomId}`);
  });

  // Desconexão de jogador
  socket.on('disconnect', () => {
    console.log(`Usuário desconectado: ${socket.id}`);
    serverStats.activePlayers--;

    // Se estava em uma sala, notificar o outro jogador
    if (socket.roomId && rooms[socket.roomId]) {
      const room = rooms[socket.roomId];

      // Filtra o jogador que saiu
      room.players = room.players.filter(player => player.id !== socket.id);

      if (room.players.length === 0) {
        // Sala vazia, remover após um tempo para caso o jogador reconecte
        setTimeout(() => {
          if (rooms[socket.roomId] && rooms[socket.roomId].players.length === 0) {
            delete rooms[socket.roomId];
            console.log(`Sala ${socket.roomId} removida por inatividade`);
          }
        }, 10 * 60 * 1000); // 10 minutos
      } else {
        // Notifica o jogador restante
        io.to(socket.roomId).emit('playerLeft');
      }
    }
  });
});

// Limpar salas inativas periodicamente (a cada 30 minutos)
setInterval(() => {
  const now = new Date();
  for (const roomId in rooms) {
    const room = rooms[roomId];
    // Remover salas inativas por mais de 1 hora
    if (room.players.length === 0 && (now - new Date(room.createdAt)) > 60 * 60 * 1000) {
      delete rooms[roomId];
      console.log(`Sala ${roomId} removida durante limpeza de rotina`);
    }
  }
}, 30 * 60 * 1000);

// Log periódico do estado do servidor (a cada 5 minutos)
setInterval(() => {
  console.log(`--- Status do servidor (${new Date().toISOString()}) ---`);
  console.log(`Salas ativas: ${Object.keys(rooms).length}`);
  console.log(`Jogadores ativos: ${serverStats.activePlayers}`);
  console.log(`Total de jogos iniciados: ${serverStats.totalGames}`);
}, 5 * 60 * 1000);

// Pega a porta dos argumentos da linha de comando ou usa valores padrão
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  if (RENDER_EXTERNAL_URL) {
    console.log(`Acesse o jogo online em: ${RENDER_EXTERNAL_URL}`);
  } else {
    console.log(`Acesse o jogo em: http://localhost:${PORT}`);
  }
  console.log(`Servidor PenaltyX2 iniciado em ${new Date().toLocaleString()}`);
});
