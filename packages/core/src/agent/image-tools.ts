/**
 * Image Tools — read_image + screenshot
 * -----------------------------------------------
 * D1 from roadmap: multimodal image input.
 *
 * read_image: workspace 内图片 → base64 → 描述 + metadata
 * screenshot: 调 Puppeteer/Sharp 截图 → base64 → 送 LLM（UI bug 排查时极有用）
 *
 * 这两个 tool 的返回值会被 Agent loop 特殊处理：
 *   当 provider 支持 multimodal（Anthropic/OpenAI）时，图片作为 content block 附到 user message；
 *   不支持 multimodal 的 provider → 只返回文字描述（用 placeholder 降级）。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Tool } from './tool-registry.js';

function resolveInside(cwd: string, p: string) {
  const abs = path.resolve(cwd, p);
  if (!abs.startsWith(path.resolve(cwd))) {
    throw new Error(`Path escapes workspace: ${p}`);
  }
  return abs;
}

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico', '.tiff', '.tif',
]);

function isImagePath(p: string): boolean {
  const ext = path.extname(p).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function getMimeType(p: string): string {
  const ext = path.extname(p).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
  };
  return map[ext] ?? 'image/png';
}

/**
 * read_image tool — 读取 workspace 内图片文件，返回 base64 + metadata。
 *
 * Agent loop 会检测 tool_result 里的 __image 字段，当 provider 支持 multimodal 时
 * 将图片附到 user message 的 content block 里（而非纯文本）。
 */
export const readImageTool: Tool = {
  name: 'read_image',
  description:
    'Read an image file from the workspace and return it as base64-encoded data with metadata.\n\n' +
    'WHEN TO USE:\n' +
    '  - You need to see a UI screenshot, design mockup, diagram, or any visual asset.\n' +
    '  - Debugging visual/UI issues — the user says "the button looks broken" and you need to see it.\n' +
    '  - Analyzing image content (icons, layouts, CSS screenshots, etc).\n\n' +
    'WHEN NOT TO USE:\n' +
    '  - For text/code files — use read_file instead.\n' +
    '  - For searching across files — use grep_search or list_files.\n\n' +
    'BEHAVIOR:\n' +
    '  - Returns the image as base64 data, plus a text description placeholder.\n' +
    '  - If the provider supports multimodal input (Anthropic/OpenAI), the image is sent as a vision content block.\n' +
    '  - If the provider does NOT support multimodal, you get only the placeholder text (file name, size, dimensions hint).\n' +
    '  - Supports: PNG, JPG, GIF, WebP, BMP, SVG, TIFF.\n' +
    '  - Maximum file size: 5MB (larger files are rejected).\n\n' +
    'PERFORMANCE: moderate (base64 encoding). parallelSafe: true.',
  parallelSafe: true,
  schema: z.object({
    path: z.string().describe('Path to image file relative to workspace'),
  }),
  async execute(input, ctx) {
    const relPath = input.path;
    const abs = resolveInside(ctx.cwd, relPath);

    // 检查是否是图片格式
    if (!isImagePath(relPath)) {
      return {
        ok: false,
        error: `Not an image file: ${relPath}. Supported formats: PNG, JPG, JPEG, GIF, WebP, BMP, SVG, TIFF.`,
        hint: 'Use read_file for text/code files.',
      };
    }

    // 检查文件是否存在
    let stat;
    try {
      stat = await fs.stat(abs);
    } catch {
      return {
        ok: false,
        error: `Image file not found: ${relPath}`,
        hint: 'Check the path; try list_files on the parent directory first.',
      };
    }

    // 大小限制（5MB）
    const MAX_SIZE = 5 * 1024 * 1024;
    if (stat.size > MAX_SIZE) {
      return {
        ok: false,
        error: `Image too large: ${(stat.size / 1024 / 1024).toFixed(1)}MB exceeds 5MB limit.`,
        hint: 'Consider resizing the image or using a smaller format (WebP/JPG).',
      };
    }

    // 读取并 base64 编码
    const buffer = await fs.readFile(abs);
    const base64 = buffer.toString('base64');
    const mimeType = getMimeType(relPath);

    // 返回 multimodal 数据 + 文字描述
    // __image 是特殊字段，Agent loop 会识别并转为 content block
    return {
      ok: true,
      content: `[image: ${relPath} (${mimeType}, ${(stat.size / 1024).toFixed(0)}KB)]`,
      __image: {
        type: 'image',
        data: base64,
        media_type: mimeType,
        path: relPath,
        size_bytes: stat.size,
      },
    };
  },
};

