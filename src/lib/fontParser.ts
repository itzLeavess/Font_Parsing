import * as opentype from 'opentype.js';

export async function parseFontFile(file: File): Promise<{
    fontName: string;
    buffer: ArrayBuffer | null;
    supportedChars: Set<number>;
    glyphCount: number;
    error: string | null;
}> {
    return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = function (e) {
            if (!e.target || !e.target.result) {
                resolve({ fontName: '', buffer: null, supportedChars: new Set(), glyphCount: 0, error: "Failed to read file." });
                return;
            }

            try {
                const buffer = e.target.result as ArrayBuffer;
                const font = opentype.parse(buffer);
                
                const supportedChars = new Set<number>();
                
                const fontName = font.names.fontFamily?.en || font.names.fullName?.en || file.name;
                
                let glyphCount = 0;
                // font.glyphs is an object containing length and getter
                const length = font.glyphs.length;
                for (let i = 0; i < length; i++) {
                    const glyph = font.glyphs.get(i);
                    glyphCount++;
                    if (glyph.unicode !== undefined) {
                        supportedChars.add(glyph.unicode);
                    }
                    if (glyph.unicodes && glyph.unicodes.length > 0) {
                        for (const u of glyph.unicodes) {
                            supportedChars.add(u);
                        }
                    }
                }

                resolve({
                    fontName,
                    buffer,
                    supportedChars,
                    glyphCount,
                    error: null,
                });
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                resolve({
                    fontName: '',
                    buffer: null,
                    supportedChars: new Set(),
                    glyphCount: 0,
                    error: `Font parsing failed: ${errorMsg}`,
                });
            }
        };

        reader.onerror = () => {
            resolve({ fontName: '', buffer: null, supportedChars: new Set(), glyphCount: 0, error: "Error reading file." });
        };

        reader.readAsArrayBuffer(file);
    });
}
