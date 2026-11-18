import Foundation

struct DailyQuestion: Identifiable, Equatable {
    let id: String
    let theme: String
    let prompt: String
    let availableOn: Date
    let timerSeconds: Int
    let xpTotal: Int
    let streak: Int
    let weekProgress: WeekProgress
    let priming: Priming?
}

struct WeekProgress: Equatable {
    let completedDays: Int
    let totalDays: Int
    let badgeEarned: Bool
}

struct Priming: Equatable {
    let emotionalHook: String
    let teaserQuestion: String
    let somaticCue: String
    let cognitiveCue: String
}
