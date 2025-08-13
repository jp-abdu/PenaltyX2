// Conexão com o servidor via Socket.IO
// Detectar automaticamente o servidor correto, seja local ou no Vercel
const socket = io({
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000
});

// Log de status da conexão
socket.on('connect', () => {
    console.log('Conectado ao servidor com ID:', socket.id);
});

socket.on('connect_error', (error) => {
    console.error('Erro de conexão:', error);
});

socket.on('disconnect', (reason) => {
    console.log('Desconectado do servidor. Motivo:', reason);
});

// Elementos HTML - Tela inicial
const introContainer = document.getElementById('intro-container');
const startGameBtn = document.getElementById('start-game-btn');

// Elementos HTML - Tela de seleção de sala e time
const teamSelectionContainer = document.getElementById('team-selection-container');
const backToIntroBtn = document.getElementById('back-to-intro-btn');
const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');
const roomWaitingMessage = document.getElementById('room-waiting-message');
const teamSelectionSection = document.getElementById('team-selection-section');
const teamOptions = document.querySelectorAll('.team-option');
const confirmTeamBtn = document.getElementById('confirm-team-btn');
const teamConfirmationMessage = document.getElementById('team-confirmation-message');

// Elementos HTML - Container do jogo
const gameContainer = document.getElementById('game-container');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');
const leaveGameBtn = document.getElementById('leave-game-btn');

// Elementos HTML - Tela de jogo
const turnInfo = document.getElementById('turn-info');
const actionMessage = document.getElementById('action-message');
const goalSpots = document.querySelectorAll('.spot');
const ball = document.getElementById('ball');
const penaltyBall = document.getElementById('penalty-ball');
const goalkeeper = document.getElementById('goalkeeper');
const player = document.getElementById('player'); // Novo elemento do jogador
const player1Score = document.getElementById('player1-score');
const player2Score = document.getElementById('player2-score');
const player1TeamName = document.getElementById('player1-team-name');
const player2TeamName = document.getElementById('player2-team-name');
const roundCounter = document.getElementById('round-counter');
const turnPlayer = document.getElementById('turn-player');
const readyButtonContainer = document.getElementById('ready-button-container');
const readyButton = document.getElementById('ready-button');
const selectionMessage = document.getElementById('selection-message');

// Elementos HTML - Tela de resultado
const playAgainBtn = document.getElementById('play-again-btn');
const returnHomeBtn = document.getElementById('return-home-btn');
const finalPlayer1Score = document.getElementById('final-player1-score');
const finalPlayer2Score = document.getElementById('final-player2-score');
const finalPlayer1Team = document.getElementById('final-player1-team');
const finalPlayer2Team = document.getElementById('final-player2-team');
const resultMessage = document.getElementById('result-message');
const resultTitle = document.getElementById('result-title');
const resultContainer = document.querySelector('.result-container');

// Variáveis de estado do jogo
let playerRole = null; // 'player1' ou 'player2'
let roomId = null;
let selectedPosition = null;
let isReady = false;
let selectedTeam = null; // Para armazenar o time escolhido pelo jogador
let isTeamConfirmed = false; // Para rastrear se o time foi confirmado
let opponentTeamConfirmed = false; // Para rastrear se o oponente confirmou o time
let opponentSelectedTeam = null; // Para armazenar o time selecionado pelo oponente
let currentAttacker = 'player1'; // controla quem é o atacante do turno atual
let currentTurn = 1; // controla qual turno está ativo (1 ou 2)
let isSuddenDeath = false; // indica se estamos em modo de morte súbita
let player1TeamData = null; // Armazena o time do jogador 1
let player2TeamData = null; // Armazena o time do jogador 2

// Mapeamento das posições do gol com coordenadas para animações
const goalPositions = {
    'top-left': {
        ballX: '15%',
        ballY: '15%',
        keeperX: '28%',  // Ajustado mais para a direita para alinhar a mão com a bola
        keeperY: '20%',  // Ajustado mais para baixo para alinhar a mão com a bola
        keeperClass: 'goalkeeper-diving-top-left',
        handX: '15%',
        handY: '15%'
    },
    'top-right': {
        ballX: '85%',
        ballY: '15%',
        keeperX: '72%',  // Ajustado mais para a esquerda para alinhar a mão com a bola
        keeperY: '20%',  // Ajustado mais para baixo para alinhar a mão com a bola
        keeperClass: 'goalkeeper-diving-top-right',
        handX: '85%',
        handY: '15%'
    },
    'center': {
        ballX: '50%',
        ballY: '50%',
        keeperX: '50%',
        keeperY: '50%',  // Restaurada posição original do goleiro no centro
        keeperClass: 'goalkeeper-waiting',
        handX: '50%',
        handY: '50%'
    },
    'bottom-left': {
        ballX: '15%',
        ballY: '60%',
        keeperX: '28%',  // Ajustado mais para a direita para alinhar a mão com a bola
        keeperY: '55%',  // Ajustado para cima para alinhar a mão com a bola
        keeperClass: 'goalkeeper-diving-bottom-left',
        handX: '15%',
        handY: '60%'
    },
    'bottom-right': {
        ballX: '85%',
        ballY: '60%',
        keeperX: '72%',  // Ajustado mais para a esquerda para alinhar a mão com a bola
        keeperY: '55%',  // Ajustado para cima para alinhar a mão com a bola
        keeperClass: 'goalkeeper-diving-bottom-right',
        handX: '85%',
        handY: '60%'
    }
};

