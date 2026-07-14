# GlucoAI: AI-Based Glucose Prediction System

## Overview

GlucoAI is a web-based research prototype demonstrating a non-invasive blood glucose prediction system. It leverages machine learning models to analyze Photoplethysmography (PPG) signals, combined with Systolic and Diastolic Blood Pressure (SBP/DBP), to estimate blood glucose levels without the need for traditional, invasive methods.

This project simulates a complete end-to-end pipeline, from signal acquisition and visualization to AI-driven analysis and a comprehensive results report, all within the browser. The frontend is built with vanilla HTML, CSS, and JavaScript.

## Features

-   **Non-Invasive Prediction:** Estimates blood glucose using optical PPG signals, eliminating the need for needles.
-   **Multi-Signal Input:** Integrates PPG waveforms with SBP and DBP values for a richer, more accurate feature set. Users can upload their own PPG data via a CSV file.
-   **Data Simulation:** Includes a built-in PPG signal simulator for users who do not have their own data.
-   **Live Signal Visualization:** Renders the PPG waveform in real-time on an HTML canvas, providing visual feedback on signal quality.
-   **AI Processing Pipeline:** Simulates a multi-stage analysis process, including noise filtering, feature extraction, and model inference.
-   **Comprehensive Reporting:** Generates a detailed report with current and predicted (next-hour) glucose levels, a trend analysis chart, vital signs, and AI-generated clinical recommendations.
-   **Multiple ML Models:** The system is designed around an ensemble of models, with XGBoost serving as the primary predictor, achieving a simulated accuracy of 94%.

## The Prediction Pipeline

The application follows a five-step process to transform raw signal data into a glucose prediction in under two seconds.

1.  **Signal Acquisition:** Captures the raw PPG waveform data from either an uploaded CSV file or the internal simulator.
2.  **Filtering & Preprocessing:** Simulates the removal of noise, artifacts, and baseline drift from the raw signal to ensure clean data for analysis.
3.  **Feature Extraction:** Extracts key physiological features from the cleaned signal, such as Heart Rate Variability (HRV), amplitude, and frequency-domain features.
4.  **ML Model Inference:** The extracted features are fed into a simulated ensemble of machine learning models, primarily driven by XGBoost and an RNN (LSTM) for trend forecasting.
5.  **Prediction & Report Generation:** The models' outputs are synthesized to produce a final blood glucose estimation (in mg/dL), a next-hour forecast, and a risk alert, which are displayed in a user-friendly report.

## Technologies Used

-   **Frontend:** HTML5, CSS3, JavaScript (ES6+)
-   **Visualization:** Chart.js for data plotting, and the native HTML Canvas API for real-time waveform rendering.
-   **Machine Learning (Simulated):** The logic within `index.js` simulates the behavior and outputs of several ML architectures, including:
    -   XGBoost (Extreme Gradient Boosting)
    -   RNN (Recurrent Neural Network with LSTM)
    -   Deep Neural Network (DNN)
    -   Support Vector Regression (SVR)
    -   Ensemble Learning


## How to Use

1.  From the **Home** page (`index.html`), click on `Start Detection` to navigate to the detection interface.
2.  On the **Detection** page (`detect.html`), you have two options:
    -   **Upload CSV:** Click the "Upload PPG CSV File" area to select a local CSV file. The file should contain a column of PPG signal values. It may optionally include SBP and DBP columns.
    -   **Use Simulated Data:** Click the `Use Simulated Data` button to load a pre-generated, realistic PPG waveform.
3.  Once data is loaded, the waveform will appear in the "Live Signal Waveform" chart, and metrics like Heart Rate and Signal Strength will be calculated.
4.  Click `Start Detection` to initiate the analysis.
5.  You will be taken to the **Processing** page (`processing.html`), which shows the live progress of the AI pipeline.
6.  Upon completion, you will be automatically redirected to the **Report** page (`results.html`), where you can view your detailed glucose analysis.

## Disclaimer

⚠️ **This is a research prototype and not a medical device.** The results generated are for demonstration purposes only and should not be used for any clinical decisions, diagnosis, or treatment. Always consult a qualified healthcare provider for medical advice.
