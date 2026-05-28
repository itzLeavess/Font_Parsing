import React, { useEffect, useState, useRef } from "react";
import Globe from "react-globe.gl";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import {
  getCountryAlphabet,
  evaluateCountryCoverageAndStatus,
  COUNTRY_METADATA,
} from "../lib/languages";
import * as topojson from "topojson-client";
import { Map as MapIcon, Globe as GlobeIcon, ChevronDown, ChevronUp, Sliders } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

interface WorldMapProps {
  fontData?: {
    fontName: string;
    family?: string;
    supportedChars: Set<number>;
    glyphCount: number;
  } | null;
  onCountryClick?: (countryName: string) => void;
  viewMode?: "globe" | "flat";
  setViewMode?: (mode: "globe" | "flat") => void;
}

const COUNTRY_DB: Record<string, { zh: string; lang: string; status: string }> =
  {
    // 一、东亚汉字文化圈
    China: {
      zh: "中国",
      lang: "简体中文",
      status: "完全可用",
    },
    Taiwan: {
      zh: "中国台湾",
      lang: "繁体中文",
      status: "基本可用",
    },
    "Hong Kong": {
      zh: "中国香港",
      lang: "粤语/繁体",
      status: "完全可用",
    },
    Macao: {
      zh: "中国澳门",
      lang: "粤语/繁体",
      status: "完全可用",
    },
    Singapore: {
      zh: "新加坡",
      lang: "简中/英语",
      status: "完全可用",
    },
    Japan: {
      zh: "日本",
      lang: "日语",
      status: "完全可用",
    },
    "South Korea": {
      zh: "韩国",
      lang: "韩语",
      status: "基本可用",
    },
    "North Korea": {
      zh: "朝鲜",
      lang: "朝鲜语",
      status: "基本可用",
    },
    "Dem. Rep. Korea": {
      zh: "朝鲜",
      lang: "朝鲜语",
      status: "基本可用",
    },
    Mongolia: {
      zh: "蒙古",
      lang: "蒙古语",
      status: "基本可用",
    },

    // 二、东南亚
    Vietnam: {
      zh: "越南",
      lang: "越南语",
      status: "基本可用",
    },
    Thailand: {
      zh: "泰国",
      lang: "泰语",
      status: "基本可用",
    },
    Myanmar: {
      zh: "缅甸",
      lang: "缅甸语",
      status: "基本可用",
    },
    Cambodia: {
      zh: "柬埔寨",
      lang: "高棉语",
      status: "基本可用",
    },
    Laos: {
      zh: "老挝",
      lang: "老挝语",
      status: "基本可用",
    },
    Malaysia: {
      zh: "马来西亚",
      lang: "马来语、英语",
      status: "完全可用",
    },
    Indonesia: {
      zh: "印度尼西亚",
      lang: "印尼语",
      status: "完全可用",
    },
    Philippines: {
      zh: "菲律宾",
      lang: "他加禄语",
      status: "完全可用",
    },

    // 三、欧洲
    Andorra: {
      zh: "安道尔",
      lang: "加泰罗尼亚语",
      status: "完全可用",
    },
    Germany: {
      zh: "德国",
      lang: "德语",
      status: "完全可用",
    },
    Austria: {
      zh: "奥地利",
      lang: "德语",
      status: "完全可用",
    },
    "United Kingdom": {
      zh: "英国",
      lang: "英语",
      status: "完全可用",
    },
    France: {
      zh: "法国",
      lang: "法语",
      status: "完全可用",
    },
    Spain: {
      zh: "西班牙",
      lang: "西班牙语",
      status: "完全可用",
    },
    Italy: {
      zh: "意大利",
      lang: "意大利语",
      status: "完全可用",
    },
    Monaco: {
      zh: "摩纳哥",
      lang: "法语",
      status: "完全可用",
    },
    Netherlands: {
      zh: "荷兰",
      lang: "荷兰语",
      status: "完全可用",
    },
    Ireland: {
      zh: "爱尔兰",
      lang: "爱尔兰语",
      status: "完全可用",
    },
    Portugal: {
      zh: "葡萄牙",
      lang: "葡萄牙语",
      status: "完全可用",
    },
    Luxembourg: {
      zh: "卢森堡",
      lang: "卢森堡语/法语/德语",
      status: "完全可用",
    },
    Switzerland: {
      zh: "瑞士",
      lang: "德语/法语/意大利语/罗曼什语",
      status: "完全可用",
    },
    Brazil: {
      zh: "巴西",
      lang: "葡萄牙语",
      status: "完全可用",
    },
    Poland: {
      zh: "波兰",
      lang: "波兰语",
      status: "完全可用",
    },
    Belgium: {
      zh: "比利时",
      lang: "荷兰语/法语/德语",
      status: "完全可用",
    },
    Czechia: {
      zh: "捷克",
      lang: "捷克语",
      status: "完全可用",
    },
    "Czech Republic": {
      zh: "捷克",
      lang: "捷克语",
      status: "完全可用",
    },
    Slovakia: {
      zh: "斯洛伐克",
      lang: "斯洛伐克语",
      status: "完全可用",
    },
    Croatia: {
      zh: "克罗地亚",
      lang: "克罗地亚语",
      status: "完全可用",
    },
    Serbia: {
      zh: "塞尔维亚",
      lang: "塞尔维亚语",
      status: "完全可用",
    },
    Montenegro: {
      zh: "黑山",
      lang: "黑山语",
      status: "完全可用",
    },
    "Bosnia and Herz.": {
      zh: "波黑",
      lang: "波斯尼亚语、塞尔维亚语、克罗地亚语",
      status: "完全可用",
    },
    "Bosnia and Herzegovina": {
      zh: "波黑",
      lang: "波斯尼亚语、塞尔维亚语、克罗地亚语",
      status: "完全可用",
    },
    Hungary: {
      zh: "匈牙利",
      lang: "匈牙利语",
      status: "完全可用",
    },
    Romania: {
      zh: "罗马尼亚",
      lang: "罗马尼亚语",
      status: "完全可用",
    },
    Bulgaria: {
      zh: "保加利亚",
      lang: "保加利亚语",
      status: "完全可用",
    },
    Albania: {
      zh: "阿尔巴尼亚",
      lang: "阿尔巴尼亚语",
      status: "完全可用",
    },
    Belarus: {
      zh: "白俄罗斯",
      lang: "白俄罗斯语、俄语",
      status: "完全可用",
    },
    Ukraine: {
      zh: "乌克兰",
      lang: "乌克兰语",
      status: "完全可用",
    },
    Greece: {
      zh: "希腊",
      lang: "希腊语",
      status: "完全可用",
    },
    Slovenia: {
      zh: "斯洛文尼亚",
      lang: "斯洛文尼亚语",
      status: "完全可用",
    },
    Latvia: {
      zh: "拉脱维亚",
      lang: "拉脱维亚语",
      status: "完全可用",
    },
    Lithuania: {
      zh: "立陶宛",
      lang: "立陶宛语、波兰语和俄语",
      status: "完全可用",
    },
    Russia: {
      zh: "俄罗斯",
      lang: "俄语",
      status: "完全可用",
    },
    "North Macedonia": {
      zh: "北马其顿",
      lang: "马其顿语、阿尔巴尼亚语",
      status: "完全可用",
    },
    Macedonia: {
      zh: "北马其顿",
      lang: "马其顿语、阿尔巴尼亚语",
      status: "完全可用",
    },
    Kosovo: {
      zh: "科索沃",
      lang: "阿尔巴尼亚语、塞尔维亚语",
      status: "完全可用",
    },
    Estonia: {
      zh: "爱沙尼亚",
      lang: "爱沙尼亚语",
      status: "完全可用",
    },
    Moldova: {
      zh: "摩尔多瓦",
      lang: "罗马尼亚语",
      status: "完全可用",
    },
    Turkey: {
      zh: "土耳其",
      lang: "土耳其语",
      status: "完全可用",
    },
    Turkiye: {
      zh: "土耳其",
      lang: "土耳其语",
      status: "完全可用",
    },
    Cyprus: {
      zh: "塞浦路斯",
      lang: "希腊语、土耳其语",
      status: "完全可用",
    },
    "N. Cyprus": {
      zh: "塞浦路斯",
      lang: "希腊语、土耳其语",
      status: "完全可用",
    },
    "Northern Cyprus": {
      zh: "塞浦路斯",
      lang: "希腊语、土耳其语",
      status: "完全可用",
    },
    Armenia: {
      zh: "亚美尼亚",
      lang: "亚美尼亚语",
      status: "完全可用",
    },
    Sweden: {
      zh: "瑞典",
      lang: "瑞典语",
      status: "完全可用",
    },
    Norway: {
      zh: "挪威",
      lang: "挪威语",
      status: "完全可用",
    },
    Denmark: {
      zh: "丹麦",
      lang: "丹麦语",
      status: "完全可用",
    },
    Finland: {
      zh: "芬兰",
      lang: "芬兰语",
      status: "完全可用",
    },
    Iceland: {
      zh: "冰岛",
      lang: "冰岛语",
      status: "完全可用",
    },

    // 四、中东与西亚
    "Saudi Arabia": {
      zh: "沙特阿拉伯",
      lang: "阿拉伯语",
      status: "基本可用",
    },
    "United Arab Emirates": {
      zh: "阿联酋",
      lang: "阿拉伯语",
      status: "基本可用",
    },
    Iran: {
      zh: "伊朗",
      lang: "波斯语",
      status: "基本可用",
    },
    Israel: {
      zh: "以色列",
      lang: "希伯来语",
      status: "基本可用",
    },
    Iraq: {
      zh: "伊拉克",
      lang: "阿拉伯语、库尔德语",
      status: "基本可用",
    },
    Syria: {
      zh: "叙利亚",
      lang: "阿拉伯语",
      status: "基本可用",
    },

    // 五、南亚
    India: {
      zh: "印度",
      lang: "22种语言",
      status: "勉强可用",
    },
    Bangladesh: {
      zh: "孟加拉国",
      lang: "孟加拉语",
      status: "基本可用",
    },
    Pakistan: {
      zh: "巴基斯坦",
      lang: "乌尔都语、英语",
      status: "勉强可用",
    },
    "Sri Lanka": {
      zh: "斯里兰卡",
      lang: "僧伽罗语、泰米尔语",
      status: "基本可用",
    },
    Nepal: {
      zh: "尼泊尔",
      lang: "尼泊尔语",
      status: "基本可用",
    },

    // 六、中亚
    Kazakhstan: {
      zh: "哈萨克斯坦",
      lang: "哈萨克语",
      status: "基本可用",
    },
    Uzbekistan: {
      zh: "乌兹别克斯坦",
      lang: "乌兹别克语",
      status: "基本可用",
    },
    Kyrgyzstan: {
      zh: "吉尔吉斯斯坦",
      lang: "吉尔吉斯语",
      status: "基本可用",
    },
    Tajikistan: {
      zh: "塔吉克斯坦",
      lang: "塔吉克语",
      status: "基本可用",
    },
    Turkmenistan: {
      zh: "土库曼斯坦",
      lang: "土库曼语",
      status: "基本可用",
    },

    // 七、大洋洲/北美/非洲
    Australia: {
      zh: "澳大利亚",
      lang: "英语",
      status: "完全可用",
    },
    "New Zealand": {
      zh: "新西兰",
      lang: "英语、毛利语",
      status: "完全可用",
    },
    "United States of America": {
      zh: "美国",
      lang: "英语",
      status: "完全可用",
    },
    "United States": {
      zh: "美国",
      lang: "英语",
      status: "完全可用",
    },
    Canada: {
      zh: "加拿大",
      lang: "英/法语",
      status: "完全可用",
    },
    "South Africa": { zh: "南非", lang: "多语言", status: "基本可用" },
    Egypt: { zh: "埃及", lang: "阿拉伯语", status: "基本可用" },
    Algeria: { zh: "阿尔及利亚", lang: "阿拉伯语", status: "基本可用" },
    Morocco: { zh: "摩洛哥", lang: "阿拉伯语", status: "基本可用" },
    Nigeria: { zh: "尼日利亚", lang: "英语", status: "基本可用" },
    Ethiopia: { zh: "埃塞俄比亚", lang: "吉兹字母", status: "勉强可用" },
    Angola: { zh: "安哥拉", lang: "葡萄牙语", status: "基本可用" },
    Benin: { zh: "贝宁", lang: "法语", status: "基本可用" },
    Botswana: { zh: "博茨瓦纳", lang: "茨瓦纳语、英语", status: "基本可用" },
    "Burkina Faso": { zh: "布基纳法索", lang: "法语", status: "基本可用" },
    Burundi: { zh: "布隆迪", lang: "法语、隆迪语、英语", status: "基本可用" },
    Cameroon: { zh: "喀麦隆", lang: "法语/英语", status: "基本可用" },
    "Central African Rep.": {
      zh: "中非共和国",
      lang: "法语、桑戈语",
      status: "基本可用",
    },
    "Central African Republic": {
      zh: "中非共和国",
      lang: "法语、桑戈语",
      status: "基本可用",
    },
    Chad: { zh: "乍得", lang: "法语/阿拉伯语", status: "基本可用" },
    Congo: { zh: "刚果共和国", lang: "法语", status: "基本可用" },
    "Democratic Republic of the Congo": {
      zh: "刚果民主共和国",
      lang: "法语",
      status: "基本可用",
    },
    "Dem. Rep. Congo": {
      zh: "刚果民主共和国",
      lang: "法语",
      status: "基本可用",
    },
    Djibouti: { zh: "吉布提", lang: "法语/阿拉伯语", status: "基本可用" },
    "Eq. Guinea": { zh: "赤道几内亚", lang: "西班牙语、法语、葡萄牙语", status: "基本可用" },
    "Equatorial Guinea": {
      zh: "赤道几内亚",
      lang: "西班牙语、法语、葡萄牙语",
      status: "基本可用",
    },
    Eritrea: { zh: "厄立特里亚", lang: "提格雷尼亚语、阿拉伯语、英语", status: "勉强可用" },
    eSwatini: { zh: "斯威士兰", lang: "斯威士语、英语", status: "基本可用" },
    Eswatini: { zh: "斯威士兰", lang: "斯威士语、英语", status: "基本可用" },
    Gabon: { zh: "加蓬", lang: "法语", status: "基本可用" },
    Gambia: { zh: "冈比亚", lang: "英语", status: "基本可用" },
    Ghana: { zh: "加纳", lang: "英语", status: "基本可用" },
    Guinea: { zh: "几内亚", lang: "法语", status: "基本可用" },
    "Guinea-Bissau": { zh: "几内亚比绍", lang: "葡萄牙语", status: "基本可用" },
    "Côte d'Ivoire": { zh: "科特迪瓦", lang: "法语", status: "基本可用" },
    "Ivory Coast": { zh: "科特迪瓦", lang: "法语", status: "基本可用" },
    Kenya: { zh: "肯尼亚", lang: "斯瓦希里语/英语", status: "基本可用" },
    Lesotho: { zh: "莱索托", lang: "英语、塞索托语", status: "基本可用" },
    Liberia: { zh: "利比里亚", lang: "英语", status: "基本可用" },
    Libya: { zh: "利比亚", lang: "阿拉伯语", status: "基本可用" },
    Madagascar: { zh: "马达加斯加", lang: "马达加斯加语、法语", status: "基本可用" },
    Malawi: { zh: "马拉维", lang: "英语、齐切瓦语", status: "基本可用" },
    Mali: { zh: "马里", lang: "法语", status: "基本可用" },
    Mauritania: { zh: "毛里塔尼亚", lang: "阿拉伯语", status: "基本可用" },
    Mozambique: { zh: "莫桑比克", lang: "葡萄牙语", status: "基本可用" },
    Namibia: { zh: "纳米比亚", lang: "英语", status: "基本可用" },
    Niger: { zh: "尼日尔", lang: "法语", status: "基本可用" },
    Rwanda: { zh: "卢旺达", lang: "卢旺达语、英语、法语、斯瓦希里语", status: "基本可用" },
    Senegal: { zh: "塞内加尔", lang: "法语", status: "基本可用" },
    "Sierra Leone": { zh: "塞拉利昂", lang: "英语", status: "基本可用" },
    Somalia: { zh: "索马里", lang: "索马里语", status: "基本可用" },
    "S. Sudan": { zh: "南苏丹", lang: "英语", status: "基本可用" },
    "South Sudan": { zh: "南苏丹", lang: "英语", status: "基本可用" },
    Sudan: { zh: "苏丹", lang: "阿拉伯语/英语", status: "基本可用" },
    Tanzania: { zh: "坦桑尼亚", lang: "斯瓦希里语、英语", status: "基本可用" },
    "United Republic of Tanzania": {
      zh: "坦桑尼亚",
      lang: "斯瓦希里语、英语",
      status: "基本可用",
    },
    Togo: { zh: "多哥", lang: "法语", status: "基本可用" },
    Tunisia: { zh: "突尼斯", lang: "阿拉伯语", status: "基本可用" },
    Uganda: { zh: "乌干达", lang: "英语/斯瓦希里语", status: "基本可用" },
    Zambia: { zh: "赞比亚", lang: "英语", status: "基本可用" },
    Zimbabwe: { zh: "津巴布韦", lang: "多语言", status: "基本可用" },
    Colombia: {
      zh: "哥伦比亚",
      lang: "西班牙语",
      status: "基本可用",
    },
    Mexico: {
      zh: "墨西哥",
      lang: "西班牙语",
      status: "基本可用",
    },
    Argentina: {
      zh: "阿根廷",
      lang: "西班牙语",
      status: "基本可用",
    },
    Chile: {
      zh: "智利",
      lang: "西班牙语",
      status: "基本可用",
    },
    Peru: {
      zh: "秘鲁",
      lang: "西班牙语、克丘亚语、艾马拉语",
      status: "基本可用",
    },
    Venezuela: { zh: "委内瑞拉", lang: "西班牙语", status: "基本可用" },
    Ecuador: { zh: "厄瓜多尔", lang: "西班牙语", status: "基本可用" },
    Bolivia: { zh: "玻利维亚", lang: "西班牙语", status: "基本可用" },
    Paraguay: { zh: "巴拉圭", lang: "西班牙语、瓜拉尼语", status: "基本可用" },
    Uruguay: { zh: "乌拉圭", lang: "西班牙语", status: "基本可用" },
    Guyana: { zh: "圭亚那", lang: "英语", status: "基本可用" },
    Suriname: { zh: "苏里南", lang: "荷兰语", status: "基本可用" },
    Guatemala: { zh: "危地马拉", lang: "西班牙语", status: "基本可用" },
    Honduras: { zh: "洪都拉斯", lang: "西班牙语", status: "基本可用" },
    "El Salvador": { zh: "萨尔瓦多", lang: "西班牙语", status: "基本可用" },
    Nicaragua: { zh: "尼加拉瓜", lang: "西班牙语", status: "基本可用" },
    "Costa Rica": { zh: "哥斯达黎加", lang: "西班牙语", status: "基本可用" },
    Panama: { zh: "巴拿马", lang: "西班牙语", status: "基本可用" },
    Cuba: { zh: "古巴", lang: "西班牙语", status: "基本可用" },
    Haiti: { zh: "海地", lang: "法语、克里奥尔语", status: "基本可用" },
    "Dominican Rep.": { zh: "多米尼加", lang: "西班牙语", status: "基本可用" },
    Dominican: { zh: "多米尼加", lang: "西班牙语", status: "基本可用" },
    Jamaica: { zh: "牙买加", lang: "英语", status: "基本可用" },
    Bahamas: { zh: "巴哈马", lang: "英语", status: "基本可用" },
    Afghanistan: { zh: "阿富汗", lang: "达里语、普什图语", status: "勉强可用" },
    Yemen: { zh: "也门", lang: "阿拉伯语", status: "基本可用" },
    Oman: { zh: "阿曼", lang: "阿拉伯语", status: "基本可用" },
    Qatar: { zh: "卡塔尔", lang: "阿拉伯语", status: "基本可用" },
    Kuwait: { zh: "科威特", lang: "阿拉伯语", status: "基本可用" },
    Bahrain: { zh: "巴林", lang: "阿拉伯语", status: "基本可用" },
    Jordan: { zh: "约旦", lang: "阿拉伯语", status: "基本可用" },
    Lebanon: { zh: "黎巴嫩", lang: "阿拉伯语", status: "基本可用" },
    Bhutan: { zh: "不丹", lang: "宗卡语", status: "勉强可用" },
    Maldives: { zh: "马尔代夫", lang: "迪维希语", status: "勉强可用" },
    Brunei: { zh: "文莱", lang: "马来语", status: "基本可用" },
    "Timor-Leste": { zh: "东帝汶", lang: "德顿语、葡萄牙语", status: "基本可用" },
    Palestine: { zh: "巴勒斯坦", lang: "阿拉伯语", status: "基本可用" },
    Fiji: { zh: "斐济", lang: "英语、斐济语、斐济印地语", status: "完全可用" },
    Belize: { zh: "伯利兹", lang: "英语", status: "完全可用" },
    Georgia: { zh: "格鲁吉亚", lang: "格鲁吉亚语", status: "完全可用" },
    Azerbaijan: { zh: "阿塞拜疆", lang: "阿塞拜疆语", status: "完全可用" },
    Mauritius: { zh: "毛里求斯", lang: "英语、法语", status: "完全可用" },
    "Cabo Verde": { zh: "佛得角", lang: "葡萄牙语", status: "完全可用" },
    Comoros: { zh: "科摩罗", lang: "科摩罗语、法语、阿拉伯语", status: "完全可用" },
    "Saint Lucia": { zh: "圣卢西亚", lang: "英语", status: "完全可用" },
    Samoa: { zh: "萨摩亚", lang: "英语、萨摩亚语", status: "完全可用" },
    Tonga: { zh: "汤加", lang: "汤加语、英语", status: "完全可用" },
    Micronesia: { zh: "密克罗尼西亚", lang: "英语", status: "完全可用" },
    "Puerto Rico": { zh: "波多黎各", lang: "英语、西班牙语", status: "基本可用" },
    Vatican: { zh: "梵蒂冈", lang: "意大利语", status: "完全可用" },
    Vanuatu: { zh: "瓦努阿图", lang: "英语、法语、比斯拉马语", status: "完全可用" },
    "Marshall Is.": { zh: "马绍尔群岛", lang: "英语", status: "完全可用" },
    "N. Mariana Is.": {
      zh: "北马里亚纳群岛",
      lang: "英语",
      status: "完全可用",
    },
    "U.S. Virgin Is.": {
      zh: "美属维尔京群岛",
      lang: "英语",
      status: "完全可用",
    },
    Guam: { zh: "关岛", lang: "英语", status: "完全可用" },
    "American Samoa": { zh: "美属萨摩亚", lang: "英语", status: "完全可用" },
    "S. Geo. and the Is.": {
      zh: "南乔治亚和南桑威奇群岛",
      lang: "英语",
      status: "完全可用",
    },
    "Saint Helena": { zh: "圣赫勒拿", lang: "英语", status: "完全可用" },
    "Pitcairn Is.": { zh: "皮特凯恩群岛", lang: "英语", status: "完全可用" },
    Anguilla: { zh: "安圭拉", lang: "英语", status: "完全可用" },
    "Falkland Is.": { zh: "马尔维纳斯群岛", lang: "英语", status: "完全可用" },
    "Cayman Is.": { zh: "开曼群岛", lang: "英语", status: "完全可用" },
    Bermuda: { zh: "百慕大", lang: "英语", status: "完全可用" },
    "British Virgin Is.": {
      zh: "英属维尔京群岛",
      lang: "英语",
      status: "完全可用",
    },
    "Turks and Caicos Is.": {
      zh: "特克斯和凯科斯群岛",
      lang: "英语",
      status: "完全可用",
    },
    Montserrat: { zh: "蒙特塞拉特", lang: "英语", status: "完全可用" },
    "Trinidad and Tobago": {
      zh: "特立尼达和多巴哥",
      lang: "英语",
      status: "完全可用",
    },
    Somaliland: { zh: "索马里兰", lang: "索马里语", status: "基本可用" },
    "Solomon Is.": { zh: "所罗门群岛", lang: "英语", status: "完全可用" },
    Seychelles: {
      zh: "塞舌尔",
      lang: "塞舌尔克里奥尔语、法语、英语",
      status: "基本可用",
    },
    "São Tomé and Principe": {
      zh: "圣多美和普林西比",
      lang: "葡萄牙语",
      status: "基本可用",
    },
    "San Marino": { zh: "圣马里诺", lang: "意大利语", status: "完全可用" },
    "St. Vin. and Gren.": {
      zh: "圣文森特和格林纳丁斯",
      lang: "英语",
      status: "完全可用",
    },
    "St. Kitts and Nevis": {
      zh: "圣基茨和尼维斯",
      lang: "英语",
      status: "完全可用",
    },
    "Papua New Guinea": {
      zh: "巴布亚新几内亚",
      lang: "英语、巴布亚皮钦语、希里莫图语",
      status: "完全可用",
    },
    Palau: { zh: "帕劳", lang: "英语、帕劳语、日语", status: "完全可用" },
    Niue: { zh: "纽埃", lang: "英语", status: "完全可用" },
    "Cook Is.": { zh: "库克群岛", lang: "英语", status: "完全可用" },
    Aruba: { zh: "阿鲁巴", lang: "荷兰语、帕皮阿门托语", status: "完全可用" },
    Curaçao: {
      zh: "库拉索",
      lang: "帕皮阿门托语、荷兰语、英语",
      status: "完全可用",
    },
    Nauru: { zh: "瑙鲁", lang: "英语", status: "完全可用" },
    Malta: { zh: "马耳他", lang: "马耳他语、英语", status: "完全可用" },
    Liechtenstein: { zh: "列支敦士登", lang: "德语", status: "完全可用" },
    Kiribati: { zh: "基里巴斯", lang: "英语、基里巴斯语", status: "完全可用" },
    Grenada: { zh: "格林纳达", lang: "英语", status: "完全可用" },
    "St. Pierre and Miquelon": {
      zh: "圣皮埃尔和密克隆",
      lang: "法语",
      status: "完全可用",
    },
    "Wallis and Futuna Is.": {
      zh: "瓦利斯和富图纳",
      lang: "法语",
      status: "完全可用",
    },
    "St-Martin": { zh: "圣马丁 (法属)", lang: "法语", status: "完全可用" },
    "St-Barthélemy": { zh: "圣巴泰勒米", lang: "法语", status: "完全可用" },
    "Fr. Polynesia": { zh: "法属波利尼西亚", lang: "法语", status: "完全可用" },
    "New Caledonia": { zh: "新喀里多尼亚", lang: "法语", status: "完全可用" },
    Dominica: { zh: "多米尼克", lang: "英语", status: "完全可用" },
    Greenland: { zh: "格陵兰", lang: "丹麦语", status: "完全可用" },
    Barbados: { zh: "巴巴多斯", lang: "英语", status: "完全可用" },
    "Norfolk Island": { zh: "诺福克岛", lang: "英语", status: "完全可用" },
    "Ashmore and Cartier Is.": {
      zh: "阿什莫尔和卡蒂尔群岛",
      lang: "英语",
      status: "完全可用",
    },
    "Antigua and Barb.": {
      zh: "安提瓜和巴布达",
      lang: "英语",
      status: "完全可用",
    },
    "Sint Maarten": { zh: "圣马丁 (荷属)", lang: "荷兰语", status: "完全可用" },
    "French Guiana": { zh: "法属圭亚那", lang: "法语", status: "完全可用" },
    Tuvalu: { zh: "图瓦卢", lang: "英语、图瓦卢语", status: "完全可用" },
  };

