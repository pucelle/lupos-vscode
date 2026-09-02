import ts from 'typescript'
import {describe, expect, it} from 'vitest'
import pluginFactory from '../../packages/lupos-server/src/index'

describe('server plugin decoration', () => {
	it('decorates a language service only once across plugin instances', () => {
		let syntacticCalls = 0
		let rawService = {
			getProgram: () => undefined,
			getSyntacticDiagnostics: () => {
				syntacticCalls++
				return []
			},
		} as unknown as ts.LanguageService
		let info = {
			languageService: rawService,
			project: {projectService: {logger: {info() {}}}},
		} as ts.server.PluginCreateInfo

		let first = pluginFactory({typescript: ts}).create(info)
		let second = pluginFactory({typescript: ts}).create(info)
		second.getSyntacticDiagnostics('C:/missing.ts')

		expect(second).toBe(first)
		expect(syntacticCalls).toBe(1)
	})
})
