// Conexão com o servidor via Socket.IO
const socket = io();

// Elementos HTML
const homeScreen = document.getElementById('home-screen');
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');
const startGameBtn = document.getElementById('start-game-btn');
const backToHomeBtn = document.getElementById('back-to-home-btn');
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
const turnPlayer = document.getElementById('turn-player'); // Novo: indicador de turno
const playAgainBtn = document.getElementById('play-again-btn');
const returnHomeBtn = document.getElementById('return-home-btn');
const finalPlayer1Score = document.getElementById('final-player1-score');
const finalPlayer2Score = document.getElementById('final-player2-score');
const resultMessage = document.getElementById('result-message');
const resultTitle = document.getElementById('result-title');
const readyButtonContainer = document.getElementById('ready-button-container');
const readyButton = document.getElementById('ready-button');
const selectionMessage = document.getElementById('selection-message');
const resultContainer = document.querySelector('.result-container');

// Variáveis de estado do jogo
let playerRole = null; // 'player1' ou 'player2'
let roomId = null;
let selectedPosition = null;
let isReady = false;
let currentAttacker = 'player1'; // controla quem é o atacante do turno atual
let currentTurn = 1; // Novo: controla qual turno está ativo (1 ou 2)

// Mapeamento das posições do gol com coordenadas para animações
const goalPositions = {
    'top-left': { ballX: '15%', ballY: '15%', keeperX: '15%', keeperY: '15%' },
    'top-right': { ballX: '85%', ballY: '15%', keeperX: '85%', keeperY: '15%' },
    'center': { ballX: '50%', ballY: '50%', keeperX: '50%', keeperY: '50%' },
    'bottom-left': { ballX: '15%', ballY: '60%', keeperX: '15%', keeperY: '60%' },
    'bottom-right': { ballX: '85%', ballY: '60%', keeperX: '85%', keeperY: '60%' }
};

// Funções para mostrar/esconder telas
function showScreen(screen) {
    homeScreen.classList.remove('active');
    startScreen.classList.remove('active');
    gameScreen.classList.remove('active');
    resultScreen.classList.remove('active');

    if (screen === 'home') homeScreen.classList.add('active');
    else if (screen === 'start') startScreen.classList.add('active');
    else if (screen === 'game') gameScreen.classList.add('active');
    else if (screen === 'result') resultScreen.classList.add('active');
}

// Navegação da tela inicial para tela de sala
startGameBtn.addEventListener('click', () => {
    showScreen('start');
});

// Navegação de volta para a tela inicial
backToHomeBtn.addEventListener('click', () => {
    showScreen('home');
});

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
        turnInfo.textContent = 'Você é o Jogador 1';
    } else {
        turnInfo.textContent = 'Você é o Jogador 2';
    }
});

// Evento ao iniciar o jogo quando dois jogadores estão na sala
socket.on('gameStart', (data) => {
    waitingMessage.classList.add('hidden');
    showScreen('game');
    roundCounter.textContent = data.round;
    currentAttacker = data.attacker || 'player1'; // começa sempre com player1
    currentTurn = data.turn || 1;
    updateTurnDisplay();
    resetRound();
    updateInstructions();
});

// Atualiza o indicador de turno
function updateTurnDisplay() {
    // Mostra o número do jogador atual (1 ou 2)
    turnPlayer.textContent = currentAttacker === 'player1' ? '1' : '2';
}

// Evento quando o outro jogador confirma sua escolha
socket.on('opponentReady', (data) => {
    // Mostra informação na tela
    actionMessage.textContent = data.message;
});

