import {
  useState,
  useCallback,
  ChangeEvent,
  DragEvent,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { parseFontFile } from "./lib/fontParser";
import * as opentype from "opentype.js";
import {
  UNICODE_BLOCKS,
  STANDARD_BLOCKS,
  getCharsForBlock,
  CharBlock,
} from "./constants/cjk";
import {
  checkJapaneseCompliance,
  JapaneseComplianceResult,
  checkKoreanCompliance,
  KoreanComplianceResult,
  checkChineseCompliance,
  checkBig5Compliance,
  ChineseComplianceResult,
  checkGeorgianCompliance,
  GeorgianComplianceResult,
} from "./lib/compliance";
// No longer using European specific compliance in favor of global country metadata

import {
  COUNTRY_METADATA,
  LANGUAGE_ALPHABETS,
  getCountryAlphabet,
  getLanguageAlphabet,
  evaluateCountryCoverageAndStatus,
} from "./lib/languages";

import {
  UploadCloud,
  Search,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
  ChevronDown,
  X,
  Eye,
  EyeOff,
  Layers,
  Copy,
  Check,
  Globe,
  Map,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  Download,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

import WorldMap from "./components/WorldMap";
import MicroContourDiff from "./components/MicroContourDiff";

// Tailwind is imported in main.tsx via index.css

interface FontData {
  fontName: string;
  fontFamilyCSS: string;
  supportedChars: Set<number>;
  glyphCount: number;
  buffer?: ArrayBuffer;
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fontData, setFontData] = useState<FontData | null>(null);

  // App Navigation Tabs
  const [activeTab, setActiveTab] = useState<"global" | "unicode" | "custom" | "diff">("global");

  // Comparison (Diff) Tab State
  const [comparisonFontData, setComparisonFontData] = useState<FontData | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [diffTab, setDiffTab] = useState<"added" | "deleted" | "unchanged">("unchanged");
  const [diffSearchQuery, setDiffSearchQuery] = useState("");
  const [diffPageSize, setDiffPageSize] = useState(200);
  const [diffCurrentPage, setDiffCurrentPage] = useState(1);
  const [diffZoomChar, setDiffZoomChar] = useState<string | null>(null);

  // Micro contour diff state
  const [microDiffText, setMicroDiffText] = useState<string>("永");
  const [microDiffSelectedChar, setMicroDiffSelectedChar] = useState<string>("永");
  const [microDiffLayout, setMicroDiffLayout] = useState<"side-by-side" | "stacked" | "overlay">("overlay");
  const [microDiffFill, setMicroDiffFill] = useState<boolean>(true);
  const [microDiffStroke, setMicroDiffStroke] = useState<boolean>(true);
  const [microDiffNodes, setMicroDiffNodes] = useState<boolean>(true);
  const [microDiffBaseOpacity, setMicroDiffBaseOpacity] = useState<number>(0.5);
  const [microDiffCompOpacity, setMicroDiffCompOpacity] = useState<number>(0.5);

  // Custom Validation Tab State
  const [customMethod, setCustomMethod] = useState<"input" | "standard" | "file">("input");
  const [selectedCustomStandardId, setSelectedCustomStandardId] = useState<string>("gb2312");
  const [customSetInput, setCustomSetInput] = useState<string>("");
  const [customFilterMode, setCustomFilterMode] = useState<"all" | "missing" | "covered">("all");
  const [customSearchQuery, setCustomSearchQuery] = useState("");
  const [customFileLoaded, setCustomFileLoaded] = useState<string | null>(null);
  const [customDisplayLimit, setCustomDisplayLimit] = useState(1000);

  useEffect(() => {
    setCustomDisplayLimit(1000);
  }, [customMethod, selectedCustomStandardId, customFilterMode, customSearchQuery]);

  const [isCopiedCustomMissing, setIsCopiedCustomMissing] = useState(false);

  const [selectedBlockId, setSelectedBlockId] = useState<string>(
    UNICODE_BLOCKS[0].id,
  );
  const [blockSearchQuery, setBlockSearchQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<"current" | "global">(
    "current",
  );
  const [filterMode, setFilterMode] = useState<"all" | "missing" | "covered">(
    "all",
  );
  const [isNorthMacedoniaExpanded, setIsNorthMacedoniaExpanded] =
    useState(false);
  const [isJapaneseExpanded, setIsJapaneseExpanded] = useState(false);
  const [isKoreanExpanded, setIsKoreanExpanded] = useState(false);
  const [expandedCountries, setExpandedCountries] = useState<
    Record<string, boolean>
  >({});
  const [collapsedContinents, setCollapsedContinents] = useState<
    Record<string, boolean>
  >({
    亚洲: true,
    欧洲: true,
    非洲: true,
    北美洲: true,
    南美洲: true,
    大洋洲: true,
    其他: true,
  });
  const [selectedCountryForModal, setSelectedCountryForModal] = useState<
    string | null
  >(null);
  const [mapViewMode, setMapViewMode] = useState<"globe" | "flat">("globe");
  const [cnDetailedBlockId, setCnDetailedBlockId] = useState<string | null>(
    null,
  );
  const [copiedLanguage, setCopiedLanguage] = useState<string | null>(null);
  const [modalLanguageFilters, setModalLanguageFilters] = useState<
    Record<string, "all" | "missing" | "existing">
  >({});
  const [gridFilterMode, setGridFilterMode] = useState<
    "all" | "missing" | "existing"
  >("all");
  const continents = useMemo(() => {
    const order = ["亚洲", "欧洲", "非洲", "北美洲", "南美洲", "大洋洲"];
    const tempSet = new Set<string>();
    Object.values(COUNTRY_METADATA).forEach((m) => {
      if (m.continent) tempSet.add(m.continent);
    });
    const presentContinents = Array.from(tempSet);
    const sorted = order.filter((c) => presentContinents.includes(c));
    // Add any unexpected continents at the end
    presentContinents.forEach((c) => {
      if (!order.includes(c)) sorted.push(c);
    });
    return sorted;
  }, []);

  const groupedCountries = useMemo(() => {
    const groups: Record<string, string[]> = {};
    Object.keys(COUNTRY_METADATA).forEach((countryName) => {
      const continent = COUNTRY_METADATA[countryName].continent || "其他";
      if (!groups[continent]) groups[continent] = [];
      groups[continent].push(countryName);
    });
    return groups;
  }, []);
  const isUnassigned = useMemo(
    () => (c: string) => {
      const code = c.codePointAt(0)!;
      const isControl =
        (code >= 0x0000 && code <= 0x001f) ||
        (code >= 0x0080 && code <= 0x009f);
      return isControl || /\p{Cn}/u.test(c);
    },
    [],
  );

  // Helper to extract unique non-whitespace characters
  const parseCustomCharacters = useCallback((rawText: string): string[] => {
    const set = new Set<string>();
    // Try to parse as JSON first in case they uploaded a JSON array/object of strings
    let textToParse = rawText;
    try {
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed)) {
        textToParse = parsed.join("");
      } else if (typeof parsed === "object" && parsed !== null) {
        textToParse = Object.values(parsed).join("");
      }
    } catch (e) {
      // Just parse as raw text
    }

    for (const char of textToParse) {
      if (/\s/.test(char)) continue;
      const code = char.codePointAt(0);
      if (code && ((code >= 0x0000 && code <= 0x001f) || (code >= 0x0080 && code <= 0x009f))) {
        continue;
      }
      set.add(char);
    }
    return Array.from(set);
  }, []);

  const customTargetChars = useMemo(() => {
    if (customMethod === "standard") {
      const block = STANDARD_BLOCKS.find((b) => b.id === selectedCustomStandardId);
      if (block) {
        return getCharsForBlock(block);
      }
      return [];
    }
    return parseCustomCharacters(customSetInput);
  }, [customMethod, selectedCustomStandardId, customSetInput, parseCustomCharacters]);

  const customStats = useMemo(() => {
    if (!fontData || customTargetChars.length === 0) {
      return { total: customTargetChars.length, covered: 0, missing: customTargetChars.length, rate: 0 };
    }
    let covered = 0;
    for (const char of customTargetChars) {
      const code = char.codePointAt(0);
      if (code && fontData.supportedChars.has(code)) {
        covered++;
      }
    }
    const missing = customTargetChars.length - covered;
    const rate = customTargetChars.length > 0 ? (covered / customTargetChars.length) * 100 : 0;
    return {
      total: customTargetChars.length,
      covered,
      missing,
      rate,
    };
  }, [fontData, customTargetChars]);

  const filteredCustomChars = useMemo(() => {
    return customTargetChars.filter((char) => {
      if (customSearchQuery) {
        const query = customSearchQuery.trim().toUpperCase();
        const codeHex = `U+${char.codePointAt(0)?.toString(16).toUpperCase()}`;
        if (!char.toUpperCase().includes(query) && !codeHex.includes(query)) {
          return false;
        }
      }

      if (!fontData) return true; // Show all if no font uploaded yet
      const code = char.codePointAt(0);
      const isCovered = !!(code && fontData.supportedChars.has(code));
      if (customFilterMode === "missing") return !isCovered;
      if (customFilterMode === "covered") return isCovered;
      return true;
    });
  }, [customTargetChars, customSearchQuery, customFilterMode, fontData]);

  const parsedBaseFont = useMemo(() => {
    if (!fontData?.buffer) return null;
    try {
      return opentype.parse(fontData.buffer);
    } catch (e) {
      console.error("Failed parsing base font with opentype.js:", e);
      return null;
    }
  }, [fontData?.buffer]);

  const parsedCompFont = useMemo(() => {
    if (!comparisonFontData?.buffer) return null;
    try {
      return opentype.parse(comparisonFontData.buffer);
    } catch (e) {
      console.error("Failed parsing comparison font with opentype.js:", e);
      return null;
    }
  }, [comparisonFontData?.buffer]);

  const diffResult = useMemo(() => {
    if (!fontData || !comparisonFontData) {
      return {
        added: [] as number[],
        deleted: [] as number[],
        unchanged: [] as number[],
        addedSet: new Set<number>(),
        deletedSet: new Set<number>(),
        unchangedSet: new Set<number>(),
      };
    }

    const baseSet = fontData.supportedChars;
    const newSet = comparisonFontData.supportedChars;

    const addedList: number[] = [];
    const deletedList: number[] = [];
    const unchangedList: number[] = [];

    const addedSet = new Set<number>();
    const deletedSet = new Set<number>();
    const unchangedSet = new Set<number>();

    // S_added = S_new \ S_base
    for (const code of newSet) {
      if (!baseSet.has(code)) {
        addedList.push(code);
        addedSet.add(code);
      } else {
        unchangedList.push(code);
        unchangedSet.add(code);
      }
    }

    // S_deleted = S_base \ S_new
    for (const code of baseSet) {
      if (!newSet.has(code)) {
        deletedList.push(code);
        deletedSet.add(code);
      }
    }

    addedList.sort((a, b) => a - b);
    deletedList.sort((a, b) => a - b);
    unchangedList.sort((a, b) => a - b);

    return {
      added: addedList,
      deleted: deletedList,
      unchanged: unchangedList,
      addedSet,
      deletedSet,
      unchangedSet,
    };
  }, [fontData, comparisonFontData]);

  const diffRatioPct = useMemo(() => {
    if (!fontData || !comparisonFontData) {
      return { leftPct: 0, sharedPct: 0, rightPct: 0, leftCount: 0, sharedCount: 0, rightCount: 0 };
    }
    const leftVal = diffResult.deleted.length;
    const sharedVal = diffResult.unchanged.length;
    const rightVal = diffResult.added.length;

    let activeSegments = 0;
    if (leftVal > 0) activeSegments++;
    if (sharedVal > 0) activeSegments++;
    if (rightVal > 0) activeSegments++;

    if (activeSegments === 0) {
      return { leftPct: 0, sharedPct: 0, rightPct: 0, leftCount: 0, sharedCount: 0, rightCount: 0 };
    }

    const minPct = 14; // Each active segment gets at least 14% width if value > 0
    const totalMin = activeSegments * minPct;
    const remainingPct = 100 - totalMin;

    const sumAll = leftVal + sharedVal + rightVal || 1;

    const lPct = leftVal > 0 ? minPct + (leftVal / sumAll) * remainingPct : 0;
    const sPct = sharedVal > 0 ? minPct + (sharedVal / sumAll) * remainingPct : 0;
    const rPct = rightVal > 0 ? minPct + (rightVal / sumAll) * remainingPct : 0;

    return {
      leftPct: lPct,
      sharedPct: sPct,
      rightPct: rPct,
      leftCount: leftVal,
      sharedCount: sharedVal,
      rightCount: rightVal
    };
  }, [fontData, comparisonFontData, diffResult]);

  const filteredDiffChars = useMemo(() => {
    const list = diffResult[diffTab];
    if (!diffSearchQuery) return list;

    const query = diffSearchQuery.trim();
    return list.filter((code) => {
      const char = String.fromCodePoint(code);
      const hex = `U+${code.toString(16).toUpperCase()}`;
      const dec = code.toString();
      return (
        char.includes(query) ||
        hex.toUpperCase().includes(query.toUpperCase()) ||
        dec.includes(query)
      );
    });
  }, [diffResult, diffTab, diffSearchQuery]);

  const totalDiffPages = Math.ceil(filteredDiffChars.length / diffPageSize) || 1;

  const paginatedDiffChars = useMemo(() => {
    const page = Math.min(Math.max(1, diffCurrentPage), totalDiffPages);
    const start = (page - 1) * diffPageSize;
    return filteredDiffChars.slice(start, start + diffPageSize);
  }, [filteredDiffChars, diffCurrentPage, diffPageSize, totalDiffPages]);

  useEffect(() => {
    setDiffCurrentPage(1);
  }, [diffTab, diffSearchQuery, diffPageSize]);
  const [hoveredCell, setHoveredCell] = useState<{
    char: string;
    codepoint: string;
    isMissing: boolean;
    isUnassigned: boolean;
    rect: DOMRect;
    blockName: string;
    isCopied?: boolean;
  } | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const renderCustomValidationView = () => {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Custom Input Header */}
        <div className="bg-white rounded-lg border border-neutral-200/85 p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-neutral-100">
            <div>
              <h2 className="text-sm font-bold font-mono tracking-wider text-neutral-800 uppercase flex items-center gap-2">
                🎯 字体字符集自定义校验
              </h2>
              <p className="text-xs text-neutral-400 mt-1 font-sans">
                输入或导入您自有的特定高频字表、字集规范，立即研判当前字体对该特定集合的支持完备性状态
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {customSetInput && (
                <button
                  onClick={() => {
                    setCustomSetInput("");
                    setCustomFileLoaded(null);
                  }}
                  className="cursor-pointer px-3 py-1.5 text-xs font-semibold text-neutral-500 hover:text-red-500 bg-white border border-neutral-200 hover:border-red-200 rounded transition-all font-mono select-none"
                >
                  清空
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input Form area */}
            <div className="lg:col-span-5 space-y-4">
              {/* Method Switcher */}
              <div className="flex bg-neutral-100 p-0.5 rounded-lg border border-neutral-200/60 select-none">
                <button
                  type="button"
                  onClick={() => setCustomMethod("input")}
                  className={`flex-1 text-center py-1.5 text-xs font-bold rounded-md transition-all duration-150 cursor-pointer ${
                    customMethod === "input"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  方式一：粘贴文本
                </button>
                <button
                  type="button"
                  onClick={() => setCustomMethod("standard")}
                  className={`flex-1 text-center py-1.5 text-xs font-bold rounded-md transition-all duration-150 cursor-pointer ${
                    customMethod === "standard"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  方式二：内建标准
                </button>
                <button
                  type="button"
                  onClick={() => setCustomMethod("file")}
                  className={`flex-1 text-center py-1.5 text-xs font-bold rounded-md transition-all duration-150 cursor-pointer ${
                    customMethod === "file"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  方式三：文本上传
                </button>
              </div>

              {/* Dynamic Content based on chosen customMethod */}
              {customMethod === "input" && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 font-mono">
                    手动输入或粘贴需要校验的目标通用文本：
                  </label>
                  <textarea
                    value={customSetInput}
                    onChange={(e) => setCustomSetInput(e.target.value)}
                    placeholder="在此直接粘贴您的测试字符、生僻字词库或任意段落集合..."
                    className="w-full h-56 p-3 text-xs bg-neutral-50/20 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 placeholder-neutral-400 font-sans leading-relaxed resize-none"
                  />
                  <p className="text-[10px] text-neutral-400 font-sans leading-relaxed">
                    ✍️ 贴入文本后，系统会自动对所有字符进行去重、过滤空白，并立即统计在当前字体中的覆盖率。
                  </p>
                </div>
              )}

              {customMethod === "standard" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 font-mono">
                      请选择内建的通用国际 / 国家标准规范字集：
                    </label>
                    <div className="relative">
                      <select
                        value={selectedCustomStandardId}
                        onChange={(e) => setSelectedCustomStandardId(e.target.value)}
                        className="w-full appearance-none text-xs font-semibold bg-white border border-neutral-200 rounded-md py-2.5 pl-3 pr-10 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 text-neutral-800 cursor-pointer"
                      >
                        <optgroup label="国家/地区标准（GB/T / GB）">
                          <option value="gb2312">GB2312 (简化字常用标准 - 6763字)</option>
                          <option value="gb18030-level1">GB18030-2022 级别 1 (常用汉字 - 27533字)</option>
                          <option value="gb18030-level2">GB18030-2022 级别 2 (规范汉字 - 27729字)</option>
                          <option value="gb18030-level3">GB18030-2022 级别 3 (全量汉字库 - 88101字)</option>
                        </optgroup>
                        <optgroup label="地方标准与其它">
                          <option value="big5">BIG5 (繁体 / 五大码标准 - 13461字)</option>
                        </optgroup>
                        <optgroup label="日本工业标准（JIS）">
                          <option value="joyo-kanji">日本常用汉字 (JOYO Kanji - 2136字)</option>
                          <option value="jis-x-0208-level1">JIS X 0208 第一水准 (常用字段)</option>
                          <option value="jis-x-0208-level2">JIS X 0208 第二水准 (生僻/辅助字段)</option>
                          <option value="japanese-kana">假名 (Hiragana / Katakana - 189字)</option>
                        </optgroup>
                        <optgroup label="韩国工业标准（KS）">
                          <option value="ks-x-1001">KS X 1001 (Hangul - 2350字)</option>
                        </optgroup>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-neutral-400">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-neutral-50 border border-neutral-200/60 rounded-lg p-3 text-xs text-neutral-500 leading-relaxed font-sans">
                    <div className="font-bold text-neutral-700 flex items-center gap-1.5 mb-1.5 font-mono">
                      💡 <span>字集规范详情说明</span>
                    </div>
                    {selectedCustomStandardId.startsWith("gb18030") && (
                      <span>
                        <strong>GB18030-2022</strong> 是最新的中国国家汉字强制性编码标准。
                        {selectedCustomStandardId === "gb18030-level1" && " 级别1覆盖了 CJK基本区与扩展A区汉字。它是多数日常字体的基本支持红线。"}
                        {selectedCustomStandardId === "gb18030-level2" && " 级别2在此基础上追加了通用规范汉字表中分布在其他扩展区的196个关键生僻汉字。"}
                        {selectedCustomStandardId === "gb18030-level3" && " 级别3需支持全量 8.7w+ 个罕见、历史与生僻汉字，是特级学术/排版类字库才需满足的超高规格。建议对大字符集字库进行验证。"}
                      </span>
                    )}
                    {selectedCustomStandardId === "gb2312" && (
                      <span>
                        <strong>GB2312-80</strong> 是最经典的简体中文汉字编码标准，收录一级常用汉字 3755 个，二级汉字 3008 个，总记 6763 个汉字。几乎所有现代中文电脑字体都会通盘支持该子集。
                      </span>
                    )}
                    {selectedCustomStandardId === "big5" && (
                      <span>
                        <strong>BIG5 五大码</strong> 是繁体中文社群最通行的字符编码标准，共收录 13461 个汉字。用于研判字体对台港澳繁体内容的支持状态。
                      </span>
                    )}
                    {selectedCustomStandardId === "joyo-kanji" && (
                      <span>
                        <strong>日本常用汉字 (常用漢字)</strong> 由日本文化厅发布，共收录 2136 个现代日语书写中最高频使用的汉字。
                      </span>
                    )}
                    {selectedCustomStandardId.includes("jis-x-0208") && (
                      <span>
                        <strong>JIS X 0208</strong> 是日本工业制定的汉字字符集标准。{selectedCustomStandardId === "jis-x-0208-level1" ? " 第一水准包含 2965 个第一阶高频核心汉字。" : " 第二水准包含 3390 个第二阶罕见字和辅助汉字。"}
                      </span>
                    )}
                    {selectedCustomStandardId === "ks-x-1001" && (
                      <span>
                        <strong>KS X 1001</strong> 是韩国主流的汉字与韩文谚文标准，它收录了韩文谚文常用 2350 个字及 4888 个韩文汉字。
                      </span>
                    )}
                    {selectedCustomStandardId === "japanese-kana" && (
                      <span>
                        <strong>日文假名 (平假名 & 片假名)</strong> 包含日语书写的基本音节符号，总计 189 个字符。
                      </span>
                    )}
                  </div>
                </div>
              )}

              {customMethod === "file" && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 font-mono">
                    请点击或拖拽上传含有自定义文本的本地文件：
                  </label>
                  <div className="border border-dashed border-neutral-250 hover:border-neutral-405 py-8 px-4 rounded-lg bg-neutral-50/25 flex flex-col items-center justify-center relative text-center transition-all min-h-[160px]">
                    <input
                      type="file"
                      accept=".txt,.json"
                      onChange={handleCustomCharsFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <UploadCloud className="w-6 h-6 text-neutral-400 mb-2" />
                    <span className="text-xs text-neutral-500 font-medium font-sans">
                      {customFileLoaded ? `已加载：${customFileLoaded}` : "点击或拖拽 TXT / JSON 文件进行导入"}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono mt-1.5">
                      导入后系统会自动读取并剔除空白和重复符号
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Analysis Metrics and results area */}
            <div className="lg:col-span-7 space-y-5">
              {!fontData ? (
                <div className="h-full border border-dashed border-neutral-200 rounded-lg bg-neutral-50/25 flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
                  <div className="text-neutral-400 mb-3 bg-white p-3.5 rounded-full border border-neutral-200/50 shadow-sm">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-bold font-mono tracking-wider text-neutral-700 uppercase">
                    等待上传字体文件
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-1 max-w-sm leading-relaxed">
                    您当前尚未加载需要审查的 TTF/OTF 字体文件。可在页面最顶部上传字体文件，或者{" "}
                    <button 
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-neutral-900 underline font-semibold cursor-pointer"
                    >
                      点击此处滚动至顶部上传区域
                    </button>。
                  </p>
                  
                  {customTargetChars.length > 0 && (
                    <div className="mt-5 text-xs bg-neutral-100 border border-neutral-200/50 px-3.5 py-1.5 rounded text-neutral-600 font-mono">
                      已就绪目标校验字符：
                      <span className="font-bold text-neutral-900 ml-1">
                        {customTargetChars.length} 个
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-neutral-50/50 p-3.5 rounded-lg border border-neutral-200/60 text-left">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">
                        目标总字数
                      </div>
                      <div className="text-xl font-mono font-bold text-neutral-900 mt-1">
                        {customStats.total}
                      </div>
                    </div>
                    <div className="bg-emerald-50/35 p-3.5 rounded-lg border border-emerald-100/70 text-left">
                      <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest font-mono">
                        已支持字数
                      </div>
                      <div className="text-xl font-mono font-bold text-emerald-700 mt-1">
                        {customStats.covered}
                      </div>
                    </div>
                    <div className={`p-3.5 rounded-lg border text-left ${customStats.missing > 0 ? 'bg-amber-50/35 border-amber-100/70' : 'bg-neutral-50/50 border-neutral-200/60'}`}>
                      <div className={`text-[10px] font-bold uppercase tracking-widest font-mono ${customStats.missing > 0 ? 'text-amber-600' : 'text-neutral-400'}`}>
                        缺失/未覆盖
                      </div>
                      <div className={`text-xl font-mono font-bold mt-1 ${customStats.missing > 0 ? 'text-amber-700' : 'text-neutral-950'}`}>
                        {customStats.missing}
                      </div>
                    </div>
                    <div className="bg-neutral-900 p-3.5 rounded-lg text-left text-white">
                      <div className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest font-mono">
                        全套覆盖率
                      </div>
                      <div className="text-xl font-mono font-bold mt-1">
                        {customStats.rate.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Progressive indicator bar */}
                  <div className="bg-neutral-100 h-2 rounded-full overflow-hidden w-full border border-neutral-200/20">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${customStats.rate === 100 ? 'bg-emerald-500' : 'bg-neutral-950'}`}
                      style={{ width: `${customStats.rate}%` }}
                    />
                  </div>

                  {/* Tab tools bar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                    {/* View filter */}
                    <div className="flex bg-neutral-100 p-0.5 rounded-md border border-neutral-200/60 select-none">
                      <button
                        onClick={() => setCustomFilterMode("all")}
                        className={`cursor-pointer px-3 py-1 text-xs font-semibold rounded-[4px] transition-all ${
                          customFilterMode === "all"
                            ? "bg-white text-neutral-900 font-bold shadow-xs whitespace-nowrap"
                            : "text-neutral-500 hover:text-neutral-800 whitespace-nowrap"
                        }`}
                      >
                        全部 ({customTargetChars.length})
                      </button>
                      <button
                        onClick={() => setCustomFilterMode("covered")}
                        className={`cursor-pointer px-3 py-1 text-xs font-semibold rounded-[4px] transition-all ${
                          customFilterMode === "covered"
                            ? "bg-white text-emerald-700 font-bold shadow-xs whitespace-nowrap"
                            : "text-neutral-500 hover:text-neutral-800 whitespace-nowrap"
                        }`}
                      >
                        已支持 ({customStats.covered})
                      </button>
                      <button
                        onClick={() => setCustomFilterMode("missing")}
                        className={`cursor-pointer px-3 py-1 text-xs font-semibold rounded-[4px] transition-all ${
                          customFilterMode === "missing"
                            ? "bg-white text-amber-700 font-bold shadow-xs whitespace-nowrap"
                            : "text-neutral-500 hover:text-neutral-800 whitespace-nowrap"
                        }`}
                      >
                        缺失 ({customStats.missing})
                      </button>
                    </div>

                    {/* Copy and Search Actions */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 sm:flex-initial">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="text"
                          value={customSearchQuery}
                          onChange={(e) => setCustomSearchQuery(e.target.value)}
                          placeholder="过滤字符及U+码点..."
                          className="w-full sm:w-36 pl-8 pr-3 py-1 text-xs border border-neutral-205 rounded focus:outline-none focus:border-neutral-900 bg-white"
                        />
                      </div>

                      {customStats.missing > 0 && (
                        <button
                          onClick={() => {
                            const missingList = customTargetChars.filter(char => {
                              const code = char.codePointAt(0);
                              return !code || !fontData.supportedChars.has(code);
                            }).join("");
                            
                            navigator.clipboard.writeText(missingList);
                            setIsCopiedCustomMissing(true);
                            setTimeout(() => setIsCopiedCustomMissing(false), 2000);
                          }}
                          className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all border shrink-0 ${
                            isCopiedCustomMissing
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-bold"
                              : "bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-900 shadow-sm"
                          }`}
                        >
                          {isCopiedCustomMissing ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>已复制缺失列表</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>一键复制缺失字</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Character visualizer grid */}
                  <div className="border border-neutral-200/85 rounded-lg bg-[#FAFAFA] p-4 max-h-[300px] overflow-y-auto relative">
                    {filteredCustomChars.length === 0 ? (
                      <div className="text-center py-12 text-neutral-400 text-xs font-mono">
                        {customSearchQuery ? "未找到匹配的可视化字符" : "测试字集在该状态下为空 🎉"}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                          {filteredCustomChars.slice(0, customDisplayLimit).map((char, index) => {
                            const code = char.codePointAt(0);
                            const isSupported = !!(code && fontData.supportedChars.has(code));
                            const codepointHex = `U+${code?.toString(16).toUpperCase().padStart(4, "0")}`;

                            return (
                              <div
                                key={`${char}-${index}`}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoveredCell({
                                    char,
                                    codepoint: codepointHex,
                                    isMissing: !isSupported,
                                    isUnassigned: false,
                                    rect,
                                    blockName: getBlockNameForChar(char),
                                  });
                                }}
                                onMouseLeave={() => setHoveredCell(null)}
                                onClick={() => {
                                  navigator.clipboard.writeText(char);
                                  setHoveredCell((prev) =>
                                    prev && prev.char === char
                                      ? { ...prev, isCopied: true }
                                      : prev,
                                  );
                                  setTimeout(() => {
                                    setHoveredCell((prev) =>
                                      prev && prev.char === char
                                        ? { ...prev, isCopied: false }
                                        : prev,
                                    );
                                  }, 1200);
                                }}
                                style={{
                                  fontFamily: isSupported
                                    ? `"${fontData.fontFamilyCSS}", sans-serif`
                                    : "inherit",
                                }}
                                className={`relative select-none cursor-pointer h-10 w-full flex items-center justify-center border text-sm font-semibold rounded transition-all active:scale-90 select-all ${
                                  isSupported
                                    ? "bg-white border-neutral-200 text-neutral-900 hover:border-neutral-400"
                                    : "bg-amber-50/50 border-amber-200/70 text-amber-700 hover:border-amber-450 line-through decoration-amber-400/40 opacity-75 hover:opacity-100"
                                }`}
                              >
                                {char}
                              </div>
                            );
                          })}
                        </div>

                        {filteredCustomChars.length > customDisplayLimit && (
                          <div className="flex justify-center py-4">
                            <button
                              onClick={() => setCustomDisplayLimit(prev => prev + 2000)}
                              className="px-6 py-2 bg-white border border-neutral-200 rounded-lg text-xs font-bold text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 hover:border-neutral-300 transition-all cursor-pointer select-none"
                            >
                              加载更多字符 ({filteredCustomChars.length - customDisplayLimit} 待显示...)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleComparisonFontUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !file.name.toLowerCase().endsWith(".otf") &&
      !file.name.toLowerCase().endsWith(".ttf")
    ) {
      setComparisonError("暂不支持该格式，请上传 .otf 或 .ttf 字体包");
      return;
    }

    setComparisonLoading(true);
    setComparisonError(null);
    setComparisonFontData(null);

    await new Promise((r) => setTimeout(r, 50));

    const result = await parseFontFile(file);

    if (result.error) {
      setComparisonError(result.error);
    } else {
      const uniqueFontFamilyName = `comparison-font-${Date.now()}`;
      if (result.buffer) {
        try {
          const fontFace = new FontFace(uniqueFontFamilyName, result.buffer);
          await fontFace.load();
          document.fonts.add(fontFace);
        } catch (e) {
          console.error("Failed to load Comparison FontFace:", e);
        }
      }

      setComparisonFontData({
        fontName: result.fontName,
        fontFamilyCSS: uniqueFontFamilyName,
        supportedChars: result.supportedChars,
        glyphCount: result.glyphCount,
        buffer: result.buffer || undefined,
      });
    }

    setComparisonLoading(false);
  };

  const handleExportDiffData = (type: "added" | "deleted" | "unchanged") => {
    const list = diffResult[type];
    if (list.length === 0) return;
    const charList = list.map(code => String.fromCodePoint(code)).join("");
    const blob = new Blob([charList], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${type}_characters_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const jumpToDiffGrid = (tab: "added" | "deleted" | "unchanged") => {
    setDiffTab(tab);
    // Use requestAnimationFrame or setTimeout to ensure state update has triggered any necessary renders 
    // though for scrolls simple setTimeout usually works best to let the browser catch up
    setTimeout(() => {
      const element = document.getElementById("diff-grid-section");
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 10);
  };

  const renderDiffView = () => {
    if (!fontData) {
      return (
        <div className="bg-white rounded-lg border border-neutral-200/85 p-8 text-center text-neutral-500 font-sans">
          请先在主页上传基准（Base）字体。
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Card Header & Description */}
        <div className="bg-white rounded-lg border border-neutral-200/85 p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-neutral-100">
            <div>
              <h2 className="text-sm font-bold font-mono tracking-wider text-neutral-800 uppercase flex items-center gap-2">
                🔎 字体版本并集与其差异对比 (Diff)
              </h2>
              <p className="text-xs text-neutral-400 mt-1 font-sans">
                上传对比字体文件，系统自动计算码点集合关系，清晰呈现「基准独有 (左边独有)」、「两者共有 (重合字符)」与「对比独有 (右边独有)」集合。
              </p>
            </div>
          </div>

          {/* Visual Connector / Map comparison schema */}
          <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
            {/* Left: Base Font (Source of Ground Truth) */}
            <div className="md:col-span-5 border border-dashed border-blue-200/90 rounded-xl p-5 bg-blue-50/5 relative flex flex-col justify-between min-h-[140px] transition-all hover:border-blue-300">
              <div className="absolute top-3 left-3 bg-blue-600 text-white text-[9px] font-mono px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                基准版本 (Base Font)
              </div>
              <div className="mt-5 space-y-2">
                <h4 className="text-sm font-bold text-blue-900 font-mono truncate">
                  {fontData.fontName}
                </h4>
                <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono">
                  <span>字形容量: <strong className="text-neutral-700 font-bold">{fontData.glyphCount.toLocaleString()}</strong></span>
                  <span>码点数: <strong className="text-neutral-700 font-bold">{fontData.supportedChars.size.toLocaleString()}</strong></span>
                </div>
              </div>
              <p className="text-[10px] text-neutral-400 mt-3 leading-relaxed">
                当前主界面的解析字体，将作为判定“新增”与“删除”的参照原点。
              </p>
            </div>

            {/* Middle: Arrow/Transition Indicator */}
            <div className="md:col-span-1 flex flex-col items-center justify-center">
              <div className="hidden md:flex flex-col items-center">
                <span className="text-xs text-neutral-400 font-mono font-bold uppercase tracking-wider mb-1">对比</span>
                <div className="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center bg-white shadow-xs">
                  <span className="text-neutral-500 text-xs font-bold font-mono">VS</span>
                </div>
              </div>
              <div className="md:hidden flex items-center gap-2">
                <div className="h-px w-8 bg-neutral-200" />
                <span className="text-xs text-neutral-400 font-mono font-bold">VS</span>
                <div className="h-px w-8 bg-neutral-200" />
              </div>
            </div>

            {/* Right: New Font / Upload Panel */}
            <div className="md:col-span-5 border border-dashed border-pink-200/90 rounded-xl p-5 bg-pink-50/5 relative flex flex-col justify-between min-h-[140px] transition-all hover:border-pink-300">
              <div className="absolute top-3 left-3 bg-pink-600 text-white text-[9px] font-mono px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                对比版本 (New Font)
              </div>
              
              {comparisonFontData ? (
                <div className="mt-5 flex flex-col justify-between h-full w-full">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-pink-900 font-mono truncate">
                      {comparisonFontData.fontName}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono">
                      <span>字形容量: <strong className="text-neutral-700 font-bold">{comparisonFontData.glyphCount.toLocaleString()}</strong></span>
                      <span>码点数: <strong className="text-neutral-700 font-bold">{comparisonFontData.supportedChars.size.toLocaleString()}</strong></span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-4">
                    <button
                      onClick={() => {
                        setComparisonFontData(null);
                        setComparisonError(null);
                      }}
                      className="cursor-pointer text-[10px] bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 font-bold px-3 py-1.5 rounded border border-red-200 transition-colors font-mono select-none"
                    >
                      清除文件
                    </button>
                    
                    <label className="cursor-pointer text-[10px] bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold px-3 py-1.5 rounded border border-pink-200 transition-colors font-mono select-none">
                      重新上传
                      <input
                        type="file"
                        accept=".ttf,.otf"
                        className="hidden"
                        onChange={handleComparisonFontUpload}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex flex-col items-center justify-center py-4 relative">
                  <input
                    type="file"
                    accept=".ttf,.otf"
                    onChange={handleComparisonFontUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  {comparisonLoading ? (
                    <div className="flex flex-col items-center space-y-2">
                      <span className="text-xs font-semibold text-neutral-600 animate-pulse font-mono">正在加载对比文件...</span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className="w-5 h-5 text-pink-400 mb-1.5" />
                      <span className="text-xs text-pink-500/80 font-bold font-mono">点击或拖拽上传新版本字体</span>
                      <span className="text-[10px] text-neutral-400 font-mono mt-0.5">支持 .ttf, .otf 格式</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {comparisonError && (
            <div className="flex items-center text-red-600 bg-red-50/50 border border-red-100 px-4 py-2.5 rounded text-xs gap-2">
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="font-semibold font-mono text-left">{comparisonError}</span>
            </div>
          )}

          {/* Comparison summary dashboard */}
          {fontData && comparisonFontData && (
            <div className="bg-neutral-50 rounded-lg p-5 border border-neutral-100 space-y-5">
              <div className="flex items-center justify-center text-center text-xs pb-1 border-b border-neutral-200/40">
                <div className="font-medium text-neutral-700 leading-relaxed">
                  对比布局：以左侧基准字体 <span className="font-mono bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded text-blue-700 shrink-0 font-bold">{fontData.fontName}</span> 与右侧对比版本 <span className="font-mono bg-pink-50 border border-pink-200/60 px-2 py-0.5 rounded text-pink-700 shrink-0 font-bold">{comparisonFontData.fontName}</span> 进行交差集对比
                </div>
              </div>
              
              {/* Calculate dynamic panel flex sizes based on percentage ratio */}
              {(() => {
                const totalVal = diffRatioPct.leftCount + diffRatioPct.sharedCount + diffRatioPct.rightCount || 1;
                // Distribute dynamically but clamped between 22% and 55%
                const panelLeftPct = diffRatioPct.leftCount > 0 ? Math.max(22, Math.min(55, diffRatioPct.leftPct)) : 22;
                const panelSharedPct = diffRatioPct.sharedCount > 0 ? Math.max(22, Math.min(55, diffRatioPct.sharedPct)) : 22;
                const panelRightPct = diffRatioPct.rightCount > 0 ? Math.max(22, Math.min(55, diffRatioPct.rightPct)) : 22;

                return (
                  <div className="flex flex-col sm:flex-row items-stretch gap-4">
                    {/* Panel 1: Left-only / Unique to Base */}
                    <div 
                      onClick={() => jumpToDiffGrid("deleted")}
                      style={{ 
                        flex: `${panelLeftPct} 1 0%`, 
                        minWidth: "180px",
                        borderWidth: "1.5px",
                        borderStyle: "solid",
                        borderColor: diffTab === "deleted" ? "rgba(191, 219, 254, 0.8)" : "rgba(229, 231, 235, 0.6)"
                      }}
                      className={`cursor-pointer p-4 rounded-lg transition-all text-left flex flex-col justify-between select-none ${
                        diffTab === "deleted" 
                          ? "bg-blue-50/80 text-blue-950 ring-1 ring-blue-200 shadow-xs" 
                          : "bg-white text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      <span className={`font-mono font-bold tracking-wider text-[10px] uppercase ${diffTab === "deleted" ? "text-blue-700" : "text-blue-500/80"}`}>基准独有 (左边独有)</span>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-bold font-mono text-blue-600">{diffResult.deleted.length.toLocaleString()}</span>
                        <span className="text-[10px] opacity-75 font-mono">占基准字形数 {((diffResult.deleted.length / (fontData.supportedChars.size || 1)) * 100).toFixed(2)}%</span>
                      </div>
                    </div>

                    {/* Panel 2: Both Shared */}
                    <div 
                      onClick={() => jumpToDiffGrid("unchanged")}
                      style={{ 
                        flex: `${panelSharedPct} 1 0%`, 
                        minWidth: "180px",
                        borderWidth: "1.5px",
                        borderStyle: "solid",
                        ...(diffTab === "unchanged" ? {
                          backgroundImage: "linear-gradient(to bottom right, rgba(239, 246, 255, 0.95), rgba(253, 242, 248, 0.95)), linear-gradient(to right, #3b82f6, #ec4899)",
                          backgroundClip: "padding-box, border-box",
                          backgroundOrigin: "padding-box, border-box",
                          borderColor: "transparent"
                        } : {
                          borderColor: "rgba(229, 231, 235, 0.6)"
                        })
                      }}
                      className={`cursor-pointer p-4 rounded-lg transition-all text-left flex flex-col justify-between select-none relative ${
                        diffTab === "unchanged" 
                          ? "shadow-sm" 
                          : "bg-white text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      <span className={`font-mono font-bold tracking-wider text-[10px] uppercase ${diffTab === "unchanged" ? "text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-pink-600" : "text-neutral-500"}`}>两者共有 (重合字符)</span>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className={`text-2xl font-bold font-mono ${diffTab === "unchanged" ? "text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-pink-600" : "text-neutral-700"}`}>{diffResult.unchanged.length.toLocaleString()}</span>
                        <span className={`text-[10px] opacity-75 font-mono ${diffTab === "unchanged" ? "text-pink-600 font-bold" : ""}`}>重合率 {((diffResult.unchanged.length / (fontData.supportedChars.size || 1)) * 100).toFixed(2)}%</span>
                      </div>
                    </div>

                    {/* Panel 3: Right-only / Unique to New */}
                    <div 
                      onClick={() => jumpToDiffGrid("added")}
                      style={{ 
                        flex: `${panelRightPct} 1 0%`, 
                        minWidth: "180px",
                        borderWidth: "1.5px",
                        borderStyle: "solid",
                        borderColor: diffTab === "added" ? "rgba(251, 207, 232, 0.8)" : "rgba(229, 231, 235, 0.6)"
                      }}
                      className={`cursor-pointer p-4 rounded-lg transition-all text-left flex flex-col justify-between select-none ${
                        diffTab === "added" 
                          ? "bg-pink-50/80 text-pink-950 ring-1 ring-pink-200 shadow-xs" 
                          : "bg-white text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      <span className={`font-mono font-bold tracking-wider text-[10px] uppercase ${diffTab === "added" ? "text-pink-700" : "text-pink-500/80"}`}>对比独有 (右边独有)</span>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-bold font-mono text-pink-600">{diffResult.added.length.toLocaleString()}</span>
                        <span className="text-[10px] opacity-75 font-mono">占对比字形数 {((diffResult.added.length / (comparisonFontData.supportedChars.size || 1)) * 100).toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Dynamic Comparison Bar Chart Indicator */}
              {(() => {
                const { leftPct, sharedPct, rightPct, leftCount, sharedCount, rightCount } = diffRatioPct;
                const midLeft = leftPct / 2;
                const midShared = (leftCount > 0 ? leftPct : 0) + (sharedPct / 2);
                const midRight = (leftCount > 0 ? leftPct : 0) + (sharedCount > 0 ? sharedPct : 0) + (rightPct / 2);

                // Compute exact border-radius classes based on which segments are visible to prevent sharp corners reaching outer container edges
                const leftRoundClass = leftCount > 0 ? `rounded-l-[5px] ${(!sharedCount && !rightCount) ? "rounded-r-[5px]" : ""}` : "";
                const sharedRoundClass = sharedCount > 0 ? `${!leftCount ? "rounded-l-[5px]" : ""} ${!rightCount ? "rounded-r-[5px]" : ""}` : "";
                const rightRoundClass = rightCount > 0 ? `${(!leftCount && !sharedCount) ? "rounded-l-[5px]" : ""} rounded-r-[5px]` : "";

                return (
                  <div className="pt-2 border-t border-neutral-200/40 space-y-3">
                    <div 
                      className="h-8 w-full rounded-md overflow-hidden flex bg-neutral-100 border border-neutral-200/60 shadow-inner select-none relative animate-in fade-in duration-300"
                    >
                      {/* Left (Base Unique) Segment */}
                      {leftCount > 0 && (
                        <div 
                          onClick={() => jumpToDiffGrid("deleted")}
                          style={{ width: `${leftPct}%` }}
                          className={`h-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 transition-all duration-300 relative group cursor-pointer flex items-center justify-center text-white min-w-[32px] overflow-hidden ${leftRoundClass} ${
                            diffTab === "deleted" ? "ring-2 ring-white ring-inset z-20 shadow-inner" : "z-10"
                          }`}
                          title={`基准独有 (左侧): ${leftCount.toLocaleString()} 字符 (${((leftCount / (fontData.supportedChars.size || 1)) * 100).toFixed(2)}%)`}
                        >
                          {leftPct >= 4 && (
                            <span className="text-[10px] font-mono font-bold truncate px-1">
                              {leftCount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Shared (Both) Segment */}
                      {sharedCount > 0 && (
                        <div 
                          onClick={() => jumpToDiffGrid("unchanged")}
                          style={{ width: `${sharedPct}%` }}
                          className={`h-full bg-gradient-to-r from-blue-500 to-pink-500 hover:opacity-90 active:opacity-100 transition-all duration-300 relative group cursor-pointer flex items-center justify-center text-white min-w-[32px] overflow-hidden ${sharedRoundClass} ${
                            diffTab === "unchanged" ? "ring-2 ring-white ring-inset z-30 shadow-inner" : "z-20 shadow-sm"
                          }`}
                          title={`两者共有: ${sharedCount.toLocaleString()} 字符 (重合率 ${((sharedCount / (fontData.supportedChars.size || 1)) * 100).toFixed(2)}%)`}
                        >
                          {/* Permanent gradient outline - blue on left, pink on right (hidden when selected to show solid white ring) */}
                          {diffTab !== "unchanged" && (
                            <div 
                              className={`absolute inset-0 border-2 border-transparent pointer-events-none ${sharedRoundClass}`} 
                              style={{ 
                                borderImage: "linear-gradient(to right, #3b82f6, #ec4899) 2",
                                borderImageSlice: 1
                              }} 
                            />
                          )}
                          {sharedPct >= 4 && (
                            <span className="text-[10px] font-mono font-bold truncate px-1 relative z-10 text-white">
                              {sharedCount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Right (Comparison Unique) Segment */}
                      {rightCount > 0 && (
                        <div 
                          onClick={() => jumpToDiffGrid("added")}
                          style={{ width: `${rightPct}%` }}
                          className={`h-full bg-pink-500 hover:bg-pink-600 active:bg-pink-700 transition-all duration-300 relative group cursor-pointer flex items-center justify-center text-white min-w-[32px] overflow-hidden ${rightRoundClass} ${
                            diffTab === "added" ? "ring-2 ring-white ring-inset z-20 shadow-inner" : "z-10"
                          }`}
                          title={`对比独有 (右侧): ${rightCount.toLocaleString()} 字符 (${((rightCount / (comparisonFontData.supportedChars.size || 1)) * 100).toFixed(2)}%)`}
                        >
                          {rightPct >= 4 && (
                            <span className="text-[10px] font-mono font-bold truncate px-1">
                              {rightCount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Centered Dynamic Legends with exact vertical alignment & no underlines */}
                    <div className="relative h-auto sm:h-7 w-full select-none flex flex-row flex-wrap justify-center sm:block items-center gap-4 mt-1.5">
                      {leftCount > 0 && (
                        <div 
                          style={{ left: `${midLeft}%` }}
                          className="static sm:absolute sm:top-0.5 sm:-translate-x-1/2 flex items-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity whitespace-nowrap"
                          onClick={() => jumpToDiffGrid("deleted")}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 bg-blue-500 ${diffTab === "deleted" ? "ring-2 ring-blue-300 ring-offset-1" : ""}`} />
                          <span className={`text-[10px] sm:text-xs font-sans font-bold transition-all ${
                            diffTab === "deleted" ? "text-blue-600" : "text-neutral-500"
                          }`}>
                            基准独有
                          </span>
                        </div>
                      )}

                      {sharedCount > 0 && (
                        <div 
                          style={{ left: `${midShared}%` }}
                          className="static sm:absolute sm:top-0.5 sm:-translate-x-1/2 flex items-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity whitespace-nowrap"
                          onClick={() => jumpToDiffGrid("unchanged")}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 bg-gradient-to-r from-blue-500 to-pink-500 ${diffTab === "unchanged" ? "ring-2 ring-purple-300 ring-offset-1 scale-110" : ""}`} />
                          <span className={`text-[10px] sm:text-xs font-sans font-bold transition-all ${
                            diffTab === "unchanged" ? "text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-pink-600 font-extrabold" : "text-neutral-500"
                          }`}>
                            两者共有
                          </span>
                        </div>
                      )}

                      {rightCount > 0 && (
                        <div 
                          style={{ left: `${midRight}%` }}
                          className="static sm:absolute sm:top-0.5 sm:-translate-x-1/2 flex items-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity whitespace-nowrap"
                          onClick={() => jumpToDiffGrid("added")}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 bg-pink-500 ${diffTab === "added" ? "ring-2 ring-pink-300 ring-offset-1" : ""}`} />
                          <span className={`text-[10px] sm:text-xs font-sans font-bold transition-all ${
                            diffTab === "added" ? "text-pink-600" : "text-neutral-500"
                          }`}>
                            对比独有
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* 单字微观轮廓 Diff */}
        {fontData && comparisonFontData && (
          <MicroContourDiff
            baseFont={parsedBaseFont}
            compFont={parsedCompFont}
            baseFontName={fontData.fontName}
            compFontName={comparisonFontData.fontName}
          />
        )}

        {/* Detailed Character Search, Grid, and Export */}
        {fontData && comparisonFontData && (
          <div id="diff-grid-section" className="bg-white rounded-lg border border-neutral-200/85 overflow-hidden flex flex-col min-h-[500px]">
            {/* Filter and Control Toolbar */}
            <div className="border-b border-neutral-100 px-5 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-neutral-50/50">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  diffTab === "added" ? "bg-pink-500" : diffTab === "deleted" ? "bg-blue-500" : "bg-neutral-400"
                }`} />
                <h3 className="text-xs font-bold font-mono tracking-wider text-neutral-700 uppercase">
                  {diffTab === "added" ? "对比独有字符网格 (右边独有)" : diffTab === "deleted" ? "基准独有字符网格 (左边独有)" : "两者共有字符网格 (重合字符)"}
                  <span className="ml-1.5 text-neutral-400 font-normal">
                    ({filteredDiffChars.length.toLocaleString()})
                  </span>
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Export Button */}
                <button
                  onClick={() => handleExportDiffData(diffTab)}
                  disabled={filteredDiffChars.length === 0}
                  className="flex items-center gap-1.5 border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-bold px-3 py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed select-none transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>导出字符明细 (.txt)</span>
                </button>

                {/* Page Size selector */}
                <select
                  value={diffPageSize}
                  onChange={(e) => setDiffPageSize(Number(e.target.value))}
                  className="bg-white border border-neutral-200 text-neutral-700 py-1.5 px-2 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer text-center"
                >
                  <option value={100}>100 个 / 页</option>
                  <option value={200}>200 个 / 页</option>
                  <option value={500}>500 个 / 页</option>
                  <option value={1000}>1000 个 / 页</option>
                </select>

                {/* SubSearch query bar */}
                <div className="relative w-full sm:w-44">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="搜索字符或 U+码点..."
                    value={diffSearchQuery}
                    onChange={(e) => setDiffSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 border border-neutral-200 rounded text-xs focus:outline-none focus:border-neutral-900 bg-neutral-50/20 focus:bg-white placeholder-neutral-400 font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Main Interactive Grid */}
            <div className="p-5 flex-1 min-h-[300px]">
              {paginatedDiffChars.length === 0 ? (
                <div className="h-48 flex flex-col justify-center items-center text-xs text-neutral-400 font-mono gap-1">
                  <span>没有可供展示的差量项</span>
                  <span className="text-[10px] opacity-75">该字符集合当前为 0，请上传另一款不同的字体包</span>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3">
                  {paginatedDiffChars.map((code) => {
                    const char = String.fromCodePoint(code);
                    const hexCode = `U+${code.toString(16).toUpperCase()}`;
                    return (
                      <div
                        key={code}
                        onClick={() => setDiffZoomChar(char)}
                        className={`group relative border rounded-lg p-3.5 flex flex-col items-center justify-between cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                          diffTab === "added"
                            ? "border-pink-100 bg-pink-50/10 hover:border-pink-300 hover:bg-pink-50/30 text-pink-950"
                            : diffTab === "deleted"
                              ? "border-blue-100 bg-blue-50/10 hover:border-blue-300 hover:bg-blue-50/30 text-blue-950"
                              : "border-neutral-100 bg-neutral-50/30 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-800"
                        }`}
                      >
                        {/* Rendering glyph using respective fonts for real comparative rendering! */}
                        <div 
                          className="text-2xl font-normal w-10 h-10 flex items-center justify-center select-none"
                          style={{
                            fontFamily: diffTab === "deleted"
                              ? `"${fontData.fontFamilyCSS}", "SimSun-ExtB", sans-serif`
                              : `"${comparisonFontData.fontFamilyCSS}", "SimSun-ExtB", sans-serif`
                          }}
                        >
                          {char}
                        </div>
                        <div className="text-[9px] font-mono opacity-65 group-hover:opacity-100 mt-2 font-bold tracking-tight">
                          {hexCode}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pagination Controls Footer */}
            {totalDiffPages > 1 && (
              <div className="border-t border-neutral-100 px-5 py-3 flex items-center justify-between bg-neutral-50/30 shrink-0">
                <span className="text-[11px] text-neutral-500 font-mono">
                  显示第 {((diffCurrentPage - 1) * diffPageSize + 1).toLocaleString()} 至 {Math.min(diffCurrentPage * diffPageSize, filteredDiffChars.length).toLocaleString()} 项，共 {filteredDiffChars.length.toLocaleString()} 项
                </span>
                
                <div className="flex items-center gap-1 select-none">
                  <button
                    disabled={diffCurrentPage === 1}
                    onClick={() => setDiffCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1 px-2 border border-neutral-200/80 rounded bg-white text-neutral-600 hover:bg-neutral-50 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono px-3 py-1 font-bold text-neutral-700">
                    页码 {diffCurrentPage} / {totalDiffPages}
                  </span>
                  <button
                    disabled={diffCurrentPage === totalDiffPages}
                    onClick={() => setDiffCurrentPage((p) => Math.min(totalDiffPages, p + 1))}
                    className="p-1 px-2 border border-neutral-200/80 rounded bg-white text-neutral-600 hover:bg-neutral-50 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Side-by-side comparative zoom modal */}
        {diffZoomChar && (
          <div 
            className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center z-[200]" 
            onClick={() => setDiffZoomChar(null)}
          >
            <div 
              className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative animate-in zoom-in-95 duration-150" 
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setDiffZoomChar(null)} 
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 font-bold font-mono text-xs cursor-pointer select-none"
              >
                ✕
              </button>
              <h3 className="text-sm font-bold text-neutral-800 font-sans mb-4 border-b pb-2 flex items-center gap-1.5">
                🔎 字形精细解析与渲染对比
              </h3>
              <div className="text-center font-mono my-2 text-xs bg-neutral-50 py-2 rounded border text-neutral-600 font-bold">
                Unicode: U+{diffZoomChar.codePointAt(0)?.toString(16).toUpperCase()} &nbsp;/&nbsp; 字符: "{diffZoomChar}"
              </div>
              
              <div className="grid grid-cols-2 gap-6 mt-4">
                {/* Left: Base Font Render */}
                {(() => {
                  const hasChar = !!(fontData?.supportedChars.has(diffZoomChar.codePointAt(0) || 0));
                  return (
                    <div className="border border-neutral-100 rounded-lg p-4 flex flex-col items-center bg-neutral-50/30">
                      <span className="text-[10px] font-bold text-neutral-400 font-mono mb-3 uppercase tracking-wider">基准版本 (Base Font)</span>
                      <div className="h-28 w-28 bg-white border border-neutral-200/80 rounded flex items-center justify-center relative shadow-xs overflow-hidden">
                        {/* Grid line helpers for high-fidelity alignment comparison */}
                        <div className="absolute inset-0 border-b border-dashed border-red-200/40 top-1/2" />
                        <div className="absolute inset-0 border-r border-dashed border-red-200/40 left-1/2" />
                        <span 
                          className={`text-6xl z-10 select-none font-medium text-center ${hasChar ? "text-neutral-800" : "text-neutral-300"}`}
                          style={{ fontFamily: hasChar && fontData ? `"${fontData.fontFamilyCSS}", sans-serif` : "sans-serif" }}
                        >
                          {diffZoomChar}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-500 mt-2 text-center font-mono truncate max-w-full font-bold">
                        {fontData ? fontData.fontName : "-"}
                      </p>
                      <span className="text-[10px] mt-2 px-2.5 py-0.5 rounded font-sans font-medium bg-neutral-100 text-neutral-500 border border-neutral-200/60 select-none">
                        {hasChar ? "已支持" : "不支持"}
                      </span>
                    </div>
                  );
                })()}

                {/* Right: Comparison Font Render */}
                {(() => {
                  const hasChar = !!(comparisonFontData?.supportedChars.has(diffZoomChar.codePointAt(0) || 0));
                  return (
                    <div className="border border-neutral-100 rounded-lg p-4 flex flex-col items-center bg-neutral-50/30">
                      <span className="text-[10px] font-bold text-neutral-400 font-mono mb-3 uppercase tracking-wider">对比版本 (New Font)</span>
                      <div className="h-28 w-28 bg-white border border-neutral-200/80 rounded flex items-center justify-center relative shadow-xs overflow-hidden">
                        <div className="absolute inset-0 border-b border-dashed border-red-200/40 top-1/2" />
                        <div className="absolute inset-0 border-r border-dashed border-red-200/40 left-1/2" />
                        <span 
                          className={`text-6xl z-10 select-none font-medium text-center ${hasChar ? "text-neutral-800" : "text-neutral-300"}`}
                          style={{ fontFamily: hasChar && comparisonFontData ? `"${comparisonFontData.fontFamilyCSS}", sans-serif` : "sans-serif" }}
                        >
                          {diffZoomChar}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-500 mt-2 text-center font-mono truncate max-w-full font-bold">
                        {comparisonFontData ? comparisonFontData.fontName : "-"}
                      </p>
                      <span className="text-[10px] mt-2 px-2.5 py-0.5 rounded font-sans font-medium bg-neutral-100 text-neutral-500 border border-neutral-200/60 select-none">
                        {hasChar ? "已支持" : "不支持"}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="mt-6 text-center text-[10.5px] text-neutral-400 leading-relaxed font-sans">
                💡 <strong>提示：</strong>在上方视窗中，你可以直观对比两个字体在相同码点(字形)上的设计细节差异（如衬线、框架、粗细笔锋等）。若该字符在某版本中不支持，图示将回退。
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const getBlockNameForChar = useCallback((c: string) => {
    const code = c.codePointAt(0)!;
    for (const block of UNICODE_BLOCKS) {
      if (block.type === "range" && block.ranges) {
        for (const [start, end] of block.ranges) {
          if (code >= start && code <= end) return block.name;
        }
      } else if (block.type === "list" && block.list) {
        if (Array.from(block.list).includes(c)) return block.name;
      }
      if (block.extraChars && block.extraChars.includes(c)) return block.name;
    }
    return "未知分区";
  }, []);

  const handleFileUpload = async (
    event: ChangeEvent<HTMLInputElement> | DragEvent<HTMLDivElement>,
  ) => {
    let file: File | null = null;

    if ("dataTransfer" in event) {
      event.preventDefault();
      file = event.dataTransfer.files[0];
    } else if ("target" in event && event.target.files) {
      file = event.target.files[0];
    }

    if (!file) return;

    if (
      !file.name.toLowerCase().endsWith(".otf") &&
      !file.name.toLowerCase().endsWith(".ttf")
    ) {
      setError("抱歉，暂不支持该格式，请上传解压后的 .otf 或 .ttf 文件");
      return;
    }

    setLoading(true);
    setError(null);
    setFontData(null); // Clear previous

    // Small timeout to allow UI to show loading state
    await new Promise((r) => setTimeout(r, 50));

    const result = await parseFontFile(file);

    if (result.error) {
      setError(result.error);
    } else {
      // Load font face natively for browser rendering
      const uniqueFontFamilyName = `custom-font-${Date.now()}`;
      if (result.buffer) {
        try {
          const fontFace = new FontFace(uniqueFontFamilyName, result.buffer);
          await fontFace.load();
          document.fonts.add(fontFace);
        } catch (e) {
          console.error("Failed to load FontFace:", e);
          // Proceed anyway, we might just not render it perfectly
        }
      }

      setFontData({
        fontName: result.fontName,
        fontFamilyCSS: uniqueFontFamilyName,
        supportedChars: result.supportedChars,
        glyphCount: result.glyphCount,
        buffer: result.buffer || undefined,
      });
    }

    setLoading(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleCustomCharsFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCustomSetInput(text);
        setCustomFileLoaded(file.name);
      }
    };
    reader.readAsText(file);
  };

  const clearData = () => {
    setFontData(null);
    setError(null);
    setSearchQuery("");
    setFilterMode("all");
    setSelectedBlockId(UNICODE_BLOCKS[0].id);
    setHoveredCell(null);
    setCustomSetInput("");
    setCustomFileLoaded(null);
    setCustomFilterMode("all");
    setCustomSearchQuery("");
    setActiveTab("global");
  };

  const viewBlock = (id: string) => {
    setSelectedBlockId(id);
    // Smooth scroll to grid
    setTimeout(() => {
      gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const selectedBlock = useMemo(() => {
    if (selectedBlockId === "all") {
      return {
        id: "all",
        name: "全部字符 (All)",
        type: "list",
        total: 0,
      } as CharBlock;
    }
    return (
      UNICODE_BLOCKS.find((b) => b.id === selectedBlockId) ||
      STANDARD_BLOCKS.find((b) => b.id === selectedBlockId) ||
      UNICODE_BLOCKS[0]
    );
  }, [selectedBlockId]);

  const filteredBlocks = useMemo(() => {
    if (!blockSearchQuery) return UNICODE_BLOCKS;
    const q = blockSearchQuery.toLowerCase();
    return UNICODE_BLOCKS.filter(
      (b) => b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q),
    );
  }, [blockSearchQuery]);

  const groupedUnicodeBlocks = useMemo(() => {
    const planes: Record<string, CharBlock[]> = {
      "基本多语言平面 (BMP)": [],
      "第一辅助平面 (SMP)": [],
      "第二辅助平面 (SIP)": [],
      "第三辅助平面 (TIP)": [],
      "其他及特殊用途平面 (SSP / Others)": [],
    };
    
    filteredBlocks.forEach((block) => {
      let runStart = 0;
      if (block.ranges && block.ranges.length > 0) {
        runStart = block.ranges[0][0];
      } else if (block.type === 'list' && block.list && block.list.length > 0) {
         runStart = typeof block.list === 'string' ? block.list.codePointAt(0) || 0 : block.list[0].codePointAt(0) || 0;
      }
      
      if (runStart < 0x10000) {
        planes["基本多语言平面 (BMP)"].push(block);
      } else if (runStart < 0x20000) {
        planes["第一辅助平面 (SMP)"].push(block);
      } else if (runStart < 0x30000) {
        planes["第二辅助平面 (SIP)"].push(block);
      } else if (runStart < 0x40000) {
        planes["第三辅助平面 (TIP)"].push(block);
      } else {
        planes["其他及特殊用途平面 (SSP / Others)"].push(block);
      }
    });

    Object.keys(planes).forEach(k => {
      if (planes[k].length === 0) delete planes[k];
    });
    return planes;
  }, [filteredBlocks]);

  const fullCharList = useMemo(() => {
    if (selectedBlockId === "all") {
      const allChars = new Set<string>();
      for (const block of UNICODE_BLOCKS) {
        getCharsForBlock(block).forEach((c) => allChars.add(c));
      }
      return Array.from(allChars);
    }
    return getCharsForBlock(selectedBlock);
  }, [selectedBlock, selectedBlockId]);

  const filteredChars = useMemo(() => {
    let list: string[] = [];

    if (searchScope === "global" && searchQuery) {
      const isHex = /^u\+[0-9a-f]{4,5}$/i.test(searchQuery.trim());
      let targetChar = "";
      if (isHex) {
        const hex = searchQuery.trim().replace(/^u\+/i, "");
        const code = parseInt(hex, 16);
        targetChar = String.fromCodePoint(code);
      }

      for (const block of UNICODE_BLOCKS) {
        const chars = getCharsForBlock(block);
        if (isHex) {
          if (chars.includes(targetChar)) {
            list.push(targetChar);
          }
        } else {
          for (const c of chars) {
            if (searchQuery.includes(c) || c.includes(searchQuery)) {
              list.push(c);
            }
          }
        }
      }
      list = Array.from(new Set(list));
    } else {
      list = fullCharList;
      if (searchQuery) {
        const isHex = /^u\+[0-9a-f]{4,5}$/i.test(searchQuery.trim());
        if (isHex) {
          const hex = searchQuery.trim().replace(/^u\+/i, "");
          const code = parseInt(hex, 16);
          const char = String.fromCodePoint(code);
          list = list.filter((c) => c === char);
        } else {
          list = list.filter(
            (c) => searchQuery.includes(c) || c.includes(searchQuery),
          );
        }
      }
    }

    if (fontData) {
      if (filterMode === "missing") {
        list = list.filter((c) => {
          const assigned = !isUnassigned(c);
          if (!assigned) return false;
          return !fontData.supportedChars.has(c.codePointAt(0)!);
        });
      } else if (filterMode === "covered") {
        list = list.filter((c) => {
          const assigned = !isUnassigned(c);
          if (!assigned) return false;
          return fontData.supportedChars.has(c.codePointAt(0)!);
        });
      }
    }

    return list;
  }, [
    fullCharList,
    searchQuery,
    filterMode,
    fontData,
    searchScope,
    isUnassigned,
  ]);

  // Virtualization calculations
  const columns = 16;
  const rowCount = Math.ceil(filteredChars.length / columns);
  const rowHeight = 48; // px

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  const calculateCoverage = (block: CharBlock) => {
    const chars = getCharsForBlock(block);
    const assignedChars = chars.filter((c) => !isUnassigned(c));
    const effectiveTotal = assignedChars.length;
    if (!fontData) return { supported: 0, total: effectiveTotal, percent: 0 };

    let supported = 0;
    for (const char of assignedChars) {
      if (fontData.supportedChars.has(char.codePointAt(0)!)) supported++;
    }

    return {
      supported,
      total: effectiveTotal,
      percent:
        effectiveTotal > 0
          ? Math.min((supported / effectiveTotal) * 100, 100)
          : 0,
    };
  };

  const overallCoverage = useMemo(() => {
    if (!fontData) return 0;
    let totalSupported = 0;
    let totalExpected = 0;
    // Just calculate over all blocks for overall metric
    for (const block of UNICODE_BLOCKS) {
      const { supported, total } = calculateCoverage(block);
      totalSupported += supported;
      totalExpected += total;
    }
    return totalExpected > 0 ? (totalSupported / totalExpected) * 100 : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontData]);

  const getBlockRangeString = (block: CharBlock) => {
    if (block.type === "range" && block.ranges && block.ranges.length > 0) {
      const start = block.ranges[0][0]
        .toString(16)
        .toUpperCase()
        .padStart(4, "0");
      const end = block.ranges[block.ranges.length - 1][1]
        .toString(16)
        .toUpperCase()
        .padStart(4, "0");
      return `U+${start} - U+${end}`;
    }
    return "--";
  };

  const getCountryStatus = (countryName: string): string => {
    if (!fontData?.supportedChars) return "未知";
    const res = evaluateCountryCoverageAndStatus(countryName, fontData.supportedChars);
    return res.status;
  };

  const statusColorMap: Record<string, string> = {
    完全可用: "bg-green-400",
    基本可用: "bg-orange-400",
    勉强可用: "bg-yellow-200",
    不可用: "bg-red-400",
    存在缺失: "bg-red-400",
    支持: "bg-green-400",
    不支持: "bg-red-400",
    未知: "bg-gray-300",
  };

  const getStatusColorClass = (stat: string) => {
    if (stat.includes("完全可用")) return "bg-green-400";
    if (stat.includes("基本可用")) return "bg-orange-400";
    if (stat.includes("不可用")) return "bg-red-400";
    return statusColorMap[stat] || "bg-gray-300";
  };

  const getStatusBadgeColor = (stat: string) => {
    if (stat.includes("完全可用") || stat === "支持") {
      return "text-green-600 bg-green-50 border-green-200";
    }
    if (stat.includes("基本可用")) {
      return "text-orange-600 bg-orange-50 border-orange-200";
    }
    if (stat.includes("勉强可用")) {
      return "text-yellow-600 bg-yellow-50 border-yellow-200";
    }
    if (stat.includes("不可用") || stat === "不支持" || stat === "存在缺失") {
      return "text-red-600 bg-red-50 border-red-200";
    }
    return "text-gray-500 bg-gray-50 border-gray-200";
  };

  const renderCountryColumns = (countriesList: string[]) => {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 pt-2">
        {countriesList.map((countryName) => {
          const metadata = COUNTRY_METADATA[countryName];
          if (!metadata) return null;

          const status = getCountryStatus(countryName);
          const dotColor = getStatusColorClass(status);

          return (
            <button
              key={countryName}
              onClick={() => setSelectedCountryForModal(countryName)}
              className="flex items-center justify-between text-left pl-2.5 pr-1.5 py-1 bg-transparent select-none active:scale-95 transition-all text-sm group border-l border-slate-200 hover:border-slate-400 hover:bg-slate-50/60"
            >
              <span className="flex items-center gap-1.5 truncate text-gray-600 group-hover:text-blue-600 font-medium">
                <span className="text-base leading-none select-none">
                  {metadata.flag}
                </span>
                <span className="truncate">{countryName}</span>
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
                />
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderBlockColumns = (blocksList: CharBlock[]) => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 pt-2">
        {blocksList.map((block) => {
          const { supported, percent, total } = calculateCoverage(block);
          const isSelected = selectedBlockId === block.id;

          return (
            <button
              key={block.id}
              onClick={() => viewBlock(block.id)}
              className={`flex items-center justify-between text-left px-3 py-2 bg-transparent select-none active:scale-95 transition-all text-sm group border rounded-lg ${isSelected ? "border-blue-400 bg-blue-50/30" : "border-slate-200 hover:border-slate-400 hover:bg-slate-50/60"}`}
            >
              <div className="flex flex-col gap-0.5 truncate pr-2">
                <span className={`text-sm font-medium truncate ${isSelected ? "text-blue-700" : "text-gray-700 group-hover:text-blue-600"}`}>
                  {block.name}
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  {getBlockRangeString(block)}
                </span>
              </div>
              <div className="flex flex-col items-end justify-center gap-1.5 flex-shrink-0 font-mono text-xs">
                 <span className={supported < total ? "text-orange-500 font-medium" : "text-gray-500"}>
                   <span>{supported.toLocaleString()}</span>
                   <span className="mx-0.5 text-gray-300">/</span>
                   <span>{total.toLocaleString()}</span>
                 </span>
                 <div className="w-14 w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${percent === 100 ? "bg-green-400" : percent > 0 ? "bg-blue-400" : "bg-gray-300"}`} style={{width: `${percent}%`}}></div>
                 </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderCountryModal = () => {
    if (!selectedCountryForModal) return null;
    const countryName = selectedCountryForModal;
    const metadata = COUNTRY_METADATA[countryName];
    if (!metadata) return null;

    const getUnicodeRep = (str: string) => {
      if (str.length === 1) {
        return `U+${str.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
      } else {
        return str
          .split("")
          .map(
            (c) =>
              `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`,
          )
          .join(" ");
      }
    };

    // Evaluate coverage and status using unified helper
    const res = fontData?.supportedChars
      ? evaluateCountryCoverageAndStatus(countryName, fontData.supportedChars)
      : { coverage: 0, status: "未知", supportedCount: 0, totalCount: 0 };

    const status = res.status;
    const coverage = res.coverage;
    const countrySupportedCount = res.supportedCount;
    const countryTotalCount = res.totalCount;

    const statusBadgeColor = getStatusBadgeColor(status);

    const CJK_MAPPING: Record<string, string[]> = {
      "中国": ["gb18030-level1", "gb18030-level2", "gb18030-level3", "gb2312"],
      "中国台湾": ["big5"],
      "中国香港": ["big5"],
      "中国澳门": ["big5"],
      "日本": ["japanese-kana", "joyo-kanji", "jis-x-0208-level1", "jis-x-0208-level2"],
      "韩国": ["ks-x-1001"],
      "朝鲜": ["ks-x-1001"],
      "韩国/朝鲜": ["ks-x-1001"],
    };

    const cjkBlocks = CJK_MAPPING[countryName];
    const isCJKMode = !!cjkBlocks;

    return (
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={() => setSelectedCountryForModal(null)}
      >
        <div
          className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-neutral-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50 animate-in fade-in duration-100">
            <div className="flex items-center gap-2.5">
              <span className="text-xl select-none">{metadata.flag}</span>
              <div>
                <h3 className="font-bold text-neutral-800 text-sm font-mono tracking-wide uppercase flex items-center gap-2 leading-tight">
                  {countryName}
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${statusBadgeColor}`}
                  >
                    {status}
                  </span>
                </h3>
                <p className="text-[10px] text-neutral-400 font-mono uppercase">
                  区域: {metadata.continent}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedCountryForModal(null)}
              className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1 animate-in fade-in duration-300">
            <div className="text-xs font-mono text-neutral-500 flex items-center gap-2 pb-3 border-b border-neutral-100 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              <span>官方语言: </span>
              <span className="text-neutral-900 font-bold bg-neutral-50 border border-neutral-200/50 px-2 py-0.5 rounded">
                {metadata.languages.join(", ")}
              </span>
            </div>

            {isCJKMode ? (
              <div className="space-y-4">
                <div className="font-semibold text-gray-800 text-sm flex items-center gap-1.5 mb-2 mt-4">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  行业/国家标准集合：
                </div>
                <div className="flex flex-col gap-3">
                  {cjkBlocks.map((blockId) => {
                    const block = STANDARD_BLOCKS.find((b) => b.id === blockId);
                    if (!block) return null;
                    const cov = calculateCoverage(block);
                    return (
                      <button
                        key={block.id}
                        onClick={() => {
                          viewBlock(block.id);
                          setSelectedCountryForModal(null);
                        }}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-sm transition-all text-left group"
                      >
                        <div className="font-medium text-gray-800 mb-2 sm:mb-0 group-hover:text-blue-700 transition-colors">
                          【{block.name}】
                        </div>
                        <div className="flex items-center justify-between w-full sm:w-auto gap-8 sm:gap-4 text-sm">
                          <span className="font-mono text-gray-500">
                            {cov.supported.toLocaleString()} / {cov.total.toLocaleString()}
                          </span>
                          <span className="text-blue-600 font-bold whitespace-nowrap bg-blue-100/50 px-2 py-1 rounded">
                            覆盖率 {Math.floor(cov.percent) === cov.percent ? cov.percent : cov.percent.toFixed(1)}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 border-t border-gray-100 pt-4">
                  <div className="font-semibold text-gray-800 text-sm flex items-center gap-1.5 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    可用性判定说明：
                  </div>
                  <div className="bg-amber-50/45 rounded-xl border border-amber-100/70 p-4 text-xs text-gray-600 leading-relaxed space-y-3">
                    {countryName === "中国" && (
                      <>
                        <p className="font-medium text-gray-800">🇨🇳 中华人民共和国汉字覆盖研判逻辑：</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li><strong>完全可用</strong>：任一国家/行业规范标准字集的覆盖率 &ge; 98%。</li>
                          <li><strong>基本可用</strong>：任一国家/行业规范标准字集的覆盖率 &ge; 95% 且 &lt; 98%。</li>
                          <li><strong>不可用</strong>：所有规范字集的覆盖率均 &lt; 95%。</li>
                          <li className="text-amber-700 font-medium list-none mt-1 pl-0">
                            ★ <strong>择优推荐机制</strong>：系统将根据字库支持的最佳层级进行展示。在同等可用层级下，推荐优先级为：<strong>GB18030-2022级别3 &gt; 级别2 &gt; 级别1 &gt; GB2312</strong>。
                          </li>
                        </ul>
                      </>
                    )}
                    {["中国台湾", "中国香港", "中国澳门"].includes(countryName) && (
                      <>
                        <p className="font-medium text-gray-800">🇭🇰 🇲🇴 🇹🇼 大中华区繁体中文覆盖研判逻辑：</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>依主流繁体规范 BIG5 标准常用汉字进行计算。</li>
                          <li><strong>完全可用</strong>：BIG5 覆盖率 &ge; 98%。</li>
                          <li><strong>基本可用</strong>：BIG5 覆盖率 &ge; 95% 且 &lt; 98%。</li>
                          <li><strong>不可用</strong>：BIG5 覆盖率 &lt; 95%。</li>
                        </ul>
                      </>
                    )}
                    {countryName === "日本" && (
                      <>
                        <p className="font-medium text-gray-800">🇯🇵 日本语覆盖研判逻辑（假名强校验 + 汉字择优推荐）：</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>
                            <strong>极低限制 / 假名硬性校验</strong>：必须首先满足“平假名 + 片假名”整体假名覆盖率 &ge; 95%，否则直接判定为<strong>不可用</strong>。
                          </li>
                          <li><strong>完全可用</strong>：在假名达标的基础之上，任一日本汉字规范（常用汉字、JIS第一、JIS第二水准）覆盖率 &ge; 98%。</li>
                          <li><strong>基本可用</strong>：在假名达标的基础之上，任一日本汉字规范覆盖率 &ge; 95% 且 &lt; 98%。</li>
                          <li className="text-amber-700 font-medium list-none mt-1 pl-0">
                            ★ <strong>择优推荐机制</strong>：在相同最大可用等级下，系统汉字推荐优先级降序为：<strong>JISX0208第二水准 &gt; JISX0208第一水准 &gt; 日本常用汉字集</strong>。
                          </li>
                        </ul>
                      </>
                    )}
                    {(countryName === "韩国" || countryName === "朝鲜" || countryName === "韩国/朝鲜") && (
                      <>
                        <p className="font-medium text-gray-800">🇰🇷 🇰🇵 朝鲜语/韩语覆盖研判逻辑：</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>依据主流 KS X 1001 规范标准常用谚文进行计算。</li>
                          <li><strong>完全可用</strong>：KS X 1001 覆盖率 &ge; 98%。</li>
                          <li><strong>基本可用</strong>：KS X 1001 覆盖率 &ge; 95% 且 &lt; 98%。</li>
                          <li><strong>不可用</strong>：KS X 1001 覆盖率 &lt; 95%。</li>
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
            <div className="space-y-8">
              {metadata.languages.map((lang, langIdx) => {
                const languageAlphabet = getLanguageAlphabet(lang);
                const currentLangFilter = modalLanguageFilters[lang] || "all";
                
                // Calculate coverage for this specific language
                let langSupportedCount = 0;
                if (fontData?.supportedChars) {
                  for (const char of languageAlphabet) {
                    let isSup = true;
                    for (let i = 0; i < char.length; i++) {
                      if (!fontData.supportedChars.has(char.codePointAt(i)!)) {
                        isSup = false;
                        break;
                      }
                    }
                    if (isSup) langSupportedCount++;
                  }
                }
                
                const langCoverage = languageAlphabet.length > 0 ? langSupportedCount / languageAlphabet.length : 0;
                let langStatus = "不可用";
                if (langCoverage >= 0.98) langStatus = "完全可用";
                else if (langCoverage >= 0.95) langStatus = "基本可用";

                // Filter characters for this specific language
                const filteredLangAlphabet = languageAlphabet.filter((char) => {
                  const isCharSup = fontData?.supportedChars
                    ? (function (c: string) {
                        for (let i = 0; i < c.length; i++) {
                          if (!fontData.supportedChars.has(c.codePointAt(i)!)) return false;
                        }
                        return true;
                      })(char)
                    : false;

                  if (currentLangFilter === "missing") return !isCharSup;
                  if (currentLangFilter === "existing") return isCharSup;
                  return true;
                });

                const displayAlphabet = filteredLangAlphabet.slice(0, 800);
                const langHasMore = filteredLangAlphabet.length > 800;

                return (
                  <div key={`${lang}-${langIdx}`} className="space-y-4">
                    <div className="flex flex-col gap-3 mb-4">
                      {/* Language Title & Filter Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                          必要字母集 - {lang} 预览{" "}
                          {langHasMore && (
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md font-normal">
                              已自动分页
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* Sub-header Filter Controls */}
                          <div className="flex bg-gray-100 p-0.5 rounded-md border border-gray-200/50">
                            <button
                              onClick={() => setModalLanguageFilters(prev => ({ ...prev, [lang]: "all" }))}
                              className={`px-2 py-1 text-[10px] rounded transition-all flex items-center gap-1 ${
                                currentLangFilter === "all"
                                  ? "bg-white text-gray-800 shadow-sm font-medium"
                                  : "text-gray-500 hover:text-gray-700 font-normal"
                              }`}
                            >
                              <span>全部</span>
                            </button>
                            <button
                              onClick={() => setModalLanguageFilters(prev => ({ ...prev, [lang]: "existing" }))}
                              className={`px-2 py-1 text-[10px] rounded transition-all flex items-center gap-1 ${
                                currentLangFilter === "existing"
                                  ? "bg-white text-gray-800 shadow-sm font-medium"
                                  : "text-gray-500 hover:text-gray-700 font-normal"
                              }`}
                            >
                              <span>已有</span>
                            </button>
                            <button
                              onClick={() => setModalLanguageFilters(prev => ({ ...prev, [lang]: "missing" }))}
                              className={`px-2 py-1 text-[10px] rounded transition-all flex items-center gap-1 ${
                                currentLangFilter === "missing"
                                  ? "bg-white text-gray-800 shadow-sm font-medium"
                                  : "text-gray-500 hover:text-gray-700 font-normal"
                              }`}
                            >
                              <span>缺失</span>
                            </button>
                          </div>

                          {/* Copy Button */}
                          <button
                            onClick={() => {
                              const text = filteredLangAlphabet.join("");
                              if (text.length === 0) {
                                setCopiedLanguage(`empty:${lang}`);
                              } else {
                                navigator.clipboard.writeText(text);
                                setCopiedLanguage(`success:${lang}`);
                              }
                              setTimeout(() => setCopiedLanguage(null), 2000);
                            }}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all border ${
                              copiedLanguage === `success:${lang}`
                                ? "bg-green-50 text-green-600 border-green-200"
                                : copiedLanguage === `empty:${lang}`
                                  ? "bg-amber-50 text-amber-600 border-amber-200"
                                  : "bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100"
                            }`}
                            title="复制当前列表所有字符"
                          >
                            {copiedLanguage === `success:${lang}` ? (
                              <Check className="w-3 h-3" />
                            ) : copiedLanguage === `empty:${lang}` ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>
                              {copiedLanguage === `success:${lang}` 
                                ? "复制成功" 
                                : copiedLanguage === `empty:${lang}`
                                  ? "复制为空"
                                  : "一键复制"}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Stats & Progress */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              langStatus === "完全可用"
                                ? "bg-green-400"
                                : langStatus === "基本可用"
                                  ? "bg-orange-400"
                                  : "bg-red-400"
                            }`}
                            style={{
                              width: `${Math.min((langSupportedCount / (languageAlphabet.length || 1)) * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <div className="text-[10px] font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded whitespace-nowrap">
                          覆盖: {langSupportedCount}/{languageAlphabet.length} ({(langCoverage * 100).toFixed(1)}%)
                        </div>
                      </div>
                    </div>

                    {/* Character preview grid per language */}
                    <div className="flex flex-wrap gap-1.5 justify-start max-h-[300px] overflow-y-auto p-2 border border-gray-100 rounded-lg bg-gray-50/30">
                      {displayAlphabet.length === 0 ? (
                        <div className="w-full py-4 text-center text-xs text-gray-400 italic">
                          无匹配字符
                        </div>
                      ) : (
                        displayAlphabet.map((char, idx) => {
                          const isCharSup = fontData?.supportedChars
                            ? (function (c: string) {
                                for (let i = 0; i < c.length; i++) {
                                  if (!fontData.supportedChars.has(c.codePointAt(i)!))
                                    return false;
                                }
                                return true;
                              })(char)
                            : false;

                          return (
                            <div
                              key={`modal-${lang}-${idx}`}
                              className={`relative w-10 h-11 flex flex-col items-center justify-center border rounded select-all transition-all cursor-pointer hover:bg-gray-50 hover:border-gray-200 active:scale-95 ${
                                isCharSup
                                  ? "bg-white text-gray-900 border-gray-100"
                                  : "bg-white text-gray-300 border-dashed border-gray-200 opacity-60 hover:opacity-100"
                              }`}
                              onMouseEnter={(e) => {
                                const codepoint = getUnicodeRep(char);
                                setHoveredCell({
                                  char,
                                  codepoint,
                                  isMissing: !isCharSup,
                                  isUnassigned: false,
                                  rect: e.currentTarget.getBoundingClientRect(),
                                  blockName: getBlockNameForChar(char),
                                });
                              }}
                              onMouseLeave={() => setHoveredCell(null)}
                              onClick={() => {
                                navigator.clipboard.writeText(char);
                                setHoveredCell((prev) =>
                                  prev && prev.char === char
                                    ? { ...prev, isCopied: true }
                                    : prev,
                                );
                                setTimeout(() => {
                                  setHoveredCell((prev) =>
                                    prev && prev.char === char
                                      ? { ...prev, isCopied: false }
                                      : prev,
                                  );
                                }, 1200);
                              }}
                            >
                              <span
                                className="text-base font-semibold leading-none relative z-10 select-all"
                                style={{
                                  fontFamily:
                                    !fontData || !isCharSup
                                      ? "inherit"
                                      : `"${fontData.fontFamilyCSS}", "SimSun-ExtB", "MingLiU-ExtB", "PMingLiU-ExtB", "HanaMinB", "HanaMinA", sans-serif`,
                                }}
                              >
                                {char}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Original renderCountryModal starts here (will be skipped early due to previous return)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _unused_renderCountryModal = () => {
    return null;
    // eslint-disable-next-line @typescript-eslint/no-unreachable
    if (!selectedCountryForModal) return null;
    const countryName = selectedCountryForModal;
    const metadata = COUNTRY_METADATA[countryName];
    if (!metadata) return null;

    const getUnicodeRep = (str: string) => {
      if (str.length === 1) {
        return `U+${str.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
      } else {
        return str
          .split("")
          .map(
            (c) =>
              `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`,
          )
          .join(" ");
      }
    };

    // Special handling for Japan and Korea Professional Compliance display inside the Modal
    if (countryName === "日本" && fontData?.supportedChars) {
      const jpComp = checkJapaneseCompliance(fontData.supportedChars);
      const details = jpComp.details;
      const status = getCountryStatus(countryName);

      const statusBadgeColor = getStatusBadgeColor(status);

      return (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedCountryForModal(null)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-2.5">
                <span className="text-xl select-none">🇯🇵</span>
                <div>
                  <h3 className="font-bold text-neutral-800 text-sm font-mono tracking-wide uppercase flex items-center gap-2 leading-tight">
                    日本 (专业合规性报告)
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${statusBadgeColor}`}
                    >
                      {jpComp.level}
                    </span>
                  </h3>
                  <p className="text-[10px] text-neutral-400 font-mono uppercase">
                    区域: {metadata.continent}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCountryForModal(null)}
                className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-5">
              <div className="text-xs font-mono text-neutral-500 flex items-center gap-2 pb-3 border-b border-neutral-100 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                <span>官方语言: </span>
                <span className="text-neutral-900 font-bold bg-neutral-50 border border-neutral-200/50 px-2 py-0.5 rounded">
                  日语
                </span>
              </div>

              <div className="space-y-4">
                <div className="font-bold text-neutral-800 text-xs flex items-center gap-1.5 font-mono uppercase tracking-wider">
                  📢 JIS 合规性标准检测结果
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Kana */}
                  <div className="bg-neutral-50/50 border border-neutral-200/60 p-4 rounded flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 font-mono">
                        假名覆盖率 (平假名 & 片假名)
                      </div>
                      <div className="text-xl font-mono font-bold text-neutral-800">
                        {(details.kanaCoverage * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="w-full bg-neutral-100 h-1 rounded overflow-hidden mt-3 border border-neutral-200/25">
                      <div
                        className="h-full bg-neutral-900 transition-all duration-300"
                        style={{ width: `${details.kanaCoverage * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Joyo */}
                  <div className="bg-neutral-50/50 border border-neutral-200/60 p-4 rounded flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 font-mono">
                        常用汉字 (常用汉字表 2,136字)
                      </div>
                      <div className="text-xl font-mono font-bold text-neutral-800">
                        {(details.joyoCoverage * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="w-full bg-neutral-100 h-1 rounded overflow-hidden mt-3 border border-neutral-200/25">
                      <div
                        className="h-full bg-neutral-900 transition-all duration-300"
                        style={{ width: `${details.joyoCoverage * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* JIS Level 1 */}
                  <div className="bg-neutral-50/50 border border-neutral-200/60 p-4 rounded flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 font-mono">
                        JIS 第一水准汉字 (2,965字)
                      </div>
                      <div className="text-xl font-mono font-bold text-neutral-800">
                        {(details.jisLevel1Coverage * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="w-full bg-neutral-100 h-1 rounded overflow-hidden mt-3 border border-neutral-200/25">
                      <div
                        className="h-full bg-neutral-900 transition-all duration-300"
                        style={{ width: `${details.jisLevel1Coverage * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* JIS Level 2 */}
                  <div className="bg-neutral-50/50 border border-neutral-200/60 p-4 rounded flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 font-mono">
                        JIS 第二水准汉字 (3,390字)
                      </div>
                      <div className="text-xl font-mono font-bold text-neutral-800">
                        {(details.jisLevel2Coverage * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="w-full bg-neutral-100 h-1 rounded overflow-hidden mt-3 border border-neutral-200/25">
                      <div
                        className="h-full bg-neutral-900 transition-all duration-300"
                        style={{ width: `${details.jisLevel2Coverage * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="text-[10.5px] text-neutral-400 bg-neutral-50 p-3 rounded. border border-neutral-250/25 leading-relaxed">
                  📢 <strong>日本JIS排版字库判定指标说明</strong>：
                  <br />
                  1.
                  <strong>标准商业日文字库</strong>：要求平/片假名、常用汉字以及JIS第一水准（JIS
                  L1）达到 <strong>99%</strong> 或以上。
                  <br />
                  2. <strong>日文基础可用</strong>：平片假名与常用汉字达到 <strong>95%</strong>
                  以上，符合基础日文日常阅读和编辑需求。
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (["中国", "中国台湾", "中国香港", "中国澳门"].includes(countryName)) {
      const isCn = countryName === "中国";
      let details: any = {
        gb2312Coverage: 0,
        level1Coverage: 0,
        level2Coverage: 0,
        level3Coverage: 0,
        big5Coverage: 0,
      };

      if (isCn) {
        if (fontData?.supportedChars) {
          const cnComp = checkChineseCompliance(fontData.supportedChars);
          details = cnComp.details;
        }
      } else {
        if (fontData?.supportedChars) {
          const big5Comp = checkBig5Compliance(fontData.supportedChars);
          details = { big5Coverage: big5Comp.coverage };
        }
      }
      const status = getCountryStatus(countryName);

      const statusBadgeColor = getStatusBadgeColor(status);

      const renderDetailedGrid = (
        blockId: string,
        title: string,
        coverage: number,
        colorClass: string,
      ) => {
        const block = STANDARD_BLOCKS.find((b) => b.id === blockId);
        if (!block) return null;
        const chars = getCharsForBlock(block);

        const filteredChars = chars.filter((char) => {
          const isSup = fontData?.supportedChars
            ? fontData.supportedChars.has(char.codePointAt(0)!)
            : false;
          if (gridFilterMode === "missing") return !isSup;
          if (gridFilterMode === "existing") return isSup;
          return true;
        });

        return (
          <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCnDetailedBlockId(null)}
                  className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div
                  className={`text-sm font-bold flex flex-wrap gap-2 items-end ${colorClass.replace("bg-", "text-")}`}
                >
                  <span>{title} 详细预览</span>
                  <span className="text-xs font-normal text-gray-400 mb-[1px]">
                    (共 {filteredChars.length} 个字)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex bg-white p-0.5 rounded-lg border border-gray-200">
                  <button
                    onClick={() => setGridFilterMode("all")}
                    className={`px-2.5 py-1 text-[11px] rounded transition-all flex items-center gap-1.5 ${
                      gridFilterMode === "all"
                        ? "bg-gray-900 text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>全部</span>
                  </button>
                  <button
                    onClick={() => setGridFilterMode("existing")}
                    className={`px-2.5 py-1 text-[11px] rounded transition-all flex items-center gap-1.5 ${
                      gridFilterMode === "existing"
                        ? "bg-gray-900 text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>已有</span>
                  </button>
                  <button
                    onClick={() => setGridFilterMode("missing")}
                    className={`px-2.5 py-1 text-[11px] rounded transition-all flex items-center gap-1.5 ${
                      gridFilterMode === "missing"
                        ? "bg-gray-900 text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>缺失</span>
                  </button>
                </div>
                <div className="text-sm font-mono font-bold text-gray-700">
                  {(coverage * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1 p-3 border border-gray-100 rounded-2xl bg-gray-50/30 max-h-[400px] overflow-y-auto">
              {filteredChars.length === 0 ? (
                <div className="w-full py-12 text-center">
                  <div className="text-gray-300 mb-2">
                    <Layers className="w-8 h-8 mx-auto opacity-20" />
                  </div>
                  <div className="text-sm text-gray-400 italic">
                    在该筛选条件下无匹配字符
                  </div>
                </div>
              ) : (
                filteredChars.map((char, idx) => {
                  const isCharSup = fontData?.supportedChars
                    ? fontData.supportedChars.has(char.codePointAt(0)!)
                    : false;
                  return (
                    <div
                      key={`${blockId}-${idx}`}
                      className={`w-8 h-8 flex items-center justify-center text-lg transition-all cursor-pointer rounded ${
                        isCharSup
                          ? "text-gray-900 hover:bg-gray-100"
                          : "text-gray-300 opacity-50 hover:bg-gray-50"
                      }`}
                      onMouseEnter={(e) => {
                        const codepoint = `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
                        setHoveredCell({
                          char,
                          codepoint,
                          isMissing: !isCharSup,
                          isUnassigned: false,
                          rect: e.currentTarget.getBoundingClientRect(),
                          blockName: getBlockNameForChar(char),
                        });
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        fontFamily: isCharSup
                          ? `"${fontData?.fontFamilyCSS}", sans-serif`
                          : "inherit",
                      }}
                    >
                      {char}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      };

      return (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => {
            setSelectedCountryForModal(null);
            setCnDetailedBlockId(null);
          }}
        >
          <div
            className={`bg-white rounded-lg w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-neutral-200 transition-all ${cnDetailedBlockId ? "max-w-4xl" : "max-w-xl"}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-2.5">
                <span className="text-xl select-none">{metadata.flag}</span>
                <div>
                  <h3 className="font-bold text-neutral-800 text-sm font-mono tracking-wide uppercase flex items-center gap-2 leading-tight">
                    {countryName} (专业合规性报告)
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${statusBadgeColor}`}
                    >
                      {status}
                    </span>
                  </h3>
                  <p className="text-[10px] text-neutral-400 font-mono uppercase">
                    区域: {metadata.continent}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedCountryForModal(null);
                  setCnDetailedBlockId(null);
                }}
                className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-6">
              <div className="text-xs font-mono text-neutral-500 flex items-center gap-2 pb-3 border-b border-neutral-100 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                <span>官方语言: </span>
                <span className="text-neutral-900 font-bold bg-neutral-50 border border-neutral-200/50 px-2 py-0.5 rounded">
                  {isCn ? "简体中文" : "繁体中文"}
                </span>
              </div>

              <div className="space-y-6">
                {!cnDetailedBlockId && (
                  <>
                    <div className="font-semibold text-gray-800 text-sm flex items-center gap-1.5 font-mono uppercase tracking-wider">
                      📢 {isCn ? "国家" : "地区"}常用标准
                    </div>

                    {isCn ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* GB2312 */}
                        <button
                          onClick={() => setCnDetailedBlockId("gb2312")}
                          className="bg-gray-50/50 border border-gray-100 p-4 rounded-xl flex flex-col justify-between hover:border-blue-200 hover:bg-blue-50/30 transition-all text-left outline-none focus:ring-2 focus:ring-blue-100"
                        >
                          <div className="w-full">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
                              GB 2312 常用汉字
                            </div>
                            <div className="text-2xl font-bold text-gray-800">
                              {(details.gb2312Coverage * 100).toFixed(1)}%
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-3">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all duration-300"
                              style={{
                                width: `${details.gb2312Coverage * 100}%`,
                              }}
                            />
                          </div>
                        </button>

                        {/* Level 1 */}
                        <button
                          onClick={() => setCnDetailedBlockId("gb18030-level1")}
                          className="bg-gray-50/50 border border-gray-100 p-4 rounded-xl flex flex-col justify-between hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-left outline-none focus:ring-2 focus:ring-indigo-100"
                        >
                          <div className="w-full">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
                              GB18030 实现级别 1
                            </div>
                            <div className="text-2xl font-bold text-gray-800">
                              {(details.level1Coverage * 100).toFixed(1)}%
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-3">
                            <div
                              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                              style={{
                                width: `${details.level1Coverage * 100}%`,
                              }}
                            />
                          </div>
                        </button>

                        {/* Level 2 */}
                        <button
                          onClick={() => setCnDetailedBlockId("gb18030-level2")}
                          className="bg-gray-50/50 border border-gray-100 p-4 rounded-xl flex flex-col justify-between hover:border-green-200 hover:bg-green-50/30 transition-all text-left outline-none focus:ring-2 focus:ring-green-100"
                        >
                          <div className="w-full">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
                              GB18030 实现级别 2
                            </div>
                            <div className="text-2xl font-bold text-gray-800">
                              {(details.level2Coverage * 100).toFixed(1)}%
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-3">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all duration-300"
                              style={{
                                width: `${details.level2Coverage * 100}%`,
                              }}
                            />
                          </div>
                        </button>

                        {/* Level 3 */}
                        <button
                          onClick={() => setCnDetailedBlockId("gb18030-level3")}
                          className="bg-gray-50/50 border border-gray-100 p-4 rounded-xl flex flex-col justify-between hover:border-emerald-200 hover:bg-emerald-50/30 transition-all text-left outline-none focus:ring-2 focus:ring-emerald-100"
                        >
                          <div className="w-full">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
                              GB18030 实现级别 3
                            </div>
                            <div className="text-2xl font-bold text-gray-800">
                              {(details.level3Coverage * 100).toFixed(1)}%
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-3">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                              style={{
                                width: `${details.level3Coverage * 100}%`,
                              }}
                            />
                          </div>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {/* Big5 */}
                        <button
                          onClick={() => setCnDetailedBlockId("big5")}
                          className="bg-gray-50/50 border border-gray-100 p-4 rounded-xl flex flex-col justify-between hover:border-blue-200 hover:bg-blue-50/30 transition-all text-left outline-none focus:ring-2 focus:ring-blue-100"
                        >
                          <div className="w-full">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
                              BIG5 常用字
                            </div>
                            <div className="text-2xl font-bold text-gray-800">
                              {(details.big5Coverage * 100).toFixed(1)}%
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-3">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all duration-300"
                              style={{
                                width: `${details.big5Coverage * 100}%`,
                              }}
                            />
                          </div>
                        </button>
                      </div>
                    )}
                  </>
                )}

                {cnDetailedBlockId === "gb2312" &&
                  renderDetailedGrid(
                    "gb2312",
                    "GB 2312",
                    details.gb2312Coverage,
                    "bg-blue-500",
                  )}
                {cnDetailedBlockId === "gb18030-level1" &&
                  renderDetailedGrid(
                    "gb18030-level1",
                    "GB18030 Level 1",
                    details.level1Coverage,
                    "bg-indigo-500",
                  )}
                {cnDetailedBlockId === "gb18030-level2" &&
                  renderDetailedGrid(
                    "gb18030-level2",
                    "GB18030 Level 2",
                    details.level2Coverage,
                    "bg-green-500",
                  )}
                {cnDetailedBlockId === "gb18030-level3" &&
                  renderDetailedGrid(
                    "gb18030-level3",
                    "GB18030 Level 3",
                    details.level3Coverage,
                    "bg-emerald-500",
                  )}
                {cnDetailedBlockId === "big5" &&
                  renderDetailedGrid(
                    "big5",
                    "BIG5",
                    details.big5Coverage,
                    "bg-blue-500",
                  )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (countryName === "韩国" && fontData?.supportedChars) {
      const korComp = checkKoreanCompliance(fontData.supportedChars);
      const korDetails = korComp.details;
      const status = getCountryStatus(countryName);

      const statusBadgeColor = getStatusBadgeColor(status);

      return (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedCountryForModal(null)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-2.5">
                <span className="text-xl select-none">🇰🇷</span>
                <div>
                  <h3 className="font-bold text-neutral-800 text-sm font-mono tracking-wide uppercase flex items-center gap-2 leading-tight">
                    韩国 (专业合规性报告)
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${statusBadgeColor}`}
                    >
                      {korComp.level}
                    </span>
                  </h3>
                  <p className="text-[10px] text-neutral-400 font-mono uppercase">
                    区域: {metadata.continent}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCountryForModal(null)}
                className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-5">
              <div className="text-xs font-mono text-neutral-500 flex items-center gap-2 pb-3 border-b border-neutral-100 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                <span>官方语言: </span>
                <span className="text-neutral-900 font-bold bg-neutral-50 border border-neutral-200/50 px-2 py-0.5 rounded">
                  韩语
                </span>
              </div>

              <div className="space-y-5">
                <div className="font-semibold text-gray-800 text-sm flex items-center gap-1.5 font-mono uppercase tracking-wider">
                  📢 KS X 1001 韩语规范合规分析
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Common Korean Standard */}
                  <div className="bg-gray-50/50 border border-gray-100 p-4 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
                        常用现代韩文本 (KS X 1001 常用现代文)
                      </div>
                      <div className="text-2xl font-bold text-gray-800">
                        {(korDetails.ksCoverage * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-3">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${korDetails.ksCoverage * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Absolute Syllables Count */}
                  <div className="bg-gray-50/50 border border-gray-100 p-4 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
                        韩语音节数量 (已获得字体支持数量)
                      </div>
                      <div className="text-2xl font-bold text-gray-800">
                        {korDetails.supportedSyllables}{" "}
                        <span className="text-sm font-normal text-gray-400">
                          / 2350 字
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-3">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-300"
                        style={{
                          width: `${(korDetails.supportedSyllables / 2350) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-gray-400 bg-gray-50 p-3 rounded-lg border border-gray-100 leading-relaxed">
                  📢 **韩语排版字库KS规范说明**：
                  <br />
                  1. **完全支持**：对 KS X 1001 标准中的 **2,350
                  个常用现代韩语字** 达到了 **99%** 或以上的极高覆盖率。
                  <br />
                  2. **基本支持**：覆盖了 KS 常用字集中 **90%**
                  以上的字符，在常规应用场景下不会发生缺字。
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (countryName === "格鲁吉亚" && fontData?.supportedChars) {
      const geoComp = checkGeorgianCompliance(fontData.supportedChars);
      const details = geoComp.details;
      const status = getCountryStatus(countryName);

      const statusBadgeColor = getStatusBadgeColor(status);

      const mkhedruliChars = Array.from({ length: 33 }, (_, i) =>
        String.fromCodePoint(0x10d0 + i),
      );
      const mtavruliChars = Array.from({ length: 33 }, (_, i) =>
        String.fromCodePoint(0x1c90 + i),
      );
      const asomtavruliChars = Array.from({ length: 33 }, (_, i) =>
        String.fromCodePoint(0x10a0 + i),
      );
      const nuskhuriChars = Array.from({ length: 33 }, (_, i) =>
        String.fromCodePoint(0x2d00 + i),
      );
      const khutsuriChars = [...asomtavruliChars, ...nuskhuriChars];

      const renderCharGrid = (
        chars: string[],
        title: string,
        coverage: number,
        colorClass: string,
      ) => {
        const filteredChars = chars.filter((char) => {
          const isSup = fontData?.supportedChars
            ? fontData.supportedChars.has(char.codePointAt(0)!)
            : false;
          if (gridFilterMode === "missing") return !isSup;
          if (gridFilterMode === "existing") return isSup;
          return true;
        });

        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div
                className={`text-xs font-bold uppercase tracking-wider flex items-end gap-1.5 ${colorClass.replace("bg-", "text-")}`}
              >
                <span>{title}</span>
                <span className="text-[10px] font-normal text-gray-400 normal-case mb-px">
                  (共 {filteredChars.length} 个字)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 p-0.5 rounded-md border border-gray-200/50">
                  <button
                    onClick={() => setGridFilterMode("all")}
                    className={`px-2 py-1 text-[10px] rounded transition-all flex items-center gap-1 ${
                      gridFilterMode === "all"
                        ? "bg-white text-gray-800 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                    title="全部"
                  >
                    <Layers className="w-3 h-3" />
                    <span>全部</span>
                  </button>
                  <button
                    onClick={() => setGridFilterMode("existing")}
                    className={`px-2 py-1 text-[10px] rounded transition-all flex items-center gap-1 ${
                      gridFilterMode === "existing"
                        ? "bg-white text-gray-800 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                    title="仅看已有"
                  >
                    <Eye className="w-3 h-3" />
                    <span>已有</span>
                  </button>
                  <button
                    onClick={() => setGridFilterMode("missing")}
                    className={`px-2 py-1 text-[10px] rounded transition-all flex items-center gap-1 ${
                      gridFilterMode === "missing"
                        ? "bg-white text-gray-800 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                    title="仅看缺失"
                  >
                    <EyeOff className="w-3 h-3" />
                    <span>缺失</span>
                  </button>
                </div>
                <div className="text-xs font-mono font-bold text-gray-700">
                  {(coverage * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
              <div
                className={`h-full ${colorClass} transition-all duration-300`}
                style={{ width: `${coverage * 100}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-1 p-2 border border-gray-100 rounded-lg bg-gray-50/10 min-h-[40px] max-h-[200px] overflow-y-auto">
              {filteredChars.length === 0 ? (
                <div className="w-full py-4 text-center text-xs text-gray-400 italic">
                  在该筛选条件下无匹配字符
                </div>
              ) : (
                filteredChars.map((char, idx) => {
                  const isCharSup = fontData?.supportedChars
                    ? fontData.supportedChars.has(char.codePointAt(0)!)
                    : false;
                  return (
                    <div
                      key={`${title}-${idx}`}
                      className={`w-7 h-8 flex items-center justify-center text-sm transition-all cursor-pointer rounded ${
                        isCharSup
                          ? "text-gray-900 hover:bg-gray-100"
                          : "text-gray-300 opacity-50 hover:bg-gray-50"
                      }`}
                      onMouseEnter={(e) => {
                        const codepoint = `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
                        setHoveredCell({
                          char,
                          codepoint,
                          isMissing: !isCharSup,
                          isUnassigned: false,
                          rect: e.currentTarget.getBoundingClientRect(),
                          blockName: getBlockNameForChar(char),
                        });
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        fontFamily: isCharSup
                          ? `"${fontData?.fontFamilyCSS}", sans-serif`
                          : "inherit",
                      }}
                    >
                      {char}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      };

      return (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedCountryForModal(null)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-2.5">
                <span className="text-xl select-none">🇬🇪</span>
                <div>
                  <h3 className="font-bold text-neutral-800 text-sm font-mono tracking-wide uppercase flex items-center gap-2 leading-tight">
                    格鲁吉亚
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${statusBadgeColor}`}
                    >
                      {geoComp.level}
                    </span>
                  </h3>
                  <p className="text-[10px] text-neutral-400 font-mono uppercase">
                    区域: {metadata.continent}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCountryForModal(null)}
                className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-6">
              <div className="text-xs font-mono text-neutral-500 flex items-center gap-2 pb-3 border-b border-neutral-100 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                <span>官方语言: </span>
                <span className="text-neutral-900 font-bold bg-neutral-50 border border-neutral-200/50 px-2.5 py-0.5 rounded shadow-none">
                  格鲁吉亚语
                </span>
              </div>

              <div className="space-y-10">
                {renderCharGrid(
                  mkhedruliChars,
                  "骑士体 Mkhedruli (现代标准/常用)",
                  details.mkhedruliCoverage,
                  "bg-blue-500",
                )}
                {renderCharGrid(
                  mtavruliChars,
                  "标题大写体 Mtavruli (现代标题风格)",
                  details.mtavruliCoverage,
                  "bg-indigo-500",
                )}
                {renderCharGrid(
                  khutsuriChars,
                  "教士体 Khutsuri (古典/宗教/学术用途)",
                  details.khutsuriCoverage,
                  "bg-amber-500",
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    const status = getCountryStatus(countryName);
    const statusBadgeColor = getStatusBadgeColor(status);
    const statusText =
      status === "完全可用"
        ? "完全支持"
        : status === "不可用"
          ? "存在缺失"
          : status;

    const countryAlphabet = getCountryAlphabet(countryName);
    let countryTotalCount = countryAlphabet.length;
    let countrySupportedCount = 0;
    if (["中国台湾", "中国香港", "中国澳门"].includes(countryName)) {
      const big5Block = STANDARD_BLOCKS.find((b) => b.id === "big5");
      if (big5Block) {
        const chars = getCharsForBlock(big5Block);
        countryTotalCount = chars.length;
        if (fontData?.supportedChars) {
          chars.forEach((char) => {
            if (fontData.supportedChars!.has(char.codePointAt(0)!)) {
              countrySupportedCount++;
            }
          });
        }
      }
    } else if (countryName === "中国") {
      const gbBlock = STANDARD_BLOCKS.find((b) => b.id === "gb18030-level1"); // Or whichever primary block
      if (gbBlock) {
        const chars = getCharsForBlock(gbBlock);
        countryTotalCount = chars.length;
        if (fontData?.supportedChars) {
          chars.forEach((char) => {
            if (fontData.supportedChars!.has(char.codePointAt(0)!)) {
              countrySupportedCount++;
            }
          });
        }
      }
    } else {
      if (fontData?.supportedChars) {
        countryAlphabet.forEach((char) => {
          let isSup = true;
          for (let i = 0; i < char.length; i++) {
            if (!fontData.supportedChars!.has(char.codePointAt(i)!)) {
              isSup = false;
            }
          }
          if (isSup) countrySupportedCount++;
        });
      }
    }

    return (
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={() => setSelectedCountryForModal(null)}
      >
        <div
          className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-neutral-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <div className="flex items-center gap-2.5">
              <span className="text-xl select-none">{metadata.flag}</span>
              <div>
                <h3 className="font-bold text-neutral-800 text-sm font-mono tracking-wide uppercase flex items-center gap-2 leading-tight">
                  {countryName}
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${statusBadgeColor}`}
                  >
                    {statusText}
                  </span>
                </h3>
                <p className="text-[10px] text-neutral-400 font-mono uppercase">
                  区域: {metadata.continent}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedCountryForModal(null)}
              className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-5 overflow-y-auto space-y-5">
            <div className="text-xs font-mono text-neutral-500 flex items-center gap-2 pb-3 border-b border-neutral-100 uppercase">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>官方语言: </span>
              <span className="text-blue-600 font-bold bg-blue-50 px-2.5 py-0.5 rounded-md">
                {metadata.languages.join("、")}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    必要字母集网格预览
                  </div>
                  <div className="text-xs font-mono text-gray-500 bg-gray-50 px-2.5 py-1 rounded">
                    已覆盖:{" "}
                    <span className="font-bold text-gray-800">
                      {countrySupportedCount}
                    </span>{" "}
                    / {countryTotalCount}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-neutral-100 h-1.5 rounded overflow-hidden mb-4 border border-neutral-200/30">
                  <div
                    className={`h-full transition-all duration-500 bg-neutral-900`}
                    style={{
                      width: `${Math.min((countrySupportedCount / (countryTotalCount || 1)) * 100, 100)}%`,
                    }}
                  />
                </div>

                {/* Character preview grid */}
                <div className="flex flex-wrap gap-1.5 justify-start max-h-[300px] overflow-y-auto p-2 border border-neutral-200/60 rounded bg-neutral-50/30">
                  {countryAlphabet.map((char, idx) => {
                    const isCharSup = fontData?.supportedChars
                      ? (function (c: string) {
                          for (let i = 0; i < c.length; i++) {
                            if (!fontData.supportedChars.has(c.codePointAt(i)!))
                              return false;
                          }
                          return true;
                        })(char)
                      : false;

                    return (
                      <div
                        key={`modal-char-${idx}`}
                        className={`relative w-10 h-11 flex flex-col items-center justify-center border rounded select-all transition-all cursor-pointer hover:bg-gray-50 hover:border-gray-200 active:scale-95 ${
                          isCharSup
                            ? "bg-white text-gray-900 border-gray-100"
                            : "bg-white text-gray-300 border-dashed border-gray-200 opacity-60 hover:opacity-100"
                        }`}
                        onMouseEnter={(e) => {
                          const codepoint = getUnicodeRep(char);
                          setHoveredCell({
                            char,
                            codepoint,
                            isMissing: !isCharSup,
                            isUnassigned: false,
                            rect: e.currentTarget.getBoundingClientRect(),
                            blockName: getBlockNameForChar(char),
                          });
                        }}
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() => {
                          navigator.clipboard.writeText(char);
                          setHoveredCell((prev) =>
                            prev && prev.char === char
                              ? { ...prev, isCopied: true }
                              : prev,
                          );
                          setTimeout(() => {
                            setHoveredCell((prev) =>
                              prev && prev.char === char
                                ? { ...prev, isCopied: false }
                                : prev,
                            );
                          }, 1200);
                        }}
                      >
                        <span
                          className="text-base font-semibold leading-none relative z-10 select-all"
                          style={{
                            fontFamily:
                              !fontData || !isCharSup
                                ? "inherit"
                                : `"${fontData.fontFamilyCSS}", "SimSun-ExtB", "MingLiU-ExtB", "PMingLiU-ExtB", "HanaMinB", "HanaMinA", sans-serif`,
                          }}
                        >
                          {char}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50/50 text-neutral-900 font-sans antialiased overflow-x-hidden">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200/80 px-6 py-4 flex items-center justify-between sticky top-0 z-[100] backdrop-blur-md bg-white/95">
        <div className="flex items-center space-x-3">
          <div className="bg-neutral-900 text-white w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs select-none leading-none">
            永
          </div>
          <span className="text-neutral-300 font-light select-none text-sm">/</span>
          <h1 className="text-xs font-bold tracking-tight text-neutral-900 font-sans">
            Font Parsing 字体解析系统
          </h1>
        </div>
        {fontData && (
          <div className="flex items-center space-x-1.5 sm:space-x-3 text-xs text-neutral-500">
            <button
              onClick={() => setActiveTab("global")}
              className={`cursor-pointer px-3 py-1.5 rounded text-xs font-bold font-mono transition-all duration-150 select-none ${
                activeTab === "global"
                  ? "bg-neutral-900 text-white font-bold"
                  : "text-neutral-500 hover:text-neutral-900 bg-neutral-100/50 hover:bg-neutral-100"
              }`}
            >
              全球看板
            </button>
            <button
              onClick={() => setActiveTab("unicode")}
              className={`cursor-pointer px-3 py-1.5 rounded text-xs font-bold font-mono transition-all duration-150 select-none ${
                activeTab === "unicode"
                  ? "bg-neutral-900 text-white font-bold"
                  : "text-neutral-500 hover:text-neutral-900 bg-neutral-100/50 hover:bg-neutral-100"
              }`}
            >
              Unicode一览表
            </button>
            <button
              onClick={() => setActiveTab("custom")}
              className={`cursor-pointer px-3 py-1.5 rounded text-xs font-bold font-mono transition-all duration-150 select-none ${
                activeTab === "custom"
                  ? "bg-neutral-900 text-white font-bold"
                  : "text-neutral-500 hover:text-neutral-900 bg-neutral-100/50 hover:bg-neutral-100"
              }`}
            >
              自定义校验
            </button>
            <button
              onClick={() => setActiveTab("diff")}
              className={`cursor-pointer px-3 py-1.5 rounded text-xs font-bold font-mono transition-all duration-150 select-none ${
                activeTab === "diff"
                  ? "bg-neutral-900 text-white font-bold"
                  : "text-neutral-500 hover:text-neutral-900 bg-neutral-100/50 hover:bg-neutral-100"
              }`}
            >
              字体版本对比
            </button>
          </div>
        )}
      </header>

      <main className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Upload Area */}
        {!fontData && activeTab !== "custom" && (
          <div className="max-w-2xl mx-auto mt-12">
            <div
              className="border border-dashed border-neutral-300 rounded-lg bg-white flex flex-col items-center justify-center p-12 sm:p-16 transition-all hover:border-neutral-500 relative text-center"
              onDragOver={handleDragOver}
              onDrop={handleFileUpload}
            >
              <input
                type="file"
                accept=".ttf,.otf"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="bg-neutral-50 border border-neutral-200/80 text-neutral-800 p-4 rounded-full mb-5">
                <UploadCloud className="w-6 h-6 text-neutral-700" />
              </div>
              {loading ? (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-neutral-900 animate-pulse tracking-tight font-mono">
                    正在解析字体规范...
                  </h2>
                  <p className="text-xs text-neutral-400 font-mono">解析并加载字体模型中</p>
                </div>
              ) : (
                <>
                  <h2 className="text-md font-bold text-neutral-900 tracking-tight mb-2">
                    部署并验证您的字体覆盖
                  </h2>
                  <p className="text-xs text-neutral-500 mb-6 max-w-sm leading-relaxed">
                    将 .otf 或 .ttf 文件拖拽到此处，或点击浏览。
                  </p>
                  <button className="bg-neutral-900 text-white hover:bg-neutral-800 rounded px-4 py-2 text-xs font-bold tracking-tight border border-neutral-900 transition-colors font-mono select-none">
                    选择字体文件
                  </button>
                </>
              )}

              {error && (
                <div className="mt-6 flex items-center text-red-600 bg-red-50/50 border border-red-100 px-4 py-2.5 rounded text-xs gap-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="font-semibold font-mono text-left">{error}</span>
                </div>
              )}
            </div>

            {/* Minimal footer features list */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12 text-center text-xs">
              <div className="space-y-1">
                <h4 className="font-bold text-neutral-900 font-mono uppercase tracking-wider text-[10px]">全球地缘覆盖</h4>
                <p className="text-neutral-400 leading-relaxed">全球 190+ 国家和地区合规检测，秒级可视化产出支持评级</p>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-neutral-900 font-mono uppercase tracking-wider text-[10px]">中日韩标准兼容</h4>
                <p className="text-neutral-400 leading-relaxed">内建 GB2312, GB18030, BIG5, JIS, KSX 等顶尖大流中日韩集标准</p>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-neutral-900 font-mono uppercase tracking-wider text-[10px]">极致渲染性能</h4>
                <p className="text-neutral-400 leading-relaxed">无需后端，通过 opentype 原生虚拟化绘制 16 列字形高清矩阵</p>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard rendering */}
        {fontData && (
          <>
            {/* Global Stats bar */}
            <div className="bg-white rounded-lg p-5 border border-neutral-200/85 flex flex-col md:flex-row md:items-center justify-between relative z-[70] gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="bg-neutral-900 text-white p-2.5 rounded font-mono font-bold leading-none select-none text-sm">
                  Aa
                </div>
                <div>
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest font-mono">
                    当前正在解析的字体
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-base font-bold tracking-tight text-neutral-900">
                      {fontData.fontName}
                    </span>
                    <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded font-mono border border-neutral-200/70">
                      {fontData.glyphCount.toLocaleString()} 个字形已解析
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={clearData}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-500 hover:text-red-500 border border-neutral-200 hover:border-red-200/60 rounded bg-white hover:bg-neutral-50 transition-colors font-mono select-none"
                  title="卸载并清空文件"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除当前字体</span>
                </button>
              </div>
            </div>

            {/* Custom Validation View Tab */}
            {activeTab === "custom" && renderCustomValidationView()}

            {/* Font Version Comparison View Tab */}
            {activeTab === "diff" && renderDiffView()}

            {(activeTab === "global" || activeTab === "unicode") && (
              <div className="relative z-[50] space-y-6">
                {activeTab === "global" && (
                  <>
                    <div className="bg-white rounded-lg border border-neutral-200/85 overflow-hidden">
                      <div className="h-[52px] px-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50 relative z-[100]">
                        <h3 className="text-xs font-bold font-mono tracking-wider text-neutral-700 uppercase">
                          地缘覆盖范围地图
                        </h3>
                        
                        {/* Vercel 风格切换控制器 */}
                        <div className="inline-flex bg-white border border-neutral-200 rounded-lg p-[3px] select-none font-sans">
                          <button
                            onClick={() => setMapViewMode("globe")}
                            className={`cursor-pointer px-3.5 py-1 text-xs font-bold rounded-[5px] transition-all duration-150 ${
                              mapViewMode === "globe"
                                ? "bg-neutral-100 text-neutral-800"
                                : "text-neutral-400 hover:text-neutral-600 bg-transparent"
                            }`}
                          >
                            3D 地球
                          </button>
                          <button
                            onClick={() => setMapViewMode("flat")}
                            className={`cursor-pointer px-3.5 py-1 text-xs font-bold rounded-[5px] transition-all duration-150 ${
                              mapViewMode === "flat"
                                ? "bg-neutral-100 text-neutral-800"
                                : "text-neutral-400 hover:text-neutral-600 bg-transparent"
                            }`}
                          >
                            2D 平铺
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        <WorldMap 
                          fontData={fontData} 
                          viewMode={mapViewMode}
                          setViewMode={setMapViewMode}
                          onCountryClick={(countryName) => {
                            setSelectedCountryForModal(countryName);
                          }}
                        />
                      </div>
                    </div>

                    {/* Language Area Accordions */}
              <div id="language-area" className="bg-white rounded-lg border border-neutral-200/85 overflow-hidden flex flex-col">
                  <div className="h-[52px] px-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50 relative z-[100]">
                    <h3 className="text-xs font-bold font-mono tracking-wider text-neutral-700 uppercase flex items-center gap-1.5">
                      🌐 区域合规性状态一览
                    </h3>
                  </div>

                  <div className="p-5 text-neutral-900 divide-y divide-neutral-100">
                  {continents.map((continent, idx) => {
                    const countriesInContinent =
                      groupedCountries[continent] || [];
                    if (countriesInContinent.length === 0) return null;

                    const sortedCountries = [...countriesInContinent].sort(
                      (a, b) => {
                        if (a === "南极洲" && b !== "南极洲") return 1;
                        if (b === "南极洲" && a !== "南极洲") return -1;
                        const areaA = COUNTRY_METADATA[a]?.area || 0;
                        const areaB = COUNTRY_METADATA[b]?.area || 0;
                        return areaB - areaA;
                      },
                    );

                    return (
                      <div
                        key={continent}
                        className="py-3.5 first:pt-0 last:pb-0"
                      >
                        <button
                          onClick={() =>
                            setCollapsedContinents((prev) => ({
                              ...prev,
                              [continent]: !prev[continent],
                            }))
                          }
                          className="w-full flex items-center justify-between group cursor-pointer focus:outline-none"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-neutral-800 tracking-tight font-mono transition-colors group-hover:text-black">
                              {continent}
                            </span>
                            <span className="text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.2 rounded font-mono border border-neutral-200/50">
                              {sortedCountries.length}
                            </span>
                          </div>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-800 transition-transform duration-200 ${
                              !collapsedContinents[continent] ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        <div
                          className={`transition-all duration-300 overflow-hidden ${
                            collapsedContinents[continent]
                              ? "max-h-0 opacity-0"
                              : "max-h-[2000px] opacity-100 mt-3"
                          }`}
                        >
                          {renderCountryColumns(sortedCountries)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
                  </>
                )}

                {activeTab === "unicode" && (
                  <div className="bg-white rounded-lg border border-neutral-200/85 flex flex-col max-h-[1200px] overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-100 bg-neutral-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-neutral-700 font-mono uppercase tracking-wider">
                    Unicode 分区一览
                  </h3>
                  <span className="text-[10px] text-neutral-400 font-mono font-normal">
                    ({filteredBlocks.length} / {UNICODE_BLOCKS.length})
                  </span>
                </div>
                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="快速搜索分区名称..."
                    value={blockSearchQuery}
                    onChange={(e) => setBlockSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-200 rounded focus:outline-none focus:border-neutral-900 bg-neutral-50/30 focus:bg-white placeholder-neutral-400 font-medium"
                  />
                </div>
              </div>
              <div className="overflow-y-auto px-5 pb-5 space-y-4 pt-4 divide-y divide-neutral-100">
                {Object.keys(groupedUnicodeBlocks).map((planeName) => (
                  <div key={planeName} className="py-3 first:pt-0">
                    <div className="flex items-center gap-2 mb-2.5">
                      <h4 className="text-[10.5px] font-bold text-neutral-400 tracking-wider font-mono uppercase flex items-center gap-1.5">
                        {planeName}
                        <span className="text-[9px] font-normal bg-neutral-50 border border-neutral-200 px-1 py-0.2 rounded text-neutral-500">
                          {groupedUnicodeBlocks[planeName].length}
                        </span>
                      </h4>
                    </div>
                    <div>
                      {renderBlockColumns(groupedUnicodeBlocks[planeName])}
                    </div>
                  </div>
                ))}
                {filteredBlocks.length === 0 && (
                  <div className="text-center py-8 text-neutral-400 text-xs font-mono">未找到匹配的分区</div>
                )}
              </div>
            </div>
                )}

            <div
              ref={gridRef}
              className="bg-white rounded-lg border border-neutral-200/85 flex flex-col h-[650px] scroll-mt-6 overflow-hidden"
            >
              {/* Grid Header */}
              <div className="border-b border-neutral-200/85 px-5 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-neutral-50/80">
                <div className="flex flex-wrap items-center text-neutral-900 font-medium whitespace-nowrap overflow-hidden gap-2">
                  <span className="text-xs font-bold font-mono tracking-wider text-neutral-700 uppercase">汉字网格实时预览</span>
                  {searchScope === "global" && searchQuery ? (
                    <span className="text-[11px] text-neutral-400 font-mono font-normal">
                      / 全域搜索结果
                    </span>
                  ) : (
                    <div className="relative">
                      <select
                        value={selectedBlockId}
                        onChange={(e) => setSelectedBlockId(e.target.value)}
                        className="appearance-none bg-white border border-neutral-200 text-neutral-800 py-1 pl-3 pr-8 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer max-w-[180px] truncate hover:bg-neutral-50 font-mono"
                      >
                        <option value="all">全部分区 (All Unicode)</option>
                        <optgroup label="国标及其他标准">
                          {STANDARD_BLOCKS.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Unicode 分区">
                          {UNICODE_BLOCKS.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} ({getBlockRangeString(b)})
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  )}
                  <span className="text-[10px] font-mono text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200/70 shrink-0">
                    {filteredChars.length.toLocaleString()} 个字符已加载
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
                  {/* Search bar inside header */}
                  <div className="flex items-center border border-neutral-200 rounded bg-white overflow-hidden focus-within:border-neutral-900 focus-within:ring-1 focus-within:ring-neutral-900 transition-all">
                    <select
                      value={searchScope}
                      onChange={(e) =>
                        setSearchScope(e.target.value as "current" | "global")
                      }
                      className="bg-neutral-50 text-neutral-600 text-[11px] pl-3 pr-2 py-1.5 focus:outline-none cursor-pointer border-r border-neutral-200/80 font-mono"
                    >
                      <option value="current">当前分区</option>
                      <option value="global font-mono">全网格搜索</option>
                    </select>
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="检索汉字或 U+ 码点..."
                        className="bg-transparent pl-8 pr-3 py-1.5 focus:outline-none text-xs w-full sm:w-44 focus:w-56 transition-all placeholder-neutral-400"
                      />
                    </div>
                  </div>

                  {/* Filter Toggle Button */}
                  <button
                    onClick={() => {
                      setFilterMode((prev) => {
                        if (prev === "all") return "missing";
                        if (prev === "missing") return "covered";
                        return "all";
                      });
                    }}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 border rounded transition-all text-xs font-semibold font-mono select-none
                       ${
                         filterMode === "all"
                           ? "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                           : filterMode === "missing"
                             ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100/70"
                             : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70"
                       }
                     `}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        filterMode === "all"
                          ? "bg-neutral-300"
                          : filterMode === "missing"
                            ? "bg-amber-500 animate-pulse"
                            : "bg-emerald-500"
                      }`}
                    />
                    <span>
                      {filterMode === "all"
                        ? "全部"
                        : filterMode === "missing"
                          ? "缺失"
                          : "已覆盖"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Virtualized Grid Content */}
              <div
                ref={parentRef}
                className="flex-1 overflow-auto bg-[#FAFAFA] p-4 relative"
                onMouseLeave={() => setHoveredCell(null)}
              >
                {filteredChars.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    {filterMode === "missing"
                      ? "该区块全覆盖，无缺失字符 🎉"
                      : filterMode === "covered"
                        ? "该区块无已覆盖字符"
                        : "未找到匹配的字符"}
                  </div>
                ) : (
                  <div
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      width: "100%",
                      position: "relative",
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      return (
                        <div
                          key={virtualRow.index}
                          className="absolute top-0 left-0 w-full flex"
                          style={{
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          {Array.from({ length: columns }).map(
                            (_, colIndex) => {
                              const itemIndex =
                                virtualRow.index * columns + colIndex;
                              const charLine = filteredChars[itemIndex];
                              if (!charLine)
                                return (
                                  <div
                                    key={colIndex}
                                    style={{ width: `${100 / columns}%` }}
                                  />
                                );

                              const isUnassignedChar = isUnassigned(charLine);
                              const isMissing =
                                !isUnassignedChar &&
                                !fontData.supportedChars.has(
                                  charLine.codePointAt(0)!,
                                );
                              const codepoint = charLine
                                .codePointAt(0)!
                                .toString(16)
                                .toUpperCase();

                              if (isUnassignedChar) {
                                return (
                                  <div
                                    key={colIndex}
                                    onMouseEnter={(e) => {
                                      setHoveredCell({
                                        char: charLine,
                                        codepoint,
                                        isMissing: false,
                                        isUnassigned: true,
                                        rect: e.currentTarget.getBoundingClientRect(),
                                        blockName:
                                          getBlockNameForChar(charLine),
                                      });
                                    }}
                                    className="relative flex items-center justify-center text-xs font-mono border-r border-b border-gray-100 bg-gray-50/50 text-gray-300 cursor-default select-none transition-all"
                                    style={{ width: `${100 / columns}%` }}
                                  >
                                    <span className="opacity-40">·</span>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={colIndex}
                                  onMouseEnter={(e) => {
                                    setHoveredCell({
                                      char: charLine,
                                      codepoint,
                                      isMissing,
                                      isUnassigned: isUnassignedChar,
                                      rect: e.currentTarget.getBoundingClientRect(),
                                      blockName: getBlockNameForChar(charLine),
                                    });
                                  }}
                                  onMouseLeave={() => setHoveredCell(null)}
                                  onClick={() => {
                                    navigator.clipboard.writeText(charLine);
                                    setHoveredCell((prev) =>
                                      prev && prev.char === charLine
                                        ? { ...prev, isCopied: true }
                                        : prev,
                                    );
                                    setTimeout(() => {
                                      setHoveredCell((prev) =>
                                        prev && prev.char === charLine
                                          ? { ...prev, isCopied: false }
                                          : prev,
                                      );
                                    }, 1200);
                                  }}
                                  className={`relative group flex items-center justify-center text-base sm:text-lg font-medium border-r border-b border-neutral-100 transition-all cursor-pointer hover:bg-neutral-50 active:scale-95 select-all
                                     ${isMissing ? "bg-white border-dashed text-neutral-300 opacity-60 hover:opacity-100" : "bg-white text-neutral-800 hover:text-black"}  
                                     ${isUnassignedChar ? "bg-neutral-50/30 text-neutral-400 font-mono text-[10px] italic" : ""}
                                  `}
                                  style={{ width: `${100 / columns}%` }}
                                >
                                  <span
                                    className="relative z-10 select-all"
                                    style={{
                                      fontFamily:
                                        isMissing || isUnassignedChar
                                          ? '"SimSun-ExtB", "MingLiU-ExtB", "PMingLiU-ExtB", "HanaMinB", "HanaMinA", "PingFang SC", "Microsoft YaHei", sans-serif'
                                          : `"${fontData.fontFamilyCSS}", "SimSun-ExtB", "MingLiU-ExtB", "PMingLiU-ExtB", "HanaMinB", "HanaMinA", sans-serif`,
                                    }}
                                  >
                                    {charLine}
                                  </span>
                                </div>
                              );
                            },
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
        </div>
            )}
          </>
        )}
      </main>

      {/* Global Country/Language Details Modal */}
      {renderCountryModal()}

      {/* Global Tooltip */}
      {hoveredCell && (
        <div
          className="fixed bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded border border-gray-800 whitespace-nowrap z-[200] pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{
            top: hoveredCell.rect.top - 8,
            left: hoveredCell.rect.left + hoveredCell.rect.width / 2,
          }}
        >
          <div className="font-mono mb-0.5 font-semibold">
            {hoveredCell.codepoint.startsWith("U+")
              ? hoveredCell.codepoint
              : `U+${hoveredCell.codepoint}`}
          </div>
          <div className="text-gray-300 border-b border-gray-700 pb-0.5 mb-1 text-[10px]">
            {hoveredCell.blockName}
          </div>
          <div
            className={`font-medium ${hoveredCell.isUnassigned ? "text-gray-400 italic" : hoveredCell.isMissing ? "text-red-400" : "text-green-400"}`}
          >
            {hoveredCell.isUnassigned
              ? "未分配/保留区"
              : hoveredCell.isMissing
                ? "不支持"
                : "已支持"}
          </div>
          {!hoveredCell.isUnassigned && (
            <div
              className={`text-[9px] mt-1 pt-1 border-t border-gray-700/60 text-center transition-colors ${hoveredCell.isCopied ? "text-green-300 font-medium" : "text-gray-400"}`}
            >
              {hoveredCell.isCopied ? "✓ 已复制到剪贴板" : "点击单元格复制字符"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
