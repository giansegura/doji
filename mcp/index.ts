import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import packageJson from '../package.json' with { type: 'json' }
import { newId } from '../src/domain/newId'
import { createDojiApi } from './dojiApi'
import { createDojiServer } from './tools'

const DEFAULT_URL = 'http://127.0.0.1:4780'

const server = createDojiServer({
  api: createDojiApi({ baseUrl: process.env.DOJI_URL ?? DEFAULT_URL }),
  newId,
  version: packageJson.version,
})

await server.connect(new StdioServerTransport())
