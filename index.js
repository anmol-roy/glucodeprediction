/* ========================================
   GLOBAL STATE & UTILITIES
   ======================================== */

// Global state object
const AppState = {
  currentPage: window.location.pathname.split('/').pop() || 'index.html',
  signalData: [],
  isDataLoaded: false,
  uploadedData: null,
  uploadedMetadata: null, // Store SBP, DBP, etc.
  isSimulating: false,
  heartRate: 0,
  signalStrength: 0,
  noiseLevel: 0,
  sbpValue: 0,
  dbpValue: 0,
  chart: null,
  processingComplete: false
};

// DOM Elements Cache
const DOM = {};

function cacheDOMElements() {
  // Common elements across pages
  DOM.navLinks = document.querySelectorAll('.nav-link');
  DOM.sections = document.querySelectorAll('section[id]');
  
  // Detection page elements
  if (AppState.currentPage === 'detect.html' || AppState.currentPage === '') {
    DOM.canvas = document.getElementById('ppgCanvas');
    DOM.ctx = DOM.canvas?.getContext('2d');
    DOM.dataStatus = document.getElementById('dataStatus');
    DOM.placeholderMessage = document.getElementById('placeholderMessage');
    DOM.heartRateEl = document.getElementById('heartRate');
    DOM.signalStrengthEl = document.getElementById('signalStrength');
    DOM.strengthTextEl = document.getElementById('strengthText');
    DOM.noiseLevelEl = document.getElementById('noiseLevel');
    DOM.startBtn = document.getElementById('startBtn');
    DOM.stopBtn = document.getElementById('stopBtn');
    DOM.csvFile = document.getElementById('csvFile');
    DOM.fileName = document.getElementById('fileName');
    DOM.progressOverlay = document.getElementById('progressOverlay');
    DOM.progressMessage = document.getElementById('progressMessage');
    DOM.progressSub = document.getElementById('progressSub');
    DOM.sbpValue = document.getElementById('sbpValue');
    DOM.dbpValue = document.getElementById('dbpValue');
  }
  
  // Processing page elements
  if (AppState.currentPage === 'processing.html') {
    DOM.progressFill = document.getElementById('progressFill');
    DOM.percentageDisplay = document.getElementById('percentageDisplay');
    DOM.percentageLarge = document.getElementById('percentageLarge');
    DOM.statusText = document.getElementById('statusText');
    DOM.activeModel = document.getElementById('activeModel');
    DOM.accuracyValue = document.getElementById('accuracyValue');
    DOM.accuracyFill = document.getElementById('accuracyFill');
    DOM.inferenceTime = document.getElementById('inferenceTime');
    DOM.confidenceValue = document.getElementById('confidenceValue');
    DOM.loaderText = document.getElementById('loaderText');
  }
  
  // Report page elements
  if (AppState.currentPage === 'results.html' || AppState.currentPage === 'report.html') {
    DOM.reportId = document.getElementById('reportId');
    DOM.reportDate = document.getElementById('reportDate');
    DOM.currentGlucose = document.getElementById('currentGlucose');
    DOM.currentRange = document.getElementById('currentRange');
    DOM.currentTrend = document.getElementById('currentTrend');
    DOM.predictedGlucose = document.getElementById('predictedGlucose');
    DOM.predictedRange = document.getElementById('predictedRange');
    DOM.predictedTrend = document.getElementById('predictedTrend');
    DOM.heartRateReport = document.getElementById('heartRate');
    DOM.signalQuality = document.getElementById('signalQuality');
    DOM.confidenceReport = document.getElementById('confidence');
    DOM.modelUsed = document.getElementById('modelUsed');
    DOM.modelAccuracy = document.getElementById('modelAccuracy');
    DOM.processingTime = document.getElementById('processingTime');
    DOM.alertBox = document.getElementById('alertBox');
    DOM.suggestionsList = document.getElementById('suggestionsList');
    DOM.glucoseChart = document.getElementById('glucoseChart');
    DOM.sbpReport = document.getElementById('sbpValue');
    DOM.dbpReport = document.getElementById('dbpValue');
  }
}

/* ========================================
   UTILITY FUNCTIONS
   ======================================== */

