import satori from 'satori'
import sharp from 'sharp'
import { writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function fetchFont(family: string, weight: number): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } },
  ).then((r) => r.text())
  const match = css.match(/src: url\((.+?\.(?:ttf|otf))\) format\('truetype'\)/)
  if (!match) throw new Error(`font URL not found for ${family}`)
  return fetch(match[1]).then((r) => r.arrayBuffer())
}

function token(text: string, color: string) {
  return { type: 'span', key: null, props: { style: { color, whiteSpace: 'pre' }, children: text } }
}

function codeLine(tokens: Array<{ type: string; key: null; props: object }>, indent = false) {
  return {
    type: 'div',
    key: null,
    props: {
      style: {
        display: 'flex',
        height: 36,
        alignItems: 'center',
        paddingLeft: indent ? 22 : 0,
        fontFamily: '"JetBrains Mono"',
        fontSize: 17,
      },
      children: tokens,
    },
  }
}

function badge(label: string, color: string, width: number) {
  return {
    type: 'div',
    key: null,
    props: {
      style: {
        width,
        height: 34,
        borderRadius: 17,
        background: '#1A2840',
        border: `1.5px solid ${color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Inter"',
        fontSize: 15,
        color,
      },
      children: label,
    },
  }
}

async function main() {
  const [monoFont, sansFont] = await Promise.all([
    fetchFont('JetBrains+Mono', 700),
    fetchFont('Inter', 400),
  ])

  const logoBase64 = readFileSync(join(__dirname, '../public/images/nanoka-logo.png')).toString('base64')

  const svg = await satori(
    {
      type: 'div',
      key: null,
      props: {
        style: {
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(135deg, #141C2E 0%, #1E2A3D 100%)',
          display: 'flex',
          position: 'relative',
        },
        children: [
          // Accent bar
          {
            type: 'div',
            key: 'accent',
            props: {
              style: {
                position: 'absolute',
                left: 80,
                top: 80,
                width: 6,
                height: 80,
                borderRadius: 3,
                background: 'linear-gradient(180deg, #E8614A 0%, #3CBFB8 100%)',
              },
            },
          },
          // Title + subtitle
          {
            type: 'div',
            key: 'title',
            props: {
              style: {
                position: 'absolute',
                left: 110,
                top: 75,
                display: 'flex',
                flexDirection: 'column',
              },
              children: [
                {
                  type: 'span',
                  key: 'name',
                  props: {
                    style: {
                      fontFamily: '"JetBrains Mono"',
                      fontSize: 68,
                      fontWeight: 700,
                      color: '#F0F4F8',
                      lineHeight: 1.1,
                    },
                    children: 'nanoka',
                  },
                },
                {
                  type: 'span',
                  key: 'sub',
                  props: {
                    style: {
                      fontFamily: '"Inter"',
                      fontSize: 24,
                      color: '#6B7FA0',
                      marginTop: 16,
                    },
                    children: 'One definition → Schema · Types · API',
                  },
                },
              ],
            },
          },
          // Logo
          {
            type: 'div',
            key: 'logo',
            props: {
              style: {
                position: 'absolute',
                right: 18,
                top: 16,
                width: 110,
                height: 110,
                borderRadius: 16,
                background: 'white',
                overflow: 'hidden',
                display: 'flex',
              },
              children: {
                type: 'img',
                key: null,
                props: { src: `data:image/png;base64,${logoBase64}`, width: 110, height: 110 },
              },
            },
          },
          // Code window
          {
            type: 'div',
            key: 'code-window',
            props: {
              style: {
                position: 'absolute',
                left: 80,
                top: 216,
                width: 820,
                height: 282,
                borderRadius: 14,
                background: '#0C1524',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              },
              children: [
                // Header bar with traffic lights
                {
                  type: 'div',
                  key: 'header',
                  props: {
                    style: {
                      width: '100%',
                      height: 46,
                      background: '#111D30',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 20,
                      gap: 10,
                      flexShrink: 0,
                    },
                    children: [
                      { type: 'div', key: 'r', props: { style: { width: 14, height: 14, borderRadius: 7, background: '#FF5F57' } } },
                      { type: 'div', key: 'y', props: { style: { width: 14, height: 14, borderRadius: 7, background: '#FFBD2E' } } },
                      { type: 'div', key: 'g', props: { style: { width: 14, height: 14, borderRadius: 7, background: '#28CA41' } } },
                    ],
                  },
                },
                // Code lines
                {
                  type: 'div',
                  key: 'code',
                  props: {
                    style: {
                      paddingLeft: 28,
                      paddingTop: 10,
                      display: 'flex',
                      flexDirection: 'column',
                    },
                    children: [
                      codeLine([
                        token('const ', '#E8614A'),
                        token('User', '#3CBFB8'),
                        token(' = nanoka.model(', '#E2EAF4'),
                        token("'users'", '#F0C060'),
                        token(', {', '#E2EAF4'),
                      ]),
                      codeLine([
                        token('id', '#3CBFB8'),
                        token(':    ', '#E2EAF4'),
                        token('t.id()', '#C8A8E8'),
                        token(',', '#E2EAF4'),
                      ], true),
                      codeLine([
                        token('email', '#3CBFB8'),
                        token(': ', '#E2EAF4'),
                        token('t.text().unique()', '#C8A8E8'),
                        token(',', '#E2EAF4'),
                      ], true),
                      codeLine([
                        token('name', '#3CBFB8'),
                        token(':  ', '#E2EAF4'),
                        token('t.text()', '#C8A8E8'),
                        token(',', '#E2EAF4'),
                      ], true),
                      codeLine([token('}', '#E2EAF4')]),
                      codeLine([token('// → DB schema + TypeScript types + Zod validator', '#4A617E')]),
                    ],
                  },
                },
              ],
            },
          },
          // Tech stack badges
          {
            type: 'div',
            key: 'badges',
            props: {
              style: {
                position: 'absolute',
                left: 110,
                top: 522,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
              },
              children: [
                badge('Hono', '#E8614A', 110),
                badge('Drizzle ORM', '#3CBFB8', 138),
                badge('Zod', '#E8614A', 100),
                badge('Cloudflare Workers', '#3CBFB8', 196),
              ],
            },
          },
          // GitHub URL
          {
            type: 'div',
            key: 'github',
            props: {
              style: {
                position: 'absolute',
                right: 90,
                bottom: 38,
                fontFamily: '"JetBrains Mono"',
                fontSize: 16,
                color: '#3A4F68',
              },
              children: 'github.com/nanokajs/nanoka',
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'JetBrains Mono', data: monoFont, weight: 700, style: 'normal' },
        { name: 'Inter', data: sansFont, weight: 400, style: 'normal' },
      ],
    },
  )

  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  writeFileSync(join(__dirname, '../public/og-image.png'), png)
  console.log('Generated site/public/og-image.png')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
