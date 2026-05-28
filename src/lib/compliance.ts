import { STANDARD_BLOCKS, getCharsForBlock } from "../constants/cjk";
import { HIRAGANA_RANGES, KATAKANA_RANGES } from '../constants/japanese';
import { JOYO_KANJI, JIS_LEVEL1_CHARS, JIS_LEVEL2_CHARS } from '../constants/japanese_jis';
import { KSX1001_HANGUL } from '../constants/korean_ksx1001';

// Group/Centralized CJK and other custom compliance verification logic.

// --- Chinese Standards Compliance ---
export interface ChineseComplianceResult {
  level: string;
  details: {
    gb2312Coverage: number;
    level1Coverage: number;
    level2Coverage: number;
    level3Coverage: number;
    big5Coverage?: number;
    supportedCount: number;
  };
}

export function checkBig5Compliance(supportedChars: Set<number>): {
  level: string;
  coverage: number;
  supportedCount: number;
} {
  const block = STANDARD_BLOCKS.find((b) => b.id === "big5");
  if (!block) return { level: "不支持", coverage: 0, supportedCount: 0 };
  const chars = getCharsForBlock(block);
  const totalInBlock = chars.length;
  if (totalInBlock === 0)
    return { level: "不支持", coverage: 0, supportedCount: 0 };

  let supportedCount = 0;
  for (const char of chars) {
    if (supportedChars.has(char.codePointAt(0)!)) {
      supportedCount++;
    }
  }
  const coverage = supportedCount / totalInBlock;

  let level = "不可用";
  if (coverage >= 0.95) level = "完全可用";
  else if (coverage >= 0.9) level = "基本可用";
  else if (coverage >= 0.85) level = "勉强可用";

  return { level, coverage, supportedCount };
}

export function checkChineseCompliance(
  supportedChars: Set<number>,
): ChineseComplianceResult {
  const getCoverage = (blockId: string) => {
    const block = STANDARD_BLOCKS.find((b) => b.id === blockId);
    if (!block) return 0;

    const chars = getCharsForBlock(block);
    const totalInBlock = chars.length;
    if (totalInBlock === 0) return 0;

    let supportedCount = 0;
    for (const char of chars) {
      if (supportedChars.has(char.codePointAt(0)!)) {
        supportedCount++;
      }
    }
    return supportedCount / totalInBlock;
  };

  const gb2312Coverage = getCoverage("gb2312");
  const level1Coverage = getCoverage("gb18030-level1");
  const level2Coverage = getCoverage("gb18030-level2");
  const level3Coverage = getCoverage("gb18030-level3");

  let level = "不可用";
  if (
    gb2312Coverage >= 0.95 ||
    level1Coverage >= 0.95 ||
    level2Coverage >= 0.95 ||
    level3Coverage >= 0.95
  ) {
    level = "完全可用";
  } else if (
    gb2312Coverage >= 0.9 ||
    level1Coverage >= 0.9 ||
    level2Coverage >= 0.9 ||
    level3Coverage >= 0.9
  ) {
    level = "基本可用";
  } else if (
    gb2312Coverage >= 0.85 ||
    level1Coverage >= 0.85 ||
    level2Coverage >= 0.85 ||
    level3Coverage >= 0.85
  ) {
    level = "勉强可用";
  }

  // Calculate supported count for the highest level or just use level 1 as base
  const level1Block = STANDARD_BLOCKS.find((b) => b.id === "gb18030-level1");
  const level1Chars = level1Block ? getCharsForBlock(level1Block) : [];
  const supportedCount = Math.round(level1Coverage * (level1Chars.length || 1));

  return {
    level,
    details: {
      gb2312Coverage,
      level1Coverage,
      level2Coverage,
      level3Coverage,
      supportedCount: supportedCount,
    },
  };
}

// --- Japanese Standards Compliance ---
export type JapaneseLevel = "非日文字体" | "日文基础可用" | "标准商业日文字库";

export interface JapaneseComplianceResult {
  is_japanese_font: boolean;
  level: JapaneseLevel;
  details: {
    kanaCoverage: number;
    supportedKana: number;
    totalKana: number;
    joyoCoverage: number;
    supportedJoyo: number;
    totalJoyo: number;
    jisCoverage: number;
    supportedJis: number;
    totalJis: number;
    jisLevel1Coverage: number;
    supportedJisLevel1: number;
    totalJisLevel1: number;
    jisLevel2Coverage: number;
    supportedJisLevel2: number;
    totalJisLevel2: number;
  };
}

