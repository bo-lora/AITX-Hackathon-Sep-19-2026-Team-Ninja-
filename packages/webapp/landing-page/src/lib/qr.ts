import QRCode from "qrcode";

export async function linkedInQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    width: 240,
    errorCorrectionLevel: "H",
    color: {
      dark: "#1b2433",
      light: "#ffffff",
    },
  });
}
