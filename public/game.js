// Conexão com o servidor via Socket.IO
const socket = io();

// Elementos HTML
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');
const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');
const waitingMessage = document.getElementById('waiting-message');
const turnInfo = document.getElementById('turn-info');
const actionMessage = document.getElementById('action-message');
const goalSpots = document.querySelectorAll('.spot');
const ball = document.getElementById('ball');
const goalkeeper = document.getElementById('goalkeeper');
const player1Score = document.getElementById('player1-score');
const player2Score = document.getElementById('player2-score');
const roundCounter = document.getElementById('round-counter');
const playAgainBtn = document.getElementById('play-again-btn');
const finalPlayer1Score = document.getElementById('final-player1-score');
const finalPlayer2Score = document.getElementById('final-player2-score');
const resultMessage = document.getElementById('result-message');
const resultTitle = document.getElementById('result-title');
const readyButtonContainer = document.getElementById('ready-button-container');
const readyButton = document.getElementById('ready-button');
const selectionMessage = document.getElementById('selection-message');

// Variáveis de estado do jogo
let playerRole = null; // 'player1' ou 'player2'
let roomId = null;
let selectedPosition = null;
let isReady = false;

// Mapeamento das posições do gol com coordenadas para animações
const goalPositions = {
    'top-left': { ballX: '15%', ballY: '15%', keeperX: '15%', keeperY: '15%' },
    'top-right': { ballX: '85%', ballY: '15%', keeperX: '85%', keeperY: '15%' },
    'center': { ballX: '50%', ballY: '50%', keeperX: '50%', keeperY: '50%' },
    'bottom-left': { ballX: '15%', ballY: '85%', keeperX: '15%', keeperY: '85%' },
    'bottom-right': { ballX: '85%', ballY: '85%', keeperX: '85%', keeperY: '85%' }
};

// Funções para mostrar/esconder telas
function showScreen(screen) {
    startScreen.classList.remove('active');
    gameScreen.classList.remove('active');
    resultScreen.classList.remove('active');

    if (screen === 'start') startScreen.classList.add('active');
    else if (screen === 'game') gameScreen.classList.add('active');
    else if (screen === 'result') resultScreen.classList.add('active');
}

// Handler para entrar em uma sala
joinBtn.addEventListener('click', () => {
    if (roomInput.value.trim() === '') {
        alert('Por favor, digite um código para a sala!');
        return;
    }

    roomId = roomInput.value;
    socket.emit('joinRoom', roomId);
    waitingMessage.classList.remove('hidden');
});

// Evento ao ser atribuído como jogador
socket.on('playerAssigned', (data) => {
    playerRole = data.playerId;
    roomId = data.roomId;

    // Mostrando mensagem conforme o papel do jogador
    if (playerRole === 'player1') {
        turnInfo.textContent = 'Você é o Jogador 1 (atacante)';
    } else {
        turnInfo.textContent = 'Você é o Jogador 2 (goleiro)';
    }
});

// Evento ao iniciar o jogo quando dois jogadores estão na sala
socket.on('gameStart', (data) => {
    waitingMessage.classList.add('hidden');
    showScreen('game');
    roundCounter.textContent = data.round;

    // Reseta estado para nova rodada
    resetRound();

    // Atualiza instruções para ambos os jogadores
    updateInstructions();
});

// Evento quando o outro jogador confirma sua escolha
socket.on('opponentReady', (data) => {
    // Mostra informação na tela
    actionMessage.textContent = data.message;
});

// Evento ao receber o resultado da rodada
socket.on('roundResult', (data) => {
    // Posicões para animação
    const kickPos = goalPositions[data.kick];
    const defensePos = goalPositions[data.defense];

    // Posiciona e mostra a bola
    ball.style.left = kickPos.ballX;
    ball.style.top = kickPos.ballY;
    ball.classList.remove('hidden');

    // Posiciona e mostra o goleiro
    goalkeeper.style.left = defensePos.keeperX;
    goalkeeper.style.top = defensePos.keeperY;
    goalkeeper.classList.remove('hidden');

    // Atualiza o placar
    player1Score.textContent = data.scores.player1;
    player2Score.textContent = data.scores.player2;

    // Mostra o resultado da jogada
    if (data.isGoal) {
        actionMessage.textContent = `GOL! O atacante marcou!`;
    } else {
        actionMessage.textContent = 'DEFENDEU! O goleiro fez uma grande defesa!';
    }

    // Desabilita cliques nos spots e botão pronto
    setGoalSpotsEnabled(false);
    readyButton.disabled = true;
    readyButton.classList.add('disabled');
});

