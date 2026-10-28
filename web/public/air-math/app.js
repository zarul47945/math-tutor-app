import { createHandCutout } from "./hand-cutout.js?v=1";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const PERSON_SEGMENTATION_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite";
const PERSON_SEGMENTATION_INTERVAL_MS = 125;
const CAMERA_WIDTH = 640;
const CAMERA_HEIGHT = 480;
const VISION_WORKER_URL = new URL("./vision-worker.js", import.meta.url);
const PINCH_START_RATIO = 0.42;
const PINCH_RELEASE_RATIO = 0.58;
const FULL_GAME_URL = new URL("/game", window.location.origin).href;
const ROUND_LENGTH = 10;
const BASE_POINTS = 100;
const MAX_SPEED_BONUS = 100;
const SPEED_BONUS_WINDOW_MS = 10000;
const STREAK_BONUS_STEP = 10;
const STREAK_BONUS_MAX = 50;
const STREAK_FIRE_THRESHOLD = 3;
const WRONG_ANSWER_PENALTY = 20;
const LEADERBOARD_API = "/api/air-math/leaderboard";
const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

const LEVELS = {
  "one-one": {
    title: "Level 1",
    label: "1 digit + 1 digit",
    description: "Build confidence with single-digit addition.",
    operator: "+",
    operationWord: "plus",
    calculate: (first, second) => first + second,
    minAnswer: 2,
    maxAnswer: 18,
    operands: () => ({ first: randomInteger(1, 9), second: randomInteger(1, 9) }),
  },
  "one-two": {
    title: "Level 2",
    label: "1 digit + 2 digit",
    description: "Add a single-digit number to a two-digit number.",
    operator: "+",
    operationWord: "plus",
    calculate: (first, second) => first + second,
    minAnswer: 11,
    maxAnswer: 108,
    operands: () => ({ first: randomInteger(1, 9), second: randomInteger(10, 99) }),
  },
  "two-two": {
    title: "Level 3",
    label: "2 digit + 2 digit",
    description: "Take on two-digit numbers with sums up to 198.",
    operator: "+",
    operationWord: "plus",
    calculate: (first, second) => first + second,
    minAnswer: 20,
    maxAnswer: 198,
    operands: () => ({ first: randomInteger(10, 99), second: randomInteger(10, 99) }),
  },
  "sifir-1-5": {
    title: "Level 4",
    label: "Sifir 1–5",
    description: "Practice multiplication tables 1 through 5.",
    operator: "×",
    operationWord: "times",
    calculate: (first, second) => first * second,
    minAnswer: 1,
    maxAnswer: 60,
    operands: () => ({ first: randomInteger(1, 5), second: randomInteger(1, 12) }),
  },
  "sifir-2-12": {
    title: "Level 5",
    label: "Sifir 2–12",
    description: "Practice multiplication tables 2 through 12.",
    operator: "×",
    operationWord: "times",
    calculate: (first, second) => first * second,
    minAnswer: 2,
    maxAnswer: 144,
    operands: () => ({ first: randomInteger(2, 12), second: randomInteger(1, 12) }),
  },
};

const MODES = {
  static: { description: "Point and pinch one of the fixed answers." },
  underwater: { description: "Only your hand, from wrist to fingertips, appears over the underwater video. Pinch the floating bubbles." },
};

const video = document.querySelector("#camera");
const underwaterBackgroundVideo = document.querySelector("#underwater-background-video");
const underwaterBackgroundMusic = document.querySelector("#underwater-background-music");
const soundSettingsButton = document.querySelector("#sound-settings-toggle");
const soundSettingsPanel = document.querySelector("#sound-settings-panel");
const soundSettingsDoneButton = document.querySelector("#sound-settings-done");
const musicVolumeSlider = document.querySelector("#music-volume");
const effectsVolumeSlider = document.querySelector("#effects-volume");
const musicVolumeOutput = document.querySelector("#music-volume-output");
const effectsVolumeOutput = document.querySelector("#effects-volume-output");
const MUSIC_VOLUME_STORAGE_KEY = "air-math-underwater-music-volume";
const EFFECTS_VOLUME_STORAGE_KEY = "air-math-sound-effects-volume";
let musicVolume = readAudioVolume(MUSIC_VOLUME_STORAGE_KEY, 0.22);
let soundEffectsVolume = readAudioVolume(EFFECTS_VOLUME_STORAGE_KEY, 1);
underwaterBackgroundMusic.volume = musicVolume;
const stage = document.querySelector("#stage");
const stageContent = document.querySelector("#stage-content");
const canvas = document.querySelector("#hand-canvas");
const personCanvas = document.querySelector("#person-canvas");
const cursor = document.querySelector("#cursor");
const problemElement = document.querySelector("#problem");
const answerButtons = [...document.querySelectorAll(".answer")];
const scoreElement = document.querySelector("#score");
const scoreHudElement = document.querySelector("#score-hud");
const scoreGainElement = document.querySelector("#score-gain");
const streakElement = document.querySelector("#streak");
const progressElement = document.querySelector("#round-progress");
const questionTimeElement = document.querySelector("#question-time");
const feedbackElement = document.querySelector("#feedback");
const announcementElement = document.querySelector("#announcement");
const panel = document.querySelector("#panel");
const panelTitle = document.querySelector("#panel-title");
const panelMessage = document.querySelector("#panel-message");
const panelIcon = document.querySelector("#panel-icon");
const panelButton = document.querySelector("#start-camera");
const handDot = document.querySelector("#hand-dot");
const handLabel = document.querySelector("#hand-label");
const newRoundButton = document.querySelector("#new-round");
const stopCameraButton = document.querySelector("#stop-camera");
const fullscreenButton = document.querySelector("#full-screen");
const levelDescription = document.querySelector("#level-description");
const levelButtons = [...document.querySelectorAll("[data-level]")];
const modeDescription = document.querySelector("#mode-description");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const celebration = document.querySelector("#celebration");
const playerNameInput = document.querySelector("#player-name");
const leaderboardList = document.querySelector("#leaderboard-list");
const leaderboardStatus = document.querySelector("#leaderboard-status");
const leaderboardLevelButtons = [...document.querySelectorAll("[data-leaderboard-level]")];

let levelKey = "one-one";
let gameMode = "static";
let mobileLandscapeMode = false;
let selectedLeaderboardLevel = "one-one";
let leaderboardRequestSequence = 0;
let question = makeQuestion(levelKey);
let score = 0;
let streak = 0;
let questionsAnswered = 0;
let correctAnswers = 0;
let roundFinished = false;
let cameraStatus = "idle";
let gamePlaying = false;
let answerLocked = false;
let handLandmarker = null;
let imageSegmenter = null;
let imageSegmenterPromise = null;
let visionFileset = null;
let visionWorker = null;
let workerReady = false;
let workerSegmentationReady = false;
let visionBusy = false;
let lastVideoTime = -1;
let inferenceInterval = 1000 / 30;
let lastPlayerFrameTime = 0;
let stageMetrics = { width: 1, height: 1 };
let answerHitBoxes = [];
let previousHandState = "";
let workerWatchdog = null;
let workerInitCancel = null;
let trackingRecovery = false;
let smoothedHandTime = 20;
let performanceWindowStartedAt = performance.now();
const performanceCounts = { camera: 0, hands: 0, masks: 0, bubbles: 0 };
const performanceMetrics = { cameraFps: 0, handFps: 0, cutoutMaskFps: 0, bubbleFps: 0, worker: false, handDelegate: "", cutoutDelegate: "", inferenceMs: 0, cameraWidth: 0, cameraHeight: 0 };
window.airMathPerformance = performanceMetrics;
let lastSegmentationTime = 0;
let maskCanvas = null;
let maskContext = null;
let maskImageData = null;
let hasPlayerMask = false;
let latestHandCutout = null;
let stream = null;
let animationFrame = null;
let nextQuestionTimer = null;
let bubbleMotionFrame = null;
let bubbleMotionLastTime = 0;
let bubbleMotionActive = false;
let bubblePositions = [];
let feedbackEffectTimer = null;
let pointsEffectTimer = null;
let fireOutTimer = null;
let questionTimerInterval = null;
let questionStartedAt = 0;
let roundResponseTimeMs = 0;
let playerName = "";
let lastInferenceTime = 0;
let pinchClosed = false;
let pinchArmed = true;
let hoverIndex = null;
let cameraSession = 0;
let audioContext = null;
let effectsMasterGain = null;

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function readAudioVolume(key, fallback) {
  try {
    const saved = window.localStorage.getItem(key);
    if (saved === null) return fallback;
    const parsed = Number(saved);
    return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : fallback;
  } catch {
    return fallback;
  }
}

