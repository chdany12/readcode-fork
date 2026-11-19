import { JetBrains_Mono } from "next/font/google";

// A clearly monospaced face for code-styled chrome (logo, nav). Geist Mono reads too close to Geist at small sizes.
export const codeFont = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"] });
