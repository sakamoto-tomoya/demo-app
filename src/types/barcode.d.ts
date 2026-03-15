/**
 * BarcodeDetector API (Chrome/Edge Android 等で利用可能)
 * @see https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector
 */
interface BarcodeDetectorOptions {
  formats?: string[];
}

interface DetectedBarcode {
  rawValue: string;
  format: string;
  boundingBox: DOMRectReadOnly;
  cornerPoints: [DOMPoint, DOMPoint, DOMPoint, DOMPoint];
}

declare var BarcodeDetector: {
  prototype: BarcodeDetectorInterface;
  new (options?: BarcodeDetectorOptions): BarcodeDetectorInterface;
  getSupportedFormats(): Promise<string[]>;
};

interface BarcodeDetectorInterface {
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
}
