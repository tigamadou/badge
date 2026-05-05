// src/lib/qrcode.ts
import QRCode from "qrcode";

export async function generateQRCodeDataURL(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 200,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
