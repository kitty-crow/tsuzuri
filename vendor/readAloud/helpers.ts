/** 移植元の読上モジュールが使用する最小の型判定。 */
export function isRecord(候補: unknown): 候補 is Record<string, unknown> {
    return typeof 候補 === "object" && 候補 !== null && !Array.isArray(候補);
}
