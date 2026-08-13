import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import process from 'node:process';
import ffmpegPath from 'ffmpeg-static';
import { chromium } from '@playwright/test';
import { CAPTIONS, DEMO_INPUT, EXPECTED_MAPPINGS, GEMINI_FIXED_RESPONSE } from './demo-video-data.mjs';

const root = process.cwd();
const artifacts = path.join(root, 'artifacts');
const temporary = path.join(artifacts, '.demo-video-temp');
const output = path.join(artifacts, 'mask-unmask-x-demo.mp4');
const demoFont = path.join(root, 'scripts', 'assets', 'fonts', 'NotoSansJP-wght.ttf');
const url = 'http://127.0.0.1:4173/mask-unmask/';
const demoFontUrl = 'http://127.0.0.1:4173/__demo-assets/NotoSansJP-wght.ttf';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} failed (${code ?? signal})`)));
  });
}

async function waitForServer(server) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode != null) throw new Error('Vite preview exited before becoming ready');
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await wait(250);
  }
  throw new Error('Timed out waiting for Vite preview');
}

async function addVideoChrome(page) {
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    const caption = document.createElement('div');
    caption.id = 'demo-caption';
    Object.assign(caption.style, {
      position: 'fixed', left: '50%', top: '16px', transform: 'translateX(-50%) translateY(-6px)',
      zIndex: '2147483646', padding: '9px 24px', borderRadius: '999px', opacity: '0',
      background: 'rgba(7, 18, 29, .94)', border: '1px solid rgba(52, 211, 153, .75)',
      color: '#f8fafc', fontFamily: '"Noto Sans JP Demo"', fontWeight: '700', fontSize: '20px', lineHeight: '1.35', letterSpacing: '.02em',
      boxShadow: '0 12px 35px rgba(0,0,0,.4)', transition: 'opacity .35s, transform .35s',
      pointerEvents: 'none', whiteSpace: 'nowrap'
    });
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.innerHTML = '<svg width="30" height="38" viewBox="0 0 30 38"><path d="M3 2L3 31L10 24L15 36L21 33L16 22L27 21Z" fill="white" stroke="#07121d" stroke-width="2"/></svg>';
    Object.assign(cursor.style, { position: 'fixed', left: '640px', top: '360px', zIndex: '2147483647', pointerEvents: 'none', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.7))', transition: 'left .18s linear, top .18s linear' });
    document.body.append(caption, cursor);
  });
}

async function installDemoFont(page) {
  const fontBytes = await readFile(demoFont);
  await page.route(demoFontUrl, (route) => route.fulfill({
    status: 200,
    contentType: 'font/ttf',
    body: fontBytes,
    headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
  }));
  await page.evaluate((fontUrl) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      @font-face {
        font-family: "Noto Sans JP Demo";
        src: url("${fontUrl}") format("truetype");
        font-style: normal;
        font-weight: 100 900;
        font-display: block;
      }
      html, body, input, textarea, button, select, option,
      #demo-caption, #demo-closing, #demo-closing * {
        font-family: "Noto Sans JP Demo" !important;
        font-synthesis: none !important;
      }
    `);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }, demoFontUrl);
  await page.evaluate(async () => {
    await document.fonts.load('400 16px "Noto Sans JP Demo"', '仮名化 復元 株式会社 山田太郎 進捗 確認');
    await document.fonts.load('700 24px "Noto Sans JP Demo"', '生成AIへ渡す前に、機密情報を仮名化');
    await document.fonts.ready;
    if (!document.fonts.check('400 16px "Noto Sans JP Demo"', '株式会社 山田太郎')) {
      throw new Error('Bundled Noto Sans JP did not load');
    }
  });
}

async function caption(page, text, duration = 2600) {
  await page.evaluate((value) => {
    const el = document.querySelector('#demo-caption');
    el.textContent = value;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  }, text);
  await wait(duration);
  await page.evaluate(() => {
    const el = document.querySelector('#demo-caption');
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(-6px)';
  });
  await wait(400);
}

async function withCaption(page, text, action, minimumDuration = 2100) {
  await page.evaluate((value) => {
    const el = document.querySelector('#demo-caption');
    el.textContent = value;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  }, text);
  await Promise.all([action(), wait(minimumDuration)]);
  await page.evaluate(() => {
    const el = document.querySelector('#demo-caption');
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(-6px)';
  });
  await wait(400);
}

async function moveCursor(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Cannot move cursor to a hidden element');
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + Math.min(box.height / 2, 28));
  await page.evaluate(({ x, y }) => {
    const cursor = document.querySelector('#demo-cursor');
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
  }, { x, y });
  await page.mouse.move(x, y, { steps: 12 });
  await wait(350);
}

async function selectText(page, text) {
  const input = page.locator('#mask-input');
  await moveCursor(page, input);
  await input.evaluate((element, selection) => {
    const start = element.value.indexOf(selection);
    if (start < 0) throw new Error(`Selection not found: ${selection}`);
    element.focus();
    element.setSelectionRange(start, start + selection.length);
    element.dispatchEvent(new Event('select', { bubbles: true }));
  }, text);
  await wait(900);
}

async function registerCustom(page, text) {
  await selectText(page, text);
  const field = page.locator('#custom-original');
  await field.scrollIntoViewIfNeeded();
  await wait(700);
  await moveCursor(page, field);
  // Reactのselectイベントはブラウザ版差があるため、選択を見せた後は値も明示して録画を安定化する。
  if (await field.inputValue() !== text) await field.fill(text);
  const button = page.getByRole('button', { name: '登録を追加' });
  await moveCursor(page, button);
  await button.click();
  await wait(1100);
}