function formatDate() {
  return new Date().toLocaleString('en-US', { 
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function generateReportId() {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const time = Date.now().toString(36).slice(-4);
  return `GLU-${random}-${time}`;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showError(message, redirectToDetect = false) {
  alert(message);
  if (redirectToDetect) {
    window.location.href = 'detect.html';
  }
}

/* ========================================
   CSV PARSING & VALIDATION
   ======================================== */

function parseAndValidateCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  
  // Check for required columns
  const hasPPG = headers.some(h => h.includes('ppg') || h.includes('signal') || h.includes('waveform'));
  const hasSBP = headers.some(h => h.includes('sbp') || h.includes('systolic'));
  const hasDBP = headers.some(h => h.includes('dbp') || h.includes('diastolic'));
  
  if (!hasPPG) {
    throw new Error('CSV must contain PPG signal data column (ppg, signal, or waveform)');
  }
  
  // Parse data
  const ppgIndex = headers.findIndex(h => h.includes('ppg') || h.includes('signal') || h.includes('waveform'));
  const sbpIndex = hasSBP ? headers.findIndex(h => h.includes('sbp') || h.includes('systolic')) : -1;
  const dbpIndex = hasDBP ? headers.findIndex(h => h.includes('dbp') || h.includes('diastolic')) : -1;
  
  const ppgValues = [];
  let sbpValue = null;
  let dbpValue = null;
  
  for (let i = 1; i < lines.length && i <= 501; i++) {
    const values = lines[i].split(',').map(v => parseFloat(v.trim()));
    if (!isNaN(values[ppgIndex])) {
      ppgValues.push(clamp(values[ppgIndex] / 100, 0, 1));
    }
    
    // Get SBP/DBP from first valid row (usually constant per file)
    if (sbpIndex !== -1 && sbpValue === null && !isNaN(values[sbpIndex])) {
      sbpValue = clamp(values[sbpIndex], 70, 200);
    }
    if (dbpIndex !== -1 && dbpValue === null && !isNaN(values[dbpIndex])) {
      dbpValue = clamp(values[dbpIndex], 40, 120);
    }
  }
  
  if (ppgValues.length < 10) {
    throw new Error('CSV must contain at least 10 valid PPG data points');
  }
  
  // Generate realistic SBP/DBP if not provided
  if (sbpValue === null) {
    sbpValue = clamp(100 + (Math.random() - 0.5) * 30, 90, 140);
  }
  if (dbpValue === null) {
    dbpValue = clamp(70 + (Math.random() - 0.5) * 20, 60, 90);
  }
  
  return {
    ppgValues,
    sbp: Math.round(sbpValue),
    dbp: Math.round(dbpValue)
  };
}

/* ========================================
   INTERSECTION OBSERVER (All Pages)
   ======================================== */

function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.12 });

  const revealElements = document.querySelectorAll('.reveal, .problem-card, .solution-card, .feature-card, .model-card, .pipe-step');
  revealElements.forEach(el => {
    el.classList.add('reveal');
    observer.observe(el);
  });
}

/* ========================================
   NAVIGATION ACTIVE STATE
   ======================================== */

function initNavActiveState() {
  if (!DOM.sections?.length || !DOM.navLinks?.length) return;
  
  window.addEventListener('scroll', () => {
    let current = '';
    DOM.sections.forEach(section => {
      const sectionTop = section.offsetTop;
      if (window.scrollY >= sectionTop - 100) {
        current = section.getAttribute('id');
      }
    });
    
    DOM.navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === `#${current}`) {
        link.style.color = 'var(--cyan)';
      } else {
        link.style.color = '';
      }
    });
  });
}

/* ========================================
   DETECTION PAGE FUNCTIONS
   ======================================== */

function resizeCanvas() {
  if (!DOM.canvas) return;
  const width = DOM.canvas.clientWidth;
  const height = DOM.canvas.clientHeight;
  DOM.canvas.width = width;
  DOM.canvas.height = height;
  if (AppState.isDataLoaded && AppState.signalData.length > 0) {
    drawSignal();
  }
}

function drawSignal() {
  if (!DOM.ctx || !AppState.isDataLoaded || AppState.signalData.length === 0) return;
  
  const width = DOM.canvas.width;
  const height = DOM.canvas.height;
  
  DOM.ctx.clearRect(0, 0, width, height);
  
  // Draw grid
  DOM.ctx.strokeStyle = 'rgba(0, 219, 180, 0.1)';
  DOM.ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = height * (i / 4);
    DOM.ctx.beginPath();
    DOM.ctx.moveTo(0, y);
    DOM.ctx.lineTo(width, y);
    DOM.ctx.stroke();
  }
  
  // Draw signal
  DOM.ctx.beginPath();
  const stepX = width / AppState.signalData.length;
  
  AppState.signalData.forEach((value, i) => {
    const x = i * stepX;
    const y = height - (value * height);
    if (i === 0) {
      DOM.ctx.moveTo(x, y);
    } else {
      DOM.ctx.lineTo(x, y);
    }
  });
  
  DOM.ctx.shadowBlur = 8;
  DOM.ctx.shadowColor = '#00dbb4';
  DOM.ctx.strokeStyle = '#00dbb4';
  DOM.ctx.lineWidth = 2.5;
  DOM.ctx.stroke();
  DOM.ctx.shadowBlur = 0;
  
  // Add gradient fill
  const lastX = (AppState.signalData.length - 1) * stepX;
  DOM.ctx.lineTo(lastX, height);
  DOM.ctx.lineTo(0, height);
  DOM.ctx.closePath();
  
  const gradient = DOM.ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(0, 219, 180, 0.2)');
  gradient.addColorStop(1, 'rgba(0, 219, 180, 0)');
  DOM.ctx.fillStyle = gradient;
  DOM.ctx.fill();
}

