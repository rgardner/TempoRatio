# TempoRatio

## Overview

TempoRatio is a hands-free practice/rest timer for musicians.

Start playing and TempoRatio automatically measures the duration of the practice interval. Stop playing, and it recommends a proportional rest period—by default, the same amount of time that was just spent practicing.

The initial use case is brass instrument practice, particularly trumpet, where alternating playing and rest can be useful but manually operating a timer between exercises interrupts practice.

TempoRatio is designed as a client-side web application and installable PWA that can be hosted entirely on GitHub Pages.

---

## Problem Statement

Musicians may want to deliberately alternate periods of playing and rest, but conventional timers require knowing the duration of an exercise in advance or manually starting and stopping a timer.

For exercises of arbitrary length, this creates unnecessary interaction:

1. Start a stopwatch.
2. Play the exercise.
3. Stop the stopwatch.
4. Determine the elapsed time.
5. Set a rest timer for the same duration.
6. Start the next exercise.

TempoRatio should reduce this workflow to:

> Start the session once, put the device on the music stand, and practice.

Sound detection should handle the transitions between playing and resting whenever possible.

---

## Primary Product Goal

Provide a reliable, low-interaction timer that automatically answers:

> "How long did I just practice, and how much longer should I rest before playing again?"

The default relationship is **1:1**:

**45 seconds playing → 45 seconds recommended rest**

The musician is never prevented from starting early. If playing resumes before the recommended rest is complete, TempoRatio immediately begins the next practice interval.

---

# Core Experience

## Session Lifecycle

A session has four user-facing states:

### 1. Idle

No practice session is active.

Primary action:

**Start Session**

Starting a session requests microphone permission if necessary and begins listening for instrument activity.

Manual mode must also be available if microphone access is unavailable or automatic detection is undesirable.

---

### 2. Playing

When sustained sound is detected, TempoRatio starts a count-up timer.

Example:

**PLAYING**

**0:37**

The timer represents the duration of the current practice interval.

The user may stop the interval manually at any time.

---

### 3. Resting

After sustained silence indicates that the practice interval has ended, TempoRatio:

1. Records the duration of the practice interval.
2. Calculates the recommended rest duration.
3. Starts a countdown.

For the default 1:1 ratio:

**37 seconds playing → 37 seconds rest**

The interface displays:

**REST**

**0:28 remaining**

**of 0:37 recommended**

A progress indicator may visualize progress toward completing the recommended rest.

---

### 4. Ready

When the recommended rest reaches zero:

- Display a prominent **READY** state.
- Optionally play a short notification sound.
- Use vibration where supported and enabled.
- Continue listening for playing.

The application does **not** automatically start a new practice interval when the rest timer expires.

The next practice interval starts when playing is detected or the user manually starts it.

---

# Automatic Sound Detection

## Detection Goal

Sound detection should identify **practice intervals**, rather than attempting to measure the exact milliseconds during which the instrument is acoustically active.

A practice interval may contain short pauses for:

- breathing
- articulation
- changing notes
- brief rests within an exercise

These pauses should not prematurely end the interval.

For example:

```text
0:00  Playing begins
0:12  Breath
0:14  Playing resumes
0:31  Breath
0:33  Playing resumes
0:48  Playing stops
0:51  End-of-playing threshold reached
```

TempoRatio should treat this as approximately one **48-second practice interval**, rather than several separate intervals.

---

## Detection State Machine

The conceptual state machine is:

```text
IDLE / LISTENING
       │
       │ sustained sound
       ▼
    PLAYING
       │
       │ sustained silence
       ▼
    RESTING
       │
       ├── rest reaches zero ──► READY
       │
       │ sound detected
       ▼
    PLAYING
```

### Starting a Practice Interval

A brief transient sound should not necessarily start an interval.

Initial target:

**Sound sustained for approximately 100–250 ms → PLAYING**

This threshold should be tuned through testing rather than treated as a fixed product requirement.

### Ending a Practice Interval

Brief silence should not end an interval.

Initial target:

**Silence sustained for approximately 2–3 seconds → RESTING**

The practice interval's duration should correspond to the approximate time the musician stopped playing, rather than including the full silence-detection delay.

For example, if playing stops at 0:48 and the application confirms the transition after three seconds of silence, the recorded interval should remain approximately 48 seconds rather than 51 seconds.

---

## Early Rest Termination

Recommended rest is guidance, not enforcement.

If the user begins playing while a rest countdown is still active:

1. End the current rest period.
2. Record how much rest actually occurred.
3. Immediately begin a new practice interval.

Example:

**Recommended:** 45 seconds  
**Actual rest:** 28 seconds

No warning or confirmation should interrupt practice.

---

# Sound Analysis

## MVP Detection Strategy

The first implementation should use browser-native audio APIs:

```text
Microphone
    ↓
getUserMedia()
    ↓
Web Audio API
    ↓
Audio signal level / RMS
    ↓
Threshold + hysteresis
    ↓
Playing / Silence
```

The MVP does **not** require:

- pitch detection
- note recognition
- FFT-based instrument classification
- machine learning
- recording audio
- uploading audio
- trumpet-specific recognition

Audio should be analyzed locally and should not be persisted.

---

## Calibration

Automatic detection must account for different:

- instruments
- microphone hardware
- room acoustics
- distances from the device
- background noise levels

Provide a simple calibration flow:

### Step 1 — Ambient Noise

**Stay quiet for a few seconds.**

TempoRatio measures the ambient noise floor.

### Step 2 — Playing Level

**Play a comfortable note or phrase.**

TempoRatio measures a representative playing level.

### Step 3 — Threshold

TempoRatio derives an initial detection threshold.

An advanced **Detection Sensitivity** control should allow manual adjustment.

Calibration should be repeatable from Settings.

---

# Manual Mode

Automatic sound detection must not be required to use TempoRatio.

Provide a prominent mode control:

**Auto / Manual**

Manual mode provides explicit controls for:

- Start Playing
- Stop Playing / Start Rest
- Start Playing Early
- Pause Session
- End Session

The underlying timer behavior should otherwise be identical between automatic and manual modes.

This also provides a fallback when microphone permissions are denied or automatic detection performs poorly in a particular environment.

---

# Pause vs. Rest

A **rest interval** is part of active practice.

A **paused session** means TempoRatio should stop interpreting sound as practice.

Examples include:

- talking to someone
- adjusting equipment
- taking a longer break
- leaving the room

Provide a **Pause Session** action.

While paused:

- automatic sound detection should not trigger practice intervals
- timers should not accumulate practice or rest time
- microphone processing should be suspended or released where practical

The user can then resume or end the session.

---

# Rest Ratio

Default:

**1:1**

Examples:

- 30 seconds playing → 30 seconds rest
- 2 minutes playing → 2 minutes rest
- 5 minutes playing → 5 minutes rest

Support configurable ratios such as:

- 1:1
- 1:2
- 2:1
- Custom

Ratio configuration is secondary to the primary timer experience and should not clutter the main practice interface.

---

# Dashboard

The primary interface should be readable from a music stand or several feet away.

Prioritize:

- very large timer
- high contrast
- obvious current state
- minimal controls
- no unnecessary text while practicing

## Playing

Display:

```text
PLAYING

0:37

Listening…

[ Stop ]
```

The timer counts upward.

Do **not** show a progress ring during playing because the eventual practice duration is unknown.

---

## Resting

Display:

```text
REST

0:28

of 0:37 recommended

[ Start Playing ]
```

A progress ring or similar visualization is appropriate because the rest interval has a known target duration.

---

## Ready

Display:

```text
READY

Rest complete

Listening…
```

The application waits for the musician to begin playing.

---

# Session Summary

MVP session tracking should remain lightweight.

At the end of a session, optionally show:

- total session duration
- total playing time
- total rest time
- number of practice intervals
- average practice interval
- recommended vs. actual rest

Detailed historical analytics are **not required for MVP**.

Future versions may add:

- saved practice sessions
- weekly/monthly trends
- consistency tracking
- practice/rest ratio analysis

---

# Settings

Persist settings locally on the device.

MVP settings:

- Auto / Manual mode
- Practice-to-rest ratio
- Detection sensitivity
- Recalibrate microphone
- End-of-rest sound on/off
- Vibration on/off where supported

No user account or cloud synchronization is required.

---

# Design Language

## "Pro-Audio Practice"

TempoRatio should resemble a focused musical tool rather than a general wellness application.

### Visual Direction

- Deep black/dark background
- High-visibility accent color
- Large technical sans-serif typography
- Strong differentiation between PLAYING, REST, READY, and PAUSED
- Minimal visual clutter
- Suitable for low-light practice environments

Inter is an appropriate default typeface.

Accessibility and legibility should take priority over aesthetic consistency.

State must not be communicated through color alone.

---

# Web Application Architecture

TempoRatio should be implemented as a fully client-side static application.

