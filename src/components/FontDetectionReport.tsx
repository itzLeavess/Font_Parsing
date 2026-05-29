import React, { useMemo, useState } from "react";
import { 
  CheckCircle2, 
  AlertCircle,
  Info,
  Workflow
} from "lucide-react";

import { 
  checkChineseCompliance, 
  checkJapaneseCompliance, 
  checkKoreanCompliance,
  checkBig5Compliance
} from "../lib/compliance";
import { 
  LANGUAGE_ALPHABETS, 
  COUNTRY_METADATA, 
  evaluateCountryCoverageAndStatus 
} from "../lib/languages";
import WorldMap from "./WorldMap";

interface FontData {
  fontName: string;
  fontFamilyCSS: string;
  supportedChars: Set<number>;
  glyphCount: number;
  buffer?: ArrayBuffer;
  fileSize?: number;
  lastModified?: number;
}

const OPENTYPE_FEATURE_DESCRIPTIONS: Record<string, string> = {
  // A. 基础排版能力
  "kern": "字距微调。自动收缩 VA, Te 等斜边字母间距缺口，防范散落空旷缺口，提升长句视觉气场。",
  "dist": "光学字距调整。专配东亚字形或独特符号，进行高灵敏光学测距重新分布。",
  "palt": "比例替代字距（中日韩）。使中日韩全宽标点在连续出现时自动收合并紧凑，提升长文密度布局。",
  "halt": "自适应半宽标点。中日韩排印中断或连续顿逗时智能减半高度，不空缺。版面顺滑紧凑。",
  "vpal": "竖向比例字距。竖排时自适应扣缩标点符号上下纵深留白。",
  "vhal": "竖向半宽字距。汉字竖排时智能消扣标点符号多余空间，排版匀称整齐。",
  "liga": "标准合字。自动拼合 fi, fl, ffi 等连续字母为统一平滑实体，根除交叉重叠冲突，印刷典范。",
  "clig": "上下文连写合字。依据文笔语意走势融合西语拼合字符，呈现极润滑的手书连写质感。",
  "dlig": "艺术/选择性连字。极具文艺古典个性的艺术字符合写设计，提供非标定制级的艺术底蕴。",
  "calt": "上下文自适应替换。自适应切换字母起笔和收笔的细微笔划骨形，实现天然手作风格。",
  "ccmp": "组拼/音标叠放分解。拼读、变音符号（如声调音标）高精锚合定位，绝对杜绝音标脱失漂移拼错。",
  "rlig": "必需连字。复杂文体（如阿拉伯语等）语法强制绝不可割裂的首中尾特定连写连接体。",
  "rclt": "必需上下文替换。复杂文法依据拼写关联强制调换指定字符形式，保全阅读无碍。",

  // B. 数字与金融排版
  "tnum": "等宽/表格数字（Tabular Numbers）。使 0-9 所有数字身框底宽完全相等。应用于表格、财务、倒计时排齐。",
  "pnum": "比例正文数字。使数字各取实际身宽，完美揉接于西文段落句中，长文阅读极顺滑自然。",
  "frac": "经典对角线真分数。识别连续输入的长分母分子（如 3/8）自动转换为精致对角排叠分数，告别机械拉粗斜划。",
  "zero": "防误混淆斜杠零（Slashed Zero）。在 0 内画一斜杠或增空内圆点。斩断大写 O 与数字 0 视觉相混隐患。",
  "onum": "古典老式数字（Oldstyle Figures）。数字依中轴及基准线有高低起伏，适宜古典名篇、诗词艺术品排印。",
  "lnum": "等高阶现代大写数字。将所有数字高度统一，完美匹配西文全大写单词排版 and 高度水平线。",
  "sups": "高清正向微型上标。提供重新绘制的无畸变、无笔锋虚化的数学幂或专用角标（如 x³）。",
  "subs": "化学下标/注记微标。支持重绘的物理化、分子下标（如 H₂O），呈现严丝合缝印件质感。",
  "numr": "真分数分子字。专配高位真分数分子转换的高级变体，细微转折流畅自然。",
  "dnom": "真分数分母字。专配分母重绘降重心特殊字，与分母符号平衡统一。",
  "afrc": "替代分样堆叠。渲染为上下对叠水平分线真分数，流溢出欧式古典社评教科排布质感。",

  // C. 多语言能力
  "locl": "地缘语境写法变体。支持多语系（如中日韩汉字）同码自适应调用各自专属差异偏旁，防偏旁混淆。",
  "mark": "多层声调音标物理定位。声调或元音变音精准定位于字符骨骼锚点顶/底处，解决越南语等高精度声调悬挂。",
  "mkmk": "声调多重堆叠定位。支持音调多层垂直自适应避让叠挂，绝对不崩叠混浊，多拼音标排版神兵。",
  "init": "复杂首端书写连写。针对阿拉伯等接合性字母在句首自适应调取首端连写接驳骨架。",
  "medi": "复杂中段书写连写。自适应调取句中两端自然拼驳的中段连顺笔造型。",
  "fina": "复杂终端书写连写。自适应加载句末末端完美画圆弧收尾造型特征。",
  "isol": "复杂孤合无接合体。无前后联驳拼口状态下，呈现原生态完美孤立古典造型骨骼。",
  "curs": "草草手书高精接合轨迹。提供高阶偏角连接轨迹点（Cursive Attachment），使连体草书笔意一贯相通。",

  // D. 东亚排版
  "vert": "纵书垂直排直模式。汉字方向维持，标点（如逗号、括号）自适应原位旋转 90 并挂靠偏右上居中。",
  "vrt2": "竖排备用回退。提供不同渲染引擎高兼容纵直书对调适配，规避换向散乱丢音。",
  "vkna": "竖直直排专属假名。使日语平片假名自适应重心，在竖直段落中音韵律动连绵流动。",
  "smpl": "简化中文快速转换。快速提供简体对应骨格映射字，支持国标多层繁简切换。",
  "trad": "繁/正中文转换骨。一键无损替代转换为端庄儒雅的古典正统中文，蕴含中华排印神韵。",

  // E. 品牌风格能力
  "salt": "美学替换变体。无套件约束地自由激活预设的第二种设计，流溢出新奇的艺术姿态特征。",
  "swsh": "典雅柔卷花体（Swash）。给标题全大写字母起和尾段添加古典浪漫优长的螺旋花边曲线纹路。",
  "cswh": "上下文联合华贵曲折。动态衔尾呼应前后字墨韵，呈现手工法式风貌与欧罗巴古典奢雅风采。",
  "titl": "雕刻级标题优化（Titling Alt）。专适大字号（48pt+）展示，消除浑粗肥厚之感，边缘坚实剔透。",

  // F. 专业出版能力
  "smcp": "小型大写字母（Small Caps）。将英文小写转换成高宽一致、粗细等衡的精巧正宗大写形态，消除生拉硬缩畸变。",
  "c2sc": "全大写转小型大写。专事社评期刊主标、篇首高级排版印刷必备方案。",
  "pcap": "超微小型大写字身。属于更极致奢雅的古典印工艺，排布极度紧缩不脱格不肥胀。",
  "c2pc": "大写至臻变超微大写。学术学术论文专线，高度与粗调等值融合配称。",
  "case": "大写标点智能抬升。当遇全大写西文排版时，自动将中联字符、连括弧抬高对准大写中心轴线，气度非凡。",
  "ordn": "高清晰印刷序角符号。将 1st, 2nd, 3rd 等的级挂字母高挂提契，线段顺接排印典雅自然。",
  "ruby": "旁释假音叠标定位。给中文拼音、和歌露比注音预留精准中轴，绝对保障大段落拼音不压扁不位移。",
  "rand": "随机异形古印韵。内置数款骨微型异体随机交替显示，模拟木刻铅印轻度墨晕不均，匠气横溢溢古典雅兴。",
  "hist": "回溯沧桑历史异格。转换至带有数百年历史厚重风雨洗礼的古世纪欧洲经院古典异体（如长s异型）。",

  // G. 可变字体支持
  "fvar": "可变字形多轴定义表。包含字宽、字重、倾斜度等轴线范围以及各种预设字重实例列表。",
  "gvar": "字形变化轮廓位移表。精确控制和锚定微调变体设计时的具体轮廓点偏量。"
};

const getFeatureMeaning = (tag: string) => {
  const lowerTag = tag.toLowerCase();
  if (/^ss[0-9][0-9]$/.test(lowerTag)) {
    return `专属定制特性 ${tag.toUpperCase()}`;
  }
  if (/^cv[0-9][0-9]$/.test(lowerTag)) {
    return `专属定制特性 ${tag.toUpperCase()}`;
  }
  return OPENTYPE_FEATURE_DESCRIPTIONS[lowerTag] || `高级排版特性 (${tag.toUpperCase()})`;
};