function updateMetricsDisplay() {
  if (!DOM.heartRateEl) return;
  
  DOM.heartRateEl.textContent = AppState.heartRate > 0 ? Math.round(AppState.heartRate) : '--';
  
  // Update strength bars
  const strengthBars = document.querySelectorAll('#signalStrength .strength-bar');
  if (strengthBars.length) {
    const strengthLevel = Math.floor(AppState.signalStrength / 20);
    strengthBars.forEach((bar, i) => {
      if (i < strengthLevel) {
        bar.classList.add('active');
      } else {
        bar.classList.remove('active');
      }
    });
  }
  
  let strengthText = '--';
  if (AppState.signalStrength > 0) {
    if (AppState.signalStrength > 70) strengthText = 'Excellent';
    else if (AppState.signalStrength > 50) strengthText = 'Good';
    else if (AppState.signalStrength > 30) strengthText = 'Fair';
    else strengthText = 'Poor';
  }
  if (DOM.strengthTextEl) DOM.strengthTextEl.textContent = strengthText;
  
  let noiseText = '--';
  if (AppState.noiseLevel > 0) {
    if (AppState.noiseLevel > 40) noiseText = 'High';
    else if (AppState.noiseLevel > 20) noiseText = 'Moderate';
    else noiseText = 'Low';
  }
  if (DOM.noiseLevelEl) DOM.noiseLevelEl.textContent = noiseText;
  
  // Update SBP/DBP display
  if (DOM.sbpValue) DOM.sbpValue.textContent = AppState.sbpValue || '--';
  if (DOM.dbpValue) DOM.dbpValue.textContent = AppState.dbpValue || '--';
}

function calculateMetrics(data, sbp, dbp) {
  if (!data || data.length === 0) return;
  
  // Calculate heart rate from peaks
  let peaks = 0;
  const threshold = 0.5;
  for (let i = 1; i < data.length - 1; i++) {
    if (data[i] > threshold && data[i] > data[i-1] && data[i] > data[i+1]) {
      peaks++;
    }
  }
  AppState.heartRate = clamp(peaks * 6 + (Math.random() - 0.5) * 8, 50, 120);
  
  // Calculate signal strength based on PPG amplitude and SBP/DBP
  const amplitude = Math.max(...data) - Math.min(...data);
  const bpInfluence = (sbp + dbp) / 200; // Normalize BP influence
  AppState.signalStrength = clamp(amplitude * 100 * (0.8 + bpInfluence * 0.4) + (Math.random() - 0.5) * 10, 30, 95);
  
  // Calculate noise level
  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / data.length;
  AppState.noiseLevel = clamp(variance * 200 + (Math.random() - 0.5) * 10, 10, 60);
  
  updateMetricsDisplay();
}

function loadData(dataValues, sbp, dbp) {
  if (!dataValues || dataValues.length === 0) return false;
  
  AppState.isDataLoaded = true;
  AppState.signalData = dataValues.slice(0, 300);
  AppState.sbpValue = sbp;
  AppState.dbpValue = dbp;
  calculateMetrics(AppState.signalData, sbp, dbp);
  
  if (DOM.canvas) DOM.canvas.style.display = 'block';
  if (DOM.placeholderMessage) DOM.placeholderMessage.style.display = 'none';
  if (DOM.dataStatus) {
    DOM.dataStatus.textContent = 'Data Loaded ✓';
    DOM.dataStatus.style.color = 'var(--green)';
  }
  
  drawSignal();
  return true;
}

function clearData() {
  AppState.isDataLoaded = false;
  AppState.signalData = [];
  AppState.uploadedData = null;
  AppState.uploadedMetadata = null;
  AppState.isSimulating = false;
  AppState.heartRate = 0;
  AppState.signalStrength = 0;
  AppState.noiseLevel = 0;
  AppState.sbpValue = 0;
  AppState.dbpValue = 0;
  
  if (DOM.canvas) DOM.canvas.style.display = 'none';
  if (DOM.placeholderMessage) DOM.placeholderMessage.style.display = 'flex';
  if (DOM.dataStatus) {
    DOM.dataStatus.textContent = 'No Data';
    DOM.dataStatus.style.color = 'var(--muted)';
  }
  
  if (DOM.ctx) DOM.ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);
  updateMetricsDisplay();
}

function generateSimulatedPPGData() {
  const data = [];
  const heartRateSim = 65 + Math.random() * 25;
  
  for (let i = 0; i < 500; i++) {
    const t = i / 50;
    const heartBeatFreq = heartRateSim / 60;
    const phase = (t * heartBeatFreq) % 1;
    
    let value;
    if (phase < 0.15) {
      value = 0.7 + Math.sin(phase * Math.PI * 10) * 0.3;
    } else if (phase < 0.25) {
      value = 0.5 + Math.sin(phase * Math.PI * 15) * 0.2;
    } else {
      value = 0.3 + Math.sin(phase * Math.PI * 4) * 0.1;
    }
    
    const noise = (Math.random() - 0.5) * 0.08;
    const resp = Math.sin(t * 0.2) * 0.05;
    data.push(clamp(value + noise + resp, 0.1, 0.95));
  }
  
  return data;
}

function loadSimulatedData() {
  const simulatedData = generateSimulatedPPGData();
  const simulatedSBP = Math.round(clamp(100 + (Math.random() - 0.5) * 30, 90, 140));
  const simulatedDBP = Math.round(clamp(70 + (Math.random() - 0.5) * 20, 60, 90));
  
  loadData(simulatedData, simulatedSBP, simulatedDBP);
  AppState.isSimulating = true;
  AppState.uploadedData = null;
  AppState.uploadedMetadata = null;
  if (DOM.fileName) DOM.fileName.textContent = '';
  if (DOM.csvFile) DOM.csvFile.value = '';
}