// Evento para próxima rodada
socket.on('nextRound', (data) => {
    // Atualiza o contador de rodadas
    roundCounter.textContent = data.round;

    // Reseta estado para nova rodada
    resetRound();

    // Atualiza instruções para ambos os jogadores
    updateInstructions();
});

// Evento ao fim do jogo
socket.on('gameOver', (data) => {
    console.log('Evento gameOver recebido:', data); // Log para depuração

    // Atualiza o placar final imediatamente
    finalPlayer1Score.textContent = data.scores.player1;
    finalPlayer2Score.textContent = data.scores.player2;

    // Define o mensagem de resultado
    if (data.winner) {
        const isWinner = playerRole === data.winner;
        resultTitle.textContent = isWinner ? 'Você Venceu!' : 'Você Perdeu!';
        resultMessage.textContent = `Jogador ${data.winner === 'player1' ? '1' : '2'} vence a disputa de pênaltis!`;
    } else {
        resultTitle.textContent = 'Empate!';
        resultMessage.textContent = 'A disputa de pênaltis terminou empatada!';
    }

    // Adiciona um pequeno atraso para mostrar o resultado da última rodada antes de mostrar a tela final
    setTimeout(() => {
        showScreen('result');
    }, 2000);
});

// Função para resetar o estado para uma nova rodada
function resetRound() {
    // Esconde a bola e o goleiro
    ball.classList.add('hidden');
    goalkeeper.classList.add('hidden');

    // Reseta variáveis de estado
    selectedPosition = null;
    isReady = false;

    // Reseta UI
    readyButtonContainer.classList.add('hidden');
    readyButton.disabled = false;
    readyButton.classList.remove('disabled');
    selectionMessage.textContent = '';

    // Habilita os spots de clique
    setGoalSpotsEnabled(true);
}

// Atualiza as instruções baseado no papel do jogador
function updateInstructions() {
    if (playerRole === 'player1') {
        turnInfo.textContent = 'Sua vez de chutar!';
        actionMessage.textContent = 'Escolha onde chutar e clique em Pronto para confirmar.';
    } else {
        turnInfo.textContent = 'Sua vez de defender!';
        actionMessage.textContent = 'Escolha onde defender e clique em Pronto para confirmar.';
    }
}

// Evento quando o outro jogador saiu
socket.on('playerLeft', () => {
    alert('O outro jogador desconectou!');
    showScreen('start');
    waitingMessage.classList.add('hidden');
});

// Evento quando a sala está cheia
socket.on('roomFull', () => {
    alert('Esta sala já está cheia!');
    waitingMessage.classList.add('hidden');
});

// Habilitar ou desabilitar cliques nas áreas do gol
function setGoalSpotsEnabled(enabled) {
    goalSpots.forEach(spot => {
        if (enabled) {
            spot.style.cursor = 'pointer';
            spot.addEventListener('click', handleSpotClick);
        } else {
            spot.style.cursor = 'default';
            spot.removeEventListener('click', handleSpotClick);
        }
    });
}

// Handler para clique nas áreas do gol
function handleSpotClick(event) {
    const position = event.target.dataset.position;
    selectedPosition = position;

    // Mostra a posição selecionada
    if (playerRole === 'player1') {
        selectionMessage.textContent = `Chute selecionado: ${getPositionName(position)}`;
    } else {
        selectionMessage.textContent = `Defesa selecionada: ${getPositionName(position)}`;
    }

    // Mostrar o botão Pronto
    readyButtonContainer.classList.remove('hidden');
}

// Converte o código da posição para um nome amigável
function getPositionName(position) {
    const positionNames = {
        'top-left': 'Canto superior esquerdo',
        'top-right': 'Canto superior direito',
        'center': 'Centro',
        'bottom-left': 'Canto inferior esquerdo',
        'bottom-right': 'Canto inferior direito'
    };
    return positionNames[position] || position;
}

// Handler para o botão Pronto
readyButton.addEventListener('click', () => {
    if (!selectedPosition) return;

    isReady = true;
    readyButton.disabled = true;
    readyButton.classList.add('disabled');

    // Notifica o servidor que o jogador está pronto
    socket.emit('playerReady', { position: selectedPosition });

    if (playerRole === 'player1') {
        actionMessage.textContent = 'Você confirmou seu chute! Aguardando o goleiro...';
    } else {
        actionMessage.textContent = 'Você confirmou sua defesa! Aguardando o resultado...';
    }
});

// Botão para jogar novamente
playAgainBtn.addEventListener('click', () => {
    showScreen('start');
    waitingMessage.classList.add('hidden');
    roomInput.value = '';
});

// Iniciar com a tela de início
showScreen('start');