// Get standard colors
const getStatusColor = (status: string) => {
  if (status.includes("完全可用") || status === "支持") {
    return "#4ade80"; // green-400
  }
  if (status.includes("基本可用")) {
    return "#fb923c"; // orange-400
  }
  if (status.includes("勉强可用")) {
    return "#fef08a"; // yellow-200
  }
  if (
    status.includes("不可用") ||
    status === "存在缺失" ||
    status === "不支持"
  ) {
    return "#f87171"; // red-400
  }
  return "#9ca3af"; // gray-400
};

export default function WorldMap({
  fontData,
  onCountryClick,
  viewMode: controlledViewMode,
  setViewMode: controlledSetViewMode,
}: WorldMapProps) {
  const [localViewMode, setLocalViewMode] = useState<"globe" | "flat">("globe");
  const [isControlPanelCollapsed, setIsControlPanelCollapsed] = useState(false);
  const [atlasResolution, setAtlasResolution] = useState<number>(110);
  const resolution = atlasResolution <= 80 ? "50m" : "110m";
  const viewMode =
    controlledViewMode !== undefined ? controlledViewMode : localViewMode;
  const setViewMode =
    controlledSetViewMode !== undefined ? controlledSetViewMode : setLocalViewMode;
  const [countries, setCountries] = useState({ features: [] });
  const [hoveredPolygon, setHoveredPolygon] = useState<any>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [showZoomInfo, setShowZoomInfo] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const zoomInfoTimerRef = useRef<number | null>(null);

  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isGlobeReady, setIsGlobeReady] = useState(false);
  const progressIntervalRef = useRef<number | null>(null);

  const [flatTooltip, setFlatTooltip] = useState<{
    x: number;
    y: number;
    content: string | null;
  }>({ x: 0, y: 0, content: null });

  useEffect(() => {
    // Reset states for loading the new resolution dataset
    setIsGlobeReady(false);
    setCountries({ features: [] });
    setLoadingProgress(0);

    // Start progress simulation
    progressIntervalRef.current = window.setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev < 90) return prev + Math.random() * 5;
        return prev;
      });
    }, 150);

    const dynamicGeoUrl = `https://unpkg.com/world-atlas@2.0.2/countries-${resolution}.json`;

    fetch(dynamicGeoUrl)
      .then((res) => res.json())
      .then((topoData: any) => {
        const geoJson = topojson.feature(
          topoData,
          topoData.objects.countries,
        ) as any;

        // Split French Guiana from France if present
        const franceIdx = geoJson.features.findIndex(
          (f: any) =>
            (f.properties.name || f.properties.ADMIN) === "France" &&
            f.geometry.type === "MultiPolygon",
        );

        if (franceIdx !== -1) {
          const france = geoJson.features[franceIdx];
          const coords = france.geometry.coordinates;
          const newFranceCoords: any[] = [];
          const frenchGuianaCoords: any[] = [];

          coords.forEach((poly: any) => {
            const firstPoint = poly[0][0];
            // French Guiana coordinates: roughly 4N, 53W
            if (
              firstPoint[0] < -50 &&
              firstPoint[0] > -55 &&
              firstPoint[1] > 0 &&
              firstPoint[1] < 10
            ) {
              frenchGuianaCoords.push(poly);
            } else {
              newFranceCoords.push(poly);
            }
          });

          if (frenchGuianaCoords.length > 0) {
            // Update France feature
            geoJson.features[franceIdx] = {
              ...france,
              geometry: {
                ...france.geometry,
                coordinates: newFranceCoords,
              },
            };

            // Add French Guiana feature
            geoJson.features.push({
              type: "Feature",
              properties: {
                ...france.properties,
                name: "French Guiana",
                ADMIN: "French Guiana",
              },
              geometry: {
                type: "MultiPolygon",
                coordinates: frenchGuianaCoords,
              },
              id: "GUF",
            });
          }
        }
        setCountries(geoJson);
      })
      .catch((err) => console.error("Map loading error:", err));

    return () => {
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [resolution]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerSize({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);

    // Initial size
    setContainerSize({
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    return () => observer.disconnect();
  }, []);

  // Make the Earth slowly rotate
  useEffect(() => {
    if (globeRef.current && countries.features.length) {
      if (viewMode === "globe") {
        globeRef.current.controls().autoRotate = true;
        globeRef.current.controls().autoRotateSpeed = 0.5;
      }
    }
  }, [globeRef.current, countries, viewMode]);

  useEffect(() => {
    const handleNativeWheel = (e: WheelEvent) => {
      if (viewMode !== "globe") return;
      if (!e.ctrlKey && !e.metaKey) {
        e.stopPropagation();
        setShowZoomInfo(true);
        if (zoomInfoTimerRef.current)
          window.clearTimeout(zoomInfoTimerRef.current);
        zoomInfoTimerRef.current = window.setTimeout(
          () => setShowZoomInfo(false),
          2000,
        );
      }
    };

    const el = containerRef.current;
    if (el) {
      el.addEventListener("wheel", handleNativeWheel, {
        capture: true,
        passive: true,
      });
    }
    return () => {
      if (el)
        el.removeEventListener("wheel", handleNativeWheel, { capture: true });
    };
  }, [viewMode]);

  const evaluateStatus = (zhName: string, configStatus: string) => {
    if (!fontData) return configStatus;
    const res = evaluateCountryCoverageAndStatus(
      zhName,
      fontData.supportedChars,
    );
    if (res.status === "未知") return configStatus;
    return res.status;
  };

  const getCountryInfo = (feat: any) => {
    const name =
      feat.properties.ADMIN || feat.properties.name || feat.properties.NAME;
    let info = COUNTRY_DB[name];
    if (!info && name === "United States of America")
      info = COUNTRY_DB["United States"];
    if (!info && (name === "W. Sahara" || name === "Western Sahara"))
      info = COUNTRY_DB["Morocco"];
    if (!info && name === "Russian Federation") info = COUNTRY_DB["Russia"];
    return { name, info };
  };

  const hexToRgba = (hex: string, alpha: number, darkenFactor = 1.0) => {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.round(r * darkenFactor);
    g = Math.round(g * darkenFactor);
    b = Math.round(b * darkenFactor);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const getPolygonColor = (feat: any) => {
    const { info } = getCountryInfo(feat);
    const isHovered = feat === hoveredPolygon;

    // Unconfigured country (unseen area)
    if (!info) {
      return isHovered ? "rgba(0, 0, 0, 0.45)" : "rgba(255, 255, 255, 0.12)";
    }

    const actualStatus = fontData
      ? evaluateStatus(info.zh, info.status)
      : info.status;
    const baseColor = getStatusColor(actualStatus);

    if (isHovered) {
      // Deeper and darker color overlay on hover
      return hexToRgba(baseColor, 0.85, 0.65);
    }
    return hexToRgba(baseColor, 0.75);
  };

  const getFlatPolygonColor = (feat: any, isHovered: boolean = false) => {
    const { info } = getCountryInfo(feat);

    // Unconfigured lands: elegant very light gray/off-white Vercel look
    if (!info) {
      return isHovered ? "#f0f0f0" : "#f5f5f5";
    }

    const actualStatus = fontData
      ? evaluateStatus(info.zh, info.status)
      : info.status;
    const baseColor = getStatusColor(actualStatus); // emerald, amber, rose, etc.

    // For configured lands, we can use slightly more sophisticated pastel/solid weights
    if (isHovered) {
      return hexToRgba(baseColor, 0.82, 0.92); // very mild and classy deepen effect
    }
    return hexToRgba(baseColor, 0.75); // subtle but clear color density
  };

  const getPolygonLabel = (feat: any) => {
    const { name, info } = getCountryInfo(feat);

    if (!info) {
      return `
        <div style="background: #ffffff; color: #111111; padding: 12px; border-radius: 6px; border: 1px solid #eaeaea; min-width: 140px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="font-weight: bold; border-bottom: 1px solid #eaeaea; padding-bottom: 6px; margin-bottom: 6px; font-size: 11.5px; text-transform: uppercase; font-family: monospace;">${name}</div>
          <div style="color: #888888; font-size: 11px;">未知区域 (无配置)</div>
        </div>
      `;
    }

    const actualStatus = fontData
      ? evaluateStatus(info.zh, info.status)
      : info.status;
    const statusColor = getStatusColor(actualStatus);

    const metadata = COUNTRY_METADATA[info.zh];
    const displayLanguages = metadata
      ? metadata.languages.join("、")
      : info.lang;

    return `
      <div style="background: #ffffff; color: #000000; padding: 14px; border-radius: 6px; border: 1px solid #eaeaea; min-width: 180px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="font-weight: bold; font-size: 12px; border-bottom: 1px solid #eaeaea; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <span>${info.zh} <span style="opacity:0.4;font-size:10px;margin-left:4px;font-weight:normal;">${name.toUpperCase()}</span></span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 6px;">
          <span style="color: #666666;">官方语言</span>
          <span style="color: #111111; font-weight: bold;">${displayLanguages}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; align-items: center;">
          <span style="color: #666666;">可用性状态</span>
          <span style="font-weight: bold; color: ${statusColor}; background: ${hexToRgba(statusColor, 0.08)}; padding: 2.5px 6px; border-radius: 4px; border: 1px solid ${hexToRgba(statusColor, 0.25)}; font-size: 10.5px;">${actualStatus}</span>
        </div>
      </div>
    `;
  };

  return (
    <div className="relative w-full h-[600px] mb-8">
      {/* Zoom Instructions Overlay */}
      {viewMode === "globe" && (
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white px-6 py-3 rounded text-sm z-[100] transition-opacity duration-300 pointer-events-none ${showZoomInfo ? "opacity-100" : "opacity-0"}`}
        >
          <span>按住 </span>
          <span className="font-mono bg-white/20 px-2 py-0.5 rounded text-xs mx-1">
            ⌘
          </span>
          <span> 或 </span>
          <span className="font-mono bg-white/20 px-2 py-0.5 rounded text-xs mx-1">
            Ctrl
          </span>
          <span> 并滚动以缩放地球 🌎</span>
        </div>
      )}

      {/* Combined Map Control Panel (Legend & Resolution Config) */}
      <AnimatePresence mode="wait">
        {isControlPanelCollapsed ? (
          <motion.button
            key="collapsed"
            type="button"
            onClick={() => setIsControlPanelCollapsed(false)}
            className="absolute top-4 left-4 z-[90] bg-white border border-neutral-200 rounded-md w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer select-none"
            title="展开控制面板"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
          >
            <Sliders className="w-4 h-4" />
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            className="absolute top-4 left-4 z-[90] bg-white border border-neutral-200 rounded-lg p-3.5 flex flex-col gap-3 w-[185px] select-none text-left shadow-none"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
          >
            {/* Top Header Row */}
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-neutral-800 font-bold text-[10px] font-mono tracking-wider uppercase">地图控制与配置</h4>
              <button
                type="button"
                onClick={() => setIsControlPanelCollapsed(true)}
                className="p-1 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors cursor-pointer select-none"
                title="收起面板"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Divider */}
            <div className="h-px bg-neutral-100" />

            {/* Section 1: Availability Legend */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-bold text-neutral-400 font-mono uppercase tracking-wider">可用性判定</span>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-[10px] text-neutral-600 font-medium">
                    完全可用 (&gt;98%)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <span className="text-[10px] text-neutral-600 font-medium">
                    基本可用 (&gt;95%)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                  <span className="text-[10px] text-neutral-600 font-medium">
                    不可用 (&lt;95%)
                  </span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-neutral-100" />

            {/* Section 2: Atlas Resolution Config */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-bold text-neutral-400 font-mono uppercase tracking-wider">边界精细度</span>
                <span className="text-[10px] font-bold text-neutral-900 font-mono bg-neutral-100 px-1.5 py-0.5 rounded leading-none">{atlasResolution}m</span>
              </div>
              
              <input 
                type="range" 
                min="40" 
                max="120" 
                step="10" 
                value={atlasResolution} 
                onChange={(e) => setAtlasResolution(parseInt(e.target.value))}
                className="w-full h-1 bg-neutral-100 rounded appearance-none cursor-pointer accent-neutral-800"
              />
              <div className="flex justify-between">
                <span className="text-[8px] text-neutral-400 font-mono">精密 (40m)</span>
                <span className="text-[8px] text-neutral-400 font-mono">粗略 (120m)</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map Container */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${viewMode === "globe" ? "w-[100vw] h-[1200px]" : "w-full h-full"} z-50 pointer-events-none flex justify-center items-center`}
      >
        <div
          ref={containerRef}
          className={`w-full h-full relative bg-transparent pointer-events-auto transition-all duration-700 ${viewMode === "flat" ? "flex items-center justify-center overflow-hidden" : "touch-none"}`}
        >
          {viewMode === "globe" ? (
            <>
              {(!isGlobeReady || countries.features.length === 0) && (
                <div className="absolute inset-0 w-full h-full flex justify-center items-center bg-white/40 backdrop-blur-[2px] z-10 pointer-events-none animate-fade-in">
                  <div className="flex flex-col items-center gap-4 bg-white p-6 rounded border border-neutral-200 w-[280px]">
                    <div className="relative w-8 h-8 flex items-center justify-center">
                      <div className="animate-spin w-5 h-5 border-2 border-neutral-200 border-t-neutral-800 rounded-full"></div>
                    </div>
                    <div className="flex flex-col items-center gap-2.5 w-full text-center">
                      <div className="text-[11px] font-bold text-neutral-800 font-mono tracking-wider uppercase">
                        {countries.features.length === 0
                          ? "正在获取地缘数据"
                          : "正在初始化三维球体"}
                      </div>
                      <div className="w-full bg-neutral-100 h-1 rounded overflow-hidden mt-1 border border-neutral-200/30">
                        <div
                          className="h-full bg-neutral-900 transition-all duration-300 ease-out"
                          style={{ width: `${loadingProgress}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono">
                        {Math.round(loadingProgress)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {containerSize.width > 0 &&
                containerSize.height > 0 &&
                countries.features.length > 0 && (
                  <Globe
                    key={resolution}
                    backgroundColor="rgba(0,0,0,0)"
                    ref={globeRef}
                    onGlobeReady={() => {
                      setLoadingProgress(100);
                      setTimeout(() => setIsGlobeReady(true), 500);
                    }}
                    width={containerSize.width}
                    height={containerSize.height}
                    globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
                    polygonsData={countries.features}
                    polygonResolution={3}
                    polygonAltitude={(feat: any) => {
                      const { info } = getCountryInfo(feat);
                      return info ? 0.012 : 0.005; // Slightly elevate matched countries
                    }}
                    polygonCapColor={getPolygonColor}
                    polygonSideColor={() => "rgba(255, 255, 255, 0.3)"}
                    polygonStrokeColor={() => "rgba(255,255,255,0.4)"}
                    polygonLabel={getPolygonLabel}
                    polygonsTransitionDuration={300}
                    onPolygonHover={(
                      polygon: object | null,
                      prevPolygon: object | null,
                    ) => {
                      setHoveredPolygon(polygon);
                      if (globeRef.current) {
                        globeRef.current.controls().autoRotate = !polygon;
                      }
                      if (containerRef.current) {
                        const { info } = polygon
                          ? getCountryInfo(polygon)
                          : { info: null };
                        containerRef.current.style.cursor = info
                          ? "pointer"
                          : "default";
                      }
                    }}
                    onPolygonClick={(polygon: any) => {
                      const { info } = getCountryInfo(polygon);
                      if (info && info.zh && onCountryClick) {
                        onCountryClick(info.zh);
                      }
                    }}
                  />
                )}
            </>
          ) : (
            <div className="w-full h-full bg-transparent flex items-center justify-center">
              <ComposableMap
                projection="geoMercator"
                width={800}
                height={450}
                projectionConfig={{
                  scale: 120,
                  center: [0, 20]
                }}
                style={{ width: "100%", height: "100%" }}
              >
                <Geographies geography={countries}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                        const { info } = getCountryInfo(geo);
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onMouseEnter={(e) => {
                              setHoveredPolygon(geo);
                              setFlatTooltip({
                                x: e.clientX,
                                y: e.clientY,
                                content: getPolygonLabel(geo),
                              });
                            }}
                            onMouseMove={(e) => {
                              setFlatTooltip((prev) => ({
                                ...prev,
                                x: e.clientX,
                                y: e.clientY,
                              }));
                            }}
                            onMouseLeave={() => {
                              setHoveredPolygon(null);
                              setFlatTooltip({
                                x: 0,
                                y: 0,
                                content: null,
                              });
                            }}
                            onClick={() => {
                              if (info && info.zh && onCountryClick) {
                                onCountryClick(info.zh);
                              }
                            }}
                            style={{
                              default: {
                                fill: getFlatPolygonColor(geo, false),
                                outline: "none",
                                stroke: "#e5e5e5",
                                strokeWidth: 0.5,
                              },
                              hover: {
                                fill: getFlatPolygonColor(geo, true),
                                outline: "none",
                                stroke: "#d4d4d4",
                                strokeWidth: 0.5,
                                cursor: info ? "pointer" : "default",
                              },
                              pressed: {
                                fill: hexToRgba(getFlatPolygonColor(geo, false), 1, 0.4),
                                outline: "none",
                              },
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
              </ComposableMap>

            </div>
          )}
        </div>
      </div>

      {/* 2D Flat Map Tooltip - Moved outside transformed containers to fix positioning offset */}
      {viewMode === "flat" && flatTooltip.content && (
        <div
          className="fixed pointer-events-none z-[200] animate-in fade-in duration-200"
          style={{
            left: `${flatTooltip.x + 15}px`,
            top: `${flatTooltip.y + 15}px`,
          }}
          dangerouslySetInnerHTML={{ __html: flatTooltip.content }}
        />
      )}
    </div>
  );
}
