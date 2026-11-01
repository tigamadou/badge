// src/lib/qrcode.ts
import QRCode from "qrcode";

const QR_OPTIONS = {
  width: 200,
  margin: 1,
  errorCorrectionLevel: "M",
} as const;

export async function generateQRCodeDataURL(data: string): Promise<string> {
  return QRCode.toDataURL(data, QR_OPTIONS);
}

export async function generateQRCodePng(data: string): Promise<Buffer> {
  return QRCode.toBuffer(data, { ...QR_OPTIONS, type: "png" });
}