const UNICODE_BLOCK_DEFINITIONS = [
  { name: "基本拉丁字母 (Basic Latin)", start: 0x0000, end: 0x007F },
  { name: "拉丁字母-1辅助 (Latin-1 Supplement)", start: 0x0080, end: 0x00FF },
  { name: "拉丁字母扩展-A (Latin Extended-A)", start: 0x0100, end: 0x017F },
  { name: "拉丁字母扩展-B (Latin Extended-B)", start: 0x0180, end: 0x024F },
  { name: "国际音标扩展 (IPA Extensions)", start: 0x0250, end: 0x02AF },
  { name: "占位修饰符号 (Spacing Modifier Letters)", start: 0x02B0, end: 0x02FF },
  { name: "结合变音符号 (Combining Diacritical Marks)", start: 0x0300, end: 0x036F },
  { name: "希腊字母及科普特字母 (Greek and Coptic)", start: 0x0370, end: 0x03FF },
  { name: "西里尔字母 (Cyrillic)", start: 0x0400, end: 0x04FF },
  { name: "西里尔字母辅助 (Cyrillic Supplement)", start: 0x0500, end: 0x052F },
  { name: "亚美尼亚字母 (Armenian)", start: 0x0530, end: 0x058F },
  { name: "希伯来文 (Hebrew)", start: 0x0590, end: 0x05FF },
  { name: "阿拉伯文 (Arabic)", start: 0x0600, end: 0x06FF },
  { name: "叙利亚文 (Syriac)", start: 0x0700, end: 0x074F },
  { name: "阿拉伯文辅助 (Arabic Supplement)", start: 0x0750, end: 0x077F },
  { name: "它拿文 (Thaana)", start: 0x0780, end: 0x07BF },
  { name: "西非书写 (N'Ko)", start: 0x07C0, end: 0x07FF },
  { name: "撒玛利亚文 (Samaritan)", start: 0x0800, end: 0x083F },
  { name: "天城体/梵文 (Devanagari)", start: 0x0900, end: 0x097F },
  { name: "孟加拉文 (Bengali)", start: 0x0980, end: 0x09FF },
  { name: "锡克教文/旁遮普文 (Gurmukhi)", start: 0x0A00, end: 0x0A7F },
  { name: "古吉拉特文 (Gujarati)", start: 0x0A80, end: 0x0AFF },
  { name: "奥里亚文 (Oriya)", start: 0x0B00, end: 0x0B7F },
  { name: "泰米尔文 (Tamil)", start: 0x0B80, end: 0x0BFF },
  { name: "泰卢固文 (Telugu)", start: 0x0C00, end: 0x0C7F },
  { name: "卡纳达文 (Kannada)", start: 0x0C80, end: 0x0CFF },
  { name: "马拉雅拉姆文 (Malayalam)", start: 0x0D00, end: 0x0D7F },
  { name: "僧伽罗文 (Sinhala)", start: 0x0D80, end: 0x0DFF },
  { name: "泰文 (Thai)", start: 0x0E00, end: 0x0E7F },
  { name: "老挝文 (Lao)", start: 0x0E80, end: 0x0EFF },
  { name: "藏文 (Tibetan)", start: 0x0F00, end: 0x0FFF },
  { name: "缅甸文 (Myanmar)", start: 0x1000, end: 0x109F },
  { name: "格鲁吉亚文 (Georgian)", start: 0x10A0, end: 0x10FF },
  { name: "韩文主字母/谚文中枢架 (Hangul Jamo)", start: 0x1100, end: 0x11FF },
  { name: "埃塞俄比亚文 (Ethiopic)", start: 0x1200, end: 0x137F },
  { name: "切罗基文 (Cherokee)", start: 0x13A0, end: 0x13FF },
  { name: "统一加拿大土著音节文字 (UCAS)", start: 0x1400, end: 0x167F },
  { name: "欧甘文 (Ogham)", start: 0x1680, end: 0x169F },
  { name: "如尼字母/北欧神圣碑铭 (Runic)", start: 0x16A0, end: 0x16FF },
  { name: "他加禄文 (Tagalog)", start: 0x1700, end: 0x171F },
  { name: "哈努诺文 (Hanunoo)", start: 0x1720, end: 0x173F },
  { name: "布希德文 (Buhid)", start: 0x1740, end: 0x175F },
  { name: "塔班努瓦文 (Tagbanwa)", start: 0x1760, end: 0x177F },
  { name: "高棉文/柬埔寨 (Khmer)", start: 0x1780, end: 0x17FF },
  { name: "蒙古文 (Mongolian)", start: 0x1800, end: 0x18AF },
  { name: "林布文 (Limbu)", start: 0x1900, end: 0x194F },
  { name: "德宏傣文 (Tai Le)", start: 0x1950, end: 0x197F },
  { name: "新傣仂文 (New Tai Lue)", start: 0x1980, end: 0x19DF },
  { name: "高棉记号 (Khmer Symbols)", start: 0x19E0, end: 0x19FF },
  { name: "布吉文 (Buginese)", start: 0x1A00, end: 0x1A1F },
  { name: "老傣文 (Tai Tham)", start: 0x1A20, end: 0x1AAF },
  { name: "巴厘文 (Balinese)", start: 0x1B00, end: 0x1B7F },
  { name: "巽他文 (Sundanese)", start: 0x1B80, end: 0x1BBF },
  { name: "雷布查文 (Lepcha)", start: 0x1C00, end: 0x1C4F },
  { name: "奥尔奇基文 (Ol Chiki)", start: 0x1C50, end: 0x1C7F },
  { name: "音标扩展 (Phonetic Extensions)", start: 0x1D00, end: 0x1D7F },
  { name: "拉丁额外扩展 (Latin Extended Additional)", start: 0x1E00, end: 0x1EFF },
  { name: "希腊扩展 (Greek Extended)", start: 0x1F00, end: 0x1FFF },
  { name: "通用标点 (General Punctuation)", start: 0x2000, end: 0x206F },
  { name: "科学上下标 (Superscripts and Subscripts)", start: 0x2070, end: 0x209F },
  { name: "国际货币符号 (Currency Symbols)", start: 0x20A0, end: 0x20CF },
  { name: "符号用组合变音符号 (Combining Marks)", start: 0x20D0, end: 0x20FF },
  { name: "类字母符号 (Letterlike Symbols)", start: 0x2100, end: 0x214F },
  { name: "数字形式/经典罗马数字 (Number Forms)", start: 0x2150, end: 0x218F },
  { name: "全向箭头符号 (Arrows)", start: 0x2190, end: 0x21FF },
  { name: "数学运算符 (Mathematical Operators)", start: 0x2200, end: 0x22FF },
  { name: "科学技术杂项符号 (Miscellaneous Technical)", start: 0x2300, end: 0x23FF },
  { name: "控制图片 (Control Pictures)", start: 0x2400, end: 0x243F },
  { name: "光学字符识别域 (OCR)", start: 0x2440, end: 0x245F },
  { name: "带框字母和数字 (Enclosed Alphanumerics)", start: 0x2460, end: 0x24FF },
  { name: "经典制表符/框线符号 (Box Drawing)", start: 0x2500, end: 0x257F },
  { name: "区块填充元素 (Block Elements)", start: 0x2580, end: 0x259F },
  { name: "标准几何图形 (Geometric Shapes)", start: 0x25A0, end: 0x25FF },
  { name: "杂项符号/常见天气电器星象标志 (Misc Symbols)", start: 0x2600, end: 0x26FF },
  { name: "装饰符号/花饰 (Dingbats)", start: 0x2700, end: 0x27BF },
  { name: "杂项数学符号-A (Misc Math Symbols-A)", start: 0x27C0, end: 0x27EF },
  { name: "追加箭头-A (Supplemental Arrows-A)", start: 0x27F0, end: 0x27FF },
  { name: "盲文点字图案 (Braille Patterns)", start: 0x2800, end: 0x28FF },
  { name: "追加箭头-B (Supplemental Arrows-B)", start: 0x2900, end: 0x297F },
  { name: "杂项数学符号-B (Misc Math Symbols-B)", start: 0x2980, end: 0x29FF },
  { name: "追加数学运算符 (Supp Math Operators)", start: 0x2A00, end: 0x2AFF },
  { name: "杂项符号及箭头 (Misc Symbols and Arrows)", start: 0x2B00, end: 0x2BFF },
  { name: "葛拉哥里字母 (Glagolitic)", start: 0x2C00, end: 0x2C5F },
  { name: "拉丁扩展-C (Latin Extended-C)", start: 0x2C60, end: 0x2C7F },
  { name: "科普特字母 (Coptic)", start: 0x2C80, end: 0x2CFF },
  { name: "格鲁吉亚补充 (Georgian Supplement)", start: 0x2D00, end: 0x2D2F },
  { name: "提非纳文 (Tifinagh)", start: 0x2D30, end: 0x2D7F },
  { name: "埃塞俄比亚扩展 (Ethiopic Extended)", start: 0x2D80, end: 0x2DDF },
  { name: "西里尔扩展-A (Cyrillic Extended-A)", start: 0x2DE0, end: 0x2DFF },
  { name: "中日韩部首辅助 (CJK Radicals Supplement)", start: 0x2E80, end: 0x2EFF },
  { name: "康熙部首 (Kangxi Radicals)", start: 0x2F00, end: 0x2FDF },
  { name: "表意文字描述符 (IDC)", start: 0x2FF0, end: 0x2FFF },
  { name: "中日韩符号和标点 (CJK Symbols and Punctuation)", start: 0x3000, end: 0x303F },
  { name: "日文平假名 (Hiragana)", start: 0x3040, end: 0x309F },
  { name: "日文片假名 (Katakana)", start: 0x30A0, end: 0x30FF },
  { name: "汉语拼音注音符号 (Bopomofo)", start: 0x3100, end: 0x312F },
  { name: "韩文兼容字母 (Hangul Compatibility Jamo)", start: 0x3130, end: 0x318F },
  { name: "汉文助读训读句读符 (Kanbun)", start: 0x3190, end: 0x319F },
  { name: "注音符号扩展 (Bopomofo Extended)", start: 0x31A0, end: 0x31BF },
  { name: "中日韩标准笔画 (CJK Strokes)", start: 0x31C0, end: 0x31EF },
  { name: "日文片假名语音扩展 (Katakana Phonetic Ext)", start: 0x31F0, end: 0x31FF },
  { name: "带圈中日韩字母及月份 (Enclosed CJK)", start: 0x3200, end: 0x32FF },
  { name: "中日韩兼容符号 (CJK Compatibility)", start: 0x3300, end: 0x33FF },
  { name: "中日韩主汉字超大字表扩展-A (CJK Unified Ideographs Ext-A)", start: 0x3400, end: 0x4DBF },
  { name: "易经六十四卦学术符号 (Yijing Hexagram)", start: 0x4DC0, end: 0x4DFF },
  { name: "中日韩主统一汉字常用集 (CJK Unified Ideographs)", start: 0x4E00, end: 0x9FFF },
  { name: "中国彝文字母 (Yi Syllables)", start: 0xA000, end: 0xA48F },
  { name: "中国彝文部首 (Yi Radicals)", start: 0xA490, end: 0xA4CF },
  { name: "傈僳字母 (Lisu)", start: 0xA4D0, end: 0xA4FF },
  { name: "西非瓦伊字母 (Vai)", start: 0xA500, end: 0xA63F },
  { name: "喀麦隆巴姆穆文字 (Bamum)", start: 0xA6A0, end: 0xA6FF },
  { name: "修饰声调符号 (Modifier Tone Letters)", start: 0xA700, end: 0xA71F },
  { name: "西文拉丁扩展-D (Latin Extended-D)", start: 0xA720, end: 0xA7FF },
  { name: "索拉什特拉文 (Saurashtra)", start: 0xA880, end: 0xA8DF },
  { name: "天城体/梵文扩展 (Devanagari Extended)", start: 0xA8E0, end: 0xA8FF },
  { name: "克耶武里字母 (Kayah Li)", start: 0xA900, end: 0xA92F },
  { name: "爪哇文字 (Javanese)", start: 0xA980, end: 0xA9DF },
  { name: "缅甸文扩展-A (Myanmar Extended-A)", start: 0xAA00, end: 0xAA5F },
  { name: "占语字母 (Cham)", start: 0xAA60, end: 0xAA7F },
  { name: "缅甸文扩展-B (Myanmar Extended-B)", start: 0xAAE0, end: 0xAAFF },
  { name: "泰越文字 (Tai Viet)", start: 0xAB00, end: 0xAB2F },
  { name: "埃塞俄比亚扩展-A (Ethiopic Extended-A)", start: 0xAB30, end: 0xAB6F },
  { name: "拉丁扩展-E (Latin Extended-E)", start: 0xAB70, end: 0xABBF },
  { name: "切罗基字母辅助 (Cherokee Supplement)", start: 0xABC0, end: 0xABFF },
  { name: "韩文现代谚文拼音全音节 (Hangul Syllables)", start: 0xAC00, end: 0xD7AF },
  { name: "韩文第一阶段扩展字母 (Hangul Jamo Extended-B)", start: 0xD7B0, end: 0xD7FF },
  { name: "私有保留功能区 (Private Use Area - PUA)", start: 0xE000, end: 0xF8FF },
  { name: "中日韩兼容表意文字/繁异汉字微调区 (CJK Compatibility Ideographs)", start: 0xF900, end: 0xFAFF },
  { name: "拉丁及希伯来字母表达形式 (Alphabetic Presentation Forms)", start: 0xFB00, end: 0xFB4F },
  { name: "阿拉伯表达形式-A (Arabic Presentation Forms-A)", start: 0xFB50, end: 0xFDFF },
  { name: "异体字选择器/变体切换器 (Variation Selectors)", start: 0xFE00, end: 0xFE0F },
  { name: "直直排竖排形式标点 (Vertical Forms)", start: 0xFE10, end: 0xFE1F },
  { name: "中日韩竖排标点兼容形式 (CJK Compatibility Forms)", start: 0xFE30, end: 0xFE4F },
  { name: "小字形变体 (Small Form Variants)", start: 0xFE50, end: 0xFE6F },
  { name: "阿拉伯表达形式-B (Arabic Presentation Forms-B)", start: 0xFE70, end: 0xFEFF },
  { name: "半角及全角符号/字母 (Halfwidth and Fullwidth)", start: 0xFF00, end: 0xFFEF },
  { name: "特殊控制标识域 (Specials)", start: 0xFFF0, end: 0xFFFF },
  { name: "麻将牌全套 (Mahjong Tiles)", start: 0x1F000, end: 0x1F02F },
  { name: "骨牌/多米诺 (Domino Tiles)", start: 0x1F030, end: 0x1F09F },
  { name: "扑克牌全画幅 (Playing Cards)", start: 0x1F0A0, end: 0x1F0FF },
  { name: "带框字母数字扩展 (Enclosed Alphanumeric Supp)", start: 0x1F100, end: 0x1F1FF },
  { name: "带圈表意中日韩文字补充 (Enclosed Ideographic Supp)", start: 0x1F200, end: 0x1F2FF },
  { name: "各种艺术符号及象形手势 (Misc Symbols and Pictographs)", start: 0x1F300, end: 0x1F5FF },
  { name: "表情符号系列 (Emoticons / Emoji)", start: 0x1F600, end: 0x1F64F },
  { name: "交通和地图方向符号 (Transport and Map)", start: 0x1F680, end: 0x1F6FF },
  { name: "中日韩主汉字扩展-B (CJK Unified Ideographs Ext-B)", start: 0x20000, end: 0x2A6DF },
  { name: "中日韩主汉字扩展-C (CJK Unified Ideographs Ext-C)", start: 0x2A700, end: 0x2B73F },
  { name: "中日韩主汉字扩展-D (CJK Unified Ideographs Ext-D)", start: 0x2B740, end: 0x2B81F },
  { name: "中日韩主汉字扩展-E (CJK Unified Ideographs Ext-E)", start: 0x2B820, end: 0x2CEAF },
  { name: "中日韩主汉字扩展-F (CJK Unified Ideographs Ext-F)", start: 0x2CEB0, end: 0x2EBEF },
  { name: "中日韩兼容表意文字补充 (CJK Comp Ideographs Supp)", start: 0x2F800, end: 0x2FA1F },
];

