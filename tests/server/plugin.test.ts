import ts from 'typescript'
import {describe, expect, it} from 'vitest'
import pluginFactory from '../../packages/lupos-server/src/index'

describe('server plugin decoration', () => {
	it('decorates a language service only once across plugin instances', () => {
		let syntacticCalls = 0
		let fileName = 'C:/project/main.ts'
		let host: ts.LanguageServiceHost = {
			getCompilationSettings: () => ({}),
			getCurrentDirectory: () => 'C:/project',
			getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
			getScriptFileNames: () => [fileName],
			getScriptSnapshot: name => name === fileName ? ts.ScriptSnapshot.fromString('export {}') : undefined,
			getScriptVersion: () => '0',
			fileExists: name => name === fileName || ts.sys.fileExists(name),
			readFile: name => name === fileName ? 'export {}' : ts.sys.readFile(name),
			readDirectory: ts.sys.readDirectory,
		}
		let rawService = ts.createLanguageService(host)
		let getSyntacticDiagnostics = rawService.getSyntacticDiagnostics.bind(rawService)

		rawService.getSyntacticDiagnostics = name => {
			syntacticCalls++
			return getSyntacticDiagnostics(name)
		}

		let info = {
			languageService: rawService,
			languageServiceHost: host,
			serverHost: ts.sys,
			project: {projectService: {logger: {info() {}}}},
		} as ts.server.PluginCreateInfo

		let first = pluginFactory({typescript: ts}).create(info)
		let second = pluginFactory({typescript: ts}).create(info)
		second.getSyntacticDiagnostics(fileName)

		expect(second).toBe(first)
		expect(syntacticCalls).toBe(1)
	})
})