// Evento ao receber o resultado da rodada
socket.on('roundResult', (data) => {
    currentAttacker = data.attacker; // atualiza quem foi o atacante da rodada

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

// Evento para o próximo turno dentro da mesma rodada
socket.on('nextTurn', (data) => {
    currentTurn = data.turn;
    currentAttacker = data.attacker;
    updateTurnDisplay();
    resetRound();
    updateInstructions();

    // Mensagem informativa sobre o próximo turno
    const attackerNumber = currentAttacker === 'player1' ? '1' : '2';
    actionMessage.textContent = `Vez do Jogador ${attackerNumber} chutar!`;
});

// Evento para próxima rodada (após os dois jogadores terem chutado)
socket.on('nextRound', (data) => {
    roundCounter.textContent = data.round;
    currentAttacker = data.attacker; // Normalmente volta para player1
    currentTurn = data.turn || 1;    // Normalmente volta para turno 1
    updateTurnDisplay();
    resetRound();
    updateInstructions();

    // Mensagem informativa sobre a nova rodada
    actionMessage.textContent = `Nova rodada! Vez do Jogador ${currentAttacker === 'player1' ? '1' : '2'} chutar!`;
});

// Evento ao fim do jogo
socket.on('gameOver', (data) => {
    console.log('Evento gameOver recebido:', data); // Log para depuração

    // Atualiza o placar final imediatamente
    finalPlayer1Score.textContent = data.scores.player1;
    finalPlayer2Score.textContent = data.scores.player2;

    // Define a mensagem de resultado e cor baseada no resultado
    if (data.winner) {
        const isWinner = playerRole === data.winner;
        resultTitle.textContent = isWinner ? 'Você Venceu!' : 'Você Perdeu!';
        resultMessage.textContent = `Jogador ${data.winner === 'player1' ? '1' : '2'} vence a disputa de pênaltis!`;

        // Adiciona a classe apropriada para a cor do resultado
        resultContainer.classList.remove('victory', 'defeat');
        if (isWinner) {
            resultContainer.classList.add('victory');
        } else {
            resultContainer.classList.add('defeat');
        }
    } else {
        resultTitle.textContent = 'Empate!';
        resultMessage.textContent = 'A disputa de pênaltis terminou empatada!';
        resultContainer.classList.remove('victory', 'defeat');
    }

    // Adiciona um pequeno atraso para mostrar o resultado da última rodada antes de mostrar a tela final
    setTimeout(() => {
        showScreen('result');
    }, 2000);
});

// Função para resetar o estado para uma nova rodada/turno
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
    const attackerNumber = currentAttacker === 'player1' ? '1' : '2';
    const defenderNumber = currentAttacker === 'player1' ? '2' : '1';

    if (playerRole === currentAttacker) {
        turnInfo.textContent = `Você é o Batedor!`;
        actionMessage.textContent = 'Escolha onde chutar e clique em Pronto para confirmar.';
        setGoalSpotsEnabled(true);
    } else {
        turnInfo.textContent = `Você é o goleiro!`;
        actionMessage.textContent = 'Escolha onde defender e clique em Pronto para confirmar.';
        setGoalSpotsEnabled(true);
    }
}

// Evento quando o outro jogador saiu
socket.on('playerLeft', () => {
    alert('O outro jogador desconectou!');
    showScreen('home');
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
    if (playerRole === currentAttacker) {
        selectionMessage.textContent = `Chute selecionado: ${getPositionName(position)}`;
    } else {
        selectionMessage.textContent = `Defesa selecionada: ${getPositionName(position)}`;
    }
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
    socket.emit('playerReady', { position: selectedPosition });
    if (playerRole === currentAttacker) {
        actionMessage.textContent = 'Você confirmou seu chute! Aguardando o goleiro...';
    } else {
        actionMessage.textContent = 'Você confirmou sua defesa! Aguardando o resultado...';
    }
});

// Botão para jogar novamente (volta para tela de sala)
playAgainBtn.addEventListener('click', () => {
    showScreen('start');
    waitingMessage.classList.add('hidden');
    roomInput.value = '';
});

// Botão para voltar à página inicial
returnHomeBtn.addEventListener('click', () => {
    showScreen('home');
    waitingMessage.classList.add('hidden');
    roomInput.value = '';
});

// Iniciar com a tela inicial (home)
showScreen('home');