// Cores dos times para estilizar o placar
const teamColors = {
    'team1': '#009c3b', // Brasil
    'team2': '#75AADB', // Argentina
    'team3': '#002654', // França
    'team4': '#008C45'  // Itália
};

// Funções para mostrar/esconder telas
function showScreen(screen) {
    // Gerencia a visibilidade das telas principais
    introContainer.classList.remove('active');
    teamSelectionContainer.classList.remove('active');
    gameContainer.style.display = 'none';

    if (screen === 'intro') {
        introContainer.classList.add('active');
    }
    else if (screen === 'teamSelection') {
        teamSelectionContainer.classList.add('active');
    }
    else {
        // Telas dentro do gameContainer
        gameContainer.style.display = 'block';

        // Primeiro, desativa todas as telas dentro do gameContainer
        gameScreen.classList.remove('active');
        resultScreen.classList.remove('active');

        // Ativa a tela específica dentro do gameContainer
        if (screen === 'game') gameScreen.classList.add('active');
        else if (screen === 'result') resultScreen.classList.add('active');
    }
}

// Navegação da tela inicial para tela de seleção de sala e time
startGameBtn.addEventListener('click', () => {
    // Animação de saída para a tela intro
    introContainer.style.transform = 'translateX(-100%)';

    // Mostra a tela de seleção de sala e time
    setTimeout(() => {
        showScreen('teamSelection');
    }, 700); // Sincronizado com a duração da transição CSS
});

// Navegação de volta para a tela inicial
backToIntroBtn.addEventListener('click', () => {
    // Resetar campos e estados
    roomInput.value = '';
    roomWaitingMessage.classList.add('hidden');
    teamSelectionSection.classList.add('hidden');
    teamConfirmationMessage.classList.add('hidden');

    // Reset de variáveis
    selectedTeam = null;
    isTeamConfirmed = false;
    opponentTeamConfirmed = false;
    opponentSelectedTeam = null;

    // Reset visual dos times
    teamOptions.forEach(team => {
        team.classList.remove('selected');
        team.style.cursor = 'pointer';
        team.style.opacity = '1';
        // Remove quaisquer indicadores
        const indicators = team.querySelectorAll('.team-selected-indicator, .team-confirmed-indicator');
        indicators.forEach(indicator => indicator.remove());
    });
    confirmTeamBtn.disabled = true;
    confirmTeamBtn.classList.add('disabled');
    confirmTeamBtn.textContent = "Confirmar Time";

    // Voltar para a tela inicial
    teamSelectionContainer.style.transform = 'translateX(-100%)';
    setTimeout(() => {
        introContainer.style.transform = 'translateX(0)';
        showScreen('intro');
    }, 700);
});

// Handler para entrar em uma sala
joinBtn.addEventListener('click', () => {
    if (roomInput.value.trim() === '') {
        alert('Por favor, digite um código para a sala!');
        return;
    }

    roomId = roomInput.value;
    socket.emit('joinRoom', roomId);
    roomWaitingMessage.classList.remove('hidden');

    // Mostrar seção de escolha de time (agora podem escolher o time enquanto esperam)
    teamSelectionSection.classList.remove('hidden');
});

// Seleção de times
teamOptions.forEach(team => {
    team.addEventListener('click', () => {
        // Se o time já foi confirmado, não permite mudar
        if (isTeamConfirmed) return;

        // Se o time já foi escolhido pelo oponente, não permite escolher
        if (opponentSelectedTeam === team.dataset.team) {
            // Mostra um alerta informando que o time já foi escolhido
            alert('Este time já foi escolhido pelo outro jogador!');
            return;
        }

        // Remove a seleção de todos os times
        teamOptions.forEach(t => t.classList.remove('selected'));

        // Seleciona o time atual
        team.classList.add('selected');
        selectedTeam = team.dataset.team;

        // Habilita o botão de confirmar
        confirmTeamBtn.disabled = false;
        confirmTeamBtn.classList.remove('disabled');

        // Envia a seleção para o servidor
        socket.emit('teamSelected', { team: selectedTeam });
    });
});