/**
 * screenshot tool — 截取当前编辑器区域或指定 URL 的截图。
 *
 * 当前实现：截 workspace 内的 HTML 文件（用 Puppeteer 在 headless 模式打开）。
 * 未来可扩展为截取 VSCode webview / Electron 窗口。
 *
 * 注：需要 puppeteer 包。如果没有安装，返回降级提示。
 */
export const screenshotTool: Tool = {
  name: 'screenshot',
  description:
    'Take a screenshot of a web page or local HTML file and return it as an image.\n\n' +
    'WHEN TO USE:\n' +
    '  - Debugging UI/CSS issues — "the layout looks wrong, take a screenshot of index.html".\n' +
    '  - Visual review of designs, mockups, or rendered pages.\n' +
    '  - You want to see how a web component looks in the browser.\n\n' +
    'WHEN NOT TO USE:\n' +
    '  - For reading code/text content — use read_file.\n' +
    '  - For existing image files — use read_image.\n\n' +
    'BEHAVIOR:\n' +
    '  - Takes a URL (http://...) or a local HTML file path.\n' +
    '  - Returns the screenshot as base64-encoded PNG.\n' +
    '  - If Puppeteer is not available, returns a fallback message.\n' +
    '  - Default viewport: 1280x800. Pass width/height to customize.\n\n' +
    'PERFORMANCE: moderate (Puppeteer launch + render). parallelSafe: false.',
  parallelSafe: false,
  schema: z.object({
    url: z.string().optional().describe('URL to screenshot (http:// or https://)'),
    path: z.string().optional().describe('Local HTML file path relative to workspace'),
    width: z.number().int().optional().describe('Viewport width (default 1280)'),
    height: z.number().int().optional().describe('Viewport height (default 800)'),
  }),
  async execute(input, ctx) {
    const vpWidth = input.width ?? 1280;
    const vpHeight = input.height ?? 800;

    // 确定截图目标
    let target: string;
    if (input.url) {
      target = input.url;
    } else if (input.path) {
      const abs = resolveInside(ctx.cwd, input.path);
      try {
        await fs.stat(abs);
      } catch {
        return { ok: false, error: `File not found: ${input.path}` };
      }
      target = `file://${abs}`;
    } else {
      return {
        ok: false,
        error: 'Must provide either url or path parameter.',
      };
    }

    // 尝试使用 Puppeteer
    try {
      // @ts-ignore — puppeteer 是可选依赖
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setViewport({ width: vpWidth, height: vpHeight });
      await page.goto(target, { waitUntil: 'networkidle0', timeout: 15000 });
      // 等一帧让渲染完成
      await page.waitForTimeout(500);
      const buffer = await page.screenshot({ type: 'png', fullPage: false });
      await browser.close();

      const base64 = buffer.toString('base64');
      return {
        ok: true,
        content: `[screenshot: ${target} (${vpWidth}x${vpHeight})]`,
        __image: {
          type: 'image',
          data: base64,
          media_type: 'image/png',
          path: target,
          size_bytes: buffer.length,
        },
      };
    } catch (e: any) {
      // Puppeteer 不可用 → 降级提示
      const msg = e?.message ?? String(e);
      if (msg.includes('Cannot find module') || msg.includes('puppeteer')) {
        return {
          ok: false,
          error: 'Puppeteer is not installed. Install it with: pnpm add puppeteer',
          hint: 'For local HTML files, you can also use read_image if you have a pre-rendered screenshot.',
        };
      }
      return {
        ok: false,
        error: `Screenshot failed: ${msg}`,
      };
    }
  },
};