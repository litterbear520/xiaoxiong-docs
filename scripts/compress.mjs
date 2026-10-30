// Writes .br and .gz next to each text file in the build so the web server can
// serve them precompressed instead of compressing on every request.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

const TEXT = /\.(html|js|mjs|css|svg|json|txt|md|xml)$/

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name)
    if (statSync(file).isDirectory()) {
      walk(file)
    } else if (TEXT.test(name)) {
      const data = readFileSync(file)
      writeFileSync(`${file}.gz`, gzipSync(data, { level: 9 }))
      writeFileSync(`${file}.br`, brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }))
    }
  }
}

walk(process.argv[2] ?? 'dist')