// Confirmação de time escolhido
confirmTeamBtn.addEventListener('click', () => {
    if (!selectedTeam) return;

    // Envia a confirmação do time para o servidor
    socket.emit('confirmTeam');

    // Atualiza o estado local
    isTeamConfirmed = true;

    // Atualiza a interface
    confirmTeamBtn.textContent = "Time Confirmado!";
    confirmTeamBtn.disabled = true;
    confirmTeamBtn.classList.add('disabled');
    teamConfirmationMessage.classList.remove('hidden');

    // Desabilita a seleção de times após confirmar
    teamOptions.forEach(team => {
        team.style.cursor = 'default';
    });

    // Atualiza a mensagem de espera
    if (opponentTeamConfirmed) {
        roomWaitingMessage.textContent = 'Ambos os jogadores confirmaram seus times. Iniciando o jogo...';
    } else {
        roomWaitingMessage.textContent = 'Seu time foi confirmado! Aguardando o outro jogador confirmar...';
    }
});

// Evento ao receber informação sobre o time do oponente quando entrar na sala
socket.on('opponentTeamInfo', (data) => {
    const { player, team, confirmed } = data;

    // Armazenar qual time o oponente escolheu
    opponentSelectedTeam = team;
    opponentTeamConfirmed = confirmed;

    if (confirmed) {
        // Armazena o time do oponente para poder mostrar no placar depois
        if (player === 'player1') {
            player1TeamData = team;
        } else {
            player2TeamData = team;
        }

        // Marca o time como já selecionado visualmente
        teamOptions.forEach(option => {
            if (option.dataset.team === team) {
                option.style.opacity = '0.5';
                option.style.cursor = 'not-allowed';

                // Adicionar um indicador visual
                if (!option.querySelector('.team-selected-indicator')) {
                    const indicator = document.createElement('div');
                    indicator.className = 'team-selected-indicator';
                    indicator.textContent = 'Já selecionado';
                    indicator.style.position = 'absolute';
                    indicator.style.top = '50%';
                    indicator.style.left = '50%';
                    indicator.style.transform = 'translate(-50%, -50%)';
                    indicator.style.background = 'rgba(255,0,0,0.5)';
                    indicator.style.color = 'white';
                    indicator.style.padding = '5px';
                    indicator.style.borderRadius = '5px';
                    indicator.style.pointerEvents = 'none';
                    option.style.position = 'relative';
                    option.appendChild(indicator);
                }
            }
        });

        // Atualizar mensagem
        const playerNumber = player === 'player1' ? '1' : '2';
        roomWaitingMessage.textContent = `Jogador ${playerNumber} já escolheu ${getTeamName(team)}. Escolha outro time.`;
    }
});