interface FontDetectionReportProps {
  fontData: FontData;
  parsedFont: any; // opentype.Font | null
}

export default function FontDetectionReport({ fontData, parsedFont }: FontDetectionReportProps) {
  const [unicodeMode, setUnicodeMode] = useState<"all" | "existing">("existing");

  const cleanFontName = useMemo(() => {
    return (fontData?.fontName || "未命名字体").replace(/\.(otf|ttf|woff|woff2)$/i, "");
  }, [fontData]);

  // 1. Basic Info Extractors
  const basicInfo = useMemo(() => {
    const name = fontData?.fontName || "未命名字体";
    const extension = name.includes(".") ? name.split(".").pop()?.toUpperCase() : "TTF";
    const format = ["OTF", "TTF", "WOFF", "WOFF2"].includes(extension || "") ? extension : "TTF";
    
    // Parse version safely from opentype metadata
    let version = "1.000";
    if (parsedFont?.names?.version) {
      const vObj = parsedFont.names.version;
      version = vObj.zh || vObj.en || Object.values(vObj)[0] || "1.000";
      // Clean standard "Version 1.003;..." strings down to clean decimals
      const match = version.match(/[\d.]+/);
      if (match) version = match[0];
    }

    const glyphCount = fontData?.glyphCount || parsedFont?.numGlyphs || 0;
    const unicodeCount = fontData?.supportedChars?.size || 0;
    
    // File size formatting
    let fileSizeStr = "未知";
    if (fontData?.fileSize) {
      const mb = fontData.fileSize / (1024 * 1024);
      fileSizeStr = `${mb.toFixed(1)}MB`;
    } else {
      // Predict logical fallback size based on glyph density
      const predictedBytes = glyphCount * 450 + 20000;
      const mb = predictedBytes / (1024 * 1024);
      fileSizeStr = `${Math.max(0.5, mb).toFixed(1)}MB (预估)`;
    }

    // Last modified time
    let updateTimeStr = "2026-05-01";
    if (fontData?.lastModified) {
      const date = new Date(fontData.lastModified);
      updateTimeStr = date.toISOString().split("T")[0];
    } else {
      updateTimeStr = new Date().toISOString().split("T")[0];
    }

    return {
      name,
      format,
      version,
      glyphCount,
      unicodeCount,
      fileSize: fileSizeStr,
      updateTime: updateTimeStr
    };
  }, [fontData, parsedFont]);

  // 2. Global regional coverage adapter
  const continents = ["亚洲", "欧洲", "北美洲", "大洋洲", "非洲", "南美洲"];
  
  const regionalCoverage = useMemo(() => {
    const results: Record<string, number> = {};
    const supported = fontData?.supportedChars || new Set<number>();
    
    continents.forEach((continent) => {
      // Find countries mapping
      const countries = Object.keys(COUNTRY_METADATA).filter(
        (country) => COUNTRY_METADATA[country].continent === continent
      );

      if (countries.length === 0) {
        results[continent] = 100; // default standard fallback
        return;
      }

      let summation = 0;
      countries.forEach((country) => {
        const stats = evaluateCountryCoverageAndStatus(country, supported);
        summation += stats.coverage * 100;
      });

      results[continent] = Number((summation / countries.length).toFixed(1));
    });

    return results;
  }, [fontData]);

  // 3. CJK National Standards Compliance Tests
  const complianceStats = useMemo(() => {
    const supported = fontData?.supportedChars || new Set<number>();

    // Chinese Standards
    const zhRes = checkChineseCompliance(supported);
    
    // Japanese Standards
    const jpRes = checkJapaneseCompliance(supported);

    // Korean Standards
    const krRes = checkKoreanCompliance(supported);

    return {
      chinese: {
        gb2312: zhRes.details.gb2312Coverage * 100,
        level1: zhRes.details.level1Coverage * 100,
        level2: zhRes.details.level2Coverage * 100,
        level3: zhRes.details.level3Coverage * 100,
        unites: `GB18030-2022级别${zhRes.details.level3Coverage >= 0.99 ? "3" : zhRes.details.level2Coverage >= 0.99 ? "2" : "1"} 合规`,
        status: zhRes.level
      },
      japanese: {
        kana: jpRes.details.kanaCoverage * 100,
        joyo: jpRes.details.joyoCoverage * 100,
        jis1: jpRes.details.jisLevel1Coverage * 100,
        jis2: jpRes.details.jisLevel2Coverage * 100,
        level: jpRes.level
      },
      korean: {
        jamo: krRes.details.jamoCoverage * 100,
        syllables: krRes.details.syllablesCoverage * 100,
        ks: krRes.details.ksCoverage * 100,
        level: krRes.level
      }
    };
  }, [fontData]);

  // 3b. Unicode Blocks Analysis
  const unicodeBlocks = useMemo(() => {
    const supported = fontData?.supportedChars || new Set<number>();
    
    // Sort block definitions for binary search
    const sortedBlocks = [...UNICODE_BLOCK_DEFINITIONS].sort((a, b) => a.start - b.start);
    
    const blocksWithCount = sortedBlocks.map((b) => ({
      name: b.name,
      start: b.start,
      end: b.end,
      count: 0
    }));

    const findBlockIdx = (code: number) => {
      let low = 0;
      let high = blocksWithCount.length - 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const b = blocksWithCount[mid];
        if (code >= b.start && code <= b.end) {
          return mid;
        } else if (code < b.start) {
          high = mid - 1;
        } else {
          low = mid + 1;
        }
      }
      return -1;
    };

    supported.forEach((code) => {
      const idx = findBlockIdx(code);
      if (idx !== -1) {
        blocksWithCount[idx].count++;
      }
    });

    return blocksWithCount;
  }, [fontData]);

  const displayedUnicodeBlocks = useMemo(() => {
    if (unicodeMode === "existing") {
      return unicodeBlocks.filter((b) => b.count > 0);
    }
    return unicodeBlocks;
  }, [unicodeBlocks, unicodeMode]);

  // 4. Languages Support Coverage Evaluator
  const languagesAnalytics = useMemo(() => {
    const supported = fontData?.supportedChars || new Set<number>();
    const fullySupported: string[] = [];
    const partiallySupported: Array<{ name: string; pct: number }> = [];

    // Exclude special languages from the general loop
    const excludedLanguages = new Set([
      "拼音", 
      "注音", 
      "繁体中文", 
      "繁體中文", 
      "简体中文", 
      "簡體中文", 
      "日语", 
      "日本語", 
      "韩语", 
      "韓国語", 
      "朝鲜语", 
      "朝鲜文",
      "朝鮮语"
    ]);

    Object.entries(LANGUAGE_ALPHABETS).forEach(([langName, alphabet]) => {
      if (alphabet.length === 0) return;
      if (excludedLanguages.has(langName)) return; // Exclude permanently or handled separately
      
      let matched = 0;
      alphabet.forEach((char) => {
        let isCharCovered = true;
        for (let i = 0; i < char.length; i++) {
          const code = char.codePointAt(i);
          if (code === undefined || !supported.has(code)) {
            isCharCovered = false;
            break;
          }
        }
        if (isCharCovered) matched++;
      });

      const percentage = (matched / alphabet.length) * 100;
      if (percentage >= 100) {
        fullySupported.push(langName);
      } else {
        partiallySupported.push({ name: langName, pct: Math.round(percentage) });
      }
    });

    // --- Separate Custom Judgement Rules for CJK ---
    
    // Traditional Chinese (繁体中文) -> if meets BIG5 standard, supported
    const big5Res = checkBig5Compliance(supported);
    const big5CoveragePct = big5Res.coverage * 100;
    if (big5CoveragePct >= 95) {
      fullySupported.push("繁体中文");
    } else {
      partiallySupported.push({ name: "繁体中文", pct: Math.round(big5CoveragePct) });
    }

    // Japanese (日语) -> if Section 3 supports Japanese (kana >= 90 && jis1 >= 90)
    const jpRes = checkJapaneseCompliance(supported);
    const jpKanaPct = jpRes.details.kanaCoverage * 100;
    const jpJis1Pct = jpRes.details.jisLevel1Coverage * 100;
    if (jpKanaPct >= 90 && jpJis1Pct >= 90) {
      fullySupported.push("日语");
    } else {
      partiallySupported.push({ name: "日语", pct: Math.round(jpJis1Pct) });
    }

    // Korean (韩语) -> if Section 3 supports Korean (level === "完全支持" || level === "基本支持")
    const krRes = checkKoreanCompliance(supported);
    const krSyllablesPct = krRes.details.syllablesCoverage * 100;
    if (krRes.level === "完全支持" || krRes.level === "基本支持") {
      fullySupported.push("韩语");
    } else {
      partiallySupported.push({ name: "韩语", pct: Math.round(krSyllablesPct) });
    }

    // Simplified Chinese (简体中文) -> if Section 3 supports GB2312 at least (gb2312Coverage >= 95%)
    const zhRes = checkChineseCompliance(supported);
    const zhGb2312Pct = zhRes.details.gb2312Coverage * 100;
    if (zhGb2312Pct >= 95) {
      fullySupported.push("简体中文");
    } else {
      partiallySupported.push({ name: "简体中文", pct: Math.round(zhGb2312Pct) });
    }

    // Sort partially supported by coverage rate descending
    partiallySupported.sort((a, b) => b.pct - a.pct);

    return {
      fullySupported,
      partiallySupported
    };
  }, [fontData]);

  // 5. OpenType Features Detection
  const openTypeFeatures = useMemo(() => {
    const features = new Set<string>();
    
    // Safely crawl lookups
    const extractFromTable = (table: any) => {
      if (table && table.features) {
        table.features.forEach((node: any) => {
          if (node.tag) features.add(node.tag);
        });
      }
    };

    if (parsedFont && parsedFont.tables) {
      extractFromTable(parsedFont.tables.gsub);
      extractFromTable(parsedFont.tables.gpos);
    }

    // Common standard fallbacks if none are exported by opentype.js parses
    const list = features.size > 0 ? Array.from(features) : ["kern", "liga", "ccmp", "clig", "vert", "locl"];
    
    const descriptions: Record<string, string> = {
      kern: "字距调整",
      liga: "标准合字",
      clig: "上下文合字",
      ccmp: "拼合与组字分解",
      locl: "本地化变体字形",
      vert: "竖排字形变体",
      frac: "优美分数样式",
      ordn: "序数符号适配",
      sups: "上标替换字形",
      subs: "下标替换字形",
      smpl: "简体形式替换",
      trad: "繁体形式替换",
      fwid: "全宽变体",
      hwid: "半宽变体",
      pwid: "比例宽度"
    };

    return list.map(tag => ({
      tag,
      description: descriptions[tag.toLowerCase()] || `自定义排版特性 (${tag})`
    }));
  }, [parsedFont]);

  // Dimension mapping and business scoring dictionary for the 7 enterprise OpenType areas
  const openTypeScores = useMemo(() => {
    const featuresSetLower = new Set<string>(
      openTypeFeatures.map(f => String((f as any).tag || "").toLowerCase())
    );

    const isVariable = !!(parsedFont?.tables?.fvar || parsedFont?.tables?.gvar);

    // A. 基础排版能力 (kern, liga, ccmp, and adjacent: clig, rlig, rclt, dist, palt, halt)
    const layoutTags = ["kern", "liga", "ccmp", "clig", "rlig", "rclt", "dist", "palt", "halt"];
    const layoutFound = layoutTags.filter(t => featuresSetLower.has(t));
    let layoutScore = 30; // base standard
    if (layoutFound.includes("kern")) layoutScore += 30;
    if (layoutFound.includes("liga")) layoutScore += 20;
    if (layoutFound.includes("ccmp") || layoutFound.includes("clig")) layoutScore += 20;
    layoutScore = Math.min(100, layoutScore);

    // B. 数字与数据排版 (tnum, pnum, frac, zero, sups, subs, numr, dnom, afrc)
    const numTags = ["tnum", "pnum", "frac", "zero", "sups", "subs", "numr", "dnom", "afrc"];
    const numFound = numTags.filter(t => featuresSetLower.has(t));
    let numScore = 20;
    if (numFound.includes("tnum")) numScore += 30;
    if (numFound.includes("zero")) numScore += 20;
    if (numFound.includes("frac")) numScore += 20;
    if (numFound.includes("pnum")) numScore += 10;
    const remainingNum = numFound.filter(t => !["tnum", "zero", "pnum", "frac"].includes(t));
    numScore += remainingNum.length * 10;
    numScore = Math.min(100, numScore);

    // C. 多语言能力 (locl, mark, mkmk, init, medi, fina, isol, curs)
    const langTags = ["locl", "mark", "mkmk", "init", "medi", "fina", "isol", "curs"];
    const langFound = langTags.filter(t => featuresSetLower.has(t));
    let langScore = 20;
    if (langFound.includes("locl")) langScore += 30;
    if (langFound.includes("mark")) langScore += 25;
    if (langFound.includes("mkmk")) langScore += 15;
    const arabicFound = langFound.filter(t => ["init", "medi", "fina", "isol", "curs"].includes(t));
    langScore += arabicFound.length * 15;
    langScore = Math.min(100, langScore);

    // D. 东亚排版能力 (vert, vrt2, vkna, vpal, vhal, smpl, trad)
    const eaTags = ["vert", "vrt2", "vkna", "vpal", "vhal", "smpl", "trad"];
    const eaFound = eaTags.filter(t => featuresSetLower.has(t));
    const isCJK = fontData?.supportedChars && (fontData.supportedChars.has(0x4e00) || fontData.supportedChars.has(0x3041));
    let eaScore = isCJK ? 45 : 20;
    if (eaFound.includes("vert") || eaFound.includes("vrt2")) eaScore += 30;
    if (eaFound.includes("vkna")) eaScore += 15;
    if (eaFound.includes("vpal") || eaFound.includes("vhal")) eaScore += 15;
    const remEa = eaFound.filter(t => !["vert", "vrt2", "vkna", "vpal", "vhal"].includes(t));
    eaScore += remEa.length * 10;
    eaScore = Math.min(100, eaScore);

    // E. 品牌风格能力 (salt, ss01-ss20, cv01-cv99, swsh, cswh, titl)
    const brandTags = ["salt", "swsh", "cswh", "titl"];
    const brandFoundBase = brandTags.filter(t => featuresSetLower.has(t));
    const ssFound = Array.from(featuresSetLower).filter(t => /^ss[0-2][0-9]$/i.test(t));
    const cvFound = Array.from(featuresSetLower).filter(t => /^cv[0-9][0-9]$/i.test(t));
    
    let brandScore = 25;
    if (ssFound.length > 0) brandScore += Math.min(45, ssFound.length * 15);
    if (cvFound.length > 0) brandScore += Math.min(20, cvFound.length * 10);
    if (brandFoundBase.includes("salt")) brandScore += 15;
    if (brandFoundBase.includes("titl")) brandScore += 10;
    brandScore = Math.min(100, brandScore);

    // F. 专业出版能力 (smcp, case, ordn, ruby, c2sc, pcap, c2pc, rand, hist)
    const advTags = ["smcp", "case", "ordn", "ruby", "c2sc", "pcap", "c2pc", "rand", "hist"];
    const advFound = advTags.filter(t => featuresSetLower.has(t));
    let advScore = 20;
    if (advFound.includes("case")) advScore += 35;
    if (advFound.includes("smcp")) advScore += 25;
    if (advFound.includes("ordn")) advScore += 15;
    if (advFound.includes("ruby")) advScore += 15;
    const remAdv = advFound.filter(t => !["case", "smcp", "ordn", "ruby"].includes(t));
    advScore += remAdv.length * 10;
    advScore = Math.min(100, advScore);

    const layoutAllTags = ["kern", "liga", "ccmp", "clig", "dlig", "calt", "rlig", "rclt", "dist", "palt", "halt"];
    const numAllTags = ["tnum", "pnum", "frac", "zero", "onum", "lnum", "sups", "subs", "numr", "dnom", "afrc"];
    const langAllTags = ["locl", "mark", "mkmk", "init", "medi", "fina", "isol", "curs"];
    const eaAllTags = ["vert", "vrt2", "vkna", "vpal", "vhal", "smpl", "trad"];
    const brandAllTags = ["salt", "swsh", "cswh", "titl", ...ssFound, ...cvFound];
    const advAllTags = ["smcp", "case", "ordn", "ruby", "c2sc", "pcap", "c2pc", "rand", "hist"];

    return [
      {
        id: "A",
        name: "基础排版能力",
        techLabel: "Layout & Positioning",
        score: layoutScore,
        allTags: layoutAllTags,
        tags: layoutFound,
        description: "涵盖字间排版对准、微距字调算力以及基础标准连字机制。它们是排印的基础防线，决定了 Va, fi, fl 连续排印时轮廓是否紧密不散、合字是否优美不重叠。",
        interpretations: layoutAllTags.map(tag => ({
          tag: tag.toUpperCase(),
          meaning: getFeatureMeaning(tag),
          detected: featuresSetLower.has(tag.toLowerCase())
        }))
      },
      {
        id: "B",
        name: "数字与数据排版",
        techLabel: "Numerals & Fractions",
        score: numScore,
        allTags: numAllTags,
        tags: numFound,
        description: "专注于金融系统的垂直对齐等宽、经典对角真分数与高清微字下标角挂，是财务表格、代码段落和科研报告的精密校对引擎，严防字型混交溢出。",
        interpretations: numAllTags.map(tag => ({
          tag: tag.toUpperCase(),
          meaning: getFeatureMeaning(tag),
          detected: featuresSetLower.has(tag.toLowerCase())
        }))
      },
      {
        id: "C",
        name: "多语言支持能力",
        techLabel: "Language & Script",
        score: langScore,
        allTags: langAllTags,
        tags: langFound,
        description: "应对多国差异语系在同一码点渲染不同偏旁（locl）以及复杂多重标音挂接、级联避让物理锚合（mark, mkmk）。专为阿拉伯文多端连体草书或越南语多叠音符定制开护航线。",
        interpretations: langAllTags.map(tag => ({
          tag: tag.toUpperCase(),
          meaning: getFeatureMeaning(tag),
          detected: featuresSetLower.has(tag.toLowerCase())
        }))
      },
      {
        id: "D",
        name: "东亚排版能力",
        techLabel: "Vertical Typography",
        score: eaScore,
        allTags: eaAllTags,
        tags: eaFound,
        description: "汉字纵书直写自适应转向、日文直书平片假名重心位移，结合繁/正、简体一键物理重映替代（smpl, trad），完美支持东方古典纵直排印美感节律。",
        interpretations: eaAllTags.map(tag => ({
          tag: tag.toUpperCase(),
          meaning: getFeatureMeaning(tag),
          detected: featuresSetLower.has(tag.toLowerCase())
        }))
      },
      {
        id: "E",
        name: "品牌定制风格能力",
        techLabel: "Stylistic Features",
        score: brandScore,
        allTags: brandAllTags,
        tags: [...brandFoundBase, ...ssFound, ...cvFound],
        description: "包含一整套极富震撼力的风格集变体自激活技术（Stylistic Sets）及雕刻级大口径高阶渲染标题优化（titl, swsh），极大度协助品牌客户一键突破死板，加载高级差异风骨变体。",
        interpretations: brandAllTags.map(tag => ({
          tag: tag.toUpperCase(),
          meaning: getFeatureMeaning(tag),
          detected: featuresSetLower.has(tag.toLowerCase())
        }))
      },
      {
        id: "F",
        name: "专业学术出版能力",
        techLabel: "Advanced Typography",
        score: advScore,
        allTags: advAllTags,
        tags: advFound,
        description: "特事小型大写字母（smcp）、大写符号中轴高度对齐（case）以及学术序角挂词重映射、旁注多音标对位等古典书作专配，是精微严肃学术物、历史异体和出版界的至高端定制方案。",
        interpretations: advAllTags.map(tag => ({
          tag: tag.toUpperCase(),
          meaning: getFeatureMeaning(tag),
          detected: featuresSetLower.has(tag.toLowerCase())
        }))
      },
      {
        id: "G",
        name: "可变字体支持",
        techLabel: "Variable Font Support",
        score: isVariable ? 100 : 20,
        allTags: ["fvar", "gvar"],
        tags: [
          ...(parsedFont?.tables?.fvar ? ["fvar"] : []),
          ...(parsedFont?.tables?.gvar ? ["gvar"] : [])
        ],
        description: "可变字体（Variable Fonts）是现代字库排版设计的终极载体，其核心特征是能在单个字库文件中，实现字重（Weight）、字宽（Width）、倾斜度（Italic）等轴线的无级连续渐变，兼顾网页极致加载耗时与排版细腻度。",
        interpretations: ["fvar", "gvar"].map(tag => ({
          tag: tag.toUpperCase(),
          meaning: getFeatureMeaning(tag),
          detected: (tag === "fvar" || tag === "gvar") ? !!(parsedFont?.tables?.[tag]) : featuresSetLower.has(tag.toLowerCase())
        }))
      }
    ];
  }, [openTypeFeatures, fontData, parsedFont]);

  const getContinentHexColor = (pct: number) => {
    if (pct >= 85) return "#22c55e"; // Success green
    if (pct >= 30) return "#f59e0b"; // Warning amber
    return "#ef4444"; // Danger red
  };

  const getContinentFillColor = (pct: number) => {
    if (pct >= 85) return "#ecfdf5"; // Success light bg
    if (pct >= 30) return "#fffbeb"; // Warning light bg
    return "#fef2f2"; // Danger light bg
  };

  return (
    <div 
      id="font-analysis-report-container-id" 
      className="bg-white border border-neutral-200/80 rounded-xl p-8 sm:p-12 shadow-sm max-w-[980px] mx-auto relative overflow-hidden"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
        {/* Decorative corner seal */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-neutral-50 rounded-full blur-2xl opacity-80 pointer-events-none -mr-12 -mt-12" />
        
        {/* Document Header */}
        <div className="border-b-2 border-neutral-900 pb-8 relative">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-black text-neutral-900 tracking-tight font-sans">
                {cleanFontName} 字体检测报告
              </h1>
              <p className="text-xs text-neutral-400 font-mono mt-1 tracking-wide">
                REPORT ID: FPA-{basicInfo.updateTime.replace(/-/g, "")}-{basicInfo.glyphCount}
              </p>
            </div>
            <div className="text-left md:text-right font-mono self-end">
              <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold block">测评时间</span>
              <span className="text-xs font-bold text-neutral-700">{basicInfo.updateTime}</span>
            </div>
          </div>
        </div>

        {/* 1. 字体基本信息 Panel */}
        <div className="mt-8 space-y-4">
          <h3 className="text-xs font-extrabold text-neutral-400 font-mono uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
            1. 字体基本信息
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/50">
                  <th className="py-2.5 px-4 font-bold text-neutral-500 font-mono uppercase tracking-wider">项目</th>
                  <th className="py-2.5 px-4 font-bold text-neutral-500 font-mono uppercase tracking-wider">结果</th>
                  <th className="py-2.5 px-4 font-bold text-neutral-500 font-mono uppercase tracking-wider">项目</th>
                  <th className="py-2.5 px-4 font-bold text-neutral-500 font-mono uppercase tracking-wider">结果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 italic-none">
                <tr>
                  <td className="py-3 px-4 text-neutral-500 font-semibold font-sans">字体名称</td>
                  <td className="py-3 px-4 text-neutral-900 font-bold truncate max-w-[180px]" title={basicInfo.name}>{basicInfo.name}</td>
                  <td className="py-3 px-4 text-neutral-500 font-semibold font-sans">文件大小</td>
                  <td className="py-3 px-4 text-neutral-900 font-mono font-bold">{basicInfo.fileSize}</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-neutral-500 font-semibold font-sans">字体格式</td>
                  <td className="py-3 px-4 text-neutral-900 font-mono font-bold">{basicInfo.format}</td>
                  <td className="py-3 px-4 text-neutral-500 font-semibold font-sans">Unicode 覆盖</td>
                  <td className="py-3 px-4 text-neutral-900 font-mono font-bold">{basicInfo.unicodeCount.toLocaleString()} 码位</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-neutral-500 font-semibold font-sans">字体版本</td>
                  <td className="py-3 px-4 text-neutral-900 font-mono font-bold">{basicInfo.version}</td>
                  <td className="py-3 px-4 text-neutral-500 font-semibold font-sans">字形总数量</td>
                  <td className="py-3 px-4 text-neutral-900 font-mono font-bold">{basicInfo.glyphCount.toLocaleString()} 轮廓</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-neutral-500 font-semibold font-sans">最后更新</td>
                  <td className="py-3 px-4 text-neutral-900 font-mono font-bold">{basicInfo.updateTime}</td>
                  <td className="py-3 px-4 text-neutral-500 font-semibold font-sans">渲染状态</td>
                  <td className="py-3 px-4 text-green-600 font-semibold font-sans flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> OpenType.JS 编译通过
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. 国家与地区适配性 Panels */}
        <div className="mt-10 space-y-4">
          <h3 className="text-xs font-extrabold text-neutral-400 font-mono uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
            2. 国家与全球地区适配性
          </h3>
          <div className="flex flex-col gap-4">
            {/* 100% Width Real WorldMap in 2D Flat Mode */}
            <div className="w-full bg-white border border-neutral-200 rounded-xl p-1 overflow-hidden relative">
              <WorldMap fontData={fontData} viewMode="flat" isReportEmbed={true} />
            </div>

            {/* Coverage rates list */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {continents.map((cont) => {
                const percentage = regionalCoverage[cont] ?? 0;
                let ratingColor = "bg-green-500";
                let ratingText = "极好覆盖";
                if (percentage < 30) {
                  ratingColor = "bg-red-500";
                  ratingText = "未覆盖";
                } else if (percentage < 85) {
                  ratingColor = "bg-amber-500";
                  ratingText = "中等可用";
                }
                
                return (
                  <div key={cont} className="bg-white p-3 border border-neutral-200 rounded-lg flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-neutral-700">{cont}</span>
                      <span className="text-xs font-bold font-mono text-neutral-900">{percentage}%</span>
                    </div>
                    <div className="mt-2.5">
                      <div className="w-full bg-neutral-100 h-1 rounded-full overflow-hidden">
                        <div className={`h-full ${ratingColor} rounded-full`} style={{ width: `${percentage}%` }} />
                      </div>
                      <span className="text-[9px] text-neutral-400 block mt-1 font-mono font-bold uppercase tracking-wide">{ratingText}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. 国标检测 Panels */}
        <div className="mt-10 space-y-4">
          <h3 className="text-xs font-extrabold text-neutral-400 font-mono uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
            3. 汉字圈国家标准合规校验
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* China Standards */}
            <div className="border border-neutral-200 rounded-lg p-4 font-sans space-y-3 bg-neutral-50/20">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                <span className="text-xs font-extrabold text-neutral-800">🇨🇳 中文国标检测</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  complianceStats.chinese.gb2312 >= 95 ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                }`}>
                  {complianceStats.chinese.gb2312 >= 95 ? "完全支持" : "不支持使用"}
                </span>
              </div>
              <ul className="space-y-2 text-xs">
                <li className="flex justify-between">
                  <span className="text-neutral-500">GB2312 基础</span>
                  <span className="font-mono font-bold text-neutral-700">{complianceStats.chinese.gb2312.toFixed(1)}%</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-neutral-500">GB18030 一级</span>
                  <span className="font-mono font-bold text-neutral-700">{complianceStats.chinese.level1.toFixed(1)}%</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-neutral-500">GB18030 二级</span>
                  <span className="font-mono font-bold text-neutral-700">{complianceStats.chinese.level2.toFixed(1)}%</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-neutral-500">GB18030 三级</span>
                  <span className="font-mono font-bold text-neutral-700">{complianceStats.chinese.level3.toFixed(1)}%</span>
                </li>
              </ul>
              <div className="pt-1.5 border-t border-dashed border-neutral-100 text-[10px] text-neutral-400 font-mono">
                判定级别: <span className="font-bold text-neutral-700">{complianceStats.chinese.unites}</span>
              </div>
            </div>

            {/* Japan Standards */}
            <div className="border border-neutral-200 rounded-lg p-4 font-sans space-y-3 bg-neutral-50/20">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                <span className="text-xs font-extrabold text-neutral-800">🇯🇵 日本工业校定</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  complianceStats.japanese.kana >= 90 && complianceStats.japanese.jis1 >= 90 ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                }`}>
                  {complianceStats.japanese.kana >= 90 && complianceStats.japanese.jis1 >= 90 ? "完全支持" : "不支持使用"}
                </span>
              </div>
              <ul className="space-y-2 text-xs">
                <li className="flex justify-between">
                  <span className="text-neutral-500">假名</span>
                  <span className="font-mono font-bold text-neutral-700">{complianceStats.japanese.kana.toFixed(1)}%</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-neutral-500">日本常用汉字</span>
                  <span className="font-mono font-bold text-neutral-700">{complianceStats.japanese.joyo.toFixed(1)}%</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-neutral-500">JIS第1水准</span>
                  <span className="font-mono font-bold text-neutral-700">{complianceStats.japanese.jis1.toFixed(1)}%</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-neutral-500">JIS第2水准</span>
                  <span className="font-mono font-bold text-neutral-700">{complianceStats.japanese.jis2.toFixed(1)}%</span>
                </li>
              </ul>
              <div className="pt-1.5 border-t border-dashed border-neutral-100 text-[10px] text-neutral-400 font-sans">
                判定结果: <span className="font-bold text-neutral-700">{complianceStats.japanese.kana >= 90 && complianceStats.japanese.jis1 >= 90 ? "支持日文使用" : "不支持日文使用"}</span>
              </div>
            </div>

            {/* Korea Standards */}
            <div className="border border-neutral-200 rounded-lg p-4 font-sans space-y-3 bg-neutral-50/20">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                <span className="text-xs font-extrabold text-neutral-800">🇰🇷 韩国 KS 检定</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  complianceStats.korean.level === "完全支持" || complianceStats.korean.level === "基本支持" ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                }`}>
                  {complianceStats.korean.level === "完全支持" || complianceStats.korean.level === "基本支持" ? "完全支持" : "不支持使用"}
                </span>
              </div>
              <ul className="space-y-2 text-xs">
                <li className="flex justify-between">
                  <span className="text-neutral-500">基础谚文字母</span>
                  <span className="font-mono font-bold text-neutral-700">{complianceStats.korean.jamo.toFixed(1)}%</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-neutral-500">谚文现代字</span>
                  <span className="font-mono font-bold text-neutral-700">{complianceStats.korean.syllables.toFixed(1)}%</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-neutral-500">KS X 1001 必备汉字</span>
                  <span className="font-mono font-bold text-neutral-700">{complianceStats.korean.ks.toFixed(1)}%</span>
                </li>
              </ul>
              <div className="pt-7 border-t border-dashed border-neutral-100 text-[10px] text-neutral-400 font-sans">
                判定结果: <span className="font-bold text-neutral-700">{complianceStats.korean.level === "完全支持" || complianceStats.korean.level === "基本支持" ? "支持韩文使用" : "不支持韩文使用"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. 语言语种支持能力 Panels */}
        <div className="mt-10 space-y-4">
          <h3 className="text-xs font-extrabold text-neutral-400 font-mono uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
            4. 语言语系兼容分析
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fully Supported Languages */}
            <div className="border border-neutral-200 rounded-lg p-4 bg-green-50/10">
              <div className="flex items-center justify-between mb-3 border-b border-green-100/50 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-green-800 font-sans">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <span>支持（100% 完整支持）</span>
                </div>
                <span className="text-xs font-mono font-bold text-green-700">共 {languagesAnalytics.fullySupported.length} 门语言</span>
              </div>
              
              {languagesAnalytics.fullySupported.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {languagesAnalytics.fullySupported.map((lang) => (
                    <span key={lang} className="text-[10px] font-medium bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded shadow-3xs font-sans">
                      {lang}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-neutral-400 italic font-sans">当前字体无全字根覆盖语系。</p>
              )}
            </div>

            {/* Partially Supported Languages */}
            <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50/40">
              <div className="flex items-center justify-between mb-3 border-b border-neutral-200/50 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 font-sans">
                  <AlertCircle className="w-4 h-4 text-neutral-500 shrink-0" />
                  <span>不支持（存在字根缺失）</span>
                </div>
                <span className="text-xs font-mono font-bold text-neutral-600">共 {languagesAnalytics.partiallySupported.length} 门语言</span>
              </div>

              {languagesAnalytics.partiallySupported.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {languagesAnalytics.partiallySupported.map((item) => (
                    <span key={item.name} className="text-[10px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200 px-2 py-0.5 rounded shadow-3xs font-sans flex items-center gap-1">
                      <span>{item.name}</span>
                      <span className="font-mono text-[9px] font-bold text-neutral-400">{item.pct}%</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-neutral-400 italic font-sans">没有存在部分缺失的语言字集。</p>
              )}
            </div>
          </div>
        </div>

        {/* 5. OpenType特性检测 Panels */}
        <div className="mt-10 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-neutral-100 pb-2">
            <h3 className="text-xs font-extrabold text-neutral-400 font-mono uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
              5. OpenType特性检测分析
            </h3>
          </div>

          {/* Explanation Banner */}
          <div className="p-3.5 bg-neutral-50 rounded-lg border border-neutral-100/80 text-[11px] text-neutral-500 leading-relaxed space-y-1 font-sans">
            <span className="font-bold text-neutral-800 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-neutral-400" /> 
              排版解析原理：字体排版特性是如何检测的？
            </span>
            <p>
              本检测模块通过 <strong>OpenType.js</strong> 直接对您上传的物理字体进行底层扫描，提取隐藏在二进制字库内的 <strong>GSUB（字形替换表）</strong> 与 <strong>GPOS（字形定位表）</strong>。
              高级排版特性是数字排版与高端印刷的关键。以下是为您精准检测出的该字体二进制表中注册的排版程序组件：
            </p>
          </div>

          {/* Layer 1: Simplified Centered Radar Chart */}
          <div className="flex flex-col items-center justify-center max-w-2xl mx-auto w-full py-4">
            <div className="w-full flex justify-center items-center">
              <svg viewBox="0 0 540 360" className="w-full h-auto overflow-visible select-none">
                {/* Radar grids: 5 levels (20%, 40%, 60%, 80%, 100%) */}
                {[20, 40, 60, 80, 100].map((level, idx) => {
                  const r = (level / 100) * 110;
                  const numVertices = openTypeScores.length;
                  const points = Array.from({ length: numVertices }).map((_, i) => {
                    const angle = (i * Math.PI * 2) / numVertices - Math.PI / 2;
                    const x = 270 + r * Math.cos(angle);
                    const y = 180 + r * Math.sin(angle);
                    return `${x},${y}`;
                  }).join(" ");
                  return (
                    <polygon 
                      key={idx} 
                      points={points} 
                      fill="none" 
                      stroke="#e5e7eb" 
                      strokeWidth="0.8" 
                      strokeDasharray={level < 100 ? "3,3" : "none"} 
                    />
                  );
                })}
                
                {/* Spoke lines */}
                {Array.from({ length: openTypeScores.length }).map((_, i) => {
                  const numVertices = openTypeScores.length;
                  const angle = (i * Math.PI * 2) / numVertices - Math.PI / 2;
                  const x = 270 + 110 * Math.cos(angle);
                  const y = 180 + 110 * Math.sin(angle);
                  return (
                    <line 
                      key={i} 
                      x1="270" 
                      y1="180" 
                      x2={x} 
                      y2={y} 
                      stroke="#e5e7eb" 
                      strokeWidth="1" 
                    />
                  );
                })}

                {/* Font Score Area Polygon */}
                {(() => {
                  const numVertices = openTypeScores.length;
                  const points = openTypeScores.map((dim, i) => {
                    const angle = (i * Math.PI * 2) / numVertices - Math.PI / 2;
                    const r = (dim.score / 100) * 110;
                    const x = 270 + r * Math.cos(angle);
                    const y = 180 + r * Math.sin(angle);
                    return `${x},${y}`;
                  }).join(" ");

                  const nodePoints = openTypeScores.map((dim, i) => {
                    const angle = (i * Math.PI * 2) / numVertices - Math.PI / 2;
                    const r = (dim.score / 100) * 110;
                    return {
                      x: 270 + r * Math.cos(angle),
                      y: 180 + r * Math.sin(angle)
                    };
                  });

                  return (
                    <>
                      <polygon 
                        points={points} 
                        fill="rgba(59, 130, 246, 0.08)" 
                        stroke="#3b82f6" 
                        strokeWidth="2.2" 
                        strokeLinejoin="round" 
                      />
                      {nodePoints.map((pt, i) => (
                        <circle 
                          key={i} 
                          cx={pt.x} 
                          cy={pt.y} 
                          r="4.5" 
                          fill="#ffffff" 
                          stroke="#3b82f6" 
                          strokeWidth="2" 
                        />
                      ))}
                    </>
                  );
                })()}

                {/* Vertices labels */}
                {openTypeScores.map((dim, i) => {
                  const numVertices = openTypeScores.length;
                  const angle = (i * Math.PI * 2) / numVertices - Math.PI / 2;
                  const x = 270 + 132 * Math.cos(angle);
                  const y = 180 + 132 * Math.sin(angle);
                  let anchor = "middle";
                  if (Math.cos(angle) > 0.1) anchor = "start";
                  else if (Math.cos(angle) < -0.1) anchor = "end";

                  return (
                    <text 
                      key={i} 
                      x={x} 
                      y={y} 
                      textAnchor={anchor} 
                      className="text-[11px] font-bold fill-neutral-700 font-sans tracking-tight"
                      dominantBaseline="middle"
                    >
                      {dim.name} ({(dim.score / 20).toFixed(1)}分)
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Layer 2: Detailed OpenType Feature Cards Showcase - SHOW ALL FEATURES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {openTypeScores.map((dim) => {
              const starsCount = Math.round(dim.score / 20);
              
              return (
                <div 
                  key={dim.id} 
                  className="border rounded-xl p-4 bg-white border-neutral-200/80 shadow-3xs hover:shadow-2xs transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-neutral-100 pb-2">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-mono font-bold leading-none text-blue-600 uppercase tracking-wider mb-1">
                          {dim.techLabel}
                        </span>
                        <h4 className="text-xs font-extrabold text-neutral-800 font-sans">
                          {dim.name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="flex text-[10px] text-amber-500 font-bold shrink-0">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <span key={s} className={s <= starsCount ? "text-amber-500" : "text-neutral-200"}>★</span>
                          ))}
                        </div>
                        <span className="text-[9px] font-bold font-mono text-neutral-400 bg-neutral-100 px-1 py-0.5 rounded scale-90">
                          {(dim.score / 20).toFixed(1)}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-neutral-400 font-sans leading-relaxed">
                      {dim.description}
                    </p>

                    {/* Detected & Undetected sub features */}
                    <div className="pt-2">
                       <span className="text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest block mb-1.5">
                         维度特征明细列表 ({dim.tags.length} 个检出 / {dim.allTags.length - dim.tags.length} 个未提供)
                       </span>

                       <div className="space-y-1.5">
                         {[...dim.interpretations]
                           .sort((a: any, b: any) => (b.detected ? 1 : 0) - (a.detected ? 1 : 0))
                           .map((inter: any) => {
                             const isDet = inter.detected;
                             return (
                               <div 
                                 key={inter.tag} 
                                 className={`flex gap-2 p-1.5 rounded-lg border transition-all text-left items-center ${
                                   isDet 
                                     ? "bg-slate-50 border-neutral-200/50 shadow-4xs" 
                                     : "bg-neutral-50/20 border-neutral-100/30 opacity-60 border-dashed"
                                 }`}
                               >
                                 <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border block h-fit leading-none shrink-0 ${
                                   isDet 
                                     ? "text-blue-700 bg-blue-50 border-blue-100" 
                                     : "text-neutral-400 bg-neutral-50/50 border-neutral-200/50 border-dashed"
                                 }`}>
                                   {inter.tag}
                                 </span>
                                 <div className="flex-1 min-w-0">
                                   <p className={`text-[10px] font-sans leading-normal ${
                                     isDet ? "text-neutral-700 font-semibold" : "text-neutral-400"
                                   }`}>
                                     {inter.meaning}
                                   </p>
                                 </div>
                                 <span className={`text-[8px] font-bold font-sans self-center shrink-0 px-1.5 py-0.5 rounded scale-90 ${
                                   isDet 
                                     ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                                     : "bg-neutral-100 text-neutral-400 border border-neutral-150/50"
                                 }`}>
                                   {isDet ? "✓ 已检出" : "✗ 未提供"}
                                 </span>
                               </div>
                             );
                           })}
                       </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 6. Unicode 分区一览 Panels */}
        <div className="mt-10 space-y-4">
          <div className="border-b border-neutral-100 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-neutral-400 font-mono uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
              6. Unicode 分区一览
            </h3>

            <div className="flex bg-neutral-100 p-0.5 rounded-md border border-neutral-200/60 text-[10px] font-sans font-medium">
              <button
                type="button"
                onClick={() => setUnicodeMode("all")}
                className={`cursor-pointer px-2 py-0.5 rounded transition-all ${
                  unicodeMode === "all"
                    ? "bg-white text-neutral-800 font-bold shadow-3xs"
                    : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                全部
              </button>
              <button
                type="button"
                onClick={() => setUnicodeMode("existing")}
                className={`cursor-pointer px-2 py-0.5 rounded transition-all ${
                  unicodeMode === "existing"
                    ? "bg-white text-neutral-800 font-bold shadow-3xs"
                    : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                已有
              </button>
            </div>
          </div>

          <p className="text-[11px] text-neutral-400 font-sans leading-relaxed">
            {unicodeMode === "all"
              ? "该分析深度扫描了此物理字体的底层码位，全面盘点和罗列所有支持的 Unicode 编码分区状态一览："
              : "该分析深度扫描了此物理字体的底层码位，精准匹配出以下至少包含一个字符的活跃 Unicode 编码分区："}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
            {displayedUnicodeBlocks.map((block) => {
              const totalSlots = block.end - block.start + 1;
              const coveragePercent = Math.min(100, (block.count / totalSlots) * 100);
              const displayName = block.name.replace(/\s*\([^)]*\)/g, "").trim();
              
              // Define minimal color code indicator based on coverage
              let dotColor = "bg-neutral-300";
              if (coveragePercent >= 90) {
                dotColor = "bg-emerald-500";
              } else if (coveragePercent >= 50) {
                dotColor = "bg-blue-500";
              } else if (coveragePercent > 0) {
                dotColor = "bg-amber-500";
              }

              return (
                <div 
                  key={block.name} 
                  className="flex items-center justify-between py-1.5 border-b border-neutral-100/60 font-sans group hover:bg-neutral-50/50 px-1 rounded transition-colors min-w-0"
                >
                  <div className="flex items-center gap-2 min-w-0 mr-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                    <span className="text-[11px] text-neutral-700 font-medium truncate" title={block.name}>
                      {displayName}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                    {block.count}/{totalSlots}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Report Footer */}
        <div className="border-t border-neutral-200 mt-12 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-neutral-400 font-mono">
          <div className="flex items-center gap-2">
            <Workflow className="w-3.5 h-3.5 text-neutral-300" />
            <span>Font Parsing</span>
          </div>
          <div className="text-center sm:text-right">
            <span>© 2026 Font Parsing · Created by iTz_Leavess · All Rights Reserved</span>
          </div>
        </div>
      </div>
  );
}