function saveAudioVolume(key, volume) {
  try { window.localStorage.setItem(key, String(volume)); } catch { /* Audio settings still work until this page closes. */ }
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const replacement = randomInteger(0, index);
    [copy[index], copy[replacement]] = [copy[replacement], copy[index]];
  }
  return copy;
}

function makeQuestion(selectedLevel = levelKey) {
  const level = LEVELS[selectedLevel];
  const { first, second } = level.operands();
  const answer = level.calculate(first, second);
  const variation = answer < 25 ? 9 : answer < 100 ? 18 : 30;
  const choices = new Set([answer]);
  let attempts = 0;
  while (choices.size < 3 && attempts < 200) {
    attempts += 1;
    const choice = Math.min(level.maxAnswer, Math.max(level.minAnswer, answer + randomInteger(-variation, variation)));
    if (choice !== answer) choices.add(choice);
  }
  for (let offset = 1; choices.size < 3; offset += 1) {
    if (answer - offset >= level.minAnswer) choices.add(answer - offset);
    if (answer + offset <= level.maxAnswer) choices.add(answer + offset);
  }
  return { first, second, answer, operator: level.operator, operationWord: level.operationWord, options: shuffle([...choices]) };
}

function handDistance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
}

function formatQuestionElapsed(milliseconds) {
  return `${(Math.max(0, milliseconds) / 1000).toFixed(1)}s`;
}

function formatRoundElapsed(milliseconds) {
  const totalSeconds = Math.max(0, milliseconds) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = (totalSeconds - minutes * 60).toFixed(1).padStart(4, "0");
  return minutes ? `${minutes}:${remainder}` : `${remainder}s`;
}

function updateQuestionTimer() {
  if (!gamePlaying || answerLocked || !questionStartedAt) return;
  questionTimeElement.textContent = formatQuestionElapsed(performance.now() - questionStartedAt);
}

function startQuestionTimer() {
  if (questionTimerInterval) window.clearInterval(questionTimerInterval);
  questionStartedAt = performance.now();
  questionTimeElement.textContent = "0.0s";
  questionTimerInterval = window.setInterval(updateQuestionTimer, 100);
}

function stopQuestionTimer() {
  if (questionTimerInterval) window.clearInterval(questionTimerInterval);
  questionTimerInterval = null;
  const elapsed = questionStartedAt ? Math.max(0, performance.now() - questionStartedAt) : 0;
  questionStartedAt = 0;
  questionTimeElement.textContent = formatQuestionElapsed(elapsed);
  return elapsed;
}

function renderLeaderboard(rows) {
  leaderboardList.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("li");
    empty.className = "leaderboard-empty";
    empty.textContent = "No scores yet. Be the first to play a round!";
    leaderboardList.append(empty);
    return;
  }
  rows.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "leaderboard-item";
    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = `${index + 1}`;
    const name = document.createElement("span");
    name.className = "leaderboard-name";
    name.textContent = entry.name;
    const points = document.createElement("span");
    points.className = "leaderboard-score";
    points.textContent = `${entry.score} pts`;
    const meta = document.createElement("span");
    meta.className = "leaderboard-meta";
    const levelName = LEVELS[entry.level]?.title ?? "Air Math";
    meta.textContent = `${levelName} · ${formatRoundElapsed(entry.elapsedMs)} answer time · ${entry.correctAnswers}/10 correct`;
    item.append(rank, name, points, meta);
    leaderboardList.append(item);
  });
}