// Evento ao receber informação quando o oponente seleciona um time (antes de confirmar)
socket.on('opponentSelectedTeam', (data) => {
    const { player, team } = data;

    // Primeiro, libera todos os times, exceto o que acabou de ser selecionado pelo oponente
    teamOptions.forEach(option => {
        // Se não for o time que acabou de ser selecionado pelo oponente
        // E não for um time já confirmado (verificação feita pelo estilo da opção)
        if (option.dataset.team !== team && !option.querySelector('.team-confirmed-indicator')) {
            // Restaura a aparência normal
            option.style.opacity = '1';
            option.style.cursor = 'pointer';

            // Remove o indicador visual caso exista
            const existingIndicator = option.querySelector('.team-selected-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
        }
    });

    // Armazenamos a seleção atual do oponente
    opponentSelectedTeam = team;

    // Agora marca apenas o time recém selecionado como bloqueado
    teamOptions.forEach(option => {
        if (option.dataset.team === team) {
            // Se o usuário atual já tinha selecionado este time e não confirmou, deve selecionar outro
            if (selectedTeam === team && !isTeamConfirmed) {
                selectedTeam = null;
                confirmTeamBtn.disabled = true;
                confirmTeamBtn.classList.add('disabled');
                option.classList.remove('selected');
                alert('O outro jogador acabou de selecionar este time. Por favor escolha outro.');
            }

            // Apenas desabilita visualmente se este jogador ainda não selecionou e confirmou
            if (selectedTeam !== team || !isTeamConfirmed) {
                option.style.opacity = '0.5';
                option.style.cursor = 'not-allowed';

                // Remover indicador existente
                const existingIndicator = option.querySelector('.team-selected-indicator');
                if (existingIndicator) {
                    existingIndicator.remove();
                }

                // Adicionar novo indicador
                if (!option.querySelector('.team-selected-indicator')) {
                    const indicator = document.createElement('div');
                    indicator.className = 'team-selected-indicator';
                    indicator.textContent = 'Selecionado pelo oponente';
                    indicator.style.position = 'absolute';
                    indicator.style.top = '50%';
                    indicator.style.left = '50%';
                    indicator.style.transform = 'translate(-50%, -50%)';
                    indicator.style.background = 'rgba(255,0,0,0.5)';
                    indicator.style.color = 'white';
                    indicator.style.padding = '5px';
                    indicator.style.borderRadius = '5px';
                    indicator.style.pointerEvents = 'none';
                    option.style.position = 'relative';
                    option.appendChild(indicator);
                }
            }
        }
    });
});

// Evento ao receber confirmação do próprio time
socket.on('teamConfirmation', (data) => {
    const { team, playerNumber } = data;
    selectedTeam = team;

    // Armazena o time conforme o papel do jogador
    if (playerRole === 'player1') {
        player1TeamData = team;
    } else if (playerRole === 'player2') {
        player2TeamData = team;
    }

    // Atualiza a interface para refletir o time selecionado
    teamOptions.forEach(t => {
        if (t.dataset.team === team) {
            t.classList.add('selected');
        } else {
            t.classList.remove('selected');
        }
    });

    // Habilita o botão de confirmar, caso ainda não tenha confirmado
    if (!isTeamConfirmed) {
        confirmTeamBtn.disabled = false;
        confirmTeamBtn.classList.remove('disabled');
    }
});

// Evento ao receber informação de que um jogador confirmou seu time
socket.on('playerConfirmedTeam', (data) => {
    const { player, team } = data;

    // Armazenar o time confirmado para exibir no placar
    if (player === 'player1') {
        player1TeamData = team;
    } else if (player === 'player2') {
        player2TeamData = team;
    }

    // Se foi o outro jogador que confirmou
    if ((playerRole === 'player1' && player === 'player2') ||
        (playerRole === 'player2' && player === 'player1')) {
        opponentTeamConfirmed = true;
        opponentSelectedTeam = team;

        // Desabilita este time visualmente, já que foi confirmado pelo oponente
        teamOptions.forEach(option => {
            if (option.dataset.team === team) {
                option.style.opacity = '0.5';
                option.style.cursor = 'not-allowed';

                // Remover indicador existente
                const existingIndicator = option.querySelector('.team-selected-indicator');
                if (existingIndicator) {
                    existingIndicator.remove();
                }

                // Adicionar novo indicador
                if (!option.querySelector('.team-confirmed-indicator')) {
                    const indicator = document.createElement('div');
                    indicator.className = 'team-confirmed-indicator';
                    indicator.textContent = 'Confirmado pelo oponente';
                    indicator.style.position = 'absolute';
                    indicator.style.top = '50%';
                    indicator.style.left = '50%';
                    indicator.style.transform = 'translate(-50%, -50%)';
                    indicator.style.background = 'rgba(255,0,0,0.7)';
                    indicator.style.color = 'white';
                    indicator.style.padding = '5px';
                    indicator.style.borderRadius = '5px';
                    indicator.style.pointerEvents = 'none';
                    option.style.position = 'relative';
                    option.appendChild(indicator);
                }
            }
        });

        // Atualiza a mensagem na tela
        const opponentNumber = player === 'player1' ? '1' : '2';
        if (isTeamConfirmed) {
            roomWaitingMessage.textContent = `Ambos confirmaram seus times. Preparando para iniciar o jogo...`;
        } else {
            roomWaitingMessage.textContent = `Jogador ${opponentNumber} confirmou ${getTeamName(team)}. Confirme seu time para começar!`;
        }
    }

    // Se foi o próprio jogador que confirmou
    if ((playerRole === 'player1' && player === 'player1') ||
        (playerRole === 'player2' && player === 'player2')) {
        isTeamConfirmed = true;

        // Atualiza a interface
        confirmTeamBtn.textContent = "Time Confirmado!";
        confirmTeamBtn.disabled = true;
        confirmTeamBtn.classList.add('disabled');
        teamConfirmationMessage.classList.remove('hidden');

        // Desabilita a seleção de times após confirmar
        teamOptions.forEach(team => {
            team.style.cursor = 'default';
        });

        // Atualiza a mensagem
        if (opponentTeamConfirmed) {
            roomWaitingMessage.textContent = 'Ambos os jogadores confirmaram seus times. Iniciando o jogo...';
        } else {
            roomWaitingMessage.textContent = 'Seu time foi confirmado! Aguardando o outro jogador confirmar...';
        }
    }
});

// Evento ao ser atribuído como jogador
socket.on('playerAssigned', (data) => {
    playerRole = data.playerId;
    roomId = data.roomId;

    // Mostrando mensagem de acordo com a atribuição
    if (playerRole === 'player1') {
        roomWaitingMessage.textContent = 'Você entrou na sala. Escolha seu time e confirme.';
    } else {
        roomWaitingMessage.textContent = 'Você entrou na sala. Escolha seu time e confirme.';
    }

    // Mostrar seção de escolha de time
    teamSelectionSection.classList.remove('hidden');
});

// Evento ao receber atualização sobre a sala
socket.on('roomUpdate', (data) => {
    if (data.playersCount === 2) {
        roomWaitingMessage.textContent = 'Dois jogadores conectados. Escolham seus times para começar!';
    }
});

// Evento ao iniciar o jogo quando dois jogadores estão na sala e confirmaram seus times
socket.on('gameStart', (data) => {
    teamSelectionContainer.style.transform = 'translateX(-100%)';

    // Armazena os times dos jogadores
    player1TeamData = data.player1Team;
    player2TeamData = data.player2Team;

    // Avança para a tela do jogo
    setTimeout(() => {
        showScreen('game');

        // Configura o jogo
        roundCounter.textContent = data.round;
        currentAttacker = data.attacker || 'player1'; // começa sempre com player1
        currentTurn = data.turn || 1;
        isSuddenDeath = false;
        updateTurnDisplay();

        // Atualiza os nomes dos times no placar
        updateTeamDisplay();

        resetRound();
        updateInstructions();

        // Mostra a informação de batedor/goleiro
        const playerNumber = playerRole === 'player1' ? '1' : '2';
        const isAttacker = playerRole === currentAttacker;

        if (isAttacker) {
            turnInfo.textContent = `Você é o Batedor!`;
        } else {
            turnInfo.textContent = `Você é o Goleiro!`;
        }
    }, 700);
});

// Função para atualizar a exibição dos nomes dos times no placar
function updateTeamDisplay() {
    // Verificar se temos dados de times válidos
    if (!player1TeamData || !player2TeamData) {
        console.log("Dados de times incompletos:", {player1: player1TeamData, player2: player2TeamData});
        return; // Não atualiza se não tiver dados completos
    }

    // Definir os nomes dos times
    player1TeamName.textContent = getTeamName(player1TeamData);
    player2TeamName.textContent = getTeamName(player2TeamData);

    // Aplicar as cores de fundo correspondentes aos times
    document.querySelector('.team1-display').style.backgroundColor = teamColors[player1TeamData] || '#444';
    document.querySelector('.team2-display').style.backgroundColor = teamColors[player2TeamData] || '#444';

    // Também atualiza os nomes na tela de resultado final
    finalPlayer1Team.textContent = getTeamName(player1TeamData);
    finalPlayer2Team.textContent = getTeamName(player2TeamData);

    console.log(`Placar atualizado: ${getTeamName(player1TeamData)} vs ${getTeamName(player2TeamData)}`);
}

// Função auxiliar para obter o nome do time a partir do código
function getTeamName(teamCode) {
    const teamNames = {
        'team1': 'Brasil',
        'team2': 'Argentina',
        'team3': 'França',
        'team4': 'Itália'
    };
    return teamNames[teamCode] || teamCode;
}

// Evento quando o jogador deixa o jogo
leaveGameBtn.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja sair do jogo? Isso contará como uma desistência.')) {
        // Voltar para a tela de seleção de sala
        gameContainer.style.display = 'none';
        resetGameState();
        showScreen('teamSelection');

        // Resetar todos os elementos da tela de seleção
        roomInput.value = '';
        roomWaitingMessage.classList.add('hidden');
        teamSelectionSection.classList.add('hidden');
        teamConfirmationMessage.classList.add('hidden');
        teamOptions.forEach(team => {
            team.classList.remove('selected');
            team.style.cursor = 'pointer';
            team.style.opacity = '1';
            // Remove quaisquer indicadores
            const indicators = team.querySelectorAll('.team-selected-indicator, .team-confirmed-indicator');
            indicators.forEach(indicator => indicator.remove());
        });
        confirmTeamBtn.disabled = true;
        confirmTeamBtn.classList.add('disabled');
        confirmTeamBtn.textContent = "Confirmar Time";

        // Resetar variáveis de estado
        selectedTeam = null;
        isTeamConfirmed = false;
        opponentTeamConfirmed = false;
        opponentSelectedTeam = null;
        player1TeamData = null;
        player2TeamData = null;
    }
});