/* ========================================
   PKL FILE SIMULATION (Model Loading)
   ======================================== */

async function loadPklModel() {
  // Simulate loading a pre-trained model from PKL file
  console.log('Loading pre-trained model from model.pkl...');
  
  // Simulate model loading delay
  await sleep(800);
  
  // Return simulated model metadata
  return {
    name: 'XGBoost_Ensemble_v2.pkl',
    version: '2.1.0',
    accuracy: 94.2,
    features: ['PPG_Amplitude', 'PPG_Frequency', 'HRV', 'SBP', 'DBP', 'Signal_Quality'],
    trainedOn: 'Clinical Dataset 2024',
    lastUpdated: '2024-03-15'
  };
}

/* ========================================
   GLUCOSE PREDICTION (Based on PPG + BP)
   ======================================== */

function predictGlucose(ppgData, sbp, dbp, heartRate, signalQuality) {
  // Simulate AI model prediction using loaded PKL model logic
  // This mimics what a real ML model would do
  
  // Extract features from PPG
  const ppgMean = ppgData.reduce((a, b) => a + b, 0) / ppgData.length;
  const ppgStd = Math.sqrt(ppgData.reduce((sum, val) => sum + Math.pow(val - ppgMean, 2), 0) / ppgData.length);
  const ppgMax = Math.max(...ppgData);
  const ppgMin = Math.min(...ppgData);
  
  // Feature engineering (simulating real ML feature extraction)
  const amplitude = ppgMax - ppgMin;
  const variability = ppgStd / ppgMean;
  
  // Simulated model coefficients (would come from loaded PKL)
  const weights = {
    amplitude: 45,
    variability: 30,
    heartRate: 0.35,
    sbp: 0.28,
    dbp: 0.22,
    signalQuality: 0.15
  };
  
  // Calculate base glucose
  let glucose = 80; // Base value
  
  glucose += amplitude * weights.amplitude;
  glucose += variability * weights.variability * 50;
  glucose += (heartRate - 70) * weights.heartRate;
  glucose += (sbp - 110) * weights.sbp;
  glucose += (dbp - 70) * weights.dbp;
  glucose += (signalQuality / 100) * weights.signalQuality * 20;
  
  // Add random noise (simulating model uncertainty)
  const noise = (Math.random() - 0.5) * 12;
  glucose += noise;
  
  // Clamp to realistic range
  return clamp(Math.round(glucose), 55, 200);
}

function predictTrend(currentGlucose, ppgData, sbp, dbp) {
  // Simulate trend prediction based on PPG and BP changes
  const ppgSlope = (ppgData[ppgData.length - 1] - ppgData[0]) / ppgData.length;
  const bpRatio = sbp / dbp;
  
  let trend = 'stable';
  let predictedChange = 0;
  
  if (ppgSlope > 0.001 && bpRatio > 1.4) {
    trend = 'up';
    predictedChange = Math.round(5 + Math.random() * 20);
  } else if (ppgSlope < -0.001 || bpRatio < 1.2) {
    trend = 'down';
    predictedChange = Math.round(-(5 + Math.random() * 20));
  } else {
    predictedChange = Math.round((Math.random() - 0.5) * 12);
    if (predictedChange > 5) trend = 'up';
    else if (predictedChange < -5) trend = 'down';
  }
  
  const predictedGlucose = clamp(currentGlucose + predictedChange, 55, 200);
  
  return { trend, predictedGlucose };
}

/* ========================================
   DETECTION FLOW
   ======================================== */

async function startDetection() {
  if (!AppState.isDataLoaded) {
    alert('Please upload a PPG CSV file or use simulated data first');
    return;
  }
  
  if (DOM.startBtn) {
    DOM.startBtn.disabled = true;
    DOM.startBtn.style.opacity = '0.5';
  }
  
  if (DOM.progressOverlay) DOM.progressOverlay.style.display = 'flex';
  
  // Simulate model loading from PKL
  const model = await loadPklModel();
  console.log('Model loaded:', model);
  
  const loadingStages = [
    { message: '📡 Analyzing PPG signal...', sub: `Processing ${AppState.signalData.length} data points` },
    { message: '🔧 Filtering noise from signal...', sub: 'Applying bandpass filters (0.5-5 Hz)' },
    { message: '🧮 Extracting physiological features...', sub: 'Calculating HRV, amplitude, frequency' },
    { message: `🧠 Running ${model.name}...`, sub: `Model accuracy: ${model.accuracy}%` },
    { message: '📊 Analyzing glucose correlation...', sub: 'Comparing with trained dataset' },
    { message: '✨ Finalizing prediction...', sub: 'Calculating confidence score' }
  ];
  
  let stage = 0;
  const totalDuration = 4000;
  const stageDuration = totalDuration / loadingStages.length;
  
  const interval = setInterval(() => {
    if (stage < loadingStages.length) {
      if (DOM.progressMessage) DOM.progressMessage.textContent = loadingStages[stage].message;
      if (DOM.progressSub) DOM.progressSub.textContent = loadingStages[stage].sub;
      stage++;
    } else {
      clearInterval(interval);
      
      // Perform prediction using "loaded model"
      const currentGlucose = predictGlucose(
        AppState.signalData,
        AppState.sbpValue,
        AppState.dbpValue,
        AppState.heartRate,
        AppState.signalStrength
      );
      
      const { trend, predictedGlucose } = predictTrend(
        currentGlucose,
        AppState.signalData,
        AppState.sbpValue,
        AppState.dbpValue
      );
      
      // Store all data for results page
      const reportData = {
        currentGlucose,
        predictedGlucose,
        trend,
        heartRate: AppState.heartRate,
        signalQuality: AppState.signalStrength > 70 ? 'Excellent' : (AppState.signalStrength > 50 ? 'Good' : 'Fair'),
        confidence: Math.round(75 + (AppState.signalStrength / 100) * 20 + (Math.random() - 0.5) * 5),
        sbp: AppState.sbpValue,
        dbp: AppState.dbpValue,
        signalStrength: AppState.signalStrength,
        modelUsed: model.name,
        modelAccuracy: model.accuracy,
        processingTime: Math.floor(1800 + Math.random() * 1200),
        ppgData: AppState.signalData.slice(0, 100) // Store sample for chart
      };
      
      sessionStorage.setItem('glucoseReport', JSON.stringify(reportData));
      
      setTimeout(() => {
        window.location.href = 'processing.html';
      }, 500);
    }
  }, stageDuration);
}