async function loadLeaderboard(level = selectedLeaderboardLevel) {
  if (!LEVELS[level]) return;
  const requestSequence = ++leaderboardRequestSequence;
  leaderboardStatus.textContent = `Loading ${LEVELS[level].title} leaderboard…`;
  try {
    const response = await fetch(`${LEADERBOARD_API}?level=${encodeURIComponent(level)}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Leaderboard unavailable");
    if (requestSequence !== leaderboardRequestSequence) return;
    const rows = Array.isArray(payload.scores) ? payload.scores : [];
    renderLeaderboard(rows);
    leaderboardStatus.textContent = rows.length ? `Top ${rows.length} scores for ${LEVELS[level].title}.` : `No scores yet for ${LEVELS[level].title}.`;
  } catch {
    if (requestSequence !== leaderboardRequestSequence) return;
    leaderboardList.replaceChildren();
    const unavailable = document.createElement("li");
    unavailable.className = "leaderboard-empty";
    unavailable.textContent = "Leaderboard is temporarily unavailable.";
    leaderboardList.append(unavailable);
    leaderboardStatus.textContent = `${LEVELS[level].title} scores will appear when the connection is back.`;
  }
}

async function submitRoundScore(entry) {
  leaderboardStatus.textContent = "Saving your score to the public leaderboard…";
  try {
    const response = await fetch(LEADERBOARD_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(entry),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Score could not be saved");
    if (entry.level === selectedLeaderboardLevel) {
      await loadLeaderboard(entry.level);
      leaderboardStatus.textContent = `Score saved to the ${LEVELS[entry.level].title} leaderboard.`;
    } else {
      leaderboardStatus.textContent = `Score saved to the ${LEVELS[entry.level].title} leaderboard. Select that level to view it.`;
    }
    if (!gamePlaying && !panel.classList.contains("hide")) panelMessage.textContent += ` Your score has been saved to the ${LEVELS[entry.level].title} leaderboard.`;
  } catch (error) {
    leaderboardStatus.textContent = error instanceof Error ? error.message : "Score could not be saved.";
    if (!gamePlaying && !panel.classList.contains("hide")) panelMessage.textContent += " The leaderboard could not save this score; please check your connection.";
  }
}

function setFeedback(message) {
  feedbackElement.textContent = message;
  announcementElement.textContent = gamePlaying
    ? `Question ${Math.min(questionsAnswered + 1, ROUND_LENGTH)} of ${ROUND_LENGTH}: ${question.first} ${question.operationWord} ${question.second}. Choices are ${question.options.join(", ")}. ${message}`
    : message;
}

function setHandState(found, pinching = false) {
  const state = `${found}:${pinching}`;
  if (state === previousHandState) return;
  previousHandState = state;
  handDot.classList.toggle("found", found);
  handLabel.textContent = found ? (pinching ? "Pinch detected" : "Hand detected") : "Show one hand to the camera";
}

function updateRoundProgress() {
  let visibleQuestion = 0;
  if (gamePlaying) visibleQuestion = Math.min(questionsAnswered + 1, ROUND_LENGTH);
  else if (roundFinished) visibleQuestion = ROUND_LENGTH;
  progressElement.textContent = `${visibleQuestion} / ${ROUND_LENGTH}`;
}

function renderQuestion() {
  problemElement.textContent = `${question.first} ${question.operator} ${question.second}`;
  answerButtons.forEach((button, index) => {
    button.textContent = question.options[index];
    button.setAttribute("aria-label", `Answer ${index + 1}: ${question.options[index]}`);
    button.classList.remove("correct", "wrong", "hover");
    button.disabled = !gamePlaying || answerLocked;
  });
  updateRoundProgress();
  refreshStageMetrics();
}

function renderLevelChoices() {
  levelButtons.forEach((button) => {
    const selected = button.dataset.level === levelKey;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.disabled = gamePlaying || cameraStatus === "starting";
  });
  levelDescription.textContent = `${LEVELS[levelKey].title}: ${LEVELS[levelKey].description}`;
  renderModeChoices();
}

function syncStageAspectRatio() {
  if (gameMode === "underwater") {
    stage.style.aspectRatio = "16 / 9";
  } else if (mobileLandscapeMode) {
    stage.style.aspectRatio = "16 / 9";
  } else if (video.videoWidth && video.videoHeight) {
    stage.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
  } else {
    stage.style.aspectRatio = "";
  }
  refreshStageMetrics();
}

function renderModeChoices() {
  modeButtons.forEach((button) => {
    const selected = button.dataset.mode === gameMode;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.disabled = gamePlaying || cameraStatus === "starting";
  });
  stage.classList.toggle("underwater-mode", gameMode === "underwater");
  if (gameMode === "underwater") {
    if (underwaterBackgroundVideo.paused) void underwaterBackgroundVideo.play().catch(() => {});
  } else {
    underwaterBackgroundVideo.pause();
  }
  if (gameMode !== "underwater") clearBubbleAnimationClasses({ resetPositions: true });
  syncStageAspectRatio();
  if (gameMode === "underwater" && cameraStatus === "ready") {
    void ensurePlayerSegmentation(cameraSession);
  } else {
    stage.classList.remove("segmenter-loading", "segmenter-fallback", "segmenter-ready");
    clearPersonCanvas();
    if (workerReady) visionWorker.postMessage({ type: "mode", underwater: false });
  }
  modeDescription.textContent = `${gameMode === "underwater" ? "Underwater mode" : "Static mode"}: ${MODES[gameMode].description}`;
}

function syncUnderwaterMusic() {
  if (gameMode !== "underwater" || !gamePlaying || document.hidden || musicVolume === 0) {
    underwaterBackgroundMusic.pause();
    return;
  }
  if (underwaterBackgroundMusic.paused) void underwaterBackgroundMusic.play().catch(() => {});
}

function updateSoundSettings() {
  const musicPercent = Math.round(musicVolume * 100);
  const effectsPercent = Math.round(soundEffectsVolume * 100);
  musicVolumeSlider.value = String(musicPercent);
  effectsVolumeSlider.value = String(effectsPercent);
  musicVolumeOutput.textContent = musicPercent === 0 ? "Off" : `${musicPercent}%`;
  effectsVolumeOutput.textContent = effectsPercent === 0 ? "Off" : `${effectsPercent}%`;
  musicVolumeSlider.setAttribute("aria-valuetext", musicPercent === 0 ? "Off" : `${musicPercent}%`);
  effectsVolumeSlider.setAttribute("aria-valuetext", effectsPercent === 0 ? "Off" : `${effectsPercent}%`);
  underwaterBackgroundMusic.volume = musicVolume;
  if (effectsMasterGain && audioContext) {
    effectsMasterGain.gain.setTargetAtTime(soundEffectsVolume, audioContext.currentTime, 0.015);
  }
}

function setSoundSettingsOpen(open) {
  soundSettingsPanel.hidden = !open;
  soundSettingsButton.setAttribute("aria-expanded", String(open));
}

function setAudioVolume(kind, percent) {
  const volume = Math.min(1, Math.max(0, Number(percent) / 100));
  if (kind === "music") {
    musicVolume = volume;
    saveAudioVolume(MUSIC_VOLUME_STORAGE_KEY, volume);
  } else {
    soundEffectsVolume = volume;
    saveAudioVolume(EFFECTS_VOLUME_STORAGE_KEY, volume);
  }
  updateSoundSettings();
  if (kind === "music") syncUnderwaterMusic();
}

function openPanel({ icon = "⌁", title, message, button, action, disabled = false }) {
  panelIcon.textContent = icon;
  panelTitle.textContent = title;
  panelMessage.textContent = message;
  panelButton.textContent = button;
  panelButton.disabled = disabled;
  panelButton.onclick = action;
  panel.classList.remove("hide");
}

function closePanel() {
  panel.classList.add("hide");
}

function clearFeedbackEffects() {
  if (feedbackEffectTimer) window.clearTimeout(feedbackEffectTimer);
  feedbackEffectTimer = null;
  stage.classList.remove("correct-flash", "wrong-shake");
  celebration.replaceChildren();
}

function clearPointEffects() {
  if (pointsEffectTimer) window.clearTimeout(pointsEffectTimer);
  if (fireOutTimer) window.clearTimeout(fireOutTimer);
  pointsEffectTimer = null;
  fireOutTimer = null;
  scoreHudElement.classList.remove("streak-fire", "fire-out");
  scoreGainElement.classList.remove("gain-pop");
  scoreGainElement.textContent = "";
}

function animatePoints(points) {
  if (pointsEffectTimer) window.clearTimeout(pointsEffectTimer);
  scoreGainElement.classList.remove("gain-pop");
  scoreGainElement.textContent = `+${points}`;
  void scoreGainElement.offsetWidth;
  scoreGainElement.classList.add("gain-pop");
  pointsEffectTimer = window.setTimeout(() => {
    scoreGainElement.classList.remove("gain-pop");
    scoreGainElement.textContent = "";
    pointsEffectTimer = null;
  }, 1000);
}

function extinguishStreakFire() {
  if (pointsEffectTimer) window.clearTimeout(pointsEffectTimer);
  pointsEffectTimer = null;
  scoreGainElement.classList.remove("gain-pop");
  scoreGainElement.textContent = "";
  if (!scoreHudElement.classList.contains("streak-fire")) return;
  scoreHudElement.classList.remove("streak-fire");
  scoreHudElement.classList.add("fire-out");
  if (fireOutTimer) window.clearTimeout(fireOutTimer);
  fireOutTimer = window.setTimeout(() => {
    scoreHudElement.classList.remove("fire-out");
    fireOutTimer = null;
  }, 600);
}

function resetRound(message) {
  stopQuestionTimer();
  questionTimeElement.textContent = "0.0s";
  gamePlaying = false;
  syncUnderwaterMusic();
  answerLocked = false;
  roundFinished = false;
  questionsAnswered = 0;
  correctAnswers = 0;
  roundResponseTimeMs = 0;
  pinchArmed = false;
  if (nextQuestionTimer) window.clearTimeout(nextQuestionTimer);
  nextQuestionTimer = null;
  clearBubbleAnimationClasses({ resetPositions: true });
  clearFeedbackEffects();
  clearPointEffects();
  answerButtons.forEach((button) => { button.disabled = true; button.classList.remove("correct", "wrong", "hover"); });
  updateRoundProgress();
  renderLevelChoices();
  setFeedback(message);
}

function startRound() {
  if (cameraStatus !== "ready") return;
  const enteredName = playerNameInput.value.normalize("NFC").trim();
  if (!enteredName || Array.from(enteredName).length > 18 || /[\u0000-\u001f\u007f]/u.test(enteredName)) {
    feedbackElement.textContent = "Enter a nickname of 1–18 characters to join the leaderboard.";
    panelMessage.textContent = "Enter a nickname in the player name box, then start your round.";
    playerNameInput.focus();
    return;
  }
  playerName = enteredName;
  try { window.localStorage.setItem("air-math-player-name", playerName); } catch { /* Name entry still works if storage is disabled. */ }
  if (nextQuestionTimer) window.clearTimeout(nextQuestionTimer);
  clearFeedbackEffects();
  clearPointEffects();
  score = 0;
  streak = 0;
  questionsAnswered = 0;
  correctAnswers = 0;
  roundResponseTimeMs = 0;
  roundFinished = false;
  question = makeQuestion(levelKey);
  gamePlaying = true;
  answerLocked = false;
  pinchArmed = false;
  scoreElement.textContent = score;
  streakElement.textContent = streak;
  renderLevelChoices();
  renderQuestion();
  spawnUnderwaterBubbles();
  startQuestionTimer();
  unlockAudio();
  syncUnderwaterMusic();
  setFeedback(`Question 1 of ${ROUND_LENGTH}. Point at an answer, then pinch your thumb and index finger together.`);
  closePanel();
}

function unlockAudio() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioContext) audioContext = new AudioContextClass();
    if (!effectsMasterGain) {
      effectsMasterGain = audioContext.createGain();
      effectsMasterGain.gain.value = soundEffectsVolume;
      effectsMasterGain.connect(audioContext.destination);
    }
    if (audioContext.state === "suspended") audioContext.resume();
  } catch {
    // Sound is an enhancement; the game still works when Web Audio is unavailable.
  }
}

function playTone(frequency, duration, { type = "sine", volume = 0.08, endFrequency = frequency, delay = 0 } = {}) {
  if (!audioContext || audioContext.state !== "running" || soundEffectsVolume === 0) return;
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(effectsMasterGain || audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playAnswerSound(correct) {
  unlockAudio();
  if (correct) {
    playTone(523, 0.19, { type: "sine", volume: 0.08 });
    playTone(659, 0.24, { type: "triangle", volume: 0.07, delay: 0.12 });
  } else {
    playTone(220, 0.24, { type: "triangle", volume: 0.09, endFrequency: 145 });
    playTone(165, 0.2, { type: "sawtooth", volume: 0.035, endFrequency: 110, delay: 0.1 });
  }
}

function playBubblePopSound() {
  if (!audioContext || audioContext.state !== "running") return;
  [0, 0.075, 0.15].forEach((delay, index) => {
    playTone(650 - index * 65, 0.1, { type: "sine", volume: 0.045, endFrequency: 170, delay });
  });
}

function clearBubbleAnimationClasses({ resetPositions = false } = {}) {
  if (bubbleMotionFrame) window.cancelAnimationFrame(bubbleMotionFrame);
  bubbleMotionFrame = null;
  bubbleMotionLastTime = 0;
  bubbleMotionActive = false;
  bubblePositions = [];
  stage.classList.remove("bubbles-popping");
  if (resetPositions) {
    answerButtons.forEach((button) => {
      button.style.removeProperty("left");
      button.style.removeProperty("top");
      button.style.removeProperty("opacity");
      button.style.removeProperty("--bubble-size");
      button.style.removeProperty("--bubble-x");
      button.style.removeProperty("--bubble-y");
      button.classList.remove("motion-active");
    });
  }
}

function popUnderwaterBubbles() {
  if (gameMode !== "underwater") return;
  clearBubbleAnimationClasses();
  void stage.offsetWidth;
  stage.classList.add("bubbles-popping");
  playBubblePopSound();
}

function spawnUnderwaterBubbles() {
  if (gameMode !== "underwater") return;
  clearBubbleAnimationClasses({ resetPositions: true });
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reducedMotion) { refreshStageMetrics(); return; }

  refreshStageMetrics();
  const { width, height } = stageMetrics;
  if (!width || !height) return;

  answerButtons.forEach((button) => button.style.removeProperty("--bubble-size"));
  const gap = 8;
  const maxDiameter = Math.max(1, (width - 16 - gap * (answerButtons.length - 1)) / answerButtons.length);
  const now = performance.now();
  const margin = 8;
  bubblePositions = answerButtons.map((button, index) => {
    const preferredDiameter = button.getBoundingClientRect().width;
    const diameter = Math.min(preferredDiameter, maxDiameter);
    const radius = diameter / 2;
    button.style.setProperty("--bubble-size", `${diameter}px`);
    const minX = radius + margin;
    const maxX = width - radius - margin;
    const x = answerButtons.length === 1
      ? width / 2
      : minX + (maxX - minX) * index / (answerButtons.length - 1);
    const bubble = {
      x,
      y: height + radius + 10,
      vx: randomInteger(-42, 42),
      vy: -randomInteger(125, 165),
      radius,
      preferredDiameter,
      startedAt: now + index * 120,
      entered: false,
      phase: Math.random() * Math.PI * 2,
      nextSteerAt: now + randomInteger(500, 950),
    };
    button.classList.add("motion-active");
    button.style.setProperty("--bubble-x", `${x}px`);
    button.style.setProperty("--bubble-y", `${bubble.y}px`);
    button.style.opacity = "0";
    return bubble;
  });

  bubbleMotionActive = true;
  bubbleMotionLastTime = now;
  bubbleMotionFrame = window.requestAnimationFrame(updateBubbleMotion);
}

function constrainBubbleToStage(bubble, width, height) {
  if (bubble.x < bubble.radius) {
    bubble.x = bubble.radius;
    bubble.vx = Math.abs(bubble.vx);
  } else if (bubble.x > width - bubble.radius) {
    bubble.x = width - bubble.radius;
    bubble.vx = -Math.abs(bubble.vx);
  }
  if (bubble.entered && bubble.y < bubble.radius) {
    bubble.y = bubble.radius;
    bubble.vy = Math.abs(bubble.vy);
  } else if (bubble.entered && bubble.y > height - bubble.radius) {
    bubble.y = height - bubble.radius;
    bubble.vy = -Math.abs(bubble.vy);
  }
}

function bounceOverlappingBubbles(first, second) {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const minimumDistance = first.radius + second.radius + 4;
  const distance = Math.hypot(dx, dy);
  if (distance >= minimumDistance) return;

  const angle = distance > 0.001 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2;
  const nx = Math.cos(angle);
  const ny = Math.sin(angle);
  const separation = (minimumDistance - distance) / 2;
  first.x -= nx * separation;
  first.y -= ny * separation;
  second.x += nx * separation;
  second.y += ny * separation;

  const closingSpeed = (second.vx - first.vx) * nx + (second.vy - first.vy) * ny;
  if (closingSpeed < 0) {
    const impulse = -(1 + 0.82) * closingSpeed / 2;
    first.vx -= impulse * nx;
    first.vy -= impulse * ny;
    second.vx += impulse * nx;
    second.vy += impulse * ny;
  }
}

function updateBubbleMotion(timestamp) {
  if (!bubbleMotionActive || gameMode !== "underwater" || !gamePlaying) {
    bubbleMotionFrame = null;
    return;
  }
  const { width, height } = stageMetrics;
  if (!width || !height) {
    bubbleMotionFrame = window.requestAnimationFrame(updateBubbleMotion);
    return;
  }

  const delta = Math.min(0.04, Math.max(0, (timestamp - bubbleMotionLastTime) / 1000));
  bubbleMotionLastTime = timestamp;
  bubblePositions.forEach((bubble, index) => {
    const maxDiameter = Math.max(1, (width - 16 - 8 * (bubblePositions.length - 1)) / bubblePositions.length);
    const diameter = Math.min(bubble.preferredDiameter, maxDiameter);
    if (Math.abs(diameter - bubble.radius * 2) > 1) {
      bubble.radius = diameter / 2;
      answerButtons[index].style.setProperty("--bubble-size", `${diameter}px`);
    }
    if (timestamp < bubble.startedAt) return;
    if (bubble.entered && timestamp >= bubble.nextSteerAt) {
      bubble.vx = Math.max(-92, Math.min(92, bubble.vx + randomInteger(-48, 48)));
      bubble.vy = Math.max(-155, Math.min(55, bubble.vy + randomInteger(-24, 24)));
      bubble.nextSteerAt = timestamp + randomInteger(650, 1250);
    }
    if (bubble.entered) {
      bubble.vx += Math.sin(timestamp * 0.0012 + bubble.phase) * 14 * delta;
      bubble.vy = Math.max(-165, bubble.vy - 7 * delta);
    }
    bubble.x += bubble.vx * delta;
    bubble.y += bubble.vy * delta;
    if (!bubble.entered && bubble.y <= height - bubble.radius) {
      bubble.entered = true;
      bubble.y = height - bubble.radius;
    }
    constrainBubbleToStage(bubble, width, height);
  });

  for (let pass = 0; pass < 3; pass += 1) {
    for (let firstIndex = 0; firstIndex < bubblePositions.length; firstIndex += 1) {
      const first = bubblePositions[firstIndex];
      if (timestamp < first.startedAt) continue;
      for (let secondIndex = firstIndex + 1; secondIndex < bubblePositions.length; secondIndex += 1) {
        const second = bubblePositions[secondIndex];
        if (timestamp < second.startedAt) continue;
        bounceOverlappingBubbles(first, second);
      }
      constrainBubbleToStage(first, width, height);
    }
  }

  bubblePositions.forEach((bubble, index) => {
    const visibleProgress = (height + bubble.radius - bubble.y) / Math.max(1, bubble.radius * 1.35);
    answerButtons[index].style.setProperty("--bubble-x", `${bubble.x.toFixed(2)}px`);
    answerButtons[index].style.setProperty("--bubble-y", `${bubble.y.toFixed(2)}px`);
    answerButtons[index].style.opacity = `${Math.max(0, Math.min(1, visibleProgress))}`;
  });
  performanceCounts.bubbles += 1;
  bubbleMotionFrame = window.requestAnimationFrame(updateBubbleMotion);
}

function animateAnswer(correct) {
  clearFeedbackEffects();
  stage.classList.add(correct ? "correct-flash" : "wrong-shake");
  if (correct) {
    const colors = ["#67e8f9", "#fde047", "#86efac", "#c4b5fd", "#fb7185"];
    for (let index = 0; index < 24; index += 1) {
      const piece = document.createElement("i");
      piece.className = "confetti-piece";
      piece.style.setProperty("--x", `${randomInteger(8, 92)}%`);
      piece.style.setProperty("--drift", `${randomInteger(-110, 110)}px`);
      piece.style.setProperty("--color", colors[index % colors.length]);
      piece.style.animationDelay = `${randomInteger(0, 100)}ms`;
      celebration.append(piece);
    }
  }
  feedbackEffectTimer = window.setTimeout(clearFeedbackEffects, 1050);
}

function finishRound() {
  gamePlaying = false;
  syncUnderwaterMusic();
  answerLocked = true;
  roundFinished = true;
  pinchArmed = false;
  answerButtons.forEach((button) => { button.disabled = true; button.classList.remove("hover"); });
  renderLevelChoices();
  updateRoundProgress();
  newRoundButton.hidden = false;
  const completedScore = score;
  const completedCorrectAnswers = correctAnswers;
  const completedResponseTimeMs = Math.round(roundResponseTimeMs);
  const completedName = playerName;
  const completedLevel = levelKey;
  setFeedback(`Round complete! ${completedCorrectAnswers} of ${ROUND_LENGTH} correct in ${formatRoundElapsed(completedResponseTimeMs)} answer time.`);
  openPanel({
    icon: completedCorrectAnswers >= 8 ? "🏆" : "✨",
    title: "Round complete!",
    message: `You scored ${completedScore} points with ${completedCorrectAnswers} of ${ROUND_LENGTH} correct. Your answer time was ${formatRoundElapsed(completedResponseTimeMs)}. Choose a level to try again or replay this level.`,
    button: "Play this level again",
    action: startRound,
  });
  void submitRoundScore({
    name: completedName,
    score: completedScore,
    elapsedMs: completedResponseTimeMs,
    correctAnswers: completedCorrectAnswers,
    level: completedLevel,
  });
}

function selectAnswer(index) {
  if (!gamePlaying || answerLocked || !Number.isInteger(index) || !soundSettingsPanel.hidden) return;
  const selected = question.options[index];
  if (selected === undefined) return;
  const responseTimeMs = stopQuestionTimer();
  roundResponseTimeMs += responseTimeMs;
  answerLocked = true;
  pinchArmed = false;
  const correct = selected === question.answer;
  questionsAnswered += 1;
  answerButtons.forEach((button) => { button.disabled = true; });
  answerButtons[index].classList.add(correct ? "correct" : "wrong");
  animateAnswer(correct);
  playAnswerSound(correct);
  popUnderwaterBubbles();

  if (correct) {
    correctAnswers += 1;
    streak += 1;
    const speedBonus = Math.max(0, MAX_SPEED_BONUS - Math.floor(responseTimeMs / (SPEED_BONUS_WINDOW_MS / MAX_SPEED_BONUS)));
    const streakBonus = Math.min(streak * STREAK_BONUS_STEP, STREAK_BONUS_MAX);
    const points = BASE_POINTS + speedBonus + streakBonus;
    score += points;
    scoreElement.textContent = score;
    streakElement.textContent = streak;
    if (streak >= STREAK_FIRE_THRESHOLD) {
      if (streak === STREAK_FIRE_THRESHOLD) scoreHudElement.classList.add("streak-fire");
      animatePoints(points);
    }
    setFeedback(`Correct! +${points} points (${speedBonus} speed, ${streakBonus} streak).${streak > 1 ? ` ${streak} in a row!` : ""}`);
  } else {
    extinguishStreakFire();
    streak = 0;
    score = Math.max(0, score - WRONG_ANSWER_PENALTY);
    scoreElement.textContent = score;
    streakElement.textContent = streak;
    setFeedback(`Not quite — ${question.first} ${question.operator} ${question.second} = ${question.answer}. -${WRONG_ANSWER_PENALTY} points; streak reset.`);
  }

  const delay = correct ? 900 : 1250;
  nextQuestionTimer = window.setTimeout(() => {
    nextQuestionTimer = null;
    if (!gamePlaying) return;
    if (questionsAnswered >= ROUND_LENGTH) {
      finishRound();
      return;
    }
    question = makeQuestion(levelKey);
    answerLocked = false;
    pinchArmed = false;
    renderQuestion();
    spawnUnderwaterBubbles();
    startQuestionTimer();
    setFeedback(`Question ${questionsAnswered + 1} of ${ROUND_LENGTH}. Point at an answer, then pinch to choose it.`);
  }, delay);
}

function clearPersonCanvas() {
  hasPlayerMask = false;
  latestHandCutout = null;
  clearHandVideo();
}

function clearHandVideo() {
  const context = personCanvas.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, personCanvas.width, personCanvas.height);
}

function refreshStageMetrics() {
  stageMetrics = { width: Math.max(1, stageContent.clientWidth), height: Math.max(1, stageContent.clientHeight) };
  answerHitBoxes = answerButtons.map((button) => {
    const left = button.offsetLeft;
    const top = button.offsetTop;
    return { left, top, right: left + button.offsetWidth, bottom: top + button.offsetHeight };
  });
}

function answerAtPoint(x, y) {
  if (!gamePlaying || answerLocked || !soundSettingsPanel.hidden) return null;
  if (gameMode === "underwater" && bubbleMotionActive) {
    const now = performance.now();
    const index = bubblePositions.findIndex((bubble) => now >= bubble.startedAt && Math.hypot(x - bubble.x, y - bubble.y) <= bubble.radius);
    return index >= 0 ? index : null;
  }
  const index = answerHitBoxes.findIndex((rect) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
  return index >= 0 ? index : null;
}

function renderPlayerFrame(now) {
  if (gameMode !== "underwater" || !video.videoWidth || now - lastPlayerFrameTime < 1000 / 32) return;
  lastPlayerFrameTime = now;
  const bounds = stageMetrics;
  // Fullscreen CSS can scale this native-sized layer without allocating a 4K canvas.
  const scale = Math.min(1, 960 / bounds.width, 720 / bounds.height);
  const width = Math.max(1, Math.round(bounds.width * scale));
  const height = Math.max(1, Math.round(bounds.height * scale));
  if (personCanvas.width !== width || personCanvas.height !== height) {
    personCanvas.width = width;
    personCanvas.height = height;
  }
  const context = personCanvas.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  // Never leave a frozen hand (or reveal the full camera) when tracking is lost.
  if (!latestHandCutout || now - latestHandCutout.updatedAt > 220) return;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  const cameraBounds = cameraCoverBounds(bounds);
  context.save();
  context.translate(bounds.width, 0);
  context.scale(-1, 1);
  context.translate(cameraBounds.x, cameraBounds.y);
  context.scale(cameraBounds.width / video.videoWidth, cameraBounds.height / video.videoHeight);
  context.clip(latestHandCutout.wristClip);
  context.clip(latestHandCutout.silhouette);
  context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
  if (hasPlayerMask) {
    context.globalCompositeOperation = "destination-in";
    context.drawImage(maskCanvas, 0, 0, video.videoWidth, video.videoHeight);
  }
  context.restore();
}

function receivePlayerMask(bitmap) {
  try {
    if (gameMode !== "underwater") return;
    if (!maskCanvas) maskCanvas = document.createElement("canvas");
    if (maskCanvas.width !== bitmap.width || maskCanvas.height !== bitmap.height) {
      maskCanvas.width = bitmap.width;
      maskCanvas.height = bitmap.height;
      maskImageData = null;
    }
    maskContext = maskCanvas.getContext("2d");
    maskContext.clearRect(0, 0, bitmap.width, bitmap.height);
    maskContext.drawImage(bitmap, 0, 0);
    hasPlayerMask = true;
    performanceCounts.masks += 1;
  } finally { bitmap.close(); }
}

function cameraCoverBounds(bounds) {
  const sourceWidth = video.videoWidth || bounds.width;
  const sourceHeight = video.videoHeight || bounds.height;
  const scale = Math.max(bounds.width / sourceWidth, bounds.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (bounds.width - width) / 2, y: (bounds.height - height) / 2, width, height };
}

function drawSegmentedPlayer(result) {
  const mask = result.confidenceMasks?.[0];
  if (!mask || !video.videoWidth || !video.videoHeight) throw new Error("The player mask is unavailable.");

  const maskWidth = mask.width;
  const maskHeight = mask.height;
  if (!maskCanvas || maskCanvas.width !== maskWidth || maskCanvas.height !== maskHeight) {
    maskCanvas = document.createElement("canvas");
    maskCanvas.width = maskWidth;
    maskCanvas.height = maskHeight;
    maskContext = maskCanvas.getContext("2d");
    maskImageData = null;
  }
  if (!maskImageData) {
    maskImageData = maskContext.createImageData(maskWidth, maskHeight);
    for (let index = 0; index < maskImageData.data.length; index += 4) {
      maskImageData.data[index] = 255;
      maskImageData.data[index + 1] = 255;
      maskImageData.data[index + 2] = 255;
    }
  }

  const probabilities = mask.getAsFloat32Array();
  for (let index = 0; index < probabilities.length; index++) {
    const amount = Math.max(0, Math.min(1, (probabilities[index] - .18) / .62));
    const smoothAmount = amount * amount * (3 - 2 * amount);
    maskImageData.data[index * 4 + 3] = Math.round(smoothAmount * 255);
  }
  maskContext.putImageData(maskImageData, 0, 0);
  hasPlayerMask = true;
  performanceCounts.masks += 1;
}

async function ensurePlayerSegmentation(session) {
  if (gameMode !== "underwater" || cameraStatus !== "ready") return null;
  if (workerReady) {
    stage.classList.remove("segmenter-fallback");
    stage.classList.add(workerSegmentationReady ? "segmenter-ready" : "segmenter-loading");
    visionWorker.postMessage({ type: "mode", underwater: true });
    return null;
  }
  if (!visionFileset) return null;
  if (imageSegmenter) {
    stage.classList.remove("segmenter-loading", "segmenter-fallback");
    stage.classList.add("segmenter-ready");
    return imageSegmenter;
  }
  if (imageSegmenterPromise) return imageSegmenterPromise;

  stage.classList.remove("segmenter-fallback", "segmenter-ready");
  stage.classList.add("segmenter-loading");
  let pending;
  pending = (async () => {
    let segmenter;
    try {
      const { ImageSegmenter } = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/vision_bundle.mjs");
      const options = {
        baseOptions: { modelAssetPath: PERSON_SEGMENTATION_MODEL_URL, delegate: preferredMainDelegate() },
        runningMode: "VIDEO",
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      };
      try {
        segmenter = await ImageSegmenter.createFromOptions(visionFileset, options);
        performanceMetrics.cutoutDelegate = options.baseOptions.delegate;
      } catch {
        segmenter = await ImageSegmenter.createFromOptions(visionFileset, { ...options, baseOptions: { ...options.baseOptions, delegate: "CPU" } });
        performanceMetrics.cutoutDelegate = "CPU";
      }
      if (session !== cameraSession || !stream) {
        segmenter.close();
        return null;
      }
      imageSegmenter = segmenter;
      if (gameMode === "underwater") {
        stage.classList.remove("segmenter-loading", "segmenter-fallback");
        stage.classList.add("segmenter-ready");
      }
      return imageSegmenter;
    } catch {
      segmenter?.close();
      if (session === cameraSession && gameMode === "underwater") {
        stage.classList.remove("segmenter-loading", "segmenter-ready");
        stage.classList.add("segmenter-fallback");
        setFeedback("Show one hand to the camera. Only your hand is displayed; pinch controls still work.");
      }
      return null;
    } finally {
      if (imageSegmenterPromise === pending) imageSegmenterPromise = null;
    }
  })();
  imageSegmenterPromise = pending;
  return pending;
}

function disablePlayerSegmentation(session) {
  if (session !== cameraSession) return;
  imageSegmenter?.close();
  imageSegmenter = null;
  workerSegmentationReady = false;
  clearPersonCanvas();
  stage.classList.remove("segmenter-loading", "segmenter-ready");
  if (gameMode === "underwater") {
    stage.classList.add("segmenter-fallback");
    setFeedback("Show one hand to the camera. Only your hand is displayed; pinch controls still work.");
  }
}

function clearHandOverlay() {
  latestHandCutout = null;
  hasPlayerMask = false;
  clearHandVideo();
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  cursor.style.opacity = "0";
  cursor.classList.remove("pinch");
  answerButtons.forEach((button) => button.classList.remove("hover"));
  hoverIndex = null;
  pinchClosed = false;
  setHandState(false);
}

function drawHand(landmarks) {
  if (gameMode === "underwater") {
    const cutout = createHandCutout(landmarks, video.videoWidth, video.videoHeight);
    latestHandCutout = cutout ? { ...cutout, updatedAt: performance.now() } : null;
    if (!cutout) clearHandVideo();
  }
  const bounds = stageMetrics;
  const ratio = Math.min(1, 1280 / bounds.width, 960 / bounds.height);
  const width = Math.max(1, Math.round(bounds.width * ratio));
  const height = Math.max(1, Math.round(bounds.height * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);
  const cameraBounds = cameraCoverBounds(bounds);
  const point = (landmark) => ({
    x: bounds.width - (landmark.x * cameraBounds.width + cameraBounds.x),
    y: landmark.y * cameraBounds.height + cameraBounds.y,
  });
  context.lineWidth = 3;
  context.lineCap = "round";
  context.strokeStyle = "rgba(103,232,249,.9)";
  context.beginPath();
  HAND_CONNECTIONS.forEach(([startIndex, endIndex]) => {
    const start = landmarks[startIndex]; const end = landmarks[endIndex];
    if (!start || !end) return;
    const a = point(start); const b = point(end);
    context.moveTo(a.x, a.y); context.lineTo(b.x, b.y);
  });
  context.stroke();
  context.fillStyle = "#f8fafc";
  context.beginPath();
  landmarks.forEach((landmark, index) => {
    const mark = point(landmark);
    const radius = index === 4 || index === 8 ? 5 : 3;
    context.moveTo(mark.x + radius, mark.y); context.arc(mark.x, mark.y, radius, 0, Math.PI * 2);
  });
  context.fill();

  const indexTip = landmarks[8];
  const thumbTip = landmarks[4];
  if (!indexTip || !thumbTip) return;
  const indexPoint = point(indexTip);
  const nextHover = answerAtPoint(indexPoint.x, indexPoint.y);
  cursor.style.transform = `translate3d(${indexPoint.x}px, ${indexPoint.y}px, 0) translate(-50%, -50%)`;
  cursor.style.opacity = "1";
  if (hoverIndex !== nextHover) {
    answerButtons.forEach((button, answerIndex) => button.classList.toggle("hover", answerIndex === nextHover));
    hoverIndex = nextHover;
  }
  const handSize = landmarks[0] && landmarks[9] ? handDistance(landmarks[0], landmarks[9]) : 0;
  const pinchRatio = handDistance(indexTip, thumbTip) / Math.max(handSize, .001);
  const pinching = pinchRatio < (pinchClosed ? PINCH_RELEASE_RATIO : PINCH_START_RATIO);
  cursor.classList.toggle("pinch", pinching);
  setHandState(true, pinching);
  if (!pinching) pinchArmed = true;
  if (pinching && !pinchClosed && pinchArmed && nextHover !== null && gamePlaying) selectAnswer(nextHover);
  pinchClosed = pinching;
}

function stopVisionWorker() {
  workerInitCancel?.();
  workerInitCancel = null;
  if (workerWatchdog) window.clearTimeout(workerWatchdog);
  workerWatchdog = null;
  visionWorker?.terminate();
  visionWorker = null;
  workerReady = false;
  workerSegmentationReady = false;
  visionBusy = false;
}

function preferredMainDelegate() {
  try {
    const probe = document.createElement("canvas").getContext("webgl2");
    if (!probe) return "CPU";
    const info = probe.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(probe.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : probe.RENDERER));
    probe.getExtension("WEBGL_lose_context")?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(renderer) ? "CPU" : "GPU";
  } catch { return "CPU"; }
}

async function startMainThreadTracking(session) {
  const { FilesetResolver, HandLandmarker } = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/vision_bundle.mjs");
  const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
  let delegate = preferredMainDelegate();
  const options = { baseOptions: { modelAssetPath: MODEL_URL, delegate }, runningMode: "VIDEO", numHands: 1, minHandDetectionConfidence: .6, minHandPresenceConfidence: .6, minTrackingConfidence: .6 };
  let tracker;
  try { tracker = await HandLandmarker.createFromOptions(fileset, options); }
  catch (error) {
    if (delegate === "CPU") throw error;
    delegate = "CPU";
    tracker = await HandLandmarker.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: "CPU" } });
  }
  if (session !== cameraSession || !stream) { tracker.close(); return; }
  visionFileset = fileset;
  handLandmarker = tracker;
  inferenceInterval = 1000 / 15;
  performanceMetrics.worker = false;
  performanceMetrics.handDelegate = delegate;
}

async function recoverTracking(session) {
  if (session !== cameraSession || trackingRecovery) return;
  stopVisionWorker();
  trackingRecovery = true;
  clearHandOverlay();
  clearPersonCanvas();
  try {
    await startMainThreadTracking(session);
    if (session === cameraSession && gameMode === "underwater") await ensurePlayerSegmentation(session);
  } catch (error) {
    if (session !== cameraSession) return;
    cleanUpCamera(); resetRound("Hand tracking stopped. Start the camera again to continue."); cameraStatus = "error";
    openPanel({ icon: "!", title: "Hand tracking stopped", message: cameraError(error), button: "Try again", action: startCamera });
  } finally { if (session === cameraSession) trackingRecovery = false; }
}

function startVisionWorker(session) {
  return new Promise((resolve, reject) => {
    if (!window.Worker || !window.createImageBitmap || !window.OffscreenCanvas) { reject(new Error("Use compatible camera processing")); return; }
    const worker = new Worker(VISION_WORKER_URL);
    visionWorker = worker;
    let settled = false;
    const timeout = window.setTimeout(() => fail(new Error("Camera processing startup timed out")), 20000);
    function fail(error) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      workerInitCancel = null;
      reject(error);
    }
    workerInitCancel = () => fail(new Error("Camera session changed"));
    worker.onerror = (event) => {
      event.preventDefault();
      if (!settled) fail(new Error(event.message || "Camera processing unavailable"));
      else if (session === cameraSession && worker === visionWorker) void recoverTracking(session);
    };
    worker.onmessage = ({ data }) => {
      if (session !== cameraSession || worker !== visionWorker) { data.mask?.close(); return; }
      if (data.type === "ready") {
        settled = true;
        window.clearTimeout(timeout);
        workerInitCancel = null;
        workerReady = true;
        performanceMetrics.worker = true;
        performanceMetrics.handDelegate = data.delegate;
        resolve();
      } else if (data.type === "init-error") {
        fail(new Error(data.message));
      } else if (data.type === "hand-result") {
        performanceCounts.hands += 1;
        smoothedHandTime = smoothedHandTime * .8 + data.handMs * .2;
        inferenceInterval = Math.max(1000 / 30, Math.min(100, smoothedHandTime * 1.15));
        performanceMetrics.handDelegate = data.delegate;
        if (data.landmarks) drawHand(data.landmarks); else clearHandOverlay();
      } else if (data.type === "result") {
        window.clearTimeout(workerWatchdog);
        workerWatchdog = null;
        visionBusy = false;
        performanceMetrics.inferenceMs = Math.round(data.duration);
        if (data.mask) receivePlayerMask(data.mask);
      } else if (data.type === "segmentation-ready") {
        workerSegmentationReady = true;
        performanceMetrics.cutoutDelegate = data.delegate;
        if (gameMode === "underwater") {
          stage.classList.remove("segmenter-loading", "segmenter-fallback");
          stage.classList.add("segmenter-ready");
        }
      } else if (data.type === "segmentation-error") {
        disablePlayerSegmentation(session);
      } else if (data.type === "tracking-error") {
        void recoverTracking(session);
      }
    };
    worker.postMessage({ type: "init", wasmRoot: WASM_ROOT, modelUrl: MODEL_URL, segmentationModelUrl: PERSON_SEGMENTATION_MODEL_URL });
  });
}

async function sendCameraFrame(session, now) {
  const worker = visionWorker;
  visionBusy = true;
  let bitmap;
  try {
    const scale = Math.min(1, CAMERA_WIDTH / video.videoWidth, CAMERA_HEIGHT / video.videoHeight);
    try {
      bitmap = await createImageBitmap(video, { resizeWidth: Math.max(1, Math.round(video.videoWidth * scale)), resizeHeight: Math.max(1, Math.round(video.videoHeight * scale)), resizeQuality: "low" });
    } catch { bitmap = await createImageBitmap(video); }
    if (session !== cameraSession || worker !== visionWorker) { bitmap.close(); return; }
    worker.postMessage({ type: "frame", frame: bitmap, timestamp: now }, [bitmap]);
    workerWatchdog = window.setTimeout(() => { void recoverTracking(session); }, 10000);
  } catch {
    bitmap?.close();
    if (session === cameraSession && worker === visionWorker) void recoverTracking(session);
  }
}

function updatePerformanceMetrics(now) {
  const seconds = (now - performanceWindowStartedAt) / 1000;
  if (seconds < 1) return;
  for (const [key, count] of Object.entries(performanceCounts)) {
    performanceMetrics[({ camera: "cameraFps", hands: "handFps", masks: "cutoutMaskFps", bubbles: "bubbleFps" })[key]] = Math.round(count / seconds);
    performanceCounts[key] = 0;
  }
  performanceMetrics.cameraWidth = video.videoWidth;
  performanceMetrics.cameraHeight = video.videoHeight;
  performanceWindowStartedAt = now;
}

function startCameraLoop(session) {
  const schedule = () => {
    if (session !== cameraSession || !stream) return;
    // Keep ticking even when the source video is hidden behind the cutout canvas.
    animationFrame = window.requestAnimationFrame(loop);
  };
  const loop = (now) => {
    if (session !== cameraSession || !stream) return;
    schedule();
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    performanceCounts.camera += 1;
    updatePerformanceMetrics(now);
    renderPlayerFrame(now);
    if (visionBusy || now - lastInferenceTime + 4 < inferenceInterval) return;
    lastInferenceTime = now;
    if (workerReady) {
      void sendCameraFrame(session, now);
    } else if (handLandmarker) {
      try {
        const started = performance.now();
        const result = handLandmarker.detectForVideo(video, now);
        performanceCounts.hands += 1;
        if (result.landmarks[0]) drawHand(result.landmarks[0]); else clearHandOverlay();
        if (gameMode === "underwater" && result.landmarks[0] && imageSegmenter && now - lastSegmentationTime >= PERSON_SEGMENTATION_INTERVAL_MS) {
          lastSegmentationTime = now;
          try { imageSegmenter.segmentForVideo(video, now, drawSegmentedPlayer); }
          catch { disablePlayerSegmentation(session); }
        }
        const cost = performance.now() - started;
        performanceMetrics.inferenceMs = Math.round(cost);
        inferenceInterval = Math.max(1000 / 15, Math.min(160, cost * 1.5));
      } catch (error) {
        cleanUpCamera(); resetRound("Hand tracking stopped. Start the camera again to continue."); cameraStatus = "error";
        openPanel({ icon: "!", title: "Hand tracking stopped", message: cameraError(error), button: "Try again", action: startCamera });
      }
    }
  };
  schedule();
}

function cleanUpCamera() {
  cameraSession += 1;
  stopVisionWorker();
  trackingRecovery = false;
  if (animationFrame) window.cancelAnimationFrame(animationFrame);
  animationFrame = null;
  handLandmarker?.close();
  handLandmarker = null;
  imageSegmenter?.close();
  imageSegmenter = null;
  imageSegmenterPromise = null;
  visionFileset = null;
  lastSegmentationTime = 0;
  lastInferenceTime = 0;
  lastVideoTime = -1;
  lastPlayerFrameTime = 0;
  inferenceInterval = 1000 / 30;
  smoothedHandTime = 20;
  performanceWindowStartedAt = performance.now();
  Object.keys(performanceCounts).forEach((key) => { performanceCounts[key] = 0; });
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  video.classList.remove("ready");
  stage.classList.remove("segmenter-loading", "segmenter-ready", "segmenter-fallback");
  clearPersonCanvas();
  clearHandOverlay();
}

function cameraError(error) {
  const name = error?.name || "";
  if ((name === "NotAllowedError" || name === "PermissionDeniedError") && isEmbeddedContext()) {
    return "This project preview cannot use the camera. Open the full game in your browser to play with the pinch gesture.";
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "Camera access was blocked. Allow it in your browser settings, then try again.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "No camera was found on this device.";
  if (name === "NotReadableError" || name === "TrackStartError") return "Your camera is busy in another app or browser tab. Close it, then try again.";
  return error?.message || "We could not start the camera. Please try again.";
}

function isEmbeddedContext() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function cameraPolicyBlocksThisFrame() {
  const policy = document.permissionsPolicy || document.featurePolicy;
  return Boolean(policy?.allowsFeature && !policy.allowsFeature("camera"));
}

function openFullGame() {
  window.open(FULL_GAME_URL, "_blank", "noopener,noreferrer");
}

function showFullGameMessage() {
  openPanel({
    icon: "↗",
    title: "Open the full game to use the camera",
    message: "This project preview does not have permission to use your camera. Open Air Math in a regular browser, then allow camera access when prompted.",
    button: "Open full game",
    action: openFullGame,
  });
}

async function startCamera() {
  unlockAudio();
  cleanUpCamera();
  if (isEmbeddedContext() && cameraPolicyBlocksThisFrame()) {
    showFullGameMessage();
    return;
  }
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    if (isEmbeddedContext()) {
      showFullGameMessage();
    } else {
      openPanel({ icon: "!", title: "Camera needs HTTPS", message: "Open this game on HTTPS or localhost in a modern browser.", button: "Try again", action: startCamera });
    }
    return;
  }
  mobileLandscapeMode = isPhoneDevice();
  if (isPortraitPhoneViewport() && !isFullscreen()) void enterLandscapeFullscreen(true);
  const session = cameraSession;
  cameraStatus = "starting";
  renderLevelChoices();
  openPanel({ icon: "⌁", title: "Starting camera", message: "Opening your camera and loading hand tracking…", button: "Starting camera…", action: () => {}, disabled: true });
  try {
    const cameraStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: CAMERA_WIDTH }, height: { ideal: CAMERA_HEIGHT }, frameRate: { ideal: 30, max: 30 } } });
    if (session !== cameraSession) { cameraStream.getTracks().forEach((track) => track.stop()); return; }
    stream = cameraStream;
    video.srcObject = cameraStream;
    await video.play();
    syncStageAspectRatio();
    video.classList.add("ready");
    try { await startVisionWorker(session); }
    catch {
      if (session !== cameraSession) return;
      stopVisionWorker();
      await startMainThreadTracking(session);
    }
    if (session !== cameraSession) return;
    cameraStatus = "ready";
    newRoundButton.hidden = false;
    stopCameraButton.hidden = false;
    renderLevelChoices();
    openPanel({ icon: "✓", title: "Camera and hand tracking are ready.", message: `${LEVELS[levelKey].title} selected. Start your 10-question round when you are ready.`, button: "Start 10-question round", action: startRound });
    const track = stream.getVideoTracks()[0];
    track?.addEventListener("ended", () => {
      if (session !== cameraSession) return;
      cleanUpCamera(); resetRound("Your camera was turned off. Start it again when you are ready."); cameraStatus = "error";
      openPanel({ icon: "!", title: "Camera stream ended", message: "You can start the camera again whenever you are ready.", button: "Turn on camera", action: startCamera });
    });
    startCameraLoop(session);
  } catch (error) {
    if (session !== cameraSession) return;
    cleanUpCamera(); cameraStatus = "error";
    renderLevelChoices();
    if ((error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") && isEmbeddedContext()) {
      showFullGameMessage();
    } else {
      openPanel({ icon: "!", title: "Camera needs attention", message: cameraError(error), button: "Try again", action: startCamera });
    }
  }
}

function selectMode(nextMode) {
  if (!MODES[nextMode] || gamePlaying || cameraStatus === "starting") return;
  gameMode = nextMode;
  renderModeChoices();
  syncUnderwaterMusic();
  const cutoutMessage = gameMode === "underwater" && cameraStatus === "ready" && !imageSegmenter && !workerSegmentationReady
    ? " Preparing your hand cutout…"
    : "";
  setFeedback(`${gameMode === "underwater" ? "Underwater mode" : "Static mode"} selected.${cutoutMessage} ${MODES[gameMode].description}`);
}

function selectLevel(nextLevel) {
  if (!LEVELS[nextLevel] || gamePlaying || cameraStatus === "starting") return;
  levelKey = nextLevel;
  question = makeQuestion(levelKey);
  renderLevelChoices();
  renderQuestion();
  setFeedback(`${LEVELS[levelKey].title} selected. Each round has ${ROUND_LENGTH} questions.`);
  if (cameraStatus === "ready") {
    openPanel({ icon: "✓", title: `${LEVELS[levelKey].title} ready`, message: `${LEVELS[levelKey].label}. Start a new 10-question round when you are ready.`, button: "Start 10-question round", action: startRound });
  }
}

function isPhoneDevice() {
  return Boolean(navigator.userAgentData?.mobile) || /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent);
}

function isPortraitPhoneViewport() {
  return isPhoneDevice() && window.matchMedia("(orientation: portrait)").matches;
}

function isFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

async function enterLandscapeFullscreen(quiet = false) {
  const needsLandscape = isPortraitPhoneViewport();
  try {
    if (stage.requestFullscreen) await stage.requestFullscreen();
    else if (stage.webkitRequestFullscreen) stage.webkitRequestFullscreen();
    else return false;
  } catch {
    if (!quiet) feedbackElement.textContent = "Full screen was blocked by your browser. Try using its full-screen shortcut.";
    return false;
  }

  if (needsLandscape) {
    try {
      if (!screen.orientation?.lock) throw new Error("Screen orientation lock is unavailable.");
      await screen.orientation.lock("landscape");
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    } catch {
      // Some mobile browsers do not support orientation locking; rotate the fullscreen stage instead.
    }
    stage.classList.toggle("mobile-landscape-fallback", window.matchMedia("(orientation: portrait)").matches);
  }
  requestAnimationFrame(refreshStageMetrics);
  return true;
}

async function toggleFullscreen() {
  try {
    if (isFullscreen()) {
      stage.classList.remove("mobile-landscape-fallback");
      try { screen.orientation?.unlock?.(); } catch {}
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else {
      await enterLandscapeFullscreen();
    }
  } catch {
    feedbackElement.textContent = "Full screen was blocked by your browser. Try using its full-screen shortcut.";
  }
}

function updateFullscreenButton() {
  const fullscreen = isFullscreen();
  if (!fullscreen) {
    stage.classList.remove("mobile-landscape-fallback");
    try { screen.orientation?.unlock?.(); } catch {}
  }
  fullscreenButton.textContent = fullscreen ? "⛶ Exit full screen" : "⛶ Full screen";
  fullscreenButton.setAttribute("aria-label", fullscreen ? "Exit full screen" : "Make camera full screen");
  fullscreenButton.setAttribute("aria-pressed", String(fullscreen));
}

answerButtons.forEach((button, index) => button.addEventListener("click", () => selectAnswer(index)));
levelButtons.forEach((button) => button.addEventListener("click", () => selectLevel(button.dataset.level)));
modeButtons.forEach((button) => button.addEventListener("click", () => selectMode(button.dataset.mode)));
leaderboardLevelButtons.forEach((button) => button.addEventListener("click", () => {
  const nextLevel = button.dataset.leaderboardLevel;
  if (!LEVELS[nextLevel]) return;
  selectedLeaderboardLevel = nextLevel;
  leaderboardLevelButtons.forEach((levelButton) => {
    const selected = levelButton.dataset.leaderboardLevel === selectedLeaderboardLevel;
    levelButton.classList.toggle("active", selected);
    levelButton.setAttribute("aria-pressed", String(selected));
  });
  void loadLeaderboard(nextLevel);
}));
newRoundButton.addEventListener("click", startRound);
fullscreenButton.addEventListener("click", toggleFullscreen);
soundSettingsButton.addEventListener("click", () => setSoundSettingsOpen(soundSettingsPanel.hidden));
soundSettingsDoneButton.addEventListener("click", () => setSoundSettingsOpen(false));
musicVolumeSlider.addEventListener("input", () => setAudioVolume("music", musicVolumeSlider.value));
effectsVolumeSlider.addEventListener("input", () => setAudioVolume("effects", effectsVolumeSlider.value));
document.addEventListener("click", (event) => {
  if (soundSettingsPanel.hidden || !(event.target instanceof Node)) return;
  if (soundSettingsPanel.contains(event.target) || soundSettingsButton.contains(event.target)) return;
  setSoundSettingsOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !soundSettingsPanel.hidden) setSoundSettingsOpen(false);
});
document.addEventListener("fullscreenchange", updateFullscreenButton);
document.addEventListener("webkitfullscreenchange", updateFullscreenButton);
stopCameraButton.addEventListener("click", () => {
  cleanUpCamera(); resetRound("Camera stopped. Turn it on whenever you are ready to play again."); cameraStatus = "idle";
  stopCameraButton.hidden = true;
  openPanel({ icon: "⌁", title: "Ready to play in the air?", message: "Turn on your camera to play with a pinch gesture.", button: "Turn on camera", action: startCamera });
});
window.addEventListener("keydown", (event) => {
  if (!gamePlaying || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target instanceof HTMLElement && event.target.matches("input, textarea, select")) return;
  const index = Number(event.key) - 1;
  if (Number.isInteger(index) && index >= 0 && index < 3) { event.preventDefault(); selectAnswer(index); }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    underwaterBackgroundVideo.pause();
    underwaterBackgroundMusic.pause();
  } else if (gameMode === "underwater") {
    void underwaterBackgroundVideo.play().catch(() => {});
    syncUnderwaterMusic();
  }
  if (document.hidden && stream) {
    cleanUpCamera(); resetRound("Camera paused while this tab was in the background. Turn it on to continue."); cameraStatus = "idle";
    openPanel({ icon: "⌁", title: "Camera paused", message: "Turn on your camera to continue playing.", button: "Turn on camera", action: startCamera });
  }
});
window.addEventListener("pagehide", () => {
  underwaterBackgroundMusic.pause();
  cleanUpCamera();
});
if (window.ResizeObserver) new ResizeObserver(refreshStageMetrics).observe(stageContent);
window.addEventListener("resize", refreshStageMetrics);
cursor.style.left = "0";
cursor.style.top = "0";

try {
  playerNameInput.value = window.localStorage.getItem("air-math-player-name") ?? "";
} catch {
  playerNameInput.value = "";
}
updateSoundSettings();
void loadLeaderboard();
renderLevelChoices();
renderQuestion();
updateFullscreenButton();
openPanel({
  icon: "⌁",
  title: "Ready to play in the air?",
  message: "Turn on your camera to play with a pinch gesture.",
  button: "Turn on camera",
  action: startCamera,
});
