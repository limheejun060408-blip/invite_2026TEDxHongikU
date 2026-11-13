// 내빈별 개인 초대장 생성기
//
// 사용법: 이 폴더에서  node generate.js
//
// - 최상위 index.html이 디자인 원본입니다. 디자인·문구를 고치려면 index.html을 고친 뒤 다시 실행하세요.
// - guests.csv(slug,이름)를 읽어 내빈마다 <slug>/index.html을 만듭니다.
// - 호칭은 모두 "님"으로 통일하고, 이름은 3글자까지만 받습니다(성이 없으면 두 글자 이름).
//   그래야 편지 윗면 "TO." 줄이 한 줄에 들어갑니다.
// - 내빈별로 바뀌는 곳: 편지 윗면 "TO. 이름 님", <title>, meta description,
//   og:title, og:description, og:url. 나머지는 index.html과 똑같습니다.
// - 최상위 index.html은 "TO. 귀빈 여러분"으로 맞춥니다.
// - 설치할 것 없음 (Node.js 기본 기능만 사용)
'use strict';
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://limheejun060408-blip.github.io/invite_2026TEDxHongikU/';
const ROOT_ADDRESSEE = '귀빈 여러분';
const HONORIFIC = '님';
const MAX_NAME_LENGTH = 3;

const DIR = __dirname;
const MASTER = path.join(DIR, 'index.html');
const CSV = path.join(DIR, 'guests.csv');

function fail(msg) {
  console.error('오류: ' + msg);
  process.exit(1);
}

function readUtf8(file) {
  const buf = fs.readFileSync(file);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
  } catch {
    fail(`${path.basename(file)} 파일이 UTF-8이 아닙니다. 엑셀에서 저장했다면 "CSV UTF-8(쉼표로 분리)" 형식으로 다시 저장하세요.`);
  }
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 정확히 한 군데만 찾아 바꿈. 원본 구조가 바뀌어 못 찾으면 멈춤
function replaceOnce(html, re, replacement, label) {
  const n = (html.match(new RegExp(re.source, 'g')) || []).length;
  if (n !== 1) fail(`index.html에서 ${label}을(를) 정확히 한 곳에서 찾지 못했습니다 (찾은 수: ${n}).`);
  return html.replace(re, replacement);
}

// ---- 원본 읽기 ----
const master = readUtf8(MASTER);
const NL = master.includes('\r\n') ? '\r\n' : '\n';

// 설명 문구의 "받는 분, " 뒤 부분(날짜·행사 안내)은 원본에서 그대로 가져옴
const descMatch = master.match(/<meta name="description" content="([^"]*)">/);
if (!descMatch) fail('index.html에서 meta description을 찾지 못했습니다.');
const commaAt = descMatch[1].indexOf(', ');
if (commaAt < 0) fail('meta description이 "받는 분, 안내 문구" 형식이 아닙니다.');
const descRest = descMatch[1].slice(commaAt + 2);

const OG_URL_RE = /<meta property="og:url" content="[^"]*">/;
const OG_DESC_RE = /<meta property="og:description" content="[^"]*">/;

function render(html, { addressee, url, title }) {
  const a = esc(addressee);
  const desc = `${a}, ${descRest}`;
  html = replaceOnce(html, /<span class="to-name">[^<]*<\/span>/, `<span class="to-name">${a}</span>`, '"TO." 받는 분 이름');
  html = replaceOnce(html, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${desc}">`, 'meta description');
  html = replaceOnce(html, OG_DESC_RE, `<meta property="og:description" content="${desc}">`, 'og:description');
  if (title) {
    const t = esc(title);
    html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${t}</title>`, '<title>');
    html = replaceOnce(html, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${t}">`, 'og:title');
  }
  const ogUrl = `<meta property="og:url" content="${esc(url)}">`;
  if (OG_URL_RE.test(html)) {
    html = replaceOnce(html, OG_URL_RE, ogUrl, 'og:url');
  } else {
    html = html.replace(OG_DESC_RE, m => m + NL + ogUrl);
  }
  return html;
}

// ---- 명단 읽기 ----
const guests = [];
const seen = new Set();
readUtf8(CSV).split(/\r?\n/).forEach((line, i) => {
  const lineNo = i + 1;
  if (!line.trim() || line.trim().startsWith('#')) return;
  const cells = line.split(',').map(c => c.trim().replace(/^"(.*)"$/, '$1').trim());
  if (cells[0].toLowerCase() === 'slug') return; // 머리글
  const [slug, name] = cells;
  if (cells.length > 2) fail(`guests.csv ${lineNo}번째 줄: 칸은 "slug,이름" 두 개만 씁니다 (호칭은 모두 "님"으로 자동으로 붙습니다).`);
  if (!name) fail(`guests.csv ${lineNo}번째 줄: 이름이 비어 있습니다.`);
  if (/\s/.test(name) || [...name].length > MAX_NAME_LENGTH) {
    fail(`guests.csv ${lineNo}번째 줄: 이름 "${name}"은(는) 띄어쓰기 없이 ${MAX_NAME_LENGTH}글자까지만 쓸 수 있습니다 (성이 없으면 두 글자 이름만).`);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug || '')) {
    fail(`guests.csv ${lineNo}번째 줄: slug "${slug}"는 영문 소문자·숫자·하이픈(-)만 쓸 수 있습니다.`);
  }
  if (seen.has(slug)) fail(`guests.csv ${lineNo}번째 줄: slug "${slug}"가 중복됩니다.`);
  seen.add(slug);
  guests.push({ slug, name });
});
if (!guests.length) fail('guests.csv에 내빈이 한 명도 없습니다.');

// ---- 최상위 초대장 ----
const root = render(master, { addressee: ROOT_ADDRESSEE, url: BASE_URL });
if (root !== master) fs.writeFileSync(MASTER, root, 'utf8');

// ---- 내빈별 초대장 ----
const lines = [];
for (const g of guests) {
  const addressee = `${g.name} ${HONORIFIC}`;
  const url = `${BASE_URL}${g.slug}/`;
  const html = render(root, { addressee, url, title: `${addressee}께 드리는 TEDxHongikU 초대장` });
  fs.mkdirSync(path.join(DIR, g.slug), { recursive: true });
  fs.writeFileSync(path.join(DIR, g.slug, 'index.html'), html, 'utf8');
  lines.push(`${addressee} – ${url}`);
}

console.log(`초대장 ${guests.length}개를 만들었습니다.\n`);
console.log(lines.join('\n'));

// 명단에서 빠진 내빈 폴더는 지우지 않고 알려만 줌
const stale = fs.readdirSync(DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('.') && !seen.has(d.name))
  .filter(d => fs.existsSync(path.join(DIR, d.name, 'index.html')))
  .map(d => d.name);
if (stale.length) {
  console.log(`\n주의: 명단에 없는 초대장 폴더가 남아 있습니다. 필요 없으면 직접 지우세요: ${stale.join(', ')}`);
}