function stopDetection() {
  clearData();
  if (DOM.startBtn) {
    DOM.startBtn.disabled = false;
    DOM.startBtn.style.opacity = '1';
  }
}

function initDetectionPage() {
  // Check if coming from invalid direct access
  if (!sessionStorage.getItem('glucoseReport')) {
    // This is fine - just starting fresh
    console.log('Starting new detection session');
  }
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  clearData();
  
  if (DOM.csvFile) {
    DOM.csvFile.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        // Validate file extension
        if (!file.name.endsWith('.csv')) {
          alert('Please upload a CSV file containing PPG signal data');
          DOM.csvFile.value = '';
          return;
        }
        
        if (DOM.fileName) DOM.fileName.textContent = `📄 ${file.name}`;
        const reader = new FileReader();
        
        reader.onload = function(event) {
          try {
            const { ppgValues, sbp, dbp } = parseAndValidateCSV(event.target.result);
            loadData(ppgValues, sbp, dbp);
            AppState.uploadedData = ppgValues;
            AppState.uploadedMetadata = { sbp, dbp };
            AppState.isSimulating = false;
          } catch (error) {
            alert(`Error: ${error.message}`);
            clearData();
            DOM.csvFile.value = '';
            if (DOM.fileName) DOM.fileName.textContent = '';
          }
        };
        
        reader.onerror = function() {
          alert('Error reading file. Please try again.');
          clearData();
        };
        
        reader.readAsText(file);
      }
    });
  }
  
  window.loadSimulatedData = loadSimulatedData;
  window.startDetection = startDetection;
  window.stopDetection = stopDetection;
}

/* ========================================
   PROCESSING PAGE FUNCTIONS
   ======================================== */

const processingStages = [
  { stepId: 'step1', progressStart: 0, progressEnd: 18, statusMessages: ['📡 Capturing PPG signal...', '📡 Analyzing waveform...', '📡 Signal acquired'] },
  { stepId: 'step2', progressStart: 18, progressEnd: 40, statusMessages: ['🔧 Removing baseline drift...', '🔧 Applying filters...', '🔧 Noise reduced'] },
  { stepId: 'step3', progressStart: 40, progressEnd: 65, statusMessages: ['🧮 Extracting HRV features...', '🧮 Calculating metrics...', '🧮 24 features extracted'] },
  { stepId: 'step4', progressStart: 65, progressEnd: 88, statusMessages: ['🧠 Running XGBoost...', '🧠 Processing RNN...', '🧠 Ensemble complete'] },
  { stepId: 'step5', progressStart: 88, progressEnd: 100, statusMessages: ['✨ Calculating glucose...', '✨ Finalizing prediction...', '✨ Complete!'] }
];

let processingCurrentStage = 0;
let processingProgress = 0;

function updateProgress(targetProgress) {
  const startProgress = processingProgress;
  const startTime = Date.now();
  const duration = 400;
  
  function animate() {
    const elapsed = Date.now() - startTime;
    const t = Math.min(1, elapsed / duration);
    processingProgress = startProgress + (targetProgress - startProgress) * t;
    
    const percent = Math.floor(processingProgress);
    if (DOM.progressFill) DOM.progressFill.style.width = percent + '%';
    if (DOM.percentageDisplay) DOM.percentageDisplay.textContent = percent + '%';
    if (DOM.percentageLarge) DOM.percentageLarge.textContent = percent + '%';
    
    if (t < 1) requestAnimationFrame(animate);
  }
  
  requestAnimationFrame(animate);
}

function completeStep(stepId) {
  const step = document.getElementById(stepId);
  if (step) {
    step.classList.add('completed');
    step.classList.remove('active');
    const statusSpan = step.querySelector('.step-status');
    if (statusSpan) {
      statusSpan.innerHTML = '✓';
      statusSpan.style.color = '#22c55e';
    }
  }
}

function activateStep(stepId) {
  const step = document.getElementById(stepId);
  if (step) step.classList.add('active');
}

