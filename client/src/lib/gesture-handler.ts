// Touch gesture handler for mobile interactions
export class GestureHandler {
  private startX: number = 0;
  private startY: number = 0;
  private startTime: number = 0;
  private element: HTMLElement | null = null;

  constructor(element: HTMLElement) {
    this.element = element;
    this.setupGestures();
  }

  private setupGestures() {
    if (!this.element) return;

    this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
  }

  private handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.startTime = Date.now();
  }

  private handleTouchMove(e: TouchEvent) {
    // Prevent default scrolling during gestures
    e.preventDefault();
  }

  private handleTouchEnd(e: TouchEvent) {
    const touch = e.changedTouches[0];
    const endX = touch.clientX;
    const endY = touch.clientY;
    const endTime = Date.now();

    const deltaX = endX - this.startX;
    const deltaY = endY - this.startY;
    const deltaTime = endTime - this.startTime;

    // Swipe detection thresholds
    const minSwipeDistance = 50;
    const maxSwipeTime = 300;
    const maxVerticalMovement = 100;

    if (deltaTime < maxSwipeTime && Math.abs(deltaY) < maxVerticalMovement) {
      if (deltaX > minSwipeDistance) {
        this.onSwipeRight();
      } else if (deltaX < -minSwipeDistance) {
        this.onSwipeLeft();
      }
    }

    // Tap detection
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && deltaTime < 200) {
      this.onTap();
    }

    // Long press detection
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && deltaTime > 500) {
      this.onLongPress();
    }
  }

  onSwipeLeft: () => void = () => {};
  onSwipeRight: () => void = () => {};
  onTap: () => void = () => {};
  onLongPress: () => void = () => {};

  destroy() {
    if (this.element) {
      this.element.removeEventListener('touchstart', this.handleTouchStart);
      this.element.removeEventListener('touchmove', this.handleTouchMove);
      this.element.removeEventListener('touchend', this.handleTouchEnd);
    }
  }
}