Recommended architecture:

- React
- TypeScript
- Vite
- Web Audio API
- `getUserMedia()`
- localStorage
- Web App Manifest
- Service Worker / PWA support
- GitHub Actions
- GitHub Pages

No backend is required for MVP.

No audio should leave the user's device.

---

# GitHub Pages Requirements

The production build must support deployment under a GitHub Pages project path such as:

```text
https://username.github.io/tempo-ratio/
```

Asset paths, routing, service-worker scope, and the Vite base path must work correctly when the application is hosted from a repository subdirectory rather than the domain root.

The application should be installable as a PWA where browser/platform support allows it.

---

# Timer Correctness

Timer correctness must not depend on JavaScript callbacks executing at precise intervals.

For example, do **not** implement elapsed time as:

```text
every second:
    elapsed += 1
```

Instead, record timestamps for state transitions and derive elapsed/remaining time from those timestamps.

This ensures the displayed timer can recover correctly when:

- rendering is delayed
- the browser throttles timers
- the tab temporarily becomes inactive
- the PWA is backgrounded and later reopened

---

# Background Operation

## Supported Requirement

Timer state should survive temporary backgrounding.

When the application becomes active again, elapsed and remaining time should be recalculated from stored timestamps.

## Explicit Non-Requirement

MVP does **not** guarantee continuous microphone-based sound detection when:

- the screen is locked
- the browser suspends the page
- the PWA is backgrounded
- the operating system suspends audio processing

Automatic detection is guaranteed only while the application is active and the platform continues providing microphone/audio processing.

The primary intended interaction is:

> Place the phone or device on a music stand with TempoRatio visible during practice.

Reliable locked-screen/background microphone monitoring may be investigated later and may require a native application.

---

# Privacy

Microphone access is required only for automatic detection.

TempoRatio should:

- clearly explain why microphone access is requested
- process microphone input locally
- not record practice audio
- not persist raw audio
- not upload audio
- stop or suspend microphone processing when the session is paused or ended where practical

The UI should visibly indicate when automatic listening is active.

---

# MVP Scope

## Required

- Static deployment on GitHub Pages
- Responsive mobile-first interface
- Installable PWA where supported
- Manual practice/rest timer
- Automatic microphone-based practice detection
- Silence debounce
- Detection hysteresis
- 1:1 rest calculation
- Configurable rest ratio
- Microphone calibration
- Detection sensitivity adjustment
- Large playing timer
- Rest countdown
- Rest progress visualization
- Ready state
- Early rest termination when playing resumes
- Pause/resume session
- End session
- Local settings persistence
- Timer recovery after temporary backgrounding
- Optional rest-complete sound/vibration
- No backend
- No audio recording/upload

## Explicitly Out of Scope for MVP

- User accounts
- Cloud synchronization
- Server-side processing
- Reliable microphone detection while the screen is locked
- Guaranteed background microphone monitoring
- Pitch/note recognition
- Instrument classification
- Machine-learning audio analysis
- Detailed historical analytics
- Social features
- Practice plans
- Native mobile applications

---

# Technical Spike

Before investing significantly in UI implementation, validate automatic detection on representative target devices.

The spike should implement:

1. Microphone permission.
2. Live RMS/signal-level measurement.
3. Ambient-noise calibration.
4. Playing threshold.
5. Playing-start debounce.
6. Silence/end-of-playing debounce.
7. State transitions between LISTENING, PLAYING, and RESTING.

Test with actual trumpet practice.

Important scenarios:

- sustained notes
- scales
- short exercises
- breathing between phrases
- several seconds of genuine rest
- very quiet playing
- loud playing
- metronome use
- speaking
- environmental noise
- device several feet away on a music stand

Primary success criterion:

> During normal trumpet practice, TempoRatio reliably distinguishes short musical/breathing pauses from the end of an exercise without requiring frequent manual correction.

If this cannot be made reliable with simple signal-level detection, investigate more sophisticated audio classification only after the basic approach has been evaluated.

---

# MVP Success Criteria

TempoRatio's first version is successful if a musician can:

1. Open the app.
2. Start a session.
3. Put the device on a music stand.
4. Play an arbitrary-length exercise.
5. Stop playing without touching the device.
6. See a reasonably accurate equal-length rest countdown begin automatically.
7. Start playing again, early or after completing the recommended rest.
8. Repeat this loop with little or no interaction.

The primary measure of product quality is **how rarely the musician needs to touch or correct the timer during a normal practice session**.