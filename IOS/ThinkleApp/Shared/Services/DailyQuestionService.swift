import Foundation
import Combine

protocol DailyQuestionProviding {
    func fetchDailyQuestion() -> AnyPublisher<DailyQuestion, Error>
    func submit(answer: String, duration: TimeInterval) -> AnyPublisher<Void, Error>
}

final class MockDailyQuestionService: DailyQuestionProviding {
    func fetchDailyQuestion() -> AnyPublisher<DailyQuestion, Error> {
        let question = DailyQuestion(
            id: "week-47-day-3",
            theme: "Week 47 — Momentum",
            prompt: "Where did you notice resistance today, and what nudged you forward?",
            availableOn: Date(),
            timerSeconds: 300,
            xpTotal: 420,
            streak: 4,
            weekProgress: WeekProgress(completedDays: 3, totalDays: 7, badgeEarned: false),
            priming: Priming(
                emotionalHook: "Name the emotion that sits behind today's resistance.",
                teaserQuestion: "If that emotion could ask you one question, what would it be?",
                somaticCue: "Take one 4-6 breath and unclench your jaw.",
                cognitiveCue: "Translate the feeling into a single bold sentence before writing."
            )
        )
        return Just(question)
            .setFailureType(to: Error.self)
            .delay(for: .milliseconds(250), scheduler: DispatchQueue.main)
            .eraseToAnyPublisher()
    }

    func submit(answer: String, duration: TimeInterval) -> AnyPublisher<Void, Error> {
        Just(()).setFailureType(to: Error.self)
            .delay(for: .milliseconds(600), scheduler: DispatchQueue.main)
            .eraseToAnyPublisher()
    }
}
