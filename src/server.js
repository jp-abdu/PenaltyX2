const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Servindo arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, '../public')));

// Armazenar salas de jogo
const rooms = {};

// Gerenciador de conexões Socket.IO
io.on('connection', (socket) => {
  console.log(`Novo usuário conectado: ${socket.id}`);

  // Criação ou entrada em sala
  socket.on('joinRoom', (roomId) => {
    // Se a sala não existir, cria uma nova
    if (!rooms[roomId]) {
      rooms[roomId] = {
        id: roomId,
        players: [],
        scores: {
          player1: 0,
          player2: 0
        },
        round: 1, // Corrigido de 0 para 1 para corresponder ao evento gameStart
        maxRounds: 5,
        player1Position: null,
        player2Position: null,
        player1Ready: false,
        player2Ready: false,
        currentAttacker: 'player1' // Começa com player1 como atacante
      };
    }

    // Se a sala já tiver 2 jogadores, impede a entrada
    const room = rooms[roomId];
    if (room.players.length >= 2) {
      socket.emit('roomFull');
      return;
    }

    // Adiciona o jogador à sala
    const playerId = room.players.length === 0 ? 'player1' : 'player2';
    room.players.push({
      id: socket.id,
      playerId
    });

    // Junta o socket à sala
    socket.join(roomId);
    socket.roomId = roomId;
    socket.playerId = playerId;

    // Notifica o jogador sobre sua entrada
    socket.emit('playerAssigned', {
      playerId,
      roomId
    });

    // Se dois jogadores entraram, inicia o jogo
    if (room.players.length === 2) {
      io.to(roomId).emit('gameStart', {
        round: 1
      });
    }

    // Envia atualização sobre jogadores na sala
    io.to(roomId).emit('roomUpdate', {
      playersCount: room.players.length
    });
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

      // Notifica o outro jogador que este está pronto
      socket.to(socket.roomId).emit('opponentReady', {
        player: 'player1',
        message: 'O jogador 1 confirmou sua escolha!'
      });
    } else {
      room.player2Position = position;
      room.player2Ready = true;

      // Notifica o outro jogador que este está pronto
      socket.to(socket.roomId).emit('opponentReady', {
        player: 'player2',
        message: 'O jogador 2 confirmou sua escolha!'
      });
    }

    // Se ambos os jogadores estão prontos, processa o resultado
    if (room.player1Ready && room.player2Ready) {
      processRound(room);
    }
  });

  // Função para processar o resultado da rodada
  function processRound(room) {
    // Determina quem é o atacante e o goleiro nesta rodada
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

    console.log(`Rodada ${room.round} processada - Placar: ${room.scores.player1} x ${room.scores.player2}`);

    // Envia o resultado para ambos os jogadores, informando quem foi atacante
    io.to(room.id).emit('roundResult', {
      attacker,
      kick: attackerPosition,
      defense: defenderPosition,
      isGoal,
      scores: room.scores
    });

    // Incrementa a rodada SÓ DEPOIS de processar o fim do jogo
    if (room.round >= room.maxRounds) {
      // Determina o vencedor
      let winner = null;
      if (room.scores.player1 > room.scores.player2) {
        winner = 'player1';
      } else if (room.scores.player2 > room.scores.player1) {
        winner = 'player2';
      }

      console.log(`Jogo finalizado - Enviando gameOver - Resultado final: ${room.scores.player1} x ${room.scores.player2}, vencedor: ${winner || 'empate'}`);

      io.to(room.id).emit('gameOver', {
        winner,
        scores: room.scores
      });

      setTimeout(() => {
        delete rooms[room.id];
      }, 5000);
    } else {
      // Alterna o atacante para a próxima rodada
      room.currentAttacker = room.currentAttacker === 'player1' ? 'player2' : 'player1';
      room.player1Position = null;
      room.player2Position = null;
      room.player1Ready = false;
      room.player2Ready = false;

      setTimeout(() => {
        io.to(room.id).emit('nextRound', {
          round: room.round + 1,
          scores: room.scores,
          attacker: room.currentAttacker
        });
        room.round++;
      }, 3000);
    }
  }

  // Desconexão de jogador
  socket.on('disconnect', () => {
    console.log(`Usuário desconectado: ${socket.id}`);

    // Se estava em uma sala, notificar o outro jogador
    if (socket.roomId && rooms[socket.roomId]) {
      const room = rooms[socket.roomId];

      // Filtra o jogador que saiu
      room.players = room.players.filter(player => player.id !== socket.id);

      if (room.players.length === 0) {
        // Sala vazia, remover
        delete rooms[socket.roomId];
      } else {
        // Notifica o jogador restante
        io.to(socket.roomId).emit('playerLeft');
      }
    }
  });
});

// Pega a porta dos argumentos da linha de comando ou usa valores padrão
const portArg = process.argv[2];
const PORT = portArg || process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
