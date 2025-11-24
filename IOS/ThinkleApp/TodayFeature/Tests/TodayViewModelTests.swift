import XCTest
import Combine
@testable import ThinkleApp

final class TodayViewModelTests: XCTestCase {
    func testLoadSuccess() async {
        let service = MockDailyQuestionService()
        let viewModel = TodayViewModel(service: service)
        await MainActor.run { viewModel.load() }
        let expectation = XCTestExpectation(description: "Loaded state")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            if case .loaded = viewModel.state {
                expectation.fulfill()
            }
        }
        wait(for: [expectation], timeout: 1)
    }
}
