import SwiftUI

struct TodayView: View {
    @StateObject private var viewModel: TodayViewModel

    init(service: DailyQuestionProviding = MockDailyQuestionService()) {
        _viewModel = StateObject(wrappedValue: TodayViewModel(service: service))
    }

    var body: some View {
        ZStack {
            content
        }
        .task { viewModel.load() }
        .alert("Error", isPresented: Binding(
            get: {
                if case .error = viewModel.state { return true }
                return false
            },
            set: { _ in viewModel.load() }
        )) {
            Button("Retry", action: viewModel.load)
        } message: {
            if case let .error(message) = viewModel.state {
                Text(message)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle, .loading:
            ProgressView("Preparing today…")
        case let .loaded(question):
            ScrollView {
                VStack(spacing: 24) {
                    header(question: question)
                    promptCard(question: question)
                    answerComposer
                    submitButton
                }
                .padding()
            }
        case let .evaluating(question, elapsed):
            evaluatingOverlay(question: question, elapsed: elapsed)
        case let .celebration(question):
            ScrollView {
                VStack(spacing: 24) {
                    header(question: question)
                    celebrationCard(question: question)
                    Button("Back to question", action: viewModel.dismissCelebration)
                        .buttonStyle(.borderedProminent)
                }
                .padding()
            }
        case .error:
            EmptyView()
        }
    }

    private func header(question: DailyQuestion) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Today · Week \(question.weekProgress.completedDays+1)")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(question.theme)
                .font(.title.bold())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func promptCard(question: DailyQuestion) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Prompt")
                .font(.caption)
                .textCase(.uppercase)
                .foregroundStyle(.secondary)
            Text(question.prompt)
                .font(.title3)
            if let priming = question.priming {
                Divider()
                VStack(alignment: .leading, spacing: 8) {
                    Text("Priming")
                        .font(.caption)
                        .textCase(.uppercase)
                        .foregroundStyle(.secondary)
                    Text(priming.emotionalHook)
                    Text(priming.teaserQuestion)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
    }

    private var answerComposer: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your reflection")
                .font(.caption)
                .foregroundStyle(.secondary)
            TextEditor(text: $viewModel.answer)
                .frame(minHeight: 180)
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 16).strokeBorder(.quaternary))
        }
    }

    private var submitButton: some View {
        Button(action: viewModel.submit) {
            Text("Submit reflection")
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .disabled(viewModel.answer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    }

    private func evaluatingOverlay(question: DailyQuestion, elapsed: TimeInterval) -> some View {
        VStack(spacing: 16) {
            ProgressView()
            Text("Evaluating your reflection (\(Int(elapsed))s)")
                .font(.headline)
            Text(question.prompt)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.ultraThinMaterial)
    }

    private func celebrationCard(question: DailyQuestion) -> some View {
        VStack(spacing: 12) {
            Text("Reflection saved")
                .font(.headline)
            Text("Streak: \(question.streak) days")
            Text("XP total: \(question.xpTotal)")
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(RoundedRectangle(cornerRadius: 16).fill(.green.opacity(0.1)))
    }
}

#Preview {
    TodayView()
}