export function checkJapaneseCompliance(supportedChars: Set<number>, jisCharsOverride?: string[]): JapaneseComplianceResult {
  const kanaOnly: number[] = [];
  [...HIRAGANA_RANGES, ...KATAKANA_RANGES].forEach(([start, end]) => {
    for (let i = start; i <= end; i++) kanaOnly.push(i);
  });

  const supportedKana = kanaOnly.filter(code => supportedChars.has(code)).length;
  const totalKana = 189; // standard kana
  const kanaCoverage = supportedKana / totalKana;

  const trueTotalJoyo = [...JOYO_KANJI].length;
  let supportedJoyo = 0;
  for (let char of JOYO_KANJI) {
    if (supportedChars.has(char.codePointAt(0)!)) {
      supportedJoyo++;
    }
  }
  const joyoCoverage = supportedJoyo / trueTotalJoyo;

  const trueTotalJisLevel1 = [...JIS_LEVEL1_CHARS].length;
  let supportedJisLevel1 = 0;
  for (let char of JIS_LEVEL1_CHARS) {
    if (supportedChars.has(char.codePointAt(0)!)) {
      supportedJisLevel1++;
    }
  }
  const jisLevel1Coverage = supportedJisLevel1 / trueTotalJisLevel1;

  const trueTotalJisLevel2 = [...JIS_LEVEL2_CHARS].length;
  let supportedJisLevel2 = 0;
  for (let char of JIS_LEVEL2_CHARS) {
    if (supportedChars.has(char.codePointAt(0)!)) {
      supportedJisLevel2++;
    }
  }
  const jisLevel2Coverage = supportedJisLevel2 / trueTotalJisLevel2;
  
  const totalJis = trueTotalJisLevel1 + trueTotalJisLevel2;
  const supportedJis = supportedJisLevel1 + supportedJisLevel2;
  const jisCoverage = supportedJis / totalJis;

  let level: JapaneseLevel = "非日文字体";
  let is_japanese_font = false;

  if (kanaCoverage >= 0.90) {
    is_japanese_font = true;
    if (joyoCoverage >= 0.99) {
      level = "日文基础可用";
      if (jisLevel1Coverage >= 0.99) {
        if (jisLevel2Coverage >= 0.95) {
          level = "标准商业日文字库";
        }
      }
    }
  }

  return {
    is_japanese_font,
    level,
    details: { 
      kanaCoverage, supportedKana, totalKana, 
      joyoCoverage, supportedJoyo, totalJoyo: trueTotalJoyo,
      jisCoverage, supportedJis, totalJis,
      jisLevel1Coverage, supportedJisLevel1, totalJisLevel1: trueTotalJisLevel1,
      jisLevel2Coverage, supportedJisLevel2, totalJisLevel2: trueTotalJisLevel2
    }
  };
}

// --- Korean Standards Compliance ---
export type KoreanLevel = "不支持" | "基本支持" | "完全支持";

export interface KoreanComplianceResult {
  is_korean_font: boolean;
  level: KoreanLevel;
  details: {
    jamoCoverage: number;
    supportedJamo: number;
    totalJamo: number;
    syllablesCoverage: number;
    supportedSyllables: number;
    totalSyllables: number;
    ksCoverage: number;
    supportedKs: number;
    totalKs: number;
  };
}

export function checkKoreanCompliance(supportedChars: Set<number>): KoreanComplianceResult {
  const startJamo = 0x3130;
  const endJamo = 0x318F;
  let supportedJamo = 0;
  let totalJamo = 0;
  for (let code = startJamo; code <= endJamo; code++) {
    totalJamo++;
    if (supportedChars.has(code)) {
      supportedJamo++;
    }
  }
  const jamoCoverage = totalJamo > 0 ? supportedJamo / totalJamo : 0;

  const startSyllable = 0xAC00;
  const endSyllable = 0xD7AF;
  let supportedSyllables = 0;
  let totalSyllables = 11172; 
  for (let code = startSyllable; code <= endSyllable; code++) {
    if (supportedChars.has(code)) {
      supportedSyllables++;
    }
  }
  const syllablesCoverage = totalSyllables > 0 ? supportedSyllables / totalSyllables : 0;

  const trueTotalKs = [...KSX1001_HANGUL].length;
  let supportedKs = 0;
  for (let char of KSX1001_HANGUL) {
    if (supportedChars.has(char.codePointAt(0)!)) {
      supportedKs++;
    }
  }
  const ksCoverage = trueTotalKs > 0 ? supportedKs / trueTotalKs : 0;

  let level: KoreanLevel = "不支持";
  if (jamoCoverage >= 0.95 && syllablesCoverage >= 0.95 && ksCoverage >= 0.90) {
    level = "完全支持";
  } else if (jamoCoverage >= 0.90 && syllablesCoverage >= 0.90 && ksCoverage >= 0.85) {
    level = "基本支持";
  }

  const is_korean_font = level !== "不支持";

  return {
    is_korean_font,
    level,
    details: {
      jamoCoverage,
      supportedJamo,
      totalJamo,
      syllablesCoverage,
      supportedSyllables,
      totalSyllables,
      ksCoverage,
      supportedKs,
      totalKs: trueTotalKs
    }
  };
}

// --- Georgian Standards Compliance ---
export interface GeorgianComplianceResult {
  level: string;
  details: {
    mkhedruliCoverage: number;
    mtavruliCoverage: number;
    khutsuriCoverage: number;
  };
}

export function checkGeorgianCompliance(supportedChars: Set<number>): GeorgianComplianceResult {
  let mkhedruliSupported = 0;
  for (let i = 0x10d0; i <= 0x10f0; i++) {
    if (supportedChars.has(i)) mkhedruliSupported++;
  }
  const mkhedruliCoverage = mkhedruliSupported / 33;

  let mtavruliSupported = 0;
  for (let i = 0x1c90; i <= 0x1cb0; i++) {
    if (supportedChars.has(i)) mtavruliSupported++;
  }
  const mtavruliCoverage = mtavruliSupported / 33;

  let khutsuriSupported = 0;
  for (let i = 0x10a0; i <= 0x10c0; i++) {
    if (supportedChars.has(i)) khutsuriSupported++;
  }
  for (let i = 0x2d00; i <= 0x2d20; i++) {
    if (supportedChars.has(i)) khutsuriSupported++;
  }
  const khutsuriCoverage = khutsuriSupported / 66;

  let level = "不可用";
  if (mkhedruliCoverage >= 0.99) {
    if (mtavruliCoverage >= 0.99) {
      if (khutsuriCoverage >= 0.9) {
        level = "专业级支持"; 
      } else {
        level = "现代标准支持"; 
      }
    } else {
      level = "基础现代支持"; 
    }
  } else if (mkhedruliCoverage > 0.5) {
    level = "部分现代支持";
  }

  return {
    level,
    details: {
      mkhedruliCoverage,
      mtavruliCoverage,
      khutsuriCoverage
    }
  };
}
