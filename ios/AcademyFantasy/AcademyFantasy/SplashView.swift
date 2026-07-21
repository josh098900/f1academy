import SwiftUI

// The launch splash: Silverstone draws itself in magenta on the black canvas,
// then "Academy Fantasy" fades in above it — echoing the web's pit-wall loader.
// Honours Reduce Motion (shows the finished track, no drawing), per the design
// doc's restraint-on-motion principle.
struct SplashView: View {
  var onFinish: () -> Void

  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var drawn: CGFloat = 0 // track trim, 0 → 1
  @State private var wordmark: Double = 0 // wordmark opacity

  var body: some View {
    ZStack {
      Theme.Palette.base.ignoresSafeArea()

      VStack(spacing: 24) {
        Text("Academy Fantasy")
          .font(AppFont.display(46))
          .foregroundStyle(Theme.Palette.primary)
          .opacity(wordmark)

        GeometryReader { geo in
          SilverstoneTrack
            .path(in: CGRect(origin: .zero, size: geo.size).insetBy(dx: 16, dy: 16))
            .trim(from: 0, to: drawn)
            .stroke(
              Theme.Palette.accent,
              style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round)
            )
        }
        .frame(height: 300)
      }
      .padding(.horizontal, 32)
    }
    .onAppear(perform: run)
  }

  private func run() {
    if reduceMotion {
      drawn = 1
      wordmark = 1
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.1) { onFinish() }
      return
    }
    withAnimation(.easeInOut(duration: 1.3)) { drawn = 1 }
    withAnimation(.easeIn(duration: 0.5).delay(1.0)) { wordmark = 1 }
    DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { onFinish() }
  }
}