// Atualiza o indicador de turno
function updateTurnDisplay() {
    // Mostra o nome do time atual em vez do número do jogador
    if (currentAttacker === 'player1' && player1TeamData) {
        turnPlayer.textContent = getTeamName(player1TeamData);
    } else if (currentAttacker === 'player2' && player2TeamData) {
        turnPlayer.textContent = getTeamName(player2TeamData);
    } else {
        // Fallback para caso os dados do time não estejam disponíveis
        turnPlayer.textContent = currentAttacker === 'player1' ? '1' : '2';
    }
}

// Evento quando o outro jogador confirma sua escolha
socket.on('opponentReady', (data) => {
    // Mostra informação na tela
    actionMessage.textContent = data.message;
});

// Evento ao receber o resultado da rodada
socket.on('roundResult', (data) => {
    currentAttacker = data.attacker; // atualiza quem foi o atacante da rodada
    isSuddenDeath = data.suddenDeath || false;

    // Posicões para animação
    const kickPos = goalPositions[data.kick];
    const defensePos = goalPositions[data.defense];

    // Muda a imagem do jogador para a posição de chute
    player.classList.remove('player-waiting');
    player.classList.add('player-kicking');

    // Oculta a bola de pênalti quando a bola de chute é mostrada
    penaltyBall.classList.add('hidden');

    // Posiciona e mostra o goleiro com a classe apropriada para a direção do movimento
    goalkeeper.className = ''; // Remove todas as classes anteriores
    goalkeeper.classList.add(defensePos.keeperClass); // Adiciona a classe baseada na posição
    goalkeeper.style.left = defensePos.keeperX;
    goalkeeper.style.top = defensePos.keeperY;
    goalkeeper.classList.remove('hidden');

    // Se foi defesa (não foi gol), a bola aparece "na mão" do goleiro
    // Caso contrário, a bola vai para onde o jogador chutou
    if (!data.isGoal) {
        // Foi defesa, a bola deve aparecer na posição da mão do goleiro
        ball.style.left = defensePos.handX;
        ball.style.top = defensePos.handY;
    } else {
        // Foi gol, a bola aparece onde foi chutada
        ball.style.left = kickPos.ballX;
        ball.style.top = kickPos.ballY;
    }
    ball.classList.remove('hidden');

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

// Evento para iniciar a morte súbita
socket.on('suddenDeathStart', (data) => {
    isSuddenDeath = true;
    roundCounter.textContent = '1';
    actionMessage.textContent = data.message || 'Empate após as 5 cobranças! Iniciando morte súbita!';
});

// Evento para o próximo turno dentro da mesma rodada
socket.on('nextTurn', (data) => {
    currentTurn = data.turn;
    currentAttacker = data.attacker;
    isSuddenDeath = data.suddenDeath || false;
    updateTurnDisplay();
    resetRound();
    updateInstructions();

    // Mensagem informativa sobre o próximo turno usando o nome do time
    const teamName = currentAttacker === 'player1' && player1TeamData ?
                     getTeamName(player1TeamData) :
                     currentAttacker === 'player2' && player2TeamData ?
                     getTeamName(player2TeamData) :
                     'Adversário';
    actionMessage.textContent = `Vez do ${teamName} chutar!`;
});

// Evento para próxima rodada (após os dois jogadores terem chutado)
socket.on('nextRound', (data) => {
    roundCounter.textContent = data.round;
    currentAttacker = data.attacker; // Normalmente volta para player1
    currentTurn = data.turn || 1;    // Normalmente volta para turno 1
    isSuddenDeath = data.suddenDeath || false;

    // Se estamos em morte súbita, atualiza o visual para mostrar isso
    if (isSuddenDeath) {
        document.querySelector('.round').innerHTML = 'Morte súbita: <span id="round-counter">' + data.round + '</span>';
    } else {
        document.querySelector('.round').innerHTML = 'Rodada: <span id="round-counter">' + data.round + '</span>/5';
    }

    updateTurnDisplay();
    resetRound();
    updateInstructions();

    // Obtém o nome do time atual
    const teamName = currentAttacker === 'player1' && player1TeamData ?
                     getTeamName(player1TeamData) :
                     currentAttacker === 'player2' && player2TeamData ?
                     getTeamName(player2TeamData) :
                     'Adversário';

    // Mensagem informativa sobre a nova rodada com o nome do time
    let message = `Nova rodada! Vez do ${teamName} chutar!`;
    if (isSuddenDeath) {
        message = `Morte súbita - Rodada ${data.round}! Vez do ${teamName} chutar!`;
    }
    actionMessage.textContent = message;
});

// Evento ao fim do jogo
socket.on('gameOver', (data) => {
    console.log('Evento gameOver recebido:', data);

    // Atualiza o placar final imediatamente
    finalPlayer1Score.textContent = data.scores.player1;
    finalPlayer2Score.textContent = data.scores.player2;

    // Define a mensagem de resultado e cor baseada no resultado
    if (data.winner) {
        const isWinner = playerRole === data.winner;
        resultTitle.textContent = isWinner ? 'Você Venceu!' : 'Você Perdeu!';

        // Mensagem personalizada ou padrão
        if (data.message) {
            resultMessage.textContent = data.message;
        } else if (data.suddenDeath) {
            resultMessage.textContent = `${getTeamName(data.winner === 'player1' ? player1TeamData : player2TeamData)} vence na morte súbita!`;
        } else {
            resultMessage.textContent = `${getTeamName(data.winner === 'player1' ? player1TeamData : player2TeamData)} vence a disputa de pênaltis!`;
        }

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
    // Esconde a bola do chute
    ball.classList.add('hidden');

    // Mostra a bola de pênalti quando a bola de chute é ocultada
    penaltyBall.classList.remove('hidden');

    // Retorna o jogador à posição de espera
    player.classList.remove('player-kicking');
    player.classList.add('player-waiting');

    // Coloca o goleiro parado no centro e o mostra (não esconde mais)
    goalkeeper.className = ''; // Remove todas as classes anteriores
    goalkeeper.classList.add('goalkeeper-waiting'); // Adiciona classe de goleiro parado
    goalkeeper.style.left = '50%';
    goalkeeper.style.top = '50%'; // Restaura posição original centralizada
    goalkeeper.classList.remove('hidden');

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

    let modoText = isSuddenDeath ? " (Morte súbita)" : "";

    if (playerRole === currentAttacker) {
        turnInfo.textContent = `Você é o Batedor${modoText}!`;
        actionMessage.textContent = 'Escolha onde chutar e clique em Pronto para confirmar.';
        setGoalSpotsEnabled(true);
    } else {
        turnInfo.textContent = `Você é o Goleiro${modoText}!`;
        actionMessage.textContent = 'Escolha onde defender e clique em Pronto para confirmar.';
        setGoalSpotsEnabled(true);
    }
}

// Evento quando o outro jogador saiu
socket.on('playerLeft', () => {
    alert('O outro jogador desconectou!');
    showScreen('teamSelection');
    roomWaitingMessage.classList.add('hidden');
    roomInput.value = '';
    resetGameState();

    // Reset de variáveis adicionais
    selectedTeam = null;
    isTeamConfirmed = false;
    opponentTeamConfirmed = false;
    opponentSelectedTeam = null;
    player1TeamData = null;
    player2TeamData = null;

    // Reset visual
    teamOptions.forEach(team => {
        team.classList.remove('selected');
        team.style.cursor = 'pointer';
        team.style.opacity = '1';
        // Remove quaisquer indicadores
        const indicators = team.querySelectorAll('.team-selected-indicator, .team-confirmed-indicator');
        indicators.forEach(indicator => indicator.remove());
    });
    confirmTeamBtn.disabled = true;
    confirmTeamBtn.classList.add('disabled');
    confirmTeamBtn.textContent = "Confirmar Time";
    teamConfirmationMessage.classList.add('hidden');
});

// Evento quando a sala está cheia
socket.on('roomFull', () => {
    alert('Esta sala já está cheia!');
    roomWaitingMessage.classList.add('hidden');
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
    // Permitir clicar no goleiro para selecionar o centro
    if (enabled) {
        goalkeeper.style.cursor = 'pointer';
        goalkeeper.addEventListener('click', handleSpotClick);
    } else {
        goalkeeper.style.cursor = 'default';
        goalkeeper.removeEventListener('click', handleSpotClick);
    }
}

// Handler para clique nas áreas do gol
function handleSpotClick(event) {
    // Obtém a posição do elemento clicado através do atributo data-position
    // Se for um clique diretamente no spot, usamos dataset.position, caso contrário verificamos se foi um clique no goleiro
    const position = event.target.dataset.position || (event.target === goalkeeper ? 'center' : null);
    console.log("Área clicada:", position); // Log para ajudar na depuração

    // Verifica se a posição é válida antes de prosseguir
    if (!position) {
        console.error("Clique em posição indefinida");
        return;
    }

    // Não vamos mais destacar visualmente a área selecionada com cor de fundo
    // Removendo o código que alterava o background-color dos spots

    selectedPosition = position;

    if (playerRole === currentAttacker) {
        selectionMessage.textContent = `Chute selecionado: ${getPositionName(position)}`;
    } else {
        selectionMessage.textContent = `Defesa selecionada: ${getPositionName(position)}`;
    }

    // Mostra o botão de confirmar
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
    // Reinicia todas as variáveis de estado do jogo para um novo começo
    resetGameState();

    // Volta para a tela de seleção de sala
    showScreen('teamSelection');
    roomWaitingMessage.classList.add('hidden');
    roomInput.value = '';
    teamSelectionSection.classList.add('hidden');
    teamConfirmationMessage.classList.add('hidden');
    teamOptions.forEach(team => {
        team.classList.remove('selected');
        team.style.cursor = 'pointer';
        team.style.opacity = '1';
        // Remove quaisquer indicadores
        const indicators = team.querySelectorAll('.team-selected-indicator, .team-confirmed-indicator');
        indicators.forEach(indicator => indicator.remove());
    });
    confirmTeamBtn.disabled = true;
    confirmTeamBtn.classList.add('disabled');
    confirmTeamBtn.textContent = "Confirmar Time";

    // Reset de variáveis adicionais
    selectedTeam = null;
    isTeamConfirmed = false;
    opponentTeamConfirmed = false;
    opponentSelectedTeam = null;
    player1TeamData = null;
    player2TeamData = null;
});

// Função para reiniciar completamente o estado do jogo
function resetGameState() {
    // Resetar placar
    player1Score.textContent = '0';
    player2Score.textContent = '0';
    finalPlayer1Score.textContent = '0';
    finalPlayer2Score.textContent = '0';

    // Resetar nomes de time no placar
    player1TeamName.textContent = 'Time 1';
    player2TeamName.textContent = 'Time 2';
    finalPlayer1Team.textContent = 'Time 1';
    finalPlayer2Team.textContent = 'Time 2';

    // Resetar round e turno
    roundCounter.textContent = '1';
    document.querySelector('.round').innerHTML = 'Rodada: <span id="round-counter">1</span>/5';

    // Limpar seleções e estados
    selectedPosition = null;
    isReady = false;
    isSuddenDeath = false;
    currentAttacker = 'player1';
    currentTurn = 1;

    // Reiniciar visuais
    ball.classList.add('hidden');
    goalkeeper.classList.add('hidden');
    penaltyBall.classList.remove('hidden');
    readyButtonContainer.classList.add('hidden');

    // Mensagens padrão
    turnInfo.textContent = 'Aguardando...';
    actionMessage.textContent = 'Clique no gol para escolher onde chutar';

    // Importante: Informar ao servidor que o jogador quer iniciar um novo jogo
    if (roomId) {
        socket.emit('requestNewGame', { roomId });
    }
}

// Botão para voltar à página inicial
returnHomeBtn.addEventListener('click', () => {
    // Reseta todas as variáveis e volta para a primeira tela
    resetGameState();
    showScreen('intro');
    introContainer.style.transform = 'translateX(0)';
    teamSelectionContainer.style.transform = 'translateX(-100%)';
    gameContainer.style.display = 'none';

    // Limpa todos os campos na tela de seleção
    roomInput.value = '';
    roomWaitingMessage.classList.add('hidden');
    teamSelectionSection.classList.add('hidden');
    teamConfirmationMessage.classList.add('hidden');
    teamOptions.forEach(team => {
        team.classList.remove('selected');
        team.style.cursor = 'pointer';
        team.style.opacity = '1';
        // Remove quaisquer indicadores
        const indicators = team.querySelectorAll('.team-selected-indicator, .team-confirmed-indicator');
        indicators.forEach(indicator => indicator.remove());
    });
    confirmTeamBtn.disabled = true;
    confirmTeamBtn.classList.add('disabled');
    confirmTeamBtn.textContent = "Confirmar Time";

    // Reset de variáveis adicionais
    selectedTeam = null;
    isTeamConfirmed = false;
    opponentTeamConfirmed = false;
    opponentSelectedTeam = null;
    player1TeamData = null;
    player2TeamData = null;
});

// Iniciar com a tela intro
showScreen('intro');
gameContainer.style.display = 'none'; // Garante que o gameContainer comece oculto
