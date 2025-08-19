// Haptic feedback utilities for mobile devices
export class HapticFeedback {
  private static isSupported = 'vibrate' in navigator;

  // Light feedback for button taps
  static light() {
    if (this.isSupported) {
      navigator.vibrate(10);
    }
  }

  // Medium feedback for spin start
  static medium() {
    if (this.isSupported) {
      navigator.vibrate([50, 20, 50]);
    }
  }

  // Heavy feedback for wins
  static heavy() {
    if (this.isSupported) {
      navigator.vibrate([100, 30, 100, 30, 200]);
    }
  }

  // Success pattern for big wins
  static success() {
    if (this.isSupported) {
      navigator.vibrate([200, 50, 100, 50, 100, 50, 200]);
    }
  }

  // Error feedback
  static error() {
    if (this.isSupported) {
      navigator.vibrate([300, 100, 300]);
    }
  }

  // Custom pattern
  static pattern(vibrationPattern: number | number[]) {
    if (this.isSupported) {
      navigator.vibrate(vibrationPattern);
    }
  }
}