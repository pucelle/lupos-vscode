import {fileURLToPath} from 'node:url'
import {defineConfig} from 'vitest/config'


export default defineConfig({
	resolve: {
		alias: {
			vscode: fileURLToPath(new URL('./tests/client/vscode-mock.ts', import.meta.url)),
		},
	},
	test: {
		clearMocks: true,
		coverage: {
			include: ['src/**/*.ts', 'packages/lupos-server/src/**/*.ts'],
		},
		include: ['tests/**/*.test.ts'],
	},
})