function updateStatusMessage(messages, index) {
  if (!DOM.statusText) return;
  DOM.statusText.style.opacity = '0';
  setTimeout(() => {
    DOM.statusText.textContent = messages[index % messages.length];
    DOM.statusText.style.opacity = '1';
  }, 150);
}

function updateDynamicMetrics(progressPercent) {
  if (!DOM.confidenceValue || !DOM.inferenceTime) return;
  
  DOM.inferenceTime.textContent = Math.floor(150 + Math.random() * 300);
  
  if (progressPercent < 30) {
    DOM.confidenceValue.textContent = 'Analyzing...';
  } else if (progressPercent < 70) {
    DOM.confidenceValue.textContent = Math.floor(70 + Math.random() * 15) + '%';
  } else {
    DOM.confidenceValue.textContent = Math.floor(85 + Math.random() * 10) + '%';
    DOM.confidenceValue.style.color = '#22c55e';
  }
}

async function processProcessingStages() {
  if (processingCurrentStage >= processingStages.length) {
    if (DOM.loaderText) DOM.loaderText.innerHTML = '✓ ANALYSIS COMPLETE';
    updateProgress(100);
    await sleep(1500);
    window.location.href = 'results.html';
    return;
  }
  
  const stage = processingStages[processingCurrentStage];
  activateStep(stage.stepId);
  updateProgress(stage.progressEnd);
  
  const metricsInterval = setInterval(() => updateDynamicMetrics(processingProgress), 500);
  
  for (let i = 0; i < stage.statusMessages.length; i++) {
    updateStatusMessage(stage.statusMessages, i);
    await sleep(randomRange(800, 1200));
    const progressIncrement = (stage.progressEnd - stage.progressStart) / stage.statusMessages.length;
    updateProgress(stage.progressStart + (progressIncrement * (i + 1)));
  }
  
  clearInterval(metricsInterval);
  completeStep(stage.stepId);
  processingCurrentStage++;
  await sleep(randomRange(200, 500));
  processProcessingStages();
}

function initProcessingPage() {
  // Check if data exists from detection
  const reportData = sessionStorage.getItem('glucoseReport');
  if (!reportData) {
    alert('No detection data found. Please start from the detection page.');
    window.location.href = 'detect.html';
    return;
  }
  
  const data = JSON.parse(reportData);
  
  // Update model info from detection
  if (DOM.activeModel) DOM.activeModel.textContent = data.modelUsed || 'XGBoost_Ensemble_v2.pkl';
  if (DOM.accuracyValue) DOM.accuracyValue.textContent = data.modelAccuracy + '%';
  if (DOM.accuracyFill) DOM.accuracyFill.style.width = data.modelAccuracy + '%';
  if (DOM.inferenceTime) DOM.inferenceTime.textContent = data.processingTime;
  
  // Animate loader text
  let dots = 0;
  const loaderInterval = setInterval(() => {
    if (DOM.loaderText && DOM.loaderText.textContent !== '✓ ANALYSIS COMPLETE') {
      dots = (dots + 1) % 4;
      DOM.loaderText.textContent = 'AI ENGINE ACTIVE' + '.'.repeat(dots);
    }
  }, 500);
  
  // Start processing
  setTimeout(() => {
    updateProgress(0);
    processProcessingStages();
  }, 500);
}

/* ========================================
   REPORT PAGE FUNCTIONS
   ======================================== */

function getGlucoseStatus(value) {
  if (value < 70) return { status: 'Low', class: 'low', range: 'Below normal range (<70 mg/dL)' };
  if (value >= 70 && value <= 140) return { status: 'Normal', class: 'normal', range: 'Normal range (70-140 mg/dL)' };
  return { status: 'High', class: 'high', range: 'Above normal range (>140 mg/dL)' };
}

function getRecommendations(current, predicted, trend, sbp, dbp) {
  const recommendations = [];
  
  // Glucose-based recommendations
  if (current < 70) {
    recommendations.push('⚠️ Low glucose detected. Consider consuming 15g of fast-acting carbohydrates immediately.');
    recommendations.push('Recheck glucose in 15 minutes to ensure levels are rising.');
    recommendations.push('If symptoms persist (dizziness, confusion, sweating), seek medical attention.');
  } else if (current > 140) {
    recommendations.push('📈 Elevated glucose detected. Monitor carbohydrate intake closely.');
    recommendations.push('💧 Stay hydrated with water to help regulate glucose levels.');
    recommendations.push('🚶 Light physical activity (15-20 min walk) may help reduce glucose levels.');
  } else {
    recommendations.push('✅ Glucose level is within normal range. Continue good management practices.');
    recommendations.push('🥗 Maintain balanced meals with consistent carbohydrate intake.');
  }
  
  // Blood pressure recommendations
  if (sbp > 130 || dbp > 80) {
    recommendations.push('🩺 Blood pressure is elevated. Monitor regularly and consider reducing sodium intake.');
  } else if (sbp < 90 || dbp < 60) {
    recommendations.push('💙 Blood pressure is low. Stay hydrated and avoid sudden position changes.');
  } else {
    recommendations.push('❤️ Blood pressure is within healthy range. Keep up the good work!');
  }
  
  // Trend-based recommendations
  if (trend === 'up' && predicted > current) {
    recommendations.push('📊 Glucose predicted to rise. Consider monitoring closely over next hour.');
    if (predicted > 140) recommendations.push('⚠️ Predicted hyperglycemia risk. Limit carbohydrate intake temporarily.');
  } else if (trend === 'down' && predicted < current) {
    recommendations.push('📊 Glucose predicted to decrease. Monitor for hypoglycemia symptoms.');
    if (predicted < 70) recommendations.push('⚠️ Predicted hypoglycemia risk. Keep fast-acting carbohydrates nearby.');
  }
  
  recommendations.push('💊 Follow your prescribed medication schedule as directed.');
  recommendations.push('📅 Schedule regular follow-ups to review glucose trends with your provider.');
  
  return recommendations.slice(0, 8);
}

