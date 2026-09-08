import {describe, expect, it, vi} from 'vitest'
import ts from 'typescript'
import {MirrorService} from '../../packages/lupos-server/src/mirror-service'
import {isMirrorableSourceFile} from '../../packages/lupos-server/src/mirror-service/mirror-language-service'
import {createTestLanguageService, diagnosticMessages} from './language-service'


/** Find diagnostics containing a stable portion of their flattened message. */
function findDiagnostic(diagnostics: readonly ts.Diagnostic[], message: string) {
	return diagnostics.find(diagnostic => {
		return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n').includes(message)
	})
}


describe('server mirror language service', {timeout: 15_000}, () => {
	it('only mirrors application source files', () => {
		let applicationSource = ts.createSourceFile('C:/project/main.ts', '', ts.ScriptTarget.ESNext)
		let declarationSource = ts.createSourceFile('C:/project/types.d.ts', '', ts.ScriptTarget.ESNext)
		let defaultLibrarySource = ts.createSourceFile('C:/typescript/lib/lib.esnext.d.ts', '', ts.ScriptTarget.ESNext)
		let externalSource = ts.createSourceFile('C:/project/node_modules/example/index.js', '', ts.ScriptTarget.ESNext)
		let program = {
			isSourceFileDefaultLibrary(sourceFile: ts.SourceFile) {
				return sourceFile === defaultLibrarySource
			},
			isSourceFileFromExternalLibrary(sourceFile: ts.SourceFile) {
				return sourceFile === externalSource
			},
		} as ts.Program

		expect(isMirrorableSourceFile(program, applicationSource)).toBe(true)
		expect(isMirrorableSourceFile(program, declarationSource)).toBe(false)
		expect(isMirrorableSourceFile(program, defaultLibrarySource)).toBe(false)
		expect(isMirrorableSourceFile(program, externalSource)).toBe(false)
	})

	it('does not start mirror completion for template markup', () => {
		let source = `import {html, Component} from 'lupos.html'
			class Card extends Component {}
			const view = html\`<Ca>\``
		let mirrorCompletion = vi.spyOn(MirrorService.prototype, 'getCompletionsAtPosition')

		let {service, fileName} = createTestLanguageService(source)
		let position = source.indexOf('<Ca>') + 3
		let completion = service.getCompletionsAtPosition(fileName, position, {})

		expect(completion?.entries.map(entry => entry.name)).toContain('Card')
		expect(mirrorCompletion).not.toHaveBeenCalled()

		mirrorCompletion.mockRestore()
	})

	it('builds a mirror program with the internal tsserver project hook', () => {
		let source = `import {html, Component} from 'lupos.html'
			class Card extends Component { count = 0 }
			const view = html\`<Card .count=\${"wrong"} />\``

		let harness = createTestLanguageService(source)
		harness.service.getProgram()

		Object.assign(harness.host, {
			updateFromProject() {},
		})

		let position = source.indexOf('.count') + 3
		let messages = diagnosticMessages(harness.service.getSemanticDiagnostics(harness.fileName))

		expect(messages.some(message => message.includes("Type 'string' is not assignable to type 'number'")))
			.toBe(true)
		expect(harness.service.getQuickInfoAtPosition(harness.fileName, position)).toBeDefined()
	})

	it('reports and maps component property assignment diagnostics', () => {
		let source = `import {html, Component} from 'lupos.html'
			class Card extends Component { count = 0 }
			const view = html\`<Card .count=\${"wrong"} />\``
			
		let {service, fileName} = createTestLanguageService(source)
		let diagnostics = service.getSemanticDiagnostics(fileName)
		let diagnostic = findDiagnostic(diagnostics, "Type 'string' is not assignable to type 'number'")

		expect(diagnostic).toBeDefined()
		expect(diagnostic?.file?.fileName).toBe(fileName)
		expect(diagnostic?.start).toBeGreaterThanOrEqual(source.indexOf('.count'))
		expect(diagnostic?.start).toBeLessThan(source.indexOf(' />'))
	})

	it('reports binding update argument diagnostics', () => {
		let source = `import {html, Binding} from 'lupos.html'
			class Show implements Binding { update(visible: boolean) {} }
			const view = html\`<div :Show=\${"wrong"} />\``

		let {service, fileName} = createTestLanguageService(source)
		let messages = diagnosticMessages(service.getSemanticDiagnostics(fileName))

		expect(messages.some(message => message.includes("string") && message.includes("boolean")), messages.join('\n'))
			.toBe(true)
	})

	it('reports component event handler diagnostics', () => {
		let source = `import {html, Component} from 'lupos.html'
			class Card extends Component<{save: number}> {}
			const view = html\`<Card @save=\${(event: string) => event} />\``

		let {service, fileName} = createTestLanguageService(source)
		let messages = diagnosticMessages(service.getSemanticDiagnostics(fileName))

		expect(messages.some(message => message.includes('(event: string)') && message.includes('EventHandlerMixed')), messages.join('\n'))
			.toBe(true)
	})

	it('uses mirror contextual typing for interpolation completion', () => {
		let source = `import {html, Component} from 'lupos.html'
			class Card extends Component { options!: {label: string, value: number} }
			const view = html\`<Card .options=\${{la: ''}} />\``

		let {service, fileName} = createTestLanguageService(source)
		let position = source.indexOf('la:') + 2
		let completion = service.getCompletionsAtPosition(fileName, position, {})

		expect(completion?.entries.map(entry => entry.name)).toContain('label')
	})

	it('returns details for mirror contextual completions', () => {
		let source = `import {html, Component} from 'lupos.html'
			class Card extends Component { options!: {label: string, value: number} }
			const view = html\`<Card .options=\${{la: ''}} />\``

		let {service, fileName} = createTestLanguageService(source)
		let position = source.indexOf('la:') + 2
		let completion = service.getCompletionsAtPosition(fileName, position, {})
		let entry = completion?.entries.find(entry => entry.name === 'label')

		let details = entry && service.getCompletionEntryDetails(
			fileName,
			position,
			entry.name,
			{},
			entry.source,
			{},
			entry.data
		)

		expect(details?.name).toBe('label')
		expect(details?.displayParts?.map(part => part.text).join('')).toContain('label')
	})

	it('returns mirror quick info and both definition APIs for a property', () => {
		let source = `import {html, Component} from 'lupos.html'
			class Card extends Component { count = 0 }
			const view = html\`<Card .count=\${1} />\``

		let {service, fileName} = createTestLanguageService(source)
		let position = source.indexOf('.count') + 3
		let declaration = source.indexOf('count = 0')
		let quickInfo = service.getQuickInfoAtPosition(fileName, position)
		let definitions = service.getDefinitionAtPosition(fileName, position)
		let definitionAndSpan = service.getDefinitionAndBoundSpan(fileName, position)

		expect(quickInfo?.textSpan).toEqual({start: source.indexOf('.count') + 1, length: 5})
		expect(definitions?.map(definition => definition.textSpan.start)).toContain(declaration)
		expect(definitionAndSpan?.definitions?.map(definition => definition.textSpan.start)).toContain(declaration)
	})

	it('refreshes mirror diagnostics after an equal-length edit', () => {
		let source = `import {html, Component} from 'lupos.html'
			class Card extends Component { count = 0 }
			const view = html\`<Card .count=\${"wrong"} />\``

		let harness = createTestLanguageService(source)

		expect(diagnosticMessages(harness.service.getSemanticDiagnostics(harness.fileName))
			.some(message => message.includes("Type 'string' is not assignable to type 'number'"))).toBe(true)

		harness.update(source.replace('"wrong"', '1234567'))

		expect(diagnosticMessages(harness.service.getSemanticDiagnostics(harness.fileName))
			.some(message => message.includes("Type 'string' is not assignable to type 'number'"))).toBe(false)
	})

	it('keeps an ordinary TypeScript diagnostic exactly once in mirrored files', () => {
		let source = `import {html, Component} from 'lupos.html'
			class Card extends Component { count = 0 }
			const native: number = "wrong"
			const view = html\`<Card .count=\${1} />\``

		let {service, fileName} = createTestLanguageService(source)
		let diagnostics = service.getSemanticDiagnostics(fileName)

		let nativeDiagnostics = diagnostics.filter(diagnostic => {
			return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
				.includes("Type 'string' is not assignable to type 'number'")
		})

		expect(nativeDiagnostics).toHaveLength(1)
		expect(ts.flattenDiagnosticMessageText(nativeDiagnostics[0].messageText, '\n'))
			.toContain("Type 'string' is not assignable to type 'number'")
	})

	it('maps safe TypeScript code fixes from generated property checks', () => {
		let source = `import {html, Component} from 'lupos.html'
			class Card extends Component { count = 0 }
			const view = html\`<Card ..cout=\${1} />\``

		let {service, fileName} = createTestLanguageService(source)
		let diagnostics = service.getSemanticDiagnostics(fileName)

		let diagnostic = diagnostics.find(diagnostic => {
			return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n').includes("Property 'cout'")
		})

		expect(diagnostic).toBeDefined()

		let fixes = service.getCodeFixesAtPosition(
			fileName,
			diagnostic!.start!,
			diagnostic!.start! + diagnostic!.length!,
			[diagnostic!.code],
			{},
			{}
		)

		let changes = fixes.flatMap(fix => fix.changes)
			.flatMap(change => change.textChanges)

		expect(changes).toContainEqual({
			span: {start: source.indexOf('cout'), length: 4},
			newText: 'count',
		})
	})
})
