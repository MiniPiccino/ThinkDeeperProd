import Foundation
import Combine

@MainActor
final class TodayViewModel: ObservableObject {
    enum State: Equatable {
        case idle
        case loading
        case loaded(DailyQuestion)
        case evaluating(DailyQuestion, elapsed: TimeInterval)
        case celebration(DailyQuestion)
        case error(String)
    }

    @Published private(set) var state: State = .idle
    @Published var answer: String = ""

    private let service: DailyQuestionProviding
    private var cancellables = Set<AnyCancellable>()
    private var question: DailyQuestion?
    private var startDate: Date?

    init(service: DailyQuestionProviding) {
        self.service = service
    }

    func load() {
        state = .loading
        service.fetchDailyQuestion()
            .sink { [weak self] completion in
                guard let self else { return }
                if case let .failure(error) = completion {
                    self.state = .error(error.localizedDescription)
                }
            } receiveValue: { [weak self] question in
                guard let self else { return }
                self.question = question
                self.state = .loaded(question)
            }
            .store(in: &cancellables)
    }

    func startSession() {
        guard case let .loaded(question) = state else { return }
        startDate = Date()
        state = .loaded(question)
    }

    func submit() {
        guard let question else { return }
        startDate = startDate ?? Date()
        let elapsed = Date().timeIntervalSince(startDate ?? Date())
        state = .evaluating(question, elapsed: elapsed)

        service.submit(answer: answer, duration: elapsed)
            .sink { [weak self] completion in
                guard let self else { return }
                if case let .failure(error) = completion {
                    self.state = .error(error.localizedDescription)
                }
            } receiveValue: { [weak self] in
                guard let self else { return }
                self.state = .celebration(question)
            }
            .store(in: &cancellables)
    }

    func dismissCelebration() {
        state = question.map { .loaded($0) } ?? .idle
        answer = ""
    }
}