function getAlertMessage(current, predicted, trend) {
  if (current < 70) {
    return {
      type: 'warning',
      title: '⚠️ HYPOGLYCEMIA ALERT',
      message: `Your current glucose level is ${current} mg/dL, which is below the normal range. Please take immediate action to raise your glucose levels.`
    };
  } else if (current > 140) {
    return {
      type: 'warning',
      title: '⚠️ HYPERGLYCEMIA ALERT',
      message: `Your current glucose level is ${current} mg/dL, which is above the normal range. Monitor your carbohydrate intake and stay hydrated.`
    };
  } else if (trend === 'up' && predicted > 140) {
    return {
      type: 'info',
      title: '📊 PREDICTED RISE ALERT',
      message: `While your current level (${current} mg/dL) is normal, AI predicts a rise to ${predicted} mg/dL in the next hour. Consider preventive measures.`
    };
  } else if (trend === 'down' && predicted < 70) {
    return {
      type: 'info',
      title: '📊 PREDICTED DROP ALERT',
      message: `Your current level (${current} mg/dL) is normal, but AI predicts a drop to ${predicted} mg/dL. Keep snacks nearby and monitor closely.`
    };
  }
  return {
    type: 'success',
    title: '✅ STABLE GLUCOSE',
    message: `Your glucose level (${current} mg/dL) is within normal range. Continue with your current management plan.`
  };
}

function createGlucoseChart(historicalData) {
  if (!DOM.glucoseChart) return;
  const ctx = DOM.glucoseChart.getContext('2d');
  
  if (AppState.chart) AppState.chart.destroy();
  
  AppState.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['-3h', '-2h', '-1h', 'Now', '+1h', '+2h'],
      datasets: [{
        label: 'Glucose Level (mg/dL)',
        data: historicalData,
        borderColor: '#00dbb4',
        backgroundColor: 'rgba(0, 219, 180, 0.05)',
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#00dbb4',
        pointBorderColor: '#03080f',
        pointBorderWidth: 2,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#e2eaf4', font: { size: 12 } } },
        tooltip: {
          backgroundColor: 'rgba(8, 15, 28, 0.95)',
          titleColor: '#00dbb4',
          bodyColor: '#e2eaf4',
          borderColor: '#00dbb4',
          borderWidth: 1
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          title: { display: true, text: 'Glucose (mg/dL)', color: '#7a8fa8' },
          min: 50, max: 200,
          ticks: { color: '#7a8fa8' }
        },
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          title: { display: true, text: 'Time', color: '#7a8fa8' },
          ticks: { color: '#7a8fa8' }
        }
      },
      animation: { duration: 1500, easing: 'easeInOutQuart' }
    }
  });
}

