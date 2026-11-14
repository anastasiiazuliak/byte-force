export interface DragDetectorOptions {
  maxMoveDistancePixels?: number;
  maxTapDurationMs?: number;
}

export class DragDetector {
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private maxMoveDistance: number;
  private maxTapDuration: number;

  constructor(options: DragDetectorOptions = {}) {
    this.maxMoveDistance = options.maxMoveDistancePixels ?? 6;
    this.maxTapDuration = options.maxTapDurationMs ?? 600;
  }

  public onPointerDown(clientX: number, clientY: number): void {
    this.startX = clientX;
    this.startY = clientY;
    this.startTime = performance.now();
  }

  public isClick(clientX: number, clientY: number): boolean {
    const elapsed = performance.now() - this.startTime;
    if (elapsed > this.maxTapDuration) {
      return false;
    }

    const dx = clientX - this.startX;
    const dy = clientY - this.startY;
    const distance = Math.hypot(dx, dy);

    return distance <= this.maxMoveDistance;
  }
}
