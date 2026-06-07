//
//  ContentView.swift
//  TempoRatio
//
//  Created by Bob Gardner on 6/7/26.
//

import SwiftUI
import UIKit // Required for haptics
import Combine

enum TimerState {
    case idle
    case practicing
    case resting
    case completed
}

struct ContentView: View {
    // Timer States
    @State private var timerState: TimerState = .idle
    @State private var practiceTime: TimeInterval = 0
    @State private var restTime: TimeInterval = 0
    @State private var initialRestDuration: TimeInterval = 0
    @State private var lastTickTime: Date? = nil
    
    // Animation States
    @State private var isGlowing = false
    @State private var waveformHeights: [CGFloat] = Array(repeating: 5.0, count: 25)
    
    // Timer Publisher ticking 20 times a second for smooth UI
    private let timer = Timer.publish(every: 0.05, on: .main, in: .common).autoconnect()
    
    var body: some View {
        ZStack {
            // Fullscreen dark background
            Color.darkBackground
                .ignoresSafeArea()
            
            VStack(spacing: 40) {
                // Header / Title
                VStack(spacing: 6) {
                    Text("TEMPORATIO")
                        .font(.system(size: 20, weight: .black, design: .monospaced))
                        .foregroundColor(.white)
                        .tracking(6)
                    
                    Text("WORK-REST BALANCE")
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .foregroundColor(.secondary)
                        .tracking(2)
                }
                .padding(.top, 20)
                
                Spacer()
                
                // Dashboard: Clock + Progress Ring
                ZStack {
                    // Track circle background
                    Circle()
                        .stroke(Color.darkGray, lineWidth: 8)
                        .frame(width: 280, height: 280)
                    
                    // State-based progress ring
                    if timerState == .resting {
                        Circle()
                            .trim(from: 0.0, to: CGFloat(restTime / max(initialRestDuration, 1.0)))
                            .stroke(Color.mutedSlate, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                            .frame(width: 280, height: 280)
                            .rotationEffect(.degrees(-90))
                            .animation(.linear(duration: 0.05), value: restTime)
                    } else if timerState == .practicing {
                        Circle()
                            .stroke(Color.electricLime, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                            .frame(width: 280, height: 280)
                            .shadow(color: Color.electricLime.opacity(0.4), radius: 8)
                            .scaleEffect(isGlowing ? 1.015 : 0.985)
                            .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: isGlowing)
                    } else if timerState == .completed {
                        Circle()
                            .stroke(Color.electricLime, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                            .frame(width: 280, height: 280)
                            .shadow(color: Color.electricLime.opacity(0.6), radius: 12)
                    }
                    
                    // Clock content
                    VStack(spacing: 8) {
                        Text(stateText.uppercased())
                            .font(.system(size: 13, weight: .bold, design: .monospaced))
                            .foregroundColor(stateColor)
                            .tracking(3)
                        
                        HStack(alignment: .lastTextBaseline, spacing: 0) {
                            Text(formatTime(displayTime))
                                .font(.system(size: 50, weight: .black, design: .monospaced))
                                .foregroundColor(.white)
                            Text(formatTenths(displayTime))
                                .font(.system(size: 28, weight: .bold, design: .monospaced))
                                .foregroundColor(stateColor.opacity(0.8))
                        }
                        
                        Text(innerLabel)
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundColor(.secondary)
                    }
                }
                
                Spacer()
                
                // Simulated Audio Waveform (DAW style visualizer)
                VStack(spacing: 12) {
                    HStack(alignment: .center, spacing: 4) {
                        ForEach(0..<waveformHeights.count, id: \.self) { index in
                            RoundedRectangle(cornerRadius: 2)
                                .fill(timerState == .practicing ? Color.electricLime : Color.mutedSlate.opacity(0.2))
                                .frame(width: 4, height: waveformHeights[index])
                        }
                    }
                    .frame(height: 60)
                    
                    Text("AUDIO DETECTION MOCK")
                        .font(.system(size: 8, weight: .bold, design: .monospaced))
                        .foregroundColor(.secondary)
                        .opacity(timerState == .practicing ? 0.8 : 0.3)
                }
                
                // Instructions / Help Text
                Text(instructionText)
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                    .frame(height: 40)
                    .padding(.bottom, 20)
            }
        }
        .onTapGesture {
            handleTap()
        }
        .onReceive(timer) { _ in
            updateTimer()
        }
        .onAppear {
            isGlowing = true
        }
    }
    
    // MARK: - Logic Helpers
    
    private var displayTime: TimeInterval {
        switch timerState {
        case .idle:
            return 0
        case .practicing:
            return practiceTime
        case .resting:
            return restTime
        case .completed:
            return 0
        }
    }
    
    private var stateText: String {
        switch timerState {
        case .idle:
            return "Ready"
        case .practicing:
            return "Active"
        case .resting:
            return "Rest"
        case .completed:
            return "Done"
        }
    }
    
    private var stateColor: Color {
        switch timerState {
        case .idle:
            return Color.mutedSlate
        case .practicing:
            return Color.electricLime
        case .resting:
            return Color.mutedSlate
        case .completed:
            return Color.electricLime
        }
    }
    
    private var innerLabel: String {
        switch timerState {
        case .idle:
            return "READY"
        case .practicing:
            return "PRACTICE ACTIVE"
        case .resting:
            return "REST ACTIVE"
        case .completed:
            return "TAP TO RESET"
        }
    }
    
    private var instructionText: String {
        switch timerState {
        case .idle:
            return "TAP ANYWHERE TO START PRACTICE"
        case .practicing:
            return "TAP ANYWHERE TO START REST COUNTDOWN"
        case .resting:
            return "TAP ANYWHERE TO CANCEL REST"
        case .completed:
            return "REST COMPLETED\nTAP ANYWHERE TO RESET"
        }
    }
    
    private func formatTime(_ time: TimeInterval) -> String {
        let minutes = Int(time) / 60
        let seconds = Int(time) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
    
    private func formatTenths(_ time: TimeInterval) -> String {
        let tenths = Int((time.truncatingRemainder(dividingBy: 1)) * 10)
        return String(format: ".%d", tenths)
    }
    
    // MARK: - Actions
    
    private func handleTap() {
        switch timerState {
        case .idle:
            practiceTime = 0
            lastTickTime = Date()
            timerState = .practicing
            triggerHaptic(style: .medium)
        case .practicing:
            restTime = practiceTime
            initialRestDuration = practiceTime
            lastTickTime = Date()
            if restTime > 0 {
                timerState = .resting
                triggerHaptic(style: .light)
            } else {
                timerState = .idle
                triggerHaptic(style: .heavy)
            }
        case .resting:
            timerState = .idle
            triggerHaptic(style: .light)
        case .completed:
            timerState = .idle
            triggerHaptic(style: .light)
        }
    }
    
    private func updateTimer() {
        guard let last = lastTickTime else {
            lastTickTime = Date()
            return
        }
        let now = Date()
        let delta = now.timeIntervalSince(last)
        lastTickTime = now
        
        switch timerState {
        case .practicing:
            practiceTime += delta
            
            // Animate waveform
            for i in 0..<waveformHeights.count {
                let time = Date().timeIntervalSinceReferenceDate
                let sine = sin(time * 10 + Double(i) * 0.5)
                let noise = Double.random(in: -0.2...0.2)
                let height = max(6.0, (sine + 1.0) / 2.0 * 40 + noise * 10)
                waveformHeights[i] = CGFloat(height)
            }
            
        case .resting:
            restTime -= delta
            
            // Flatten waveform
            for i in 0..<waveformHeights.count {
                if waveformHeights[i] > 6.0 {
                    waveformHeights[i] -= 2.0
                } else {
                    waveformHeights[i] = 5.0
                }
            }
            
            if restTime <= 0 {
                restTime = 0
                timerState = .completed
                triggerNotificationHaptic(type: .success)
            }
            
        case .idle, .completed:
            // Flatten waveform
            for i in 0..<waveformHeights.count {
                waveformHeights[i] = 5.0
            }
        }
    }
    
    // MARK: - Haptic Generators
    
    private func triggerHaptic(style: UIImpactFeedbackGenerator.FeedbackStyle) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.prepare()
        generator.impactOccurred()
    }
    
    private func triggerNotificationHaptic(type: UINotificationFeedbackGenerator.FeedbackType) {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(type)
    }
}

// Custom Colors matching the PRD Design Language
extension Color {
    static let darkBackground = Color(red: 0.075, green: 0.075, blue: 0.075) // #131313
    static let electricLime = Color(red: 0.80, green: 1.0, blue: 0.0) // #CCFF00
    static let mutedSlate = Color(red: 0.39, green: 0.45, blue: 0.55) // #64748B
    static let darkGray = Color(red: 0.15, green: 0.15, blue: 0.15) // #262626
}

#Preview {
    ContentView()
}
