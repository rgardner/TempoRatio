# Project Brief: TempoRatio

## Overview
TempoRatio is a specialized practice utility for musicians and vocalists. It uses sound-based triggers to manage a proportional "work-to-rest" ratio, ensuring balanced practice sessions and preventing vocal or physical fatigue.

## Problem Statement
Musicians often over-practicing without adequate rest, leading to fatigue, poor technique, or repetitive strain injuries. Manually setting timers between every exercise is disruptive to the creative flow.

## The Solution
An automated, hands-free timer that "listens" to the performance.
1. **Count-up (Practice):** Triggered by audio input. Tracks active playing time.
2. **Countdown (Rest):** Triggered by silence. Automatically sets a rest period equal to the preceding practice duration (1:1 ratio).

---

## Core Features

### 1. Adaptive Audio Timer
- **Live Detection:** Real-time waveform analysis to detect instrument or vocal activity.
- **Hands-Free Logic:** Automatic state switching between "Practicing" and "Resting" based on sound thresholds.
- **Proportional Scaling:** Dynamic rest calculation (Default 1:1, adjustable in settings).

### 2. High-Visibility Dashboard
- **Digital Readout:** Large, high-contrast clock face for visibility at a distance.
- **Progress Ring:** Visual representation of the current phase's progress.
- **Status Indicators:** Clear "Active" vs. "Rest" color coding (Electric Lime / Muted Slate).

### 3. Session History & Analytics
- **Practice Logs:** Breakdown of total time, rest time, and ratios achieved.
- **Consistency Tracking:** Weekly and monthly trends to monitor practice habits.

### 4. Customization
- **Ratio Adjustment:** Ability to set 1:2, 2:1, or custom proportions.
- **Sensitivity Controls:** Adjustable noise gate to filter out background noise or metronomes.

---

## Design Language: "Pro-Audio Practice"
- **Color Palette:** Deep blacks (`#131313`) with high-energy "Electric Lime" accents for high visibility in low-light studios.
- **Typography:** Bold, technical sans-serif (Inter) for maximum legibility.
- **Atmosphere:** Minimalist, focused, and professional, echoing the look of high-end DAW (Digital Audio Workstation) plugins.

---

## Technical Considerations
- **Microphone Permissions:** Required for core functionality.
- **Background Operation:** Timer must persist while the screen is off or in the background during long sessions.
- **Low Latency:** Fast response to audio triggers to ensure accurate timing.
