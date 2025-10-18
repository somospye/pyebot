// Módulo minimalista y rápido para detectar si un texto es código y su lenguaje,
// normalizado a etiquetas de Markdown (```lang).
// Estrategia: heurísticas ultra rápidas -> fallback a highlight.js con set reducido.

import hljs from 'highlight.js/lib/core';

// solo lenguajes comunes para acelerar y reducir falsos positivos.
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import xml from 'highlight.js/lib/languages/xml';   // cubre HTML/XML
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
import ini from 'highlight.js/lib/languages/ini';
import yaml from 'highlight.js/lib/languages/yaml';
// import toml from 'highlight.js/lib/languages/toml';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import r from 'highlight.js/lib/languages/r';
import powershell from 'highlight.js/lib/languages/powershell';

// Registro 
const REGISTERED = (() => {
    hljs.registerLanguage('javascript', javascript);
    hljs.registerLanguage('typescript', typescript);
    hljs.registerLanguage('json', json);
    hljs.registerLanguage('python', python);
    hljs.registerLanguage('java', java);
    hljs.registerLanguage('c', c);
    hljs.registerLanguage('cpp', cpp);
    hljs.registerLanguage('csharp', csharp);
    hljs.registerLanguage('go', go);
    hljs.registerLanguage('rust', rust);
    hljs.registerLanguage('ruby', ruby);
    hljs.registerLanguage('php', php);
    hljs.registerLanguage('xml', xml);      // HLJS usa 'xml' también para HTML
    hljs.registerLanguage('css', css);
    hljs.registerLanguage('bash', bash);
    hljs.registerLanguage('ini', ini);
    hljs.registerLanguage('yaml', yaml);
    // hljs.registerLanguage('toml', toml);
    hljs.registerLanguage('sql', sql);
    hljs.registerLanguage('swift', swift);
    hljs.registerLanguage('kotlin', kotlin);
    hljs.registerLanguage('r', r);
    hljs.registerLanguage('powershell', powershell);
    return true;
})();

export type Detection = {
    isCode: boolean;
    lang: string | null;         // nombre crudo detectado (hljs o heurística)
    markdownLang: string | null; // nombre normalizado para ```markdown
    confidence: number;          // 0..1
    source: 'heuristic' | 'hljs' | 'none';
};

const MD_ALIAS: Record<string, string> = {
    js: 'javascript', javascript: 'javascript', node: 'javascript',
    ts: 'typescript', typescript: 'typescript',
    json: 'json',
    py: 'python', python: 'python',
    java: 'java',
    c: 'c',
    'c++': 'cpp', cpp: 'cpp',
    'c#': 'csharp', csharp: 'csharp', cs: 'csharp',
    go: 'go', golang: 'go',
    rs: 'rust', rust: 'rust',
    rb: 'ruby', ruby: 'ruby',
    php: 'php',
    html: 'html', xml: 'html', xhtml: 'html', // preferimos 'html' para fences
    css: 'css',
    bash: 'bash', sh: 'bash', shell: 'bash', zsh: 'bash',
    ini: 'ini', conf: 'ini',
    yaml: 'yaml', yml: 'yaml',
    toml: 'toml',
    sql: 'sql',
    swift: 'swift',
    kotlin: 'kotlin', kt: 'kotlin',
    r: 'r',
    powershell: 'powershell', ps1: 'powershell'
};

