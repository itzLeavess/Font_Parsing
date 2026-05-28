import React, { useState, useMemo } from "react";
import * as opentype from "opentype.js";
import { motion, AnimatePresence } from "motion/react";
import { 
  Layers, 
  Settings, 
  Download, 
  Sliders, 
  MousePointer, 
  HelpCircle,
  Maximize2,
  Columns
} from "lucide-react";

interface MicroContourDiffProps {
  baseFont: opentype.Font | null;
  compFont: opentype.Font | null;
  baseFontName: string;
  compFontName: string;
}

const RECOMMENDATIONS = ["永", "繁", "g", "B", "Q", "5", "@"];

function hexToRgba(hex: string, opacity: number) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}

interface SingleGlyphData {
  pathData: string;
  points: { x: number; y: number; type: "anchor" | "control" }[];
  lines: { x1: number; y1: number; x2: number; y2: number }[];
  unitsPerEm: number;
  scale: number;
  xOffset: number;
  yOffset: number;
  char: string;
  advanceValue: number;
  error?: boolean;
}

export default function MicroContourDiff({
  baseFont,
  compFont,
  baseFontName,
  compFontName
}: MicroContourDiffProps) {
  // Input string
  const [inputText, setInputText] = useState<string>("永");
  
  // Controls
  const [alignMode, setAlignMode] = useState<"metrics" | "optical">("optical");
  const [layoutMode, setLayoutMode] = useState<"side-by-side" | "overlay">("overlay");
  
  const [sharedViewBox, setSharedViewBox] = useState({ x: 0, y: 0, w: 1000, h: 1000 });
  
  React.useEffect(() => {
    setSharedViewBox({ x: 0, y: 0, w: 1000, h: 1000 });
  }, [inputText, alignMode, layoutMode]);
  const [showFill, setShowFill] = useState<boolean>(true);
  const [showStroke, setShowStroke] = useState<boolean>(true);
  const [showNodes, setShowNodes] = useState<boolean>(true);
  const [baseOpacity, setBaseOpacity] = useState<number>(45); // 0-100
  const [compOpacity, setCompOpacity] = useState<number>(45);   // 0-100

  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showBaseline, setShowBaseline] = useState<boolean>(true);

  const [baseColorHex, setBaseColorHex] = useState<string>("#3b82f6");
  const [compColorHex, setCompColorHex] = useState<string>("#ec4899");
  
  // Inspection coordinates hover state
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);

  // Parse letters to character array (skip empty spacings to avoid rendering blank boxes)
  const characters = useMemo(() => {
    return Array.from(inputText).filter((c: string) => c.trim() !== "");
  }, [inputText]);

  // Safe fetch function for a single character inside its box index
  const getSingleGlyphDetails = (
    font: opentype.Font | null,
    char: string,
    align: "metrics" | "optical"
  ): SingleGlyphData | null => {
    if (!font || !char) return null;
    try {
      const glyph = font.charToGlyph(char);
      const unitsPerEm = font.unitsPerEm || 1000;
      
      // Standard scale factors: let the character fill ~76% of its 1000x1000 workspace
      const targetSize = 760;
      const scale = targetSize / unitsPerEm;
      const fontSize = targetSize;

      let xMin = 0;
      let yMin = 0;
      let xMax = unitsPerEm;
      let yMax = unitsPerEm;

      try {
        const rawBbox = glyph.getBoundingBox() as any;
        if (rawBbox) {
          xMin = rawBbox.xMin !== undefined ? rawBbox.xMin : (rawBbox.x1 !== undefined ? rawBbox.x1 : 0);
          yMin = rawBbox.yMin !== undefined ? rawBbox.yMin : (rawBbox.y1 !== undefined ? rawBbox.y1 : 0);
          xMax = rawBbox.xMax !== undefined ? rawBbox.xMax : (rawBbox.x2 !== undefined ? rawBbox.x2 : unitsPerEm);
          yMax = rawBbox.yMax !== undefined ? rawBbox.yMax : (rawBbox.y2 !== undefined ? rawBbox.y2 : unitsPerEm);
        }
      } catch (e) {
        console.warn("Bounding box retrieval ignored for char:", char, e);
      }

      let xOffset = 0;
      let yOffset = 720; // Default typographic baseline at Y: 720

      const advanceRaw = glyph.advanceWidth !== undefined ? glyph.advanceWidth : unitsPerEm;
      const advanceScaled = advanceRaw * scale;

      if (align === "optical") {
        // Center the active bounding box within index's 1000 coordinate square
        const glyphCenterX = (xMin + xMax) / 2;
        const glyphCenterY = (yMin + yMax) / 2;
        xOffset = 500 - scale * glyphCenterX;
        yOffset = 500 + scale * glyphCenterY; // Y coords invert downwards in SVG orientation
      } else {
        // Center horizontally based on advance width with uniform baseline mapping
        xOffset = (1000 - advanceScaled) / 2;
        yOffset = 720;
      }

      // Use raw glyph path instead of font.getPath to have full control over the coordinate system
      const rawPath = glyph.path;
      const pointsList: { x: number; y: number; type: "anchor" | "control" }[] = [];
      const linesList: { x1: number; y1: number; x2: number; y2: number }[] = [];
      
      let currentX = 0;
      let currentY = 0;
      let startX = 0;
      let startY = 0;
      let pathData = "";

      const mapX = (x: number) => xOffset + x * scale;
      const mapY = (y: number) => yOffset - y * scale; // Invert Y for SVG

      rawPath.commands.forEach((cmd: any) => {
        if (cmd.type === "M") {
          const mx = mapX(cmd.x);
          const my = mapY(cmd.y);
          currentX = mx;
          currentY = my;
          startX = mx;
          startY = my;
          pointsList.push({ x: mx, y: my, type: "anchor" });
          pathData += `M ${mx} ${my} `;
        } else if (cmd.type === "L") {
          const lx = mapX(cmd.x);
          const ly = mapY(cmd.y);
          currentX = lx;
          currentY = ly;
          pointsList.push({ x: lx, y: ly, type: "anchor" });
          pathData += `L ${lx} ${ly} `;
        } else if (cmd.type === "Q") {
          const cx = mapX(cmd.x1);
          const cy = mapY(cmd.y1);
          const lx = mapX(cmd.x);
          const ly = mapY(cmd.y);
          linesList.push({ x1: currentX, y1: currentY, x2: cx, y2: cy });
          linesList.push({ x1: lx, y1: ly, x2: cx, y2: cy });
          pointsList.push({ x: cx, y: cy, type: "control" });
          pointsList.push({ x: lx, y: ly, type: "anchor" });
          currentX = lx;
          currentY = ly;
          pathData += `Q ${cx} ${cy} ${lx} ${ly} `;
        } else if (cmd.type === "C") {
          const cx1 = mapX(cmd.x1);
          const cy1 = mapY(cmd.y1);
          const cx2 = mapX(cmd.x2);
          const cy2 = mapY(cmd.y2);
          const lx = mapX(cmd.x);
          const ly = mapY(cmd.y);
          linesList.push({ x1: currentX, y1: currentY, x2: cx1, y2: cy1 });
          linesList.push({ x1: lx, y1: ly, x2: cx2, y2: cy2 });
          pointsList.push({ x: cx1, y: cy1, type: "control" });
          pointsList.push({ x: cx2, y: cy2, type: "control" });
          pointsList.push({ x: lx, y: ly, type: "anchor" });
          currentX = lx;
          currentY = ly;
          pathData += `C ${cx1} ${cy1} ${cx2} ${cy2} ${lx} ${ly} `;
        } else if (cmd.type === "Z") {
          currentX = startX;
          currentY = startY;
          pathData += `Z `;
        }
      });

      return {
        pathData,
        points: pointsList,
        lines: linesList,
        unitsPerEm,
        scale,
        xOffset,
        yOffset,
        char,
        advanceValue: advanceScaled
      };
    } catch (err) {
      console.warn("Path render bypass triggered for character:", char, err);
      // Failover returns safe fallback state to keep layout stable and show browser standard font
      return {
        pathData: "",
        points: [],
        lines: [],
        unitsPerEm: 1000,
        scale: 1,
        xOffset: 0,
        yOffset: 720,
        char,
        advanceValue: 1000,
        error: true
      };
    }
  };

  // Memoize lists of processed fonts side-by-side
  const baseGlyphsData = useMemo(() => {
    const array = characters.length > 0 ? [getSingleGlyphDetails(baseFont, characters[0], alignMode)] : [];
    return array;
  }, [characters, baseFont, alignMode]);

  const compGlyphsData = useMemo(() => {
    const array = characters.length > 0 ? [getSingleGlyphDetails(compFont, characters[0], alignMode)] : [];
    return array;
  }, [characters, compFont, alignMode]);

  const handleMouseLeave = () => {
    setHoverCoord(null);
  };

  // Export full SVG vectors
  const triggerDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateSingleSVGString = (title: string, glyphs: (SingleGlyphData | null)[], colorHex: string, opacity: number = 82) => {
    let elements = "";
    
    // 1. Background
    elements += `<rect width="1000" height="1000" fill="#ffffff"/>`;

    // 2. Grid
    if (showGrid) {
      // Simple 100x100 grid for export
      for (let i = 100; i < 1000; i += 100) {
        elements += `\n  <line x1="${i}" y1="0" x2="${i}" y2="1000" stroke="#f1f5f9" stroke-width="1"/>`;
        elements += `\n  <line x1="0" y1="${i}" x2="1000" y2="${i}" stroke="#f1f5f9" stroke-width="1"/>`;
      }
      elements += `\n  <line x1="500" y1="0" x2="500" y2="1000" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="5,5" />`;
    }

    // 3. Baseline
    if (showBaseline) {
      elements += `\n  <line x1="0" y1="720" x2="1000" y2="720" stroke="#f43f5e" stroke-width="2" stroke-dasharray="5,5" />`;
    }

    // 4. Paths
    glyphs.forEach((gl) => {
      if (!gl || !gl.pathData) return;
      const fillVal = showFill ? colorHex : "none";
      const fillOpacity = showFill ? (opacity / 100) : 0;
      const strokeVal = showStroke ? colorHex : (showFill ? "none" : "#333333");
      elements += `\n  <path d="${gl.pathData}" fill-rule="nonzero" fill="${fillVal}" fill-opacity="${fillOpacity}" stroke="${strokeVal}" stroke-width="2"/>`;
      
      // 5. Nodes
      if (showNodes && gl.points) {
        // Control lines
        if (gl.lines) {
          gl.lines.forEach((ln) => {
            elements += `\n  <line x1="${ln.x1}" y1="${ln.y1}" x2="${ln.x2}" y2="${ln.y2}" stroke="${colorHex}" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.5"/>`;
          });
        }
        // Points
        gl.points.forEach((pt) => {
          const isCtrl = pt.type === "control";
          if (isCtrl) {
            elements += `\n  <rect x="${pt.x - 2}" y="${pt.y - 2}" width="4" height="4" fill="#ffffff" stroke="${colorHex}" stroke-width="0.5" transform="rotate(45 ${pt.x} ${pt.y})"/>`;
          } else {
            elements += `\n  <circle cx="${pt.x}" cy="${pt.y}" r="2.5" fill="${colorHex}"/>`;
          }
        });
      }
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  ${elements}
  <text x="30" y="50" font-family="sans-serif" font-weight="bold" font-size="20" fill="#666666" opacity="0.8">${title} | "${inputText}"</text>
</svg>`;
  };

  const generateCompositeSVGString = () => {
    let elements = "";
    
    // 1. Background
    elements += `<rect width="1000" height="1000" fill="#f8fafc"/>`;

    // 2. Grid
    if (showGrid) {
      for (let i = 100; i < 1000; i += 100) {
        elements += `\n  <line x1="${i}" y1="0" x2="${i}" y2="1000" stroke="#f1f5f9" stroke-width="1"/>`;
        elements += `\n  <line x1="0" y1="${i}" x2="1000" y2="${i}" stroke="#f1f5f9" stroke-width="1"/>`;
      }
      elements += `\n  <line x1="500" y1="0" x2="500" y2="1000" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4,4" />`;
    }

    // 3. Baseline
    if (showBaseline) {
      elements += `\n  <line x1="0" y1="720" x2="1000" y2="720" stroke="#f43f5e" stroke-width="2" stroke-dasharray="4,4" />`;
    }

    // 4. Base Paths
    baseGlyphsData.forEach((gl) => {
      if (gl?.pathData) {
        const fillVal = showFill ? baseColorHex : "none";
        const fillOpacity = showFill ? (baseOpacity / 100) : 0;
        const strokeVal = showStroke ? baseColorHex : "none";
        elements += `\n  <path d="${gl.pathData}" fill-rule="nonzero" fill="${fillVal}" fill-opacity="${fillOpacity}" stroke="${strokeVal}" stroke-width="2"/>`;
        
        if (showNodes && gl.points) {
          if (gl.lines) {
            gl.lines.forEach((ln) => {
              elements += `\n  <line x1="${ln.x1}" y1="${ln.y1}" x2="${ln.x2}" y2="${ln.y2}" stroke="${baseColorHex}" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.3"/>`;
            });
          }
          gl.points.forEach((pt) => {
            const isCtrl = pt.type === "control";
            if (isCtrl) {
              elements += `\n  <rect x="${pt.x - 1.5}" y="${pt.y - 1.5}" width="3" height="3" fill="#ffffff" stroke="${baseColorHex}" stroke-width="0.5" transform="rotate(45 ${pt.x} ${pt.y})" opacity="0.4"/>`;
            } else {
              elements += `\n  <circle cx="${pt.x}" cy="${pt.y}" r="2" fill="${baseColorHex}" opacity="0.6"/>`;
            }
          });
        }
      }
    });

    // 5. Comp Paths
    compGlyphsData.forEach((gl) => {
      if (gl?.pathData) {
        const fillVal = showFill ? compColorHex : "none";
        const fillOpacity = showFill ? (compOpacity / 100) : 0;
        const strokeVal = showStroke ? compColorHex : "none";
        elements += `\n  <path d="${gl.pathData}" fill-rule="nonzero" fill="${fillVal}" fill-opacity="${fillOpacity}" stroke="${strokeVal}" stroke-width="2"/>`;

        if (showNodes && gl.points) {
          if (gl.lines) {
            gl.lines.forEach((ln) => {
              elements += `\n  <line x1="${ln.x1}" y1="${ln.y1}" x2="${ln.x2}" y2="${ln.y2}" stroke="${compColorHex}" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.3"/>`;
            });
          }
          gl.points.forEach((pt) => {
            const isCtrl = pt.type === "control";
            if (isCtrl) {
              elements += `\n  <rect x="${pt.x - 1.5}" y="${pt.y - 1.5}" width="3" height="3" fill="#ffffff" stroke="${compColorHex}" stroke-width="0.5" transform="rotate(45 ${pt.x} ${pt.y})" opacity="0.4"/>`;
            } else {
              elements += `\n  <circle cx="${pt.x}" cy="${pt.y}" r="2" fill="${compColorHex}" opacity="0.6"/>`;
            }
          });
        }
      }
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  ${elements}
  <text x="30" y="50" font-family="sans-serif" font-weight="bold" font-size="24" fill="#0f172a">微观轮廓叠层对比</text>
  <text x="30" y="85" font-family="sans-serif" font-size="16" fill="#64748b">包含单字: "${inputText}"</text>
  <text x="30" y="940" font-family="sans-serif" font-size="14" fill="#475569">基准 (蓝): ${baseFontName}</text>
  <text x="30" y="965" font-family="sans-serif" font-size="14" fill="#475569">对比 (粉): ${compFontName}</text>
</svg>`;
  };

  const textLength = Math.max(1, characters.length);

  return (
    <div id="micro_diff_root" className="bg-white rounded-lg border border-neutral-200/80 overflow-hidden flex flex-col mb-6">
      {/* Header wrapper section - clean, professional boundary, layout, colors */}
      <div className="border-b border-neutral-100 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-neutral-50/50 to-white">
        <div>
          <h3 className="text-sm font-bold font-sans tracking-wide text-neutral-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>单字微观轮廓 Diff</span>
          </h3>
        </div>

        <button
          onClick={() => setSharedViewBox({ x: 0, y: 0, w: 1000, h: 1000 })}
          className="bg-white border border-neutral-200 hover:bg-neutral-50 hover:border-blue-400 hover:text-blue-600 px-3 py-1.5 rounded-lg text-neutral-600 transition-all flex items-center gap-2 text-[11px] font-bold select-none cursor-pointer"
          title="重置视图 / 适应窗口"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>适应窗口/重置</span>
        </button>
      </div>

      {/* Input query form and templates */}
      <div className="px-6 py-4 border-b border-neutral-100/60 bg-neutral-50/10 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-6 relative">
            <label className="absolute -top-2 left-2.5 px-1 bg-white text-[9px] text-neutral-500 font-bold uppercase tracking-wider">输入比对单字</label>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="请输入想查看比对的单字/拼音..."
              className="w-full bg-white border border-neutral-200 rounded-lg px-3.5 py-2.5 font-sans text-sm font-semibold select-all text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs"
            />
          </div>
          
          <div className="md:col-span-6 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-neutral-400 font-bold shrink-0 uppercase tracking-widest mr-1">推荐测试点:</span>
            {RECOMMENDATIONS.map(char => (
              <button
                key={char}
                onClick={() => setInputText(char)}
                className={`px-2.5 py-1 rounded-lg flex items-center justify-center text-xs font-semibold transition-all border shrink-0 ${
                  inputText === char
                    ? "bg-blue-50 border-blue-200 text-blue-600 shadow-sm"
                    : "bg-white border-neutral-200/80 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {char}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Primary configuration grid and sandbox renderer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
        {/* Left Control Column: 4 grid-cols */}
        <div className="lg:col-span-4 border-r border-neutral-100 p-6 bg-neutral-50/25 flex flex-col justify-between gap-6">
          <div className="space-y-6">
            {/* View Layout Switcher */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold text-neutral-400 font-mono uppercase tracking-widest block font-bold">排列布局视角</span>
              <div className="flex bg-neutral-100 p-0.5 rounded-lg select-none shrink-0 border border-neutral-200/50 relative">
                {(["overlay", "side-by-side"] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setLayoutMode(mode)}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors relative z-10 ${
                      layoutMode === mode
                        ? "text-neutral-900"
                        : "text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    {layoutMode === mode && (
                      <motion.div
                        layoutId="layout-pill"
                        className="absolute inset-0 bg-white rounded shadow-2xs z-[-1]"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                      />
                    )}
                    {mode === "overlay" ? (
                      <><Layers className="w-3.5 h-3.5" /><span>无缝叠层</span></>
                    ) : (
                      <><Columns className="w-3.5 h-3.5" /><span>左右对比</span></>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Align & Spacing Modes */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold text-neutral-400 font-mono uppercase tracking-widest block font-bold">排版对齐模式</span>
              <div className="flex bg-neutral-100 p-0.5 rounded-lg select-none shrink-0 border border-neutral-200/50 relative">
                {(["optical", "metrics"] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setAlignMode(mode)}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors relative z-10 ${
                      alignMode === mode
                        ? "text-neutral-900"
                        : "text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    {alignMode === mode && (
                      <motion.div
                        layoutId="align-pill"
                        className="absolute inset-0 bg-white rounded shadow-2xs z-[-1]"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                      />
                    )}
                    {mode === "optical" ? (
                      <><Maximize2 className="w-3.5 h-3.5" /><span>光学居中</span></>
                    ) : (
                      <><Settings className="w-3.5 h-3.5" /><span>基线对齐</span></>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Path Material Visibility Toggles */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-extrabold text-neutral-400 font-mono uppercase tracking-widest block font-bold">矢量材质层开关</span>
              <div className="space-y-2 bg-white rounded-lg p-3 border border-neutral-200/50">
                <label className="flex items-center justify-between cursor-pointer select-none text-xs text-neutral-600">
                  <span className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 bg-neutral-400 rounded-2xs" />
                    <span>纯色底色填充 (Fill)</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={showFill}
                    onChange={(e) => setShowFill(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
                
                <label className="flex items-center justify-between cursor-pointer select-none text-xs text-neutral-600 pt-2 border-t border-neutral-100">
                  <span className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-neutral-500 rounded-2xs" />
                    <span>高精边缘描边 (Outlines)</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={showStroke}
                    onChange={(e) => setShowStroke(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer select-none text-xs text-neutral-600 pt-2 border-t border-neutral-100">
                  <span className="flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="font-semibold select-none">控制贝塞尔锚点 (Bézier Nodes)</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={showNodes}
                    onChange={(e) => setShowNodes(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Translucent blinder slider options */}
            {layoutMode === "overlay" && (
              <div className="space-y-2.5">
                <span className="text-[10px] font-extrabold text-neutral-400 font-mono uppercase tracking-widest block font-bold">层叠通道视效控制</span>
                <div className="space-y-5 bg-white rounded-lg p-4 border border-neutral-200/50">
                  <div className="space-y-4 flex items-center gap-4">
                    <input 
                      type="color" 
                      value={baseColorHex} 
                      onChange={(e) => setBaseColorHex(e.target.value)} 
                      className="w-10 h-10 shrink-0 cursor-pointer p-0 border-0 bg-transparent block" 
                    />
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex justify-between items-end">
                        <span className="text-[11px] text-neutral-700 font-bold truncate max-w-[140px]" title={baseFontName}>{baseFontName}</span>
                        <span className="text-[10px] text-neutral-400 font-mono font-bold tracking-tighter">{baseOpacity}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={baseOpacity}
                        onChange={(e) => setBaseOpacity(Number(e.target.value))}
                        className="w-full h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-neutral-500 hover:accent-neutral-700 transition-all border border-neutral-200/30"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 flex items-center gap-4 pt-4 border-t border-neutral-100">
                    <input 
                      type="color" 
                      value={compColorHex} 
                      onChange={(e) => setCompColorHex(e.target.value)} 
                      className="w-10 h-10 shrink-0 cursor-pointer p-0 border-0 bg-transparent block" 
                    />
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex justify-between items-end">
                        <span className="text-[11px] text-neutral-700 font-bold truncate max-w-[140px]" title={compFontName}>{compFontName}</span>
                        <span className="text-[10px] text-neutral-400 font-mono font-bold tracking-tighter">{compOpacity}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={compOpacity}
                        onChange={(e) => setCompOpacity(Number(e.target.value))}
                        className="w-full h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-neutral-500 hover:accent-neutral-700 transition-all border border-neutral-200/30"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Grid & Baseline Toggles */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-extrabold text-neutral-400 font-mono uppercase tracking-widest block font-bold">辅助准星参考线</span>
              <div className="space-y-2 bg-white rounded-lg p-3 border border-neutral-200/50">
                <label className="flex items-center justify-between cursor-pointer select-none text-xs text-neutral-600">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold select-none">显示坐标网格线</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer select-none text-xs text-neutral-600 pt-2 border-t border-neutral-100">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold select-none">显示基准线</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={showBaseline}
                    onChange={(e) => setShowBaseline(e.target.checked)}
                    className="rounded text-red-500 focus:ring-red-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Export Assets / Vectors Section */}
          <div className="space-y-2.5 pt-4 border-t border-neutral-200/40">
            <span className="text-[10px] font-extrabold text-neutral-400 font-mono uppercase tracking-widest block font-bold">矢量资产导出</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={baseGlyphsData.length === 0 || !baseFont}
                onClick={() => triggerDownload(`string_base.svg`, generateSingleSVGString(baseFontName, baseGlyphsData, baseColorHex, 82))}
                className="flex items-center justify-center gap-1 border border-neutral-200 bg-white hover:bg-neutral-50 text-[11px] font-bold text-neutral-700 py-2 rounded-md transition-all select-none cursor-pointer disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>基准 SVG</span>
              </button>
              
              <button
                disabled={compGlyphsData.length === 0 || !compFont}
                onClick={() => triggerDownload(`string_compare.svg`, generateSingleSVGString(compFontName, compGlyphsData, compColorHex, 82))}
                className="flex items-center justify-center gap-1 border border-neutral-200 bg-white hover:bg-neutral-50 text-[11px] font-bold text-neutral-700 py-2 rounded-md transition-all select-none cursor-pointer disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                <span>对比 SVG</span>
              </button>
            </div>

            {layoutMode === "overlay" && (
              <button
                disabled={baseGlyphsData.length === 0 || compGlyphsData.length === 0 || !baseFont || !compFont}
                onClick={() => triggerDownload(`string_overlay_composite.svg`, generateCompositeSVGString())}
                className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-3 rounded-md transition-all select-none cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span>导出叠层 Composite SVG</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Canvas Container: Borderless infinite grid effect */}
        <div className="lg:col-span-8 bg-white relative overflow-hidden flex flex-col min-h-[500px] border-l border-neutral-200/50">
          
          <div className="flex-1 w-full relative">
            {layoutMode === "overlay" ? (
              // 1. Unified Overlay View
              <div className="w-full h-full absolute inset-0">
                {renderGlyphCanvas("overlay", baseGlyphsData, compGlyphsData)}
              </div>
            ) : (
              // 2. Side-By-Side horizontal layout
              <div className="w-full h-full absolute inset-0 flex divide-x divide-neutral-200/80">
                <div className="flex-1 h-full relative">
                  {renderGlyphCanvas("base-only", baseGlyphsData, [])}
                </div>
                <div className="flex-1 h-full relative">
                  {renderGlyphCanvas("comp-only", [], compGlyphsData)}
                </div>
              </div>
            )}
          </div>

          {/* Coordinate inspection metrics tracker fixed at bottom */}
          <div className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-white/80 backdrop-blur-md border-t border-neutral-200/50 flex justify-between items-center text-[10px] text-neutral-400 font-mono select-none z-20">
            <div className="flex items-center gap-4 font-bold text-neutral-500">
              <span className="flex items-center gap-1.5">
                <MousePointer className="w-3.5 h-3.5 text-neutral-400" />
                <span>探针坐标: {hoverCoord ? <span className="text-blue-600 font-extrabold">X: {hoverCoord.x} / Y: {hoverCoord.y}</span> : <span className="text-neutral-400 font-medium font-bold">滑动于画布</span>}</span>
              </span>
              
              {layoutMode === "overlay" && (
                <span className="flex items-center gap-2 font-normal text-[9.5px]">
                  <span className="inline-block w-2 h-2 rounded bg-blue-500/20 border border-blue-500" />
                  <span>基准: {baseFontName}</span>
                  <span className="mx-1 text-neutral-300">|</span>
                  <span className="inline-block w-2 h-2 rounded bg-pink-500/20 border border-pink-500" />
                  <span>对比: {compFontName}</span>
                </span>
              )}
            </div>

            <span className="text-right text-[9.5px] text-neutral-400">
              * 按住 Ctrl / Cmd 键加鼠标滚轮可同步缩放，按住鼠标左键拖拽可同步平移画布。
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // SVG Renderer helper for multiple characters
  function renderGlyphCanvas(
    type: "overlay" | "base-only" | "comp-only",
    baseArray: (SingleGlyphData | null)[],
    compArray: (SingleGlyphData | null)[],
  ) {
    const N = textLength;

    // Check if both dataset lists are totally empty
    const hasBase = baseArray.some(x => x && x.pathData);
    const hasComp = compArray.some(x => x && x.pathData);

    if ((type === "overlay" && !hasBase && !hasComp) ||
        (type === "base-only" && !hasBase) ||
        (type === "comp-only" && !hasComp)) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center text-neutral-400 text-xs">
          <HelpCircle className="w-8 h-8 text-neutral-300 mb-2" />
          <span>待检测字符在当前字库未被完整包含，或解析尚未就绪</span>
        </div>
      );
    }

    const baseColor = hexToRgba(baseColorHex, baseOpacity);
    const compColor = hexToRgba(compColorHex, compOpacity);
    
    // Check if nodes should be scaled down for dense texts
    const limitDensity = false;

    return (
      <InteractiveSVG
        viewBox={sharedViewBox}
        onChangeViewBox={setSharedViewBox}
        onHoverCoord={setHoverCoord}
        onHoverLeave={handleMouseLeave}
      >
        <defs>
          {/* Grid pattern applied across full width of the block */}
          <pattern id="micro_grid_pattern_refined_seq" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(224, 224, 224, 0.35)" strokeWidth="0.5" />
          </pattern>
        </defs>

        {/* 1. Subtle horizontal technical grid background spanning infinitely */}
        {showGrid && <rect x="-5000" y="-5000" width="11000" height="11000" fill="url(#micro_grid_pattern_refined_seq)" />}

        {/* 2. Map structural grid lines and baselines for each box sequence */}
        {showGrid && (
            <g key={`character-box-0`}>
              {/* Inner auxiliary grids for this sub-square */}
              {[100, 200, 300, 400, 500, 600, 700, 800, 900].map(line => (
                <g key={`aux-0-${line}`}>
                  {/* Vertical coordinate lines */}
                  <line
                    x1={line}
                    y1="-5000"
                    x2={line}
                    y2="6000"
                    stroke={line === 500 ? "rgba(100, 116, 139, 0.25)" : "rgba(100, 116, 139, 0.08)"}
                    strokeWidth={line === 500 ? "1" : "0.5"}
                    strokeDasharray={line === 500 ? "none" : "3,3"}
                  />
                  {/* Horizontal coordinate lines */}
                  <line
                    x1="-5000"
                    y1={line}
                    x2="6000"
                    y2={line}
                    stroke={line === 500 ? "rgba(100, 116, 139, 0.25)" : "rgba(100, 116, 139, 0.08)"}
                    strokeWidth={line === 500 ? "1" : "0.5"}
                    strokeDasharray={line === 500 ? "none" : "3,3"}
                  />
                </g>
              ))}
            </g>
        )}

        {/* 3. Global Typographic horizontal Baseline line (RED) across all sequences */}
        {showBaseline && (
          <g>
            <line
              x1="-5000"
              y1="720"
              x2="6000"
              y2="720"
              stroke="rgba(239, 68, 68, 0.6)"
              strokeWidth="2.5"
              strokeDasharray="4,4"
            />
          </g>
        )}

        {/* 4. Render Base Font paths across all active frames */}
        {type !== "comp-only" && baseArray.map((gl, boxIdx) => {
          if (!gl) return null;
          
          // Render browser text fallback if Cmap failed for this specific char
          if (gl.error) {
            return (
              <g key={`base-error-${boxIdx}`} className="select-none pointer-events-none">
                <text x={boxIdx * 1000 + 500} y={540} textAnchor="middle" fill="#9ca3af" fontSize="220" fontWeight="bold" opacity="0.3" fontFamily="sans-serif">
                  {gl.char}
                </text>
                <text x={boxIdx * 1000 + 500} y={660} textAnchor="middle" fill="#ef4444" fontSize="28" fontWeight="bold" opacity="0.6" fontFamily="sans-serif">
                  (字库矢量溢出 / 编码缺失)
                </text>
              </g>
            );
          }

          return (
            <g key={`base-gl-${boxIdx}`}>
              {showFill && gl.pathData && (
                <path
                  d={gl.pathData}
                  fill={baseColor}
                  fillRule="nonzero"
                  style={{ mixBlendMode: type === "overlay" ? "multiply" : "normal" }}
                  className="transition-colors duration-200"
                />
              )}
              {showStroke && gl.pathData && (
                <path
                  d={gl.pathData}
                  fill="none"
                  stroke={baseColorHex}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.8}
                />
              )}
            </g>
          );
        })}

        {/* 5. Render Comparison Font paths across all active frames */}
        {type !== "base-only" && compArray.map((gl, boxIdx) => {
          if (!gl) return null;

          // Render browser text fallback if Cmap failed for this specific char
          if (gl.error) {
            return (
              <g key={`comp-error-${boxIdx}`} className="select-none pointer-events-none">
                {type === "comp-only" && (
                  <>
                    <text x={boxIdx * 1000 + 500} y={540} textAnchor="middle" fill="#9ca3af" fontSize="220" fontWeight="bold" opacity="0.3" fontFamily="sans-serif">
                      {gl.char}
                    </text>
                    <text x={boxIdx * 1000 + 500} y={660} textAnchor="middle" fill="#ef4444" fontSize="28" fontWeight="bold" opacity="0.6" fontFamily="sans-serif">
                      (字库矢量溢出 / 编码缺失)
                    </text>
                  </>
                )}
              </g>
            );
          }

          return (
            <g key={`comp-gl-${boxIdx}`}>
              {showFill && gl.pathData && (
                <path
                  d={gl.pathData}
                  fill={compColor}
                  fillRule="nonzero"
                  style={{ mixBlendMode: type === "overlay" ? "multiply" : "normal" }}
                  className="transition-colors duration-200"
                />
              )}
              {showStroke && gl.pathData && (
                <path
                  d={gl.pathData}
                  fill="none"
                  stroke={compColorHex}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.8}
                />
              )}
            </g>
          );
        })}

        {/* 6. Bézier Points/Nodes layer */}
        {showNodes && (
          <g id="bezier-nodes-layer">
            {/* Base Nodes: Drawn as beautiful dark-blue circles */}
            {type !== "comp-only" && baseArray.map((gl, boxIdx) => {
              if (!gl || !gl.points) return null;
              return (
                <g key={`base-pts-${boxIdx}`} opacity={limitDensity ? 0.45 : 0.95}>
                  {/* Bezier control lines */}
                  {gl.lines && gl.lines.map((ln, lIdx) => (
                    <line
                      key={`base-line-${boxIdx}-${lIdx}`}
                      x1={ln.x1}
                      y1={ln.y1}
                      x2={ln.x2}
                      y2={ln.y2}
                      stroke={baseColorHex}
                      strokeWidth="0.75"
                      strokeDasharray="2,2"
                      opacity={0.6}
                      className="pointer-events-none"
                    />
                  ))}
                  {/* Bezier points */}
                  {gl.points.map((pt, pIdx) => {
                    const isCtrl = pt.type === "control";
                    if (limitDensity && isCtrl) return null;
                    return (
                      <circle
                        key={`base-pt-${boxIdx}-${pIdx}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={isCtrl ? 2 : (limitDensity ? 2 : 3.5)}
                        fill={isCtrl ? "#ffffff" : baseColorHex}
                        stroke={baseColorHex}
                        strokeWidth={isCtrl ? 0.75 : (limitDensity ? 0.5 : 1)}
                        className="pointer-events-none"
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Comparison Nodes: Drawn as beautiful pink squares */}
            {type !== "base-only" && compArray.map((gl, boxIdx) => {
              if (!gl || !gl.points) return null;
              return (
                <g key={`comp-pts-${boxIdx}`} opacity={limitDensity ? 0.45 : 0.95}>
                  {/* Bezier control lines */}
                  {gl.lines && gl.lines.map((ln, lIdx) => (
                    <line
                      key={`comp-line-${boxIdx}-${lIdx}`}
                      x1={ln.x1}
                      y1={ln.y1}
                      x2={ln.x2}
                      y2={ln.y2}
                      stroke={compColorHex}
                      strokeWidth="0.75"
                      strokeDasharray="2,2"
                      opacity={0.6}
                      className="pointer-events-none"
                    />
                  ))}
                  {/* Bezier points */}
                  {gl.points.map((pt, pIdx) => {
                    const isCtrl = pt.type === "control";
                    if (limitDensity && isCtrl) return null;

                    const size = isCtrl ? 4 : (limitDensity ? 4 : 6);
                    const offset = size / 2;
                    return (
                      <rect
                        key={`comp-pt-${boxIdx}-${pIdx}`}
                        x={pt.x - offset}
                        y={pt.y - offset}
                        width={size}
                        height={size}
                        fill={isCtrl ? "#ffffff" : compColorHex}
                        stroke={compColorHex}
                        strokeWidth={isCtrl ? 0.75 : (limitDensity ? 0.5 : 1)}
                        transform={isCtrl ? `rotate(45 ${pt.x} ${pt.y})` : undefined}
                        className="pointer-events-none"
                      />
                    );
                  })}
                </g>
              );
            })}
          </g>
        )}

        {/* 7. Hover cursor locator lines */}
        {hoverCoord && (
          <g id="cursor-locator-lines" opacity={0.5} className="pointer-events-none">
            <line x1={hoverCoord.x} y1="-5000" x2={hoverCoord.x} y2="6000" stroke="#64748b" strokeWidth="0.75" strokeDasharray="2,2" />
            <line x1="-5000" y1={hoverCoord.y} x2="6000" y2={hoverCoord.y} stroke="#64748b" strokeWidth="0.75" strokeDasharray="2,2" />
            <circle cx={hoverCoord.x} cy={hoverCoord.y} r="3.5" fill="#f43f5e" />
          </g>
        )}
      </InteractiveSVG>
    );
  }
}

function InteractiveSVG({ 
  viewBox,
  onChangeViewBox,
  onHoverCoord, 
  onHoverLeave, 
  children 
}: { 
  viewBox: {x: number, y: number, w: number, h: number},
  onChangeViewBox: (v: {x: number, y: number, w: number, h: number}) => void,
  onHoverCoord: (coord: {x: number, y: number}) => void, 
  onHoverLeave: () => void, 
  children: React.ReactNode 
}) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [isPanning, setIsPanning] = React.useState(false);
  const panStart = React.useRef({ x: 0, y: 0, viewBoxX: 0, viewBoxY: 0 });

  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        
        const rect = svg.getBoundingClientRect();
        const currentW = viewBox.w;
        const currentH = viewBox.h;
        const currentX = viewBox.x;
        const currentY = viewBox.y;

        const pointerX = currentX + ((e.clientX - rect.left) / rect.width) * currentW;
        const pointerY = currentY + ((e.clientY - rect.top) / rect.height) * currentH;

        const zoomFactor = Math.pow(1.002, e.deltaY);

        let newW = currentW * zoomFactor;
        let newH = currentH * zoomFactor;

        if (newW > 2000) { newW = 2000; }
        if (newW < 20) { newW = 20; }
        newH = newW; // Force 1:1 aspect ratio matching the grid (1000:1000)

        const newX = pointerX - (pointerX - currentX) * (newW / currentW);
        const newY = pointerY - (pointerY - currentY) * (newH / currentH);

        onChangeViewBox({ x: newX, y: newY, w: newW, h: newH });
      }
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [viewBox, onChangeViewBox]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, viewBoxX: viewBox.x, viewBoxY: viewBox.y };
    }
  };

  const handlePointerUp = () => {
    setIsPanning(false);
  };

  const handlePointerMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    
    if (isPanning) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;

      const mappedDx = dx * (viewBox.w / rect.width);
      const mappedDy = dy * (viewBox.h / rect.height);

      onChangeViewBox({
        ...viewBox,
        x: panStart.current.viewBoxX - mappedDx,
        y: panStart.current.viewBoxY - mappedDy,
      });
      return;
    }

    const pxX = (e.clientX - rect.left) / rect.width;
    const pxY = (e.clientY - rect.top) / rect.height;

    const svgX = viewBox.x + pxX * viewBox.w;
    const svgY = viewBox.y + pxY * viewBox.h;
    onHoverCoord({ x: Math.round(svgX), y: Math.round(svgY) });
  };

  return (
    <motion.svg
      ref={svgRef}
      animate={{ 
        viewBox: `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}` 
      }}
      transition={{ type: "spring", stiffness: 120, damping: 20, mass: 1 }}
      preserveAspectRatio="xMidYMid meet"
      className={`w-full h-full object-contain ${isPanning ? 'cursor-grabbing' : 'cursor-crosshair'} bg-transparent select-none`}
      onMouseDown={handleMouseDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={() => {
        handlePointerUp();
        onHoverLeave();
      }}
    >
      {children}
    </motion.svg>
  );
}
