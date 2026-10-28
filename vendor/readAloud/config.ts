/** 出典: kittyCrypto-gg/website/src/readAloud/config.ts（表示例に必要な設定だけを分離） */
export const READ_ALOUD_IGNORE_SELECTORS = [".reader-paragraph-num", ".bookmark-emoji"] as const;
export const READ_ALOUD_META_ATTR = "data-readaloud";
export const READ_ALOUD_VOICE = "ja-JP-NanamiNeural";
export const READ_ALOUD_REGIONS = [
    "uksouth", "japaneast", "japanwest", "westeurope", "northeurope",
    "eastus", "eastus2", "westus2", "southeastasia", "australiaeast",
] as const;
export const SPEECH_SDK_PATH = "./音声SDK.js";