// Palabras clave rápidas por lenguaje para decisiones deterministas
const QUICK_SIGNS: Array<{ test: RegExp, md: string, boost?: number }> = [
    { test: /^\s*#!.*\b(node|nodejs)\b/m, md: 'javascript', boost: 1 },
    { test: /^\s*#!.*\bpython(?:3)?\b/m, md: 'python', boost: 1 },
    { test: /^\s*#!.*\b(bash|sh|zsh)\b/m, md: 'bash', boost: 1 },
    { test: /(^|\n)\s*<!DOCTYPE\s+html/i, md: 'html', boost: 1 },
    { test: /(<html[\s>]|<\/html>)/i, md: 'html' },
    { test: /^\s*<\?php\b/m, md: 'php', boost: 1 },
    { test: /#include\s*<[^>]+>/, md: 'cpp' },
    { test: /\bstd::\w+|->\s*std::/, md: 'cpp' },
    { test: /\bpackage\s+main\b[\s\S]*\bfunc\s+main\(/m, md: 'go' },
    { test: /\bfn\s+\w+\s*\(|\blet\s+mut\b|\bimpl\b/, md: 'rust' },
    { test: /\bdef\s+\w+\s*\(|\bimport\s+\w+|\bfrom\s+\w+\s+import\b/, md: 'python' },
    { test: /\bclass\s+\w+\s*{|^\s*public\s+(class|static)|System\.out\.println\(/m, md: 'java' },
    { test: /\busing\s+System;|Console\.WriteLine\(/, md: 'csharp' },
    { test: /\binterface\s+\w+|:\s*\w+(\s*\|\s*\w+)*\s*[{,]|as\s+\w+|type\s+\w+\s*=/, md: 'typescript' },
    { test: /\b(function|const|let|=>)\b|console\.log\(|export\s+(default|const|function)/, md: 'javascript' },
    { test: /^\s*{\s*"(?:[^"]|\\")+"\s*:/m, md: 'json' },
    { test: /^\s*SELECT\b|\bINSERT\s+INTO\b|\bUPDATE\b|\bDELETE\s+FROM\b/i, md: 'sql' },
    { test: /^\s*\w+\s*=\s*["'][^"']*["']\s*$/m, md: 'ini' },
    { test: /(^|\n)\s*-\s+\w+:\s|(^|\n)\s*\w+:\s*(\w+|["'])/m, md: 'yaml' },
    { test: /\bfunc\s+\w+\(/, md: 'go' },
    { test: /\bprint\(/, md: 'python' },
];

function normalizeToMarkdownLang(name: string | null): string | null {
    if (!name) return null;
    const key = name.toLowerCase();
    return MD_ALIAS[key] || MD_ALIAS[key.replace(/\+/g, 'p')] || null;
}

// Señal de “parece código” por patrones estructurales
function roughCodeScore(text: string): number {
    const lines = text.split(/\r?\n/);
    const nLines = lines.length;

    const symbolCount = (text.match(/[{}()[\];<>:=]/g) || []).length;
    const keywordHits = (text.match(/\b(function|def|class|import|from|package|public|private|protected|if|else|for|while|switch|case|try|catch|return|const|let|var|#include|fn|impl|struct|enum|interface)\b/gi) || []).length;
    const indented = lines.filter(l => /^\s{2,}|\t/.test(l)).length;
    const semicolons = (text.match(/;/g) || []).length;
    const angleBrackets = (text.match(/<\w+[^>]*>/g) || []).length; // HTML/XML tags

    // ponderación arbitraria, osea esto es simplemente inventado
    return keywordHits * 3 + symbolCount * 0.4 + indented * 0.5 + semicolons * 0.2 + angleBrackets * 0.6 + (nLines >= 3 ? 1 : 0);
}

function earlyHeuristic(text: string): { md: string | null; bonus: number } | null {
    for (const { test, md, boost } of QUICK_SIGNS) {
        if (test.test(text)) return { md, bonus: boost ?? 0.5 };
    }
    return null;
}

function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x; }

/**
 * Detecta si un texto es código y su lenguaje, normalizado a Markdown.
 * Rápido: heurísticas deterministas + highlight.js con set reducido.
 */
export function detectCodeLanguage(text: string): Detection {
    if (!REGISTERED) { /* noop para forzar side effect de registro */ }

    const trimmed = text.trim();

    // basura corta sin señales
    if (trimmed.length < 8 && !/[{}();<>=]/.test(trimmed)) {
        return { isCode: false, lang: null, markdownLang: null, confidence: 0.02, source: 'none' };
    }

    // Atajo heurístico determinista
    const quick = earlyHeuristic(trimmed);
    const rough = roughCodeScore(trimmed);

    if (quick) {
        const md = quick.md;
        const conf = clamp01(0.65 + quick.bonus + Math.min(rough, 8) / 20); // ~0.7..1
        return { isCode: true, lang: md, markdownLang: md, confidence: conf, source: 'heuristic' };
    }

    // Si prácticamente no hay “señal de código”, corta aquí
    if (rough < 2.5) {
        return { isCode: false, lang: null, markdownLang: null, confidence: clamp01(rough / 10), source: 'none' };
    }

    // Fallback: highlight.js auto
    const auto = hljs.highlightAuto(trimmed);
    const raw = auto.language || null;

    // hljs a veces devuelve 'xml' para HTML
    let normalized = normalizeToMarkdownLang(raw);

    // Ajuste: si hay etiquetas claras de HTML, fuerza html
    if (!normalized && /<\w+[^>]*>/.test(trimmed)) {
        normalized = 'html';
    }

    // confianza: combina relevancia hljs (0..~20) + rough score
    const rel = (auto.relevance ?? 0);
    const conf = clamp01(rel / 12 + Math.min(rough, 12) / 18);

    // si hljs no reconoce lenguaje y la señal es baja, descartar
    const isCode = !!normalized && conf >= 0.35;

    return {
        isCode,
        lang: raw,
        markdownLang: isCode ? normalized : null,
        confidence: isCode ? conf : Math.min(conf, 0.34),
        source: 'hljs'
    };
}

/**
 * Utilidad: devuelve bloque ```lang formateado si es posible determinar el lenguaje.
 */
export function toFencedBlock(text: string): string | null {
    const det = detectCodeLanguage(text);
    if (!det.isCode || !det.markdownLang) return null;
    const fence = '```' + det.markdownLang + '\n' + text.replace(/\s+$/, '') + '\n```';
    return fence;
}