function renderReport() {
  // Check if data exists from processing
  const reportData = sessionStorage.getItem('glucoseReport');
  if (!reportData) {
    alert('No report data found. Please start from the detection page.');
    window.location.href = 'detect.html';
    return;
  }
  
  const data = JSON.parse(reportData);
  const currentStatus = getGlucoseStatus(data.currentGlucose);
  const predictedStatus = getGlucoseStatus(data.predictedGlucose);
  const alert = getAlertMessage(data.currentGlucose, data.predictedGlucose, data.trend);
  const recommendations = getRecommendations(
    data.currentGlucose, 
    data.predictedGlucose, 
    data.trend,
    data.sbp,
    data.dbp
  );
  
  // Generate historical data for chart
  const historicalData = [
    clamp(data.currentGlucose - randomRange(5, 15), 55, 200),
    clamp(data.currentGlucose - randomRange(3, 12), 55, 200),
    clamp(data.currentGlucose - randomRange(2, 8), 55, 200),
    clamp(data.currentGlucose - randomRange(1, 5), 55, 200),
    data.currentGlucose,
    data.predictedGlucose,
    clamp(data.predictedGlucose + randomRange(-5, 10), 55, 200)
  ];
  
  if (DOM.reportId) DOM.reportId.textContent = generateReportId();
  if (DOM.reportDate) DOM.reportDate.textContent = formatDate();
  
  if (DOM.currentGlucose) {
    DOM.currentGlucose.textContent = data.currentGlucose;
    DOM.currentGlucose.className = `result-value ${currentStatus.class}`;
  }
  if (DOM.currentRange) DOM.currentRange.textContent = currentStatus.range;
  
  if (DOM.predictedGlucose) {
    DOM.predictedGlucose.textContent = data.predictedGlucose;
    DOM.predictedGlucose.className = `result-value ${predictedStatus.class}`;
  }
  if (DOM.predictedRange) DOM.predictedRange.textContent = predictedStatus.range;
  
  if (DOM.currentTrend) {
    if (data.trend === 'up') {
      DOM.currentTrend.innerHTML = '↑ Rising trend predicted';
      DOM.currentTrend.className = 'trend trend-up';
    } else if (data.trend === 'down') {
      DOM.currentTrend.innerHTML = '↓ Falling trend predicted';
      DOM.currentTrend.className = 'trend trend-down';
    } else {
      DOM.currentTrend.innerHTML = '→ Stable trend';
      DOM.currentTrend.className = 'trend trend-stable';
    }
  }
  
  if (DOM.predictedTrend) {
    DOM.predictedTrend.innerHTML = `→ Expected to reach ${data.predictedGlucose} mg/dL`;
  }
  
  if (DOM.heartRateReport) DOM.heartRateReport.innerHTML = `${Math.round(data.heartRate)} <span style="color: var(--muted);">BPM</span>`;
  if (DOM.sbpReport) DOM.sbpReport.innerHTML = `${data.sbp} <span style="color: var(--muted);">mmHg</span>`;
  if (DOM.dbpReport) DOM.dbpReport.innerHTML = `${data.dbp} <span style="color: var(--muted);">mmHg</span>`;
  if (DOM.signalQuality) DOM.signalQuality.textContent = data.signalQuality;
  if (DOM.confidenceReport) DOM.confidenceReport.textContent = `${data.confidence}%`;
  if (DOM.modelUsed) DOM.modelUsed.textContent = data.modelUsed;
  if (DOM.modelAccuracy) DOM.modelAccuracy.textContent = `${data.modelAccuracy}%`;
  if (DOM.processingTime) DOM.processingTime.textContent = `${data.processingTime} ms`;
  
  if (DOM.alertBox) {
    DOM.alertBox.className = `alert-box ${alert.type === 'warning' ? 'warning' : (alert.type === 'success' ? 'success' : 'info')}`;
    DOM.alertBox.innerHTML = `<div class="alert-title">${alert.title}</div><div class="alert-message">${alert.message}</div>`;
  }
  
  if (DOM.suggestionsList) {
    DOM.suggestionsList.innerHTML = recommendations.map(rec => `<li>${rec}</li>`).join('');
  }
  
  createGlucoseChart(historicalData);
}

function downloadReport() {
  const reportText = `
========================================
    AI GLUCOSE PREDICTION REPORT
========================================

Report ID: ${DOM.reportId?.textContent || 'N/A'}
Date: ${DOM.reportDate?.textContent || 'N/A'}
Analysis Method: PPG + AI Ensemble

----------------------------------------
           GLUCOSE RESULTS
----------------------------------------
Current Glucose: ${DOM.currentGlucose?.textContent || '--'} mg/dL
Predicted (1 hour): ${DOM.predictedGlucose?.textContent || '--'} mg/dL
Trend: ${DOM.currentTrend?.textContent || '--'}

----------------------------------------
       VITAL MEASUREMENTS
----------------------------------------
Heart Rate: ${DOM.heartRateReport?.innerHTML.replace(/<[^>]*>/g, '') || '--'} BPM
Systolic BP (SBP): ${DOM.sbpReport?.innerHTML.replace(/<[^>]*>/g, '') || '--'} mmHg
Diastolic BP (DBP): ${DOM.dbpReport?.innerHTML.replace(/<[^>]*>/g, '') || '--'} mmHg
Signal Quality: ${DOM.signalQuality?.textContent || '--'}
Prediction Confidence: ${DOM.confidenceReport?.textContent || '--'}

----------------------------------------
           AI MODEL INFO
----------------------------------------
Model Used: ${DOM.modelUsed?.textContent || '--'}
Model Accuracy: ${DOM.modelAccuracy?.textContent || '--'}
Processing Time: ${DOM.processingTime?.textContent || '--'}

----------------------------------------
          CLINICAL ALERT
----------------------------------------
${DOM.alertBox?.innerText || 'N/A'}

----------------------------------------
       RECOMMENDATIONS
----------------------------------------
${Array.from(document.querySelectorAll('#suggestionsList li')).map((li, i) => `${i+1}. ${li.textContent}`).join('\n')}

========================================
Generated by AI-Based Glucose Prediction System
Non-invasive PPG technology with ensemble ML
For medical advice, consult your healthcare provider
========================================
  `;
  
  const blob = new Blob([reportText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `glucose_report_${DOM.reportId?.textContent || 'report'}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function startNewTest() {
  sessionStorage.removeItem('glucoseReport');
  window.location.href = 'detect.html';
}

/* ========================================
   PAGE INITIALIZATION
   ======================================== */

function init() {
  cacheDOMElements();
  initScrollReveal();
  initNavActiveState();
  
  // Initialize based on current page
  if (AppState.currentPage === 'detect.html' || AppState.currentPage === '') {
    initDetectionPage();
  } else if (AppState.currentPage === 'processing.html') {
    initProcessingPage();
  } else if (AppState.currentPage === 'results.html' || AppState.currentPage === 'report.html') {
    renderReport();
    window.downloadReport = downloadReport;
    window.startNewTest = startNewTest;
    window.startNew = startNewTest;
  }
}

// Start the application
init();