async function verifyMappings(page) {
  const rows = page.locator('#panel-mask table tbody tr');
  if (await rows.count() !== EXPECTED_MAPPINGS.length) throw new Error(`Expected exactly 4 mappings, got ${await rows.count()}`);
  for (const [tag, original] of EXPECTED_MAPPINGS) {
    const row = rows.filter({ hasText: tag });
    if (await row.count() !== 1 || !(await row.innerText()).includes(original)) {
      throw new Error(`Expected mapping was not generated: ${tag} -> ${original}`);
    }
  }
  const masked = await page.locator('#mask-output').inputValue();
  for (const [tag] of EXPECTED_MAPPINGS) if (!masked.includes(tag)) throw new Error(`Masked output is missing ${tag}`);
}

async function main() {
  if (!ffmpegPath) throw new Error('ffmpeg-static does not provide a binary for this platform');
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true });
  await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: root });
  // npmを介さずViteを直接起動し、終了時に待受プロセスそのものを確実に停止する。
  const viteBinary = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
  const server = spawn(viteBinary, ['preview', '--host', '127.0.0.1'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (chunk) => process.stdout.write(chunk));
  server.stderr.on('data', (chunk) => process.stderr.write(chunk));
  let browser;
  try {
    await waitForServer(server);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: temporary, size: { width: 1280, height: 720 } } });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => sessionStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await installDemoFont(page);
    await addVideoChrome(page);
    await wait(1600);

    await caption(page, CAPTIONS.start, 2600);
    const maskInput = page.locator('#mask-input');
    await withCaption(page, CAPTIONS.pasteSource, async () => {
      await moveCursor(page, maskInput);
      await maskInput.click();
      await maskInput.pressSequentially(DEMO_INPUT, { delay: 5 });
      await wait(700);
    });

    await withCaption(page, CAPTIONS.company, () => registerCustom(page, '株式会社みらいサンプル'));
    await page.locator('#mask-input').scrollIntoViewIfNeeded();
    await wait(500);
    await withCaption(page, CAPTIONS.person, () => registerCustom(page, '山田太郎'));
    await verifyMappings(page);

    const table = page.locator('#panel-mask table');
    await withCaption(page, CAPTIONS.autoDetect, async () => {
      await table.scrollIntoViewIfNeeded();
      await moveCursor(page, table);
      await wait(1500);
    });
    await withCaption(page, CAPTIONS.maskedResult, async () => {
      await page.locator('#mask-output').scrollIntoViewIfNeeded();
      await moveCursor(page, page.locator('#mask-output'));
      await wait(1400);
    });

    await caption(page, CAPTIONS.sendToAi, 2400);
    const unmaskTab = page.locator('#tab-unmask');
    const unmaskInput = page.locator('#unmask-input');
    await withCaption(page, CAPTIONS.pasteAnswer, async () => {
      await moveCursor(page, unmaskTab);
      await unmaskTab.click();
      await wait(700);
      await moveCursor(page, unmaskInput);
      await unmaskInput.click();
      await unmaskInput.pressSequentially(GEMINI_FIXED_RESPONSE, { delay: 4 });
      await wait(900);
    });

    const restored = page.locator('#unmask-output');
    const expectedFragments = ['株式会社みらいサンプル', '山田太郎 様', 'sato@example.com', '03-1234-5678'];
    const restoredValue = await restored.inputValue();
    for (const fragment of expectedFragments) if (!restoredValue.includes(fragment)) throw new Error(`Restored output is missing: ${fragment}`);
    await withCaption(page, CAPTIONS.restoredResult, async () => {
      await restored.scrollIntoViewIfNeeded();
      await moveCursor(page, restored);
      await wait(1500);
    });
    const summary = page.locator('#panel-unmask').getByText('正常復元', { exact: false }).first();
    await summary.scrollIntoViewIfNeeded();
    const panelText = await page.locator('#panel-unmask').innerText();
    if (!panelText.includes('4 件') || !panelText.includes('0 件')) throw new Error('Restore summary is not 4 restored / 0 unrestored');
    await withCaption(page, CAPTIONS.summary, async () => {
      await moveCursor(page, summary);
      await wait(1500);
    });

    await page.evaluate((lines) => {
      const existing = document.querySelector('#demo-closing');
      if (existing) existing.remove();
      const card = document.createElement('div');
      card.id = 'demo-closing';
      card.innerHTML = `<div>${lines[0]}</div><div style="font-size:23px;color:#cbd5e1;margin-top:14px">${lines[1]}</div><div style="font-size:25px;color:#34d399;margin-top:24px">${lines[2]}</div>`;
      Object.assign(card.style, { position: 'fixed', inset: '0', zIndex: '2147483645', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(7,18,29,.97)', color: '#fff', textAlign: 'center', fontFamily: '"Noto Sans JP Demo"', fontWeight: '800', fontSize: '36px', lineHeight: '1.35', opacity: '0', transition: 'opacity .5s' });
      document.body.append(card);
      requestAnimationFrame(() => { card.style.opacity = '1'; });
    }, CAPTIONS.closing);
    await wait(4700);

    const video = page.video();
    await context.close();
    const webm = await video.path();
    await browser.close();
    browser = undefined;
    await run(ffmpegPath, ['-y', '-i', webm, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output]);
    const info = await stat(output);
    if (info.size < 100_000) throw new Error(`Generated MP4 is unexpectedly small: ${info.size} bytes`);
    console.log(`\nCreated ${path.relative(root, output)} (${(info.size / 1024 / 1024).toFixed(1)} MiB)`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server.exitCode == null) {
      server.kill('SIGTERM');
      await Promise.race([once(server, 'exit'), wait(3000)]).catch(() => {});
      if (server.exitCode == null) server.kill('SIGKILL');
    }
    await rm(temporary, